import { Module } from '@nestjs/common';
import { JobExecutionsService } from './job-executions.service';
import { JobExecutionsController } from './job-executions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobSchedulerModule } from '../jobs/job-scheduler.module';

@Module({
  imports: [PrismaModule, JobSchedulerModule],
  controllers: [JobExecutionsController],
  providers: [JobExecutionsService],
  exports: [JobExecutionsService],
})
export class JobExecutionsModule {}
