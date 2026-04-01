import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionStatus } from '../generated/prisma/enums';
import { EXECUTION_DONE, EXECUTION_FAILED, EXECUTION_DIFF } from '../events/event-names';
import { ExecutionDoneEvent, ExecutionFailedEvent, ExecutionDiffEvent } from 'src/events/executions.events';

const EXECUTION_DONE_LOG = (length: number) =>
  `Scrape completed successfully. Extracted ${length} characters.`;

const MIN_EXECUTIONS_FOR_DIFF = 2;

@Injectable()
export class JobExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findOne(jobId: string, executionId: string, userId: string) {
    await this.verifyOwnership(jobId, userId);
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        results: { orderBy: { date: 'desc' } },
        logs: { orderBy: { date: 'asc' } },
        _count: { select: { logs: true, results: true } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async initExecution(jobId: string, executionId?: string) {
    if (executionId) return this.markRunning(executionId);

    return this.prisma.jobExecution.create({
      data: { jobId, status: ExecutionStatus.RUNNING, startedAt: new Date() },
    });
  }

  async fetchJobTarget(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: { include: { targetUrl: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found.`);
    return {
      url: job.datapoint.targetUrl.url,
      path: job.datapoint.path,
      extractorType: job.extractorType,
      outputFormat: job.outputFormat,

    };
  }

  async completeExecution(executionId: string, jobId: string, result: string) {
    await this.saveResult(executionId, result);
    await this.saveLog(executionId, 'INFO', EXECUTION_DONE_LOG(result.length));
    await this.markDone(executionId);

    const userId = await this.fetchUserId(jobId);
    await this.detectAndEmitDiff(jobId, executionId, userId);
    this.eventEmitter.emit(EXECUTION_DONE, new ExecutionDoneEvent(jobId, executionId, userId));
  }

  async failExecution(executionId: string, jobId: string, errorMessage: string) {
    await this.saveLog(executionId, 'ERROR', errorMessage);
    await this.markFailed(executionId);

    const userId = await this.fetchUserId(jobId);
    this.eventEmitter.emit(EXECUTION_FAILED, new ExecutionFailedEvent(jobId, executionId, userId, errorMessage));
  }

  async findByJob(jobId: string, userId: string) {
    await this.verifyOwnership(jobId, userId);
    return this.prisma.jobExecution.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { logs: true, results: true } } },
    });
  }

  async findLatestDone(jobId: string, userId: string) {
    await this.verifyOwnership(jobId, userId);
    return this.prisma.jobExecution.findMany({
      where: { jobId, status: ExecutionStatus.DONE },
      orderBy: { finishedAt: 'desc' },
      take: MIN_EXECUTIONS_FOR_DIFF,
      include: {
        results: { orderBy: { date: 'desc' }, take: 1 },
        _count: { select: { logs: true, results: true } },
      },
    });
  }

  // ─── Diff detection ───────────────────────────────────────────────────────

  private async detectAndEmitDiff(jobId: string, executionId: string, userId: string) {
    const latestTwo = await this.fetchLatestTwoResults(jobId);
    if (latestTwo.length < MIN_EXECUTIONS_FOR_DIFF) return;

    const [latest, previous] = latestTwo;
    const latestText = this.extractText(latest);
    const previousText = this.extractText(previous);

    if (latestText !== previousText) {
      this.eventEmitter.emit(EXECUTION_DIFF, new ExecutionDiffEvent(jobId, executionId, userId));
    }
  }

  private async fetchLatestTwoResults(jobId: string) {
    return this.prisma.jobExecution.findMany({
      where: { jobId, status: ExecutionStatus.DONE },
      orderBy: { finishedAt: 'desc' },
      take: MIN_EXECUTIONS_FOR_DIFF,
      include: { results: { orderBy: { date: 'desc' }, take: 1 } },
    });
  }

  private extractText(execution: { results: { definition: unknown }[] }): string {
    const definition = execution.results[0]?.definition as Record<string, unknown> | undefined;
    return typeof definition?.text === 'string' ? definition.text : '';
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async fetchUserId(jobId: string): Promise<string> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: { include: { targetUrl: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${jobId} not found.`);
    return job.datapoint.targetUrl.userId;
  }

  private async verifyOwnership(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { datapoint: { include: { targetUrl: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.datapoint.targetUrl.userId !== userId) throw new NotFoundException('Job not found');
    return job;
  }

  private async markRunning(executionId: string) {
    return this.prisma.jobExecution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.RUNNING, startedAt: new Date() },
    });
  }

  private async markDone(executionId: string) {
    return this.prisma.jobExecution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.DONE, finishedAt: new Date() },
    });
  }

  private async markFailed(executionId: string) {
    return this.prisma.jobExecution.update({
      where: { id: executionId },
      data: { status: ExecutionStatus.FAILED, finishedAt: new Date() },
    });
  }

  private async saveResult(executionId: string, text: string) {
    return this.prisma.result.create({
      data: { executionId, definition: { text } },
    });
  }

  private async saveLog(executionId: string, level: 'INFO' | 'ERROR', message: string) {
    return this.prisma.log.create({
      data: { executionId, level, message },
    });
  }
}