import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';
import { parseRows } from '../utils/parse-rows';

@Injectable()
export class CsvFormatter implements IFormatter {
	format(raw: string, fieldNames?: string[]): string {
		const rows = parseRows(raw);
		if (rows.length === 0) return '';

		const colCount = Math.max(...rows.map((r) => r.length));
		const headers = this.buildHeaders(fieldNames, colCount);

		return [
			headers.map(this.escape).join(','),
			...rows.map((r) =>
				Array.from({ length: colCount }, (_, i) => this.escape(r[i] ?? '')).join(',')
			),
		].join('\n');
	}

	private buildHeaders(fieldNames: string[] | undefined, colCount: number): string[] {
		if (!fieldNames || fieldNames.length === 0) {
			return Array.from({ length: colCount }, (_, i) => `field_${i + 1}`);
		}
		const extras = Array.from(
			{ length: Math.max(0, colCount - fieldNames.length) },
			(_, i) => `field_${fieldNames.length + i + 1}`
		);
		return [...fieldNames, ...extras];
	}

	private escape(value: string): string {
		if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
		return value;
	}
}
