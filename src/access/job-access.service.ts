import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyJobOwnership(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: { include: { targetUrl: true } } },
    });

    if (!job || job.datapoint.targetUrl.userId !== userId) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async verifyExecutionOwnership(executionId: string, userId: string) {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        job: { include: { datapoint: { include: { targetUrl: true } } } },
      },
    });

    if (!execution || execution.job.datapoint.targetUrl.userId !== userId) {
      throw new NotFoundException('Execution not found');
    }

    return execution;
  }

  async verifyJobExecutionOwnership(
    jobId: string,
    executionId: string,
    userId: string,
  ) {
    const execution = await this.prisma.jobExecution.findFirst({
      where: { id: executionId, jobId },
      include: {
        job: { include: { datapoint: { include: { targetUrl: true } } } },
      },
    });

    if (!execution || execution.job.datapoint.targetUrl.userId !== userId) {
      throw new NotFoundException('Execution not found');
    }

    return execution;
  }

  async getJobOwnerId(jobId: string): Promise<string> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: { include: { targetUrl: true } } },
    });

    if (!job) throw new NotFoundException(`Job ${jobId} not found.`);
    return job.datapoint.targetUrl.userId;
  }

  async getExecutionOwnerId(executionId: string): Promise<string> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        job: { include: { datapoint: { include: { targetUrl: true } } } },
      },
    });

    if (!execution) throw new NotFoundException(`Execution ${executionId} not found.`);
    return execution.job.datapoint.targetUrl.userId;
  }
}
