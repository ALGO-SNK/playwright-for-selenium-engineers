import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('a dialog handler is registered before the action that opens it', async ({ page }) => {
  await page.setContent(`
    <button type="button">Rename order</button>
    <output aria-label="Order name">Not renamed</output>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        const name = prompt('New order name?');
        document.querySelector('output').textContent = name ?? 'Cancelled';
      });
    </script>
  `);

  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('prompt');
    expect(dialog.message()).toBe('New order name?');
    await dialog.accept('QM-1042');
  });

  await page.getByRole('button', { name: 'Rename order' }).click();
  await expect(page.getByLabel('Order name')).toHaveText('QM-1042');
});

test('a popup is captured before the click and remains a separate Page', async ({ page }) => {
  await page.setContent(`
    <h1>Orders</h1>
    <button type="button">Open invoice</button>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        const popup = window.open('', '_blank');
        popup.document.write('<h1>Invoice QM-1042</h1>');
        popup.document.close();
      });
    </script>
  `);

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open invoice' }).click();
  const invoicePage = await popupPromise;

  await expect(invoicePage.getByRole('heading', { name: 'Invoice QM-1042' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
});

test('a download is captured before the trigger and its contents are verified', async ({ page }, testInfo) => {
  await page.route('https://qualitymart.test/orders.csv', async route => {
    await route.fulfill({
      body: 'id,total\nQM-1042,42.00',
      contentType: 'text/csv',
      headers: {
        'content-disposition': 'attachment; filename="orders.csv"'
      }
    });
  });

  await page.setContent(`
    <a href="https://qualitymart.test/orders.csv">Export CSV</a>
  `);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  const savedPath = testInfo.outputPath('orders.csv');

  expect(download.suggestedFilename()).toBe('orders.csv');
  await download.saveAs(savedPath);
  await expect(readFile(savedPath, 'utf8')).resolves.toBe('id,total\nQM-1042,42.00');
});
