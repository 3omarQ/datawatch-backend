export interface IScraper {
  scrape(url: string, path: string): Promise<string>;
}

export const SCRAPER_TOKEN = 'IScraper';