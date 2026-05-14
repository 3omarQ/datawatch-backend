import { Module } from '@nestjs/common';
import { JobExecutionsService } from './job-executions.service';
import { JobExecutionsController } from './job-executions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobSchedulerModule } from '../jobs/job-scheduler.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, JobSchedulerModule, NotificationsModule, AccessModule],
  controllers: [JobExecutionsController],
  providers: [JobExecutionsService],
  exports: [JobExecutionsService],
})
export class JobExecutionsModule { }
