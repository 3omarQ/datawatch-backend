import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { IScraper } from '../interfaces/scraper.interface';

puppeteer.use(StealthPlugin());

const CONFIG = {
  timeout: 30000,
  navigationTimeout: 25000,
  renderDelay: 3000,
  viewport: { width: 1280, height: 800 },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
  headers: {
    'Accept-Language': 'en-US,en;q=0.9',
  },
  is_headless:true,
} as const;

@Injectable()
export class SmartScraperService implements IScraper, OnModuleDestroy {
  private readonly logger = new Logger(SmartScraperService.name);
  private browser: Browser | null = null;

  async scrape(url: string, path: string): Promise<string> {
    const page = await this.openPage();
    try {
      await this.navigate(page, url);
      return await this.extract(page, path);
    } finally {
      await page.close();
    }
  }

  private async openPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);
    await page.setDefaultTimeout(CONFIG.timeout);
    await page.setExtraHTTPHeaders(CONFIG.headers);
    return page;
  }

  private async navigate(page: Page, url: string): Promise<void> {
    this.logger.log(`[Smart] Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.navigationTimeout });
    await new Promise((r) => setTimeout(r, CONFIG.renderDelay));
  }

  private async extract(page: Page, path: string): Promise<string> {
    await page.waitForSelector(path, { timeout: CONFIG.timeout });
    const text = await page.$$eval(path, (els) =>
      els
        .map((el) => (el as HTMLElement).innerText.trim())
        .filter((t) => t.length > 0)
        .join('\n'),
    );
    if (!text) throw new Error(`No text found for selector: "${path}"`);
    return this.format(text);
  }

  private format(raw: string): string {
    return raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).join('\n');
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.logger.log('[Smart] Launching browser...');
      this.browser = await puppeteer.launch({ headless: CONFIG.is_headless, args: [...CONFIG.args] }) as unknown as Browser;
    }
    return this.browser;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      this.logger.log('[Smart] Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }
}