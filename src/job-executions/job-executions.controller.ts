import { Controller, Post, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JobExecutionsService } from './job-executions.service';
import { JobSchedulerService } from 'src/jobs/job-scheduler.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobExecutionsController {
  constructor(private readonly jobExecutionsService: JobExecutionsService,
    private readonly jobSchedulerService: JobSchedulerService) {}

    @Get(':id/executions/latest')
    findLatest(@Param('id') jobId: string, @Req() req: any) {
      return this.jobExecutionsService.findLatestDone(jobId, req.user.id);
    }
  @Get(':id/executions/:executionId')
  findOne(
    @Param('id') jobId: string,
    @Param('executionId') executionId: string,
    @Req() req: any,
  ) {
    return this.jobExecutionsService.findOne(jobId, executionId, req.user.id);
  }

  @Post(':id/run')
  run(@Param('id') jobId: string, @Req() req: any) {
    return this.jobSchedulerService.enqueueRun(jobId, req.user.id);
  }

  @Get(':id/executions')
  findByJob(@Param('id') jobId: string, @Req() req: any) {
    return this.jobExecutionsService.findByJob(jobId, req.user.id);
  }
}
