import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';
import { parseRows } from '../utils/parse-rows';

@Injectable()
export class MdFormatter implements IFormatter {
  format(raw: string, fieldNames?: string[]): string {
    const rows = parseRows(raw);
    if (rows.length === 0) return '';

    const isMultiField = rows[0].length > 1;
    if (!isMultiField) {
      // single field — bullet list
      return rows.map((r) => `- ${r[0]}`).join('\n');
    }

    const colCount = Math.max(...rows.map((r) => r.length));
    const headers = Array.from(
      { length: colCount },
      (_, i) => fieldNames?.[i] ?? `field_${i + 1}`
    );

    const widths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length), 3)
    );

    const headerRow = '| ' + headers.map((h, i) => h.padEnd(widths[i])).join(' | ') + ' |';
    const separator = '| ' + widths.map((w) => '-'.repeat(w)).join(' | ') + ' |';
    const dataRows = rows.map(
      (row) =>
        '| ' +
        Array.from({ length: colCount }, (_, i) =>
          (row[i] ?? '').padEnd(widths[i])
        ).join(' | ') +
        ' |'
    );

    return [headerRow, separator, ...dataRows].join('\n');
  }
}
