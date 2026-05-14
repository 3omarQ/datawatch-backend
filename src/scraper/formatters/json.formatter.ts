import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';
import { parseRows } from '../utils/parse-rows';

@Injectable()
export class JsonFormatter implements IFormatter {
  format(raw: string, fieldNames?: string[]): string {

    const rows = parseRows(raw);
    if (rows.length === 0) return JSON.stringify({ items: [] }, null, 2);

    const isMultiField = rows[0].length > 1;

    if (!isMultiField) {
      const items = rows.map((r) => r[0]);
      return JSON.stringify({ items }, null, 2);
    }

    const items = rows.map((row) =>
      Object.fromEntries(
        row.map((cell, i) => [fieldNames?.[i] ?? `field_${i + 1}`, cell])
      )
    );
    return JSON.stringify({ items }, null, 2);
  }
}
