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
    const start = Date.now();
    this.logger.log(`[${jobId}] Starting scrape`);

    const execution = await this.jobExecutionsService.initExecution(jobId, executionId);

    const onLog = (message: string) =>
      this.jobExecutionsService.saveLog(execution.id, 'INFO', message);

    try {
      const target = await this.jobExecutionsService.fetchJobTarget(jobId);
      this.logger.log(
        `[${jobId}] Target: ${target.url} | selector: ${target.path} | ` +
        `extractor: ${target.extractorType} | format: ${target.outputFormat} | ` +
        `pagination: ${target.paginationSelector ?? 'none'} | maxPages: ${target.maxPages ?? 1}`
      );

      const scraper = this.scraperFactory.get(target.extractorType);
      const formatter = this.formatterFactory.get(target.outputFormat, target.fieldNames);

      const scrapeStart = Date.now();
      const raw = await scraper.scrape(
        target.url,
        target.path,
        target.paginationSelector,
        target.maxPages,
        onLog,
      );
      const scrapeMs = Date.now() - scrapeStart;
      this.logger.log(`[${jobId}] Scrape done in ${scrapeMs}ms — raw length: ${raw.length} chars`);

      const result = formatter.format(raw);
      this.logger.log(`[${jobId}] Formatted — output length: ${result.length} chars`);

      await this.jobExecutionsService.completeExecution(execution.id, jobId, result);
      this.logger.log(`[${jobId}] Execution ${execution.id} completed in ${Date.now() - start}ms`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[${jobId}] Execution ${execution.id} failed after ${Date.now() - start}ms — ${message}`,
        stack,
      );
      await this.jobExecutionsService.failExecution(execution.id, jobId, message);
      throw error;
    }
  }
}