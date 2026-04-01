import { Injectable } from '@nestjs/common';
import { IFormatter } from './formatter.interface';

@Injectable()
export class JsonFormatter implements IFormatter {
  format(raw: string): string {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    return JSON.stringify({ lines }, null, 2);
  }
}