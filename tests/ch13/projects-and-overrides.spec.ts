import { expect, test as base } from '@playwright/test';

type MarketOptions = {
  market: 'US' | 'IN';
};

const test = base.extend<MarketOptions>({
  market: ['US', { option: true }]
});

test('the selected project exposes a stable execution contract', async (
  { browserName, market },
  testInfo
) => {
  expect(testInfo.project.name).toBe(browserName);
  expect(market).toBe('US');
});

test.describe('a narrow suite override', () => {
  test.use({ market: 'IN' });

  test('replaces the broad option without creating another project', async ({ market }) => {
    expect(market).toBe('IN');
  });
});
