import { Module } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [QueueModule, PrismaModule, AccessModule],
  providers: [JobSchedulerService],
  exports: [JobSchedulerService],
})
export class JobSchedulerModule {}
