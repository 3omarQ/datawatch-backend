import { Module } from '@nestjs/common';
import { BasicScraperService } from './strategies/basic.scraper';
import { SmartScraperService } from './strategies/smart.scraper';
import { ScraperFactoryService } from './scraper-factory.service';
import { TxtFormatter } from './formatters/txt.formatter';
import { JsonFormatter } from './formatters/json.formatter';
import { MdFormatter } from './formatters/md.formatter';
import { FormatterFactoryService } from './formatter-factory.service';

@Module({
  providers: [
    BasicScraperService,
    SmartScraperService,
    ScraperFactoryService,
    TxtFormatter,
    JsonFormatter,
    MdFormatter,
    FormatterFactoryService,
  ],
  exports: [ScraperFactoryService, FormatterFactoryService],
})
export class ScraperModule {}