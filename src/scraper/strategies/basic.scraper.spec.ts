import axios from 'axios';
import { BasicScraperService } from './basic.scraper';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BasicScraperService', () => {
  let service: BasicScraperService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BasicScraperService();
  });

  it('extracts and normalizes text for a CSS selector', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `
        <html>
          <body>
            <h2 class="product"> First item </h2>
            <h2 class="product">Second item</h2>
          </body>
        </html>
      `,
    });

    await expect(
      service.scrape('https://example.com', '.product'),
    ).resolves.toBe('First item\nSecond item');
  });

  it('zips multiple selectors into rows', async () => {
    mockedAxios.get.mockResolvedValue({
      data: `
        <article><h2>Phone</h2><span class="price">100</span></article>
        <article><h2>Laptop</h2><span class="price">900</span></article>
      `,
    });

    await expect(
      service.scrape('https://example.com', 'h2, .price'),
    ).resolves.toBe('Phone | 100\nLaptop | 900');
  });

  it('fails when the selector does not match any element', async () => {
    mockedAxios.get.mockResolvedValue({ data: '<p>No product here</p>' });

    await expect(
      service.scrape('https://example.com', '.missing'),
    ).rejects.toThrow('No elements found for selector');
  });
});
