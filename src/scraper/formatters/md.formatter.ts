import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';

@Injectable()
export class MdFormatter implements IFormatter {
  format(raw: string): string {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => `- ${l}`)
      .join('\n');
  }
}