export type ScraperLogFn = (message: string) => void;

export interface IScraper {
  scrape(
    url: string,
    path: string,
    paginationSelector?: string,
    maxPages?: number,
    onLog?: ScraperLogFn,
  ): Promise<string>;
}

export const SCRAPER_TOKEN = 'IScraper';