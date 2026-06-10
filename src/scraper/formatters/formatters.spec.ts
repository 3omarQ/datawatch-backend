import { CsvFormatter } from './csv.formatter';
import { JsonFormatter } from './json.formatter';
import { TxtFormatter } from './txt.formatter';

describe('Scraper formatters', () => {
  it('formats single-field rows as text', () => {
    expect(new TxtFormatter().format('Alpha\nBeta')).toBe('Alpha\nBeta');
  });

  it('formats multi-field rows as JSON objects with field names', () => {
    expect(
      JSON.parse(new JsonFormatter().format('Phone | 100\nLaptop | 900', [
        'name',
        'price',
      ])),
    ).toEqual({
      items: [
        { name: 'Phone', price: '100' },
        { name: 'Laptop', price: '900' },
      ],
    });
  });

  it('formats multi-field rows as CSV with generated headers', () => {
    expect(new CsvFormatter().format('Phone | 100\nLaptop | 900')).toBe(
      'field_1,field_2\nPhone,100\nLaptop,900',
    );
  });
});
