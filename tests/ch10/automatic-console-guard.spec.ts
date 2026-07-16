import { expect, test as base } from '@playwright/test';

type AutomaticFixtures = {
  consoleGuard: void;
};

const test = base.extend<AutomaticFixtures>({
  consoleGuard: [async ({ page }, use) => {
    const errors: string[] = [];

    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await use();

    expect(errors, 'unexpected browser console errors').toEqual([]);
  }, { auto: true }]
});

test('automatic policy runs without appearing in the test signature', async ({ page }) => {
  await page.setContent('<h1>Order confirmed</h1>');
  await expect(page.getByRole('heading')).toHaveText('Order confirmed');
});
