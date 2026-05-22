import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { toAuthUser } from './auth-user';
import { clearAuthCookie, setAuthCookie } from './auth-cookie';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { OAuthDto } from './dto/oauth.dto';
import type { User } from '../generated/prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(user);
    setAuthCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto);
    setAuthCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationCode(email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  async oauthLogin(
    @Body() dto: OAuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.oauthLogin(dto);
    setAuthCookie(res, result.accessToken);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return { message: 'Logged out successfully.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: User) {
    return toAuthUser(user);
  }
}
