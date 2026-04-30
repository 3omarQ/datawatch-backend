import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { ExecutionStatus, LogLevel } from '../generated/prisma/enums';
import { EXECUTION_DONE, EXECUTION_FAILED, EXECUTION_DIFF } from '../events/event-names';
import { ExecutionDoneEvent, ExecutionFailedEvent, ExecutionDiffEvent } from 'src/events/executions.events';
import { NotificationsGateway } from 'src/notifications/gateways/notifications.gateway';

const EXECUTION_DONE_LOG = (length: number) =>
  `Scrape completed successfully. Extracted ${length} characters.`;

const MIN_EXECUTIONS_FOR_DIFF = 2;

@Injectable()
export class JobExecutionsService {
  private readonly logger = new Logger(JobExecutionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsGateway: NotificationsGateway,
  ) { }

  async findOne(jobId: string, executionId: string, userId: string) {
    await this.verifyOwnership(jobId, userId);
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        results: { orderBy: { date: 'desc' } },
        logs: { orderBy: { date: 'asc' } },
        job: { select: { outputFormat: true } },
        _count: { select: { logs: true, results: true } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async initExecution(jobId: string, executionId?: string) {
    if (executionId) {
      this.logger.log(`[${jobId}] Re-using execution ${executionId} — marking RUNNING`);
      return this.markRunning(executionId);
    }
    this.logger.log(`[${jobId}] Creating new execution`);
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
    const fieldNames = job.datapoint.fieldNames
      ? JSON.parse(job.datapoint.fieldNames as string)
      : undefined;
    console.log('fieldNames from DB:', fieldNames);
    return {
      url: job.datapoint.targetUrl.url,
      path: job.datapoint.path,
      fieldNames: job.datapoint.fieldNames ? JSON.parse(job.datapoint.fieldNames) : undefined,
      paginationSelector: job.datapoint.paginationSelector ?? undefined,
      maxPages: job.datapoint.maxPages ?? undefined,
      extractorType: job.extractorType,
      outputFormat: job.outputFormat,
    };
  }

  async completeExecution(executionId: string, jobId: string, result: string) {
    await this.saveResult(executionId, result);
    await this.saveLog(executionId, 'INFO', EXECUTION_DONE_LOG(result.length));
    await this.markDone(executionId);
    this.logger.log(`[${jobId}] Execution ${executionId} marked DONE`);

    const userId = await this.fetchUserId(jobId);
    await this.detectAndEmitDiff(jobId, executionId, userId);
    this.eventEmitter.emit(EXECUTION_DONE, new ExecutionDoneEvent(jobId, executionId, userId));
  }

  async failExecution(executionId: string, jobId: string, errorMessage: string) {
    await this.saveLog(executionId, 'ERROR', errorMessage);
    await this.markFailed(executionId);
    this.logger.error(`[${jobId}] Execution ${executionId} marked FAILED — ${errorMessage}`);

    const userId = await this.fetchUserId(jobId);
    this.eventEmitter.emit(EXECUTION_FAILED, new ExecutionFailedEvent(jobId, executionId, userId, errorMessage));
  }

  async findByJob(jobId: string, userId: string) {
    await this.verifyOwnership(jobId, userId);
    return this.prisma.jobExecution.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        logs: {
          take: 1,
          orderBy: { date: 'desc' }
        },
        _count: { select: { logs: true, results: true } }
      },
    });
  }
  private async fetchUserIdByExecutionId(executionId: string): Promise<string> {
    const execution = await this.prisma.jobExecution.findUnique({
      where: { id: executionId },
      include: {
        job: {
          include: { datapoint: { include: { targetUrl: true } } },
        },
      },
    });
    if (!execution) throw new NotFoundException(`Execution ${executionId} not found.`);
    return execution.job.datapoint.targetUrl.userId;
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

  private async saveLog(executionId: string, level: LogLevel, message: string) {
    const log = await this.prisma.log.create({
      data: { executionId, level, message },
    });
    // emit to the user owning this execution
    const userId = await this.fetchUserIdByExecutionId(executionId);
    this.notificationsGateway.pushLogToUser(userId, {
      executionId,
      log,
    });
    return log;
  }
}