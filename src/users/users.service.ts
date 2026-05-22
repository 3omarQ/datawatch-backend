import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_USER_SELECT, toAuthUser } from '../auth/auth-user';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async findRawById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: AUTH_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return toAuthUser(user);
  }

  async updateProfile(id: string, name: string) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { name },
      select: AUTH_USER_SELECT,
    });
    return toAuthUser(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.findRawById(id);
    if (user.provider !== 'LOCAL')
      throw new ForbiddenException('OAuth users cannot change password');
    if (!user.password)
      throw new BadRequestException('No password set');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid)
      throw new BadRequestException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
    });
    return { message: 'Password updated successfully.' };
  }

  async updateNotificationSettings(id: string, notifyByEmail: boolean) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { notifyByEmail },
      select: AUTH_USER_SELECT,
    });
    return toAuthUser(user);
  }

  async deleteAccount(id: string) {
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Account deleted successfully.' };
  }
}
