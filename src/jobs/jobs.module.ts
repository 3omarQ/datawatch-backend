import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DatapointsModule } from '../datapoints/datapoints.module';
import { JobSchedulerModule } from './job-scheduler.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [PrismaModule, DatapointsModule, JobSchedulerModule, AccessModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsModule {}
