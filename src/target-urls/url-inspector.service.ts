// url-inspector.service.ts
import { Injectable } from '@nestjs/common';
import { UrlStatus } from '../generated/prisma/enums';

export interface UrlMetadata {
  name: string;
  status: UrlStatus;
}

@Injectable()
export class UrlInspectorService {
  async inspect(url: string): Promise<UrlMetadata> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return { name: url, status: UrlStatus.INACTIVE };
      }

      const html = await response.text();
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const name = match?.[1]?.trim() ?? url;

      return { name, status: UrlStatus.ACTIVE };
    } catch {
      return { name: url, status: UrlStatus.INACTIVE };
    }
  }
}
