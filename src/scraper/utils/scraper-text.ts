export function normalizeScrapedText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export function zipColumns(columns: string[][]): string {
  const rowCount = Math.max(...columns.map((column) => column.length));
  const rows: string[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    rows.push(columns.map((column) => column[rowIndex] ?? '').join(' | '));
  }

  return rows.join('\n');
}
