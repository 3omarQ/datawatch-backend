import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { IScraper, ScraperLogFn } from '../interfaces/scraper.interface';
import { normalizeScrapedText, zipColumns } from '../utils/scraper-text';

puppeteer.use(StealthPlugin());

const CONFIG = {
  timeout: 300000,
  navigationTimeout: 300000,
  renderDelay: 3000,
  viewport: { width: 1280, height: 800 },
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    // Memory savers
    '--single-process',
    '--no-zygote',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
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

  async scrape(
    url: string,
    path: string,
    paginationSelector?: string,
    maxPages?: number,
    onLog?: ScraperLogFn,
  ): Promise<string> {
    const log = (msg: string) => {
      this.logger.log(msg);
      onLog?.(msg);
    };

    const page = await this.openPage();
    try {
      await this.navigate(page, url, log);
      if (!paginationSelector || !maxPages) {
        return await this.extract(page, path, log);
      }
      return await this.extractWithPagination(page, path, paginationSelector, maxPages, log);
    } finally {
      await page.close();
    }
  }

  private async extractWithPagination(
    page: Page,
    path: string,
    paginationSelector: string,
    maxPages: number,
    log: (msg: string) => void,
  ): Promise<string> {
    const allRows: string[] = [];

    for (let i = 0; i < maxPages; i++) {
      log(`Extracting page ${i + 1}/${maxPages}`);
      const raw = await this.extract(page, path, log);
      if (raw) allRows.push(raw);

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
            log(`Next page found via "${sel}": ${href}`);
            nextHref = href;
            break;
          }
        } catch {
          // selector not present on this page — try next fallback
        }
      }

      if (!nextHref) {
        log(`No next button found — stopping at page ${i + 1}`);
        break;
      }

      await this.navigate(page, nextHref, log);
    }

    log(`Pagination complete — ${allRows.length} pages scraped`);
    return normalizeScrapedText(allRows.join('\n'));
  }

  private async navigate(page: Page, url: string, log: (msg: string) => void): Promise<void> {
    log(`Navigating to: ${url}`);
    const start = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.navigationTimeout });
    await new Promise((r) => setTimeout(r, CONFIG.renderDelay));
    log(`Page ready in ${Date.now() - start}ms`);
  }

  private async extract(page: Page, path: string, log: (msg: string) => void): Promise<string> {
    const selectors = path.split(',').map((s) => s.trim()).filter(Boolean);

    if (selectors.length === 1) {
      log(`Waiting for selector: ${selectors[0]}`);
      await page.waitForSelector(selectors[0], { timeout: CONFIG.timeout }).catch((e) => {
        log(`Selector timed out: ${selectors[0]} — ${e.message}`);
      });
      const start = Date.now();
      const text = await page.$$eval(selectors[0], (els) =>
        els
          .filter((el) => getComputedStyle(el as HTMLElement).display !== 'none')
          .map((el) => (el as HTMLElement).innerText.trim())
          .filter(Boolean)
          .join('\n')
      );
      log(`Extracted ${text.split('\n').length} items in ${Date.now() - start}ms`);
      if (!text) throw new Error(`No text found for selector: "${selectors[0]}"`);
      return normalizeScrapedText(text);
    }

    log(`Multi-field extraction — ${selectors.length} selectors`);
    const start = Date.now();
    const columns = await Promise.all(
      selectors.map((sel) =>
        page.$$eval(sel, (els) =>
          els
            .filter((el) => {
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
    log(`Column lengths: [${columns.map((c) => c.length).join(', ')}] in ${Date.now() - start}ms`);
    return zipColumns(columns);
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.logger.log('[Smart] Launching browser...');
      this.browser = await puppeteer.launch({
        headless: CONFIG.is_headless,
        args: [...CONFIG.args],
      }) as unknown as Browser;
    }
    return this.browser;
  }

  private async openPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);
    await page.setDefaultTimeout(CONFIG.timeout);
    await page.setExtraHTTPHeaders(CONFIG.headers);
    return page;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      this.logger.log('[Smart] Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
  }
}
