import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatters/formatter.interface';
import { TxtFormatter } from './formatters/txt.formatter';
import { JsonFormatter } from './formatters/json.formatter';
import { MdFormatter } from './formatters/md.formatter';

export type OutputFormat = 'TXT' | 'JSON' | 'MD';

@Injectable()
export class FormatterFactoryService {
  constructor(
    private readonly txt: TxtFormatter,
    private readonly json: JsonFormatter,
    private readonly md: MdFormatter,
  ) {}

  get(format: OutputFormat): IFormatter {
    switch (format) {
      case 'JSON': return this.json;
      case 'MD': return this.md;
      case 'TXT':
      default: return this.txt;
    }
  }
}