import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TargetUrlsModule } from './target-urls/target-urls.module';

import { DatapointsModule } from './datapoints/datapoints.module';
import { UsersModule } from './users/users.module';
import { LogsModule } from './job-logs/logs.module';
import { JobsModule } from './jobs/jobs.module';
import { ResultsModule } from './results/results.module';
import { JobExecutionsModule } from './job-executions/job-executions.module';
import { BullModule } from '@nestjs/bullmq';
import { QueueModule } from './queue/queue.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';
import { PreviewModule } from './preview/preview.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TargetUrlsModule,
    DatapointsModule, 
    JobsModule,
    LogsModule,
    ResultsModule,
    JobExecutionsModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379'),
      },
    }),
    QueueModule,
    EventEmitterModule.forRoot(),
    NotificationsModule,
    PreviewModule,

  ],
  
})
export class AppModule {}
