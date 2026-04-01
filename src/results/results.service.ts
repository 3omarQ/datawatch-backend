import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResultsService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyJobOwnership(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: { include: { targetUrl: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.datapoint.targetUrl.userId !== userId)
      throw new ForbiddenException();
    return job;
  }

  async findByExecution(executionId: string, userId: string) {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        job: { include: { datapoint: { include: { targetUrl: true } } } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    if (execution.job.datapoint.targetUrl.userId !== userId)
      throw new ForbiddenException();

    return this.prisma.result.findMany({
      where: { executionId },
      orderBy: { date: 'desc' },
    });
  }

  async findByJob(jobId: string, userId: string) {
    await this.verifyJobOwnership(jobId, userId);

    return this.prisma.result.findMany({
      where: { execution: { jobId } },
      orderBy: { date: 'desc' },
    });
  }

  async findLatestTwo(jobId: string, userId: string) {
    await this.verifyJobOwnership(jobId, userId);

    return this.prisma.result.findMany({
      where: { execution: { jobId } },
      orderBy: { date: 'desc' },
      take: 2,
    });
  }
}
