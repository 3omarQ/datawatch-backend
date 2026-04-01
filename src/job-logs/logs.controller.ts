import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LogsService } from './logs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('jobs/:jobId/logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  findByJob(@Param('jobId') jobId: string, @CurrentUser('id') userId: string) {
    return this.logsService.findByJob(jobId, userId);
  }
}
