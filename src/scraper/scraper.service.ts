import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import axios from 'axios';

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioElements = ReturnType<CheerioRoot>;

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async run(url: string, path: string): Promise<string> {
    const html = await this.fetchHtml(url);
    const raw = this.extract(html, path);
    return this.formatAsTxt(raw);
  }

  private async fetchHtml(url: string): Promise<string> {
    this.logger.log(`Fetching HTML from: ${url}`);
    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DataWatch-Bot/1.0)' },
    });
    return response.data;
  }

  private extract(html: string, path: string): string {
    const $ = cheerio.load(html);
    const elements = $(path);

    if (elements.length === 0) {
      throw new Error(`No elements found for selector: "${path}"`);
    }

    const texts = this.extractTexts($, elements);

    if (texts.length === 0) {
      throw new Error(`Elements found for "${path}" but all were empty.`);
    }

    return texts.join('\n');
  }

  private extractTexts($: CheerioRoot, elements: CheerioElements): string[] {
    const texts: string[] = [];
    elements.each((_, el) => {
      const text = $(el).text().trim();
      if (text) texts.push(text);
    });
    return texts;
  }

  private formatAsTxt(raw: string): string {
    return this.joinLines(
      this.removeEmptyLines(
        this.trimLines(
          this.splitLines(raw)
        )
      )
    );
  }

  private splitLines(raw: string): string[] {
    return raw.split('\n');
  }

  private trimLines(lines: string[]): string[] {
    return lines.map((line) => line.trim());
  }

  private removeEmptyLines(lines: string[]): string[] {
    return lines.filter((line) => line.length > 0);
  }

  private joinLines(lines: string[]): string {
    return lines.join('\n');
  }
}