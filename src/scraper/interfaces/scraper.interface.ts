export interface IScraper {
  scrape(url: string, path: string, paginationSelector?: string, maxPages?: number): Promise<string>;
}

export const SCRAPER_TOKEN = 'IScraper';