import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './gateways/notifications.gateway';
import { WebhookChannel } from './channels/webhook.channel';
import { PrismaModule } from '../prisma/prisma.module';
import jwtConfig from '../config/jwt.config';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync(jwtConfig.asProvider()),
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, WebhookChannel],
  exports: [NotificationsService],
})
export class NotificationsModule {}