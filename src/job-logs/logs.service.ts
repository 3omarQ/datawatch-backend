import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobAccessService } from '../access/job-access.service';

@Injectable()
export class LogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobAccess: JobAccessService,
  ) {}

  async findByExecution(executionId: string, userId: string) {
    await this.jobAccess.verifyExecutionOwnership(executionId, userId);

    return this.prisma.log.findMany({
      where: { executionId },
      orderBy: { date: 'asc' },
    });
  }

  async findByJob(jobId: string, userId: string) {
    await this.jobAccess.verifyJobOwnership(jobId, userId);

    return this.prisma.log.findMany({
      where: { execution: { jobId } },
      orderBy: { date: 'asc' },
    });
  }
}
