import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OAuthDto } from './dto/oauth.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import type { User } from '../generated/prisma/client';
import { Provider } from '../generated/prisma/enums';
import { toAuthUser } from './auth-user';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Token Generation ────────────────────────────────────
  private generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    };
    return this.jwtService.sign(payload);
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ─── Validate User (Local Strategy) ─────────────────────
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) return null;

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) return null;

    return user;
  }

  // ─── Login ───────────────────────────────────────────────
  async login(user: User) {
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email first');
    }

    return {
      user: toAuthUser(user),
      accessToken: this.generateAccessToken(user),
    };
  }

  // ─── Register ────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        provider: Provider.LOCAL,
      },
    });

    await this.sendVerificationCode(user);

    return {
      message: 'Registration successful! Please verify your email.',
      email: user.email,
    };
  }

  // ─── Send Verification Code ───────────────────────────────
  private async sendVerificationCode(user: User) {
    // Delete existing codes
    await this.prisma.verificationCode.deleteMany({
      where: { userId: user.id },
    });

    const code = this.generateVerificationCode();

    await this.prisma.verificationCode.create({
      data: {
        code,
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    await this.emailService.sendVerificationCode(user.email, code, user.name);
  }

  // ─── Verify Email ────────────────────────────────────────
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new NotFoundException('User not found');

    const verificationCode = await this.prisma.verificationCode.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationCode) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await this.prisma.verificationCode.deleteMany({
      where: { userId: user.id },
    });

    return {
      user: toAuthUser({ ...user, emailVerified: true }),
      accessToken: this.generateAccessToken({ ...user, emailVerified: true }),
    };
  }

  // ─── Resend Verification Code ─────────────────────────────
  async resendVerificationCode(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) throw new NotFoundException('User not found');

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.sendVerificationCode(user);

    return { message: 'Verification code sent!' };
  }

  // ─── Forgot Password ─────────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return success to prevent email enumeration attacks
    if (!user || user.provider !== Provider.LOCAL) {
      return {
        message: 'If your email exists, you will receive a reset link.',
      };
    }

    // Delete existing tokens
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    const token = this.generateResetToken();

    await this.prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await this.emailService.sendPasswordResetEmail(
      user.email,
      token,
      user.name,
    );

    return { message: 'If your email exists, you will receive a reset link.' };
  }

  // ─── Reset Password ───────────────────────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    const passwordReset = await this.prisma.passwordReset.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (
      !passwordReset ||
      passwordReset.used ||
      passwordReset.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: passwordReset.userId },
      data: { password: hashedPassword },
    });

    await this.prisma.passwordReset.update({
      where: { id: passwordReset.id },
      data: { used: true },
    });

    return { message: 'Password reset successfully!' };
  }

  // ─── OAuth Login/Register ─────────────────────────────────
  async oauthLogin(dto: OAuthDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name ?? dto.email,
          image: dto.image,
          provider: dto.provider.toUpperCase() as Provider,
          providerAccountId: dto.providerAccountId,
          emailVerified: true,
        },
      });
    }

    return {
      user: toAuthUser(user),
      accessToken: this.generateAccessToken(user),
    };
  }
}
