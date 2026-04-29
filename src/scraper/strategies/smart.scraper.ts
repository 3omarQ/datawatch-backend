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
  is_headless: true,
} as const;

@Injectable()
export class SmartScraperService implements IScraper, OnModuleDestroy {
  private readonly logger = new Logger(SmartScraperService.name);
  private browser: Browser | null = null;

  async scrape(url: string, path: string, paginationSelector?: string, maxPages?: number): Promise<string> {
    const page = await this.openPage();
    try {
      await this.navigate(page, url);
      if (!paginationSelector || !maxPages) {
        return await this.extract(page, path);
      }
      return await this.extractWithPagination(page, path, paginationSelector, maxPages);
    } finally {
      await page.close();
    }
  }
  // smart-scraper.service.ts — extractWithPagination replacement

  private async extractWithPagination(
    page: Page,
    path: string,
    paginationSelector: string,
    maxPages: number
  ): Promise<string> {
    const allRows: string[] = [];

    for (let i = 0; i < maxPages; i++) {
      this.logger.log(`[Smart] Extracting page ${i + 1}`);
      const raw = await this.extract(page, path);
      if (raw) allRows.push(raw);

      // ── Find next button ──────────────────────────────────────────────────
      // Try the user's selector first; fall back to common semantic selectors.
      const FALLBACKS = [
        paginationSelector,
        'a[rel="next"]',
        'a[aria-label*="next" i]',
        'li.page-item a.page-link[aria-label*="next" i]',
      ];

      let nextHref: string | null = null;

      for (const sel of FALLBACKS) {
        try {
          const href = await page.$eval(sel, (el) => {
            const anchor = el as HTMLAnchorElement;
            const disabled =
              anchor.hasAttribute('disabled') ||
              anchor.classList.contains('disabled') ||
              anchor.getAttribute('aria-disabled') === 'true' ||
              anchor.closest('li')?.classList.contains('disabled');
            return disabled ? null : anchor.href || null;
          });

          if (href) {
            this.logger.log(`[Smart] Next href found via "${sel}": ${href}`);
            nextHref = href;
            break;
          }
        } catch {
          // selector not present on this page — try next fallback
        }
      }

      if (!nextHref) {
        this.logger.log(`[Smart] No enabled next button found — stopping`);
        break;
      }

      // Navigate by URL instead of clicking so the selector position doesn't matter
      await this.navigate(page, nextHref);
    }

    return this.format(allRows.join('\n'));
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
    const selectors = path.split(',').map((s) => s.trim()).filter(Boolean);

    if (selectors.length === 1) {
      await page.waitForSelector(selectors[0], { timeout: CONFIG.timeout });
      const text = await page.$$eval(selectors[0], (els) =>
        els.map((el) => (el as HTMLElement).innerText.trim()).filter(Boolean).join('\n')
      );
      if (!text) throw new Error(`No text found for selector: "${selectors[0]}"`);
      return this.format(text);
    }

    // multi-field: extract each selector, zip rows by index
    const columns = await Promise.all(
      selectors.map((sel) =>
        page.$$eval(sel, (els) =>
          els
            .filter((el) => {
              // walk up the DOM — if any ancestor has display:none, element is hidden
              let cur: HTMLElement | null = el as HTMLElement;
              while (cur) {
                if (getComputedStyle(cur).display === 'none') return false;
                cur = cur.parentElement;
              }
              return true;
            })
            .map((el) => (el as HTMLElement).innerText.trim())
            .filter(Boolean)
        )
      )
    );

    return this.zipColumns(columns);
  }

  private zipColumns(columns: string[][]): string {
    const rowCount = Math.max(...columns.map((c) => c.length));
    const rows: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      rows.push(columns.map((col) => col[i] ?? '').join(' | '));
    }
    return rows.join('\n');
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