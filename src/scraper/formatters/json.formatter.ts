import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';

@Injectable()
export class JsonFormatter implements IFormatter {
  format(raw: string, fieldNames?: string[]): string {
    console.log('JsonFormatter.format called, fieldNames:', fieldNames);

    const rows = this.parseRows(raw);
    if (rows.length === 0) return JSON.stringify({ items: [] }, null, 2);

    const isMultiField = rows[0].length > 1;

    if (!isMultiField) {
      // single field — simple array of values
      const items = rows.map((r) => r[0]);
      return JSON.stringify({ items }, null, 2);
    }

    // multi-field — array of objects keyed by field names
    const items = rows.map((row) =>
      Object.fromEntries(
        row.map((cell, i) => [fieldNames?.[i] ?? `field_${i + 1}`, cell])
      )
    );
    return JSON.stringify({ items }, null, 2);
  }

  private parseRows(raw: string): string[][] {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => line.split('|').map((c) => c.trim()));
  }
}