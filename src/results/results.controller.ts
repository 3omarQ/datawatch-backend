// results.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('jobs/:jobId/results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  findByJob(@Param('jobId') jobId: string, @CurrentUser('id') userId: string) {
    return this.resultsService.findByJob(jobId, userId);
  }

  @Get('diff')
  getLatestDiff(
    @Param('jobId') jobId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.resultsService.findLatestTwo(jobId, userId);
  }
}
