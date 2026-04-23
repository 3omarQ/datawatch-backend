import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';

@Injectable()
export class TxtFormatter implements IFormatter {
  format(raw: string, fieldNames?: string[]): string {
    const rows = this.parseRows(raw);
    if (rows.length === 0) return '';

    const isMultiField = rows[0].length > 1;
    if (!isMultiField) return rows.map((r) => r[0]).join('\n');

    const labelWidth = this.maxLabelWidth(fieldNames, rows[0].length);

    const formatted = rows.map((row, rowIdx) => {
      const lines = row.map((cell, i) => {
        const label = (fieldNames?.[i] ?? `field_${i + 1}`).padEnd(labelWidth);
        return `${label}  ${cell}`;
      });
      // separator between items except last
      return lines.join('\n');
    });

    return formatted.join('\n' + '─'.repeat(labelWidth + 20) + '\n');
  }

  private parseRows(raw: string): string[][] {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => line.split('|').map((c) => c.trim()));
  }

  private maxLabelWidth(fieldNames: string[] | undefined, colCount: number): number {
    const names = Array.from(
      { length: colCount },
      (_, i) => fieldNames?.[i] ?? `field_${i + 1}`
    );
    return Math.max(...names.map((n) => n.length));
  }
}
