import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScrapeProcessor } from './scrape.processor';
import { ScrapeQueueEvents } from './scrape.events';
import { ScraperModule } from '../scraper/scraper.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SCRAPE_QUEUE_NAME } from './constants';
import { JobExecutionsService } from '../job-executions/job-executions.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SCRAPE_QUEUE_NAME }),
    ScraperModule,
    PrismaModule,

  ],
  providers: [ScrapeProcessor, ScrapeQueueEvents, JobExecutionsService],
  exports: [BullModule],
})
export class QueueModule {}