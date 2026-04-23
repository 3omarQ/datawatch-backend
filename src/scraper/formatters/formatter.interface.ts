export interface IFormatter {
  format(raw: string, fieldNames?: string[]): string;
}