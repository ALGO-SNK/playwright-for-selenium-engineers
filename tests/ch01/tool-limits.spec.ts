import { expect, test } from '@playwright/test';

test('browser isolation does not imply backend isolation', async ({ browser }) => {
  const buyer = await browser.newContext();
  const admin = await browser.newContext();

  try {
    await buyer.addCookies([
      { name: 'role', value: 'buyer', domain: 'qualitymart.test', path: '/' }
    ]);
    await admin.addCookies([
      { name: 'role', value: 'admin', domain: 'qualitymart.test', path: '/' }
    ]);

    await expect.poll(async () => (await buyer.cookies())[0]?.value).toBe('buyer');
    await expect.poll(async () => (await admin.cookies())[0]?.value).toBe('admin');
  } finally {
    await buyer.close();
    await admin.close();
  }
});
