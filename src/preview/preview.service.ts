import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser } from 'puppeteer';
import { HIGHLIGHT_SCRIPT } from './highlight-script';
import { PICKER_SCRIPT } from './picker-script';

puppeteer.use(StealthPlugin());

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
  '--single-process', // important on Render's free tier
];


const VIEWPORT = { width: 1280, height: 800 };

@Injectable()
export class PreviewService {
  async getProxiedHtml(url: string, selector: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: LAUNCH_ARGS,
    }) as unknown as Browser;

    try {
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      if (selector) {
        await page.waitForSelector(selector, { timeout: 10000 }).catch(() => { });
      }

      await new Promise((r) => setTimeout(r, 3000));
      const html = await page.content();

      return selector
        ? this.buildHighlightPage(html, url, selector)
        : this.buildPickerPage(html, url);
    } finally {
      await browser.close();
    }
  }

  private sanitize(html: string, baseUrl: string): string {
    return html
      .replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '')
      .replace(/<meta[^>]*http-equiv[^>]*>/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<base[^>]*>/gi, '')
      .replace(/<head([^>]*)>/i, `<head$1><base href="${baseUrl}">`);
  }

  private buildHighlightPage(html: string, url: string, selector: string): string {
    const safe = this.sanitize(html, url);
    return safe.replace('</body>', `${HIGHLIGHT_SCRIPT(selector)}</body>`);
  }

  private buildPickerPage(html: string, url: string): string {
    const safe = this.sanitize(html, url);
    return safe.replace('</body>', `${PICKER_SCRIPT}</body>`);
  }
}