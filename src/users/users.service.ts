import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, name: string) {
    return this.prisma.user.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, email: true, image: true, notifyByEmail: true },
    });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.findById(id);
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
    return this.prisma.user.update({
      where: { id },
      data: { notifyByEmail },
      select: { id: true, notifyByEmail: true },
    });
  }

  async deleteAccount(id: string) {
    await this.findById(id);
    return this.prisma.user.delete({ where: { id } });
  }
}