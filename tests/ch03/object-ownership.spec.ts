import { expect, test } from '@playwright/test';

test('closing a context invalidates its page', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await context.close();

  await expect(page.goto('https://qualitymart.test')).rejects.toThrow(/closed/i);
});

test('contexts isolate browser cookies, not backend state', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();

  try {
    await first.addCookies([
      { name: 'session', value: 'buyer-a', domain: 'qualitymart.test', path: '/' }
    ]);

    expect(await first.cookies()).toHaveLength(1);
    expect(await second.cookies()).toHaveLength(0);
  } finally {
    await first.close();
    await second.close();
  }
});
