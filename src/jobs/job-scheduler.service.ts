import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCRAPE_QUEUE_NAME, SCRAPE_JOB_NAME, SCHEDULER_PREFIX } from '../queue/constants';
import { JobAccessService } from '../access/job-access.service';

@Injectable()
export class JobSchedulerService {
  private readonly logger = new Logger(JobSchedulerService.name);

  constructor(
    private readonly jobAccess: JobAccessService,
    @InjectQueue(SCRAPE_QUEUE_NAME) private readonly scrapeQueue: Queue,
  ) { }

  async scheduleOnCreate(job: {
    id: string;
    cron: string | null;
    scheduleStart: Date | null;
  }) {
    if (job.cron) {
      await this.registerCronScheduler(job.id, job.cron);
      const shouldRunImmediately = !job.scheduleStart;
      if (shouldRunImmediately) await this.enqueueImmediate(job.id);
      return;
    }
    this.logger.log(
      `[Scheduler] Scheduling job ${job.id} — ` +
      `type: ${job.cron ? 'cron' : 'once'} | ` +
      `cron: ${job.cron ?? 'n/a'} | ` +
      `start: ${job.scheduleStart?.toISOString() ?? 'immediate'}`
    );


    const delay = this.computeDelay(job.scheduleStart);
    await this.enqueueOnce(job.id, delay);
  }

  async onJobPaused(jobId: string) {
    this.logger.log(`[Scheduler] Job ${jobId} paused — removing cron scheduler`);
    await this.removeCronScheduler(jobId);
  }

  async onJobResumed(jobId: string, cron: string | null) {
    this.logger.log(`[Scheduler] Job ${jobId} resumed — cron: ${cron ?? 'none'}`);
    if (!cron) return;
    await this.registerCronScheduler(jobId, cron);
  }

  async onJobDeleted(jobId: string) {
    this.logger.log(`[Scheduler] Job ${jobId} deleted — removing cron scheduler`);
    await this.removeCronScheduler(jobId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────


  private schedulerKey(jobId: string): string {
    return `${SCHEDULER_PREFIX}-${jobId}`;
  }

  private computeDelay(scheduleStart: Date | null): number {
    if (!scheduleStart) return 0;
    return Math.max(0, scheduleStart.getTime() - Date.now());
  }

  private async enqueueImmediate(jobId: string) {
    await this.scrapeQueue.add(SCRAPE_JOB_NAME, { jobId });
  }

  private async enqueueOnce(jobId: string, delay: number) {
    await this.scrapeQueue.add(
      SCRAPE_JOB_NAME,
      { jobId },
      { delay },
    );
  }

  private async registerCronScheduler(jobId: string, cron: string) {
    await this.scrapeQueue.upsertJobScheduler(
      this.schedulerKey(jobId),
      { pattern: cron },
      { name: SCRAPE_JOB_NAME, data: { jobId } },
    );
  }

  private async removeCronScheduler(jobId: string) {
    await this.scrapeQueue.removeJobScheduler(this.schedulerKey(jobId));
  }

  async enqueueRun(jobId: string, userId: string) {
    this.logger.log(`[Scheduler] Manual run requested for job ${jobId} by user ${userId}`);
    await this.jobAccess.verifyJobOwnership(jobId, userId);

    await this.scrapeQueue.add(SCRAPE_JOB_NAME, { jobId });
    return { jobId };
  }
}
