import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobAccessService } from '../access/job-access.service';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobAccess: JobAccessService,
  ) {}

  async findByExecution(executionId: string, userId: string) {
    await this.jobAccess.verifyExecutionOwnership(executionId, userId);

    return this.prisma.result.findMany({
      where: { executionId },
      orderBy: { date: 'desc' },
    });
  }

  async findByJob(jobId: string, userId: string) {
    await this.jobAccess.verifyJobOwnership(jobId, userId);

    return this.prisma.result.findMany({
      where: { execution: { jobId } },
      orderBy: { date: 'desc' },
    });
  }

  async findLatestTwo(jobId: string, userId: string) {
    await this.jobAccess.verifyJobOwnership(jobId, userId);

    return this.prisma.result.findMany({
      where: { execution: { jobId } },
      orderBy: { date: 'desc' },
      take: 2,
    });
  }
}
