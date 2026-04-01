import { Module } from '@nestjs/common';
import { DatapointsController } from './datapoints.controller';
import { DatapointsService } from './datapoints.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TargetUrlsModule } from '../target-urls/target-urls.module';
import { JobSchedulerModule } from 'src/jobs/job-scheduler.module';

@Module({
  imports: [PrismaModule, TargetUrlsModule,JobSchedulerModule],
  controllers: [DatapointsController],
  providers: [DatapointsService],
  exports: [DatapointsService],
})
export class DatapointsModule {}
