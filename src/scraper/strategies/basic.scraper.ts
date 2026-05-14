import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { IScraper } from '../interfaces/scraper.interface';
import { normalizeScrapedText, zipColumns } from '../utils/scraper-text';

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioElements = ReturnType<CheerioRoot>;

@Injectable()
export class BasicScraperService implements IScraper {
  private readonly logger = new Logger(BasicScraperService.name);

  async scrape(url: string, path: string, paginationSelector?: string, maxPages?: number): Promise<string> {
    if (!paginationSelector || !maxPages) {
      const html = await this.fetchHtml(url);
      return normalizeScrapedText(this.extract(html, path));
    }
    return this.scrapeWithPagination(url, path, paginationSelector, maxPages);
  }

  private async scrapeWithPagination(
    url: string,
    path: string,
    paginationSelector: string,
    maxPages: number
  ): Promise<string> {
    const allRows: string[] = [];
    let currentUrl: string | null = url;
    let page = 0;

    while (currentUrl && page < maxPages) {
      this.logger.log(`[Basic] Page ${page + 1}: ${currentUrl}`);
      const html = await this.fetchHtml(currentUrl);
      const $ = cheerio.load(html);
      const raw = this.extract(html, path);
      if (raw) allRows.push(raw);

      // find next page URL
      const nextEl = $(paginationSelector).first();
      const nextHref = nextEl.attr('href');
      if (!nextHref) break;

      currentUrl = nextHref.startsWith('http')
        ? nextHref
        : new URL(nextHref, currentUrl).href;
      page++;
    }

    return normalizeScrapedText(allRows.join('\n'));
  }

  private async fetchHtml(url: string): Promise<string> {
    this.logger.log(`[Basic] Fetching HTML from: ${url}`);
    const response = await axios.get<string>(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DataWatch-Bot/1.0)' },
    });
    return response.data;
  }

  private extract(html: string, path: string): string {
    const $ = cheerio.load(html);
    const selectors = path.split(',').map((s) => s.trim()).filter(Boolean);

    if (selectors.length === 1) {
      const elements = $(selectors[0]);
      if (elements.length === 0)
        throw new Error(`No elements found for selector: "${selectors[0]}"`);
      const texts = this.extractTexts($, elements);
      if (texts.length === 0)
        throw new Error(`Elements found for "${selectors[0]}" but all were empty.`);
      return texts.join('\n');
    }

    // multi-field: extract each selector, zip rows by index
    const columns = selectors.map((sel) => {
      const texts: string[] = [];
      $(sel).each((_, el) => {
        const text = $(el).text().trim();
        if (text) texts.push(text);
      });
      return texts;
    });

    return zipColumns(columns);
  }

  private extractTexts($: CheerioRoot, elements: CheerioElements): string[] {
    const texts: string[] = [];
    elements.each((_, el) => {
      const text = $(el).text().trim();
      if (text) texts.push(text);
    });
    return texts;
  }

}
