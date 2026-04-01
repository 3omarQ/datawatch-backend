import { QueueEventsHost, QueueEventsListener, OnQueueEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

@QueueEventsListener('scrape')
export class ScrapeQueueEvents extends QueueEventsHost {
  private readonly logger = new Logger(ScrapeQueueEvents.name);

  @OnQueueEvent('completed')
  onCompleted({ jobId }: { jobId: string }) {
    this.logger.log(`Job ${jobId} completed.`);
    // notifications hook goes here later
  }

  @OnQueueEvent('failed')
  onFailed({ jobId, failedReason }: { jobId: string; failedReason: string }) {
    this.logger.error(`Job ${jobId} failed: ${failedReason}`);
    // notifications hook goes here later
  }
}