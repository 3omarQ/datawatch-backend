import { Injectable } from '@nestjs/common';
import { IScraper } from './interfaces/scraper.interface';
import { BasicScraperService } from './strategies/basic.scraper';
import { SmartScraperService } from './strategies/smart.scraper';

export type ExtractorType = 'BASIC' | 'SMART';

@Injectable()
export class ScraperFactoryService {
  constructor(
    private readonly basicScraper: BasicScraperService,
    private readonly smartScraper: SmartScraperService,
  ) {}

  get(extractorType: ExtractorType): IScraper {
    switch (extractorType) {
      case 'SMART': return this.smartScraper;
      case 'BASIC': return this.basicScraper;
      default: return this.basicScraper;
    }
  }
}