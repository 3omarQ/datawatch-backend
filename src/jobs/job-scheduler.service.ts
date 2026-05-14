import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCRAPE_QUEUE_NAME, SCRAPE_JOB_NAME, SCHEDULER_PREFIX } from '../queue/constants';
import { JobAccessService } from '../access/job-access.service';
import { JobStatus } from '../generated/prisma/enums';

type SchedulableJob = {
  id: string;
  status: JobStatus;
  cron: string | null;
  scheduleStart: Date | null;
};

@Injectable()
export class JobSchedulerService {

  constructor(
    private readonly logger = new Logger(JobSchedulerService.name),
    private readonly jobAccess: JobAccessService,
    @InjectQueue(SCRAPE_QUEUE_NAME) private readonly scrapeQueue: Queue,
  ) { }

  async scheduleOnCreate(job: SchedulableJob) {
    if (job.status === JobStatus.PAUSED) return;
    await this.updateJobSchedule(job, { tryToRunImmediately: true });
  }

  async rescheduleAfterJobUpdate(previous: SchedulableJob, current: SchedulableJob) {
    if (current.status === JobStatus.PAUSED) {
      await this.clearSchedule(current.id);
      return;
    }

    if (
      previous.status === JobStatus.PAUSED ||
      previous.cron !== current.cron ||
      previous.scheduleStart?.getTime() !== current.scheduleStart?.getTime()
    ) {
      await this.updateJobSchedule(current, { tryToRunImmediately: false });
    }
  }

  private async updateJobSchedule(
    job: SchedulableJob,
    options: { tryToRunImmediately: boolean },
  ) {
    await this.clearSchedule(job.id);

    if (job.cron) {
      await this.registerCronScheduler(job.id, job.cron);
      const shouldRunImmediately = options.tryToRunImmediately && !job.scheduleStart;
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

  async onJobDeleted(jobId: string) {
    this.logger.log(`[Scheduler] Job ${jobId} deleted — removing cron scheduler`);
    await this.clearSchedule(jobId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────


  private schedulerKey(jobId: string): string {
    return `${SCHEDULER_PREFIX}-${jobId}`;
  }

  private onceJobKey(jobId: string): string {
    return `once-${jobId}`;
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
      { delay, jobId: this.onceJobKey(jobId) },
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

  private async removeOneTimeQueueJob(jobId: string) {
    const queuedJob = await this.scrapeQueue.getJob(this.onceJobKey(jobId));
    if (!queuedJob) return;
    try {
      await queuedJob.remove();
    } catch (error) {
      this.logger.warn(
        `[Scheduler] Could not remove one-time job ${jobId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async clearSchedule(jobId: string) {
    await this.removeCronScheduler(jobId);
    await this.removeOneTimeQueueJob(jobId);
  }

  async enqueueRun(jobId: string, userId: string) {
    this.logger.log(`[Scheduler] Manual run requested for job ${jobId} by user ${userId}`);
    await this.jobAccess.verifyJobOwnership(jobId, userId);

    await this.scrapeQueue.add(SCRAPE_JOB_NAME, { jobId });
    return { jobId };
  }
}
