import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatters/formatter.interface';
import { TxtFormatter } from './formatters/txt.formatter';
import { JsonFormatter } from './formatters/json.formatter';
import { MdFormatter } from './formatters/md.formatter';
import { CsvFormatter } from './formatters/csv.formatter';
import { OutputFormat } from 'src/generated/prisma/enums';

@Injectable()
export class FormatterFactoryService {
  constructor(
    private readonly txt: TxtFormatter,
    private readonly json: JsonFormatter,
    private readonly md: MdFormatter,
    private readonly csv: CsvFormatter,
  ) { }

  get(format: OutputFormat, fieldNames?: string[]): IFormatter {

    const base = this.resolve(format);
    if (!fieldNames || fieldNames.length === 0) return base;

    // wrap to inject fieldNames automatically
    return {
      format: (raw: string) => base.format(raw, fieldNames),
    };
  }

  private resolve(format: OutputFormat): IFormatter {
    switch (format) {
      case 'CSV': return this.csv;
      case 'JSON': return this.json;
      case 'MD': return this.md;
      case 'TXT':
      default: return this.txt;
    }
  }
}