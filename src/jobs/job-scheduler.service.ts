import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCRAPE_QUEUE_NAME, SCRAPE_JOB_NAME, SCHEDULER_PREFIX } from '../queue/constants';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JobSchedulerService {
  constructor(
      private readonly prisma: PrismaService,
    @InjectQueue(SCRAPE_QUEUE_NAME) private readonly scrapeQueue: Queue,
  ) {}

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

    const delay = this.computeDelay(job.scheduleStart);
    await this.enqueueOnce(job.id, delay);
  }

  async onJobPaused(jobId: string) {
    await this.removeCronScheduler(jobId);
  }

  async onJobResumed(jobId: string, cron: string | null) {
    if (!cron) return;
    await this.registerCronScheduler(jobId, cron);
  }

  async onJobDeleted(jobId: string) {
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
    await this.scrapeQueue.add(SCRAPE_JOB_NAME, {jobId});
  }

  private async enqueueOnce(jobId: string, delay: number) {
    await this.scrapeQueue.add(
      SCRAPE_JOB_NAME,
      {jobId},
      { delay },
    );
  }

  private async registerCronScheduler(jobId: string, cron: string) {
    await this.scrapeQueue.upsertJobScheduler(
      this.schedulerKey(jobId),
      { pattern: cron },
      { name: SCRAPE_JOB_NAME, data: {jobId} },
    );
  }

  private async removeCronScheduler(jobId: string) {
    await this.scrapeQueue.removeJobScheduler(this.schedulerKey(jobId));
  }

  async enqueueRun(jobId: string, userId: string) {
  const job = await this.prisma.job.findUnique({
    where: { id: jobId },
    include: { datapoint: { include: { targetUrl: true } } },
  });
  if (!job) throw new NotFoundException('Job not found');
  if (job.datapoint.targetUrl.userId !== userId) throw new ForbiddenException();

  await this.scrapeQueue.add(SCRAPE_JOB_NAME, {jobId});
  return { jobId };
}
}