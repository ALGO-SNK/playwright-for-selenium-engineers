import { expect, test as base } from '@playwright/test';

type Market = 'US' | 'IN';

type Fixtures = {
  market: Market;
  currency: 'USD' | 'INR';
};

const test = base.extend<Fixtures>({
  market: ['US', { option: true }],
  currency: async ({ market }, use) => {
    await use(market === 'IN' ? 'INR' : 'USD');
  }
});

test('the default market configures its dependency', async ({ currency }) => {
  expect(currency).toBe('USD');
});

test.describe('India market', () => {
  test.use({ market: 'IN' });

  test('a suite can override a typed option', async ({ currency }) => {
    expect(currency).toBe('INR');
  });
});
