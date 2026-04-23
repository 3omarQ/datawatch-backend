import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScraperFactoryService } from '../scraper/scraper-factory.service';
import { FormatterFactoryService } from '../scraper/formatter-factory.service';
import { JobExecutionsService } from '../job-executions/job-executions.service';
import { SCRAPE_QUEUE_NAME } from './constants';

export interface ScrapeJobData {
  jobId: string;
  executionId?: string;
}

@Processor(SCRAPE_QUEUE_NAME)
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    private readonly scraperFactory: ScraperFactoryService,
    private readonly formatterFactory: FormatterFactoryService,
    private readonly jobExecutionsService: JobExecutionsService,
  ) {
    super();
  }

  async process(job: Job<ScrapeJobData>): Promise<void> {
    const { jobId, executionId } = job.data;
    this.logger.log(`Processing scrape for job ${jobId}`);

    const execution = await this.jobExecutionsService.initExecution(jobId, executionId);

    try {
      const { url, path, extractorType, outputFormat, fieldNames, paginationSelector, maxPages } =
        await this.jobExecutionsService.fetchJobTarget(jobId);

      const scraper = this.scraperFactory.get(extractorType);
      console.log('fieldNames in processor:', fieldNames);
      const formatter = this.formatterFactory.get(outputFormat, fieldNames);
      console.log('formatter has fieldNames bound:', formatter.format.toString().includes('fieldNames'));

      const raw = await scraper.scrape(url, path, paginationSelector, maxPages);
      const result = formatter.format(raw);
      console.log('formatted result first 100 chars:', result.slice(0, 100));

      await this.jobExecutionsService.completeExecution(execution.id, jobId, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error.';
      await this.jobExecutionsService.failExecution(execution.id, jobId, message);
      throw error;
    }
  }
}