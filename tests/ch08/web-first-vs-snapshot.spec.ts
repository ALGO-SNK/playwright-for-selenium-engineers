import { expect, test } from '@playwright/test';

test('a snapshot stays historical while a web-first assertion observes change', async ({ page }) => {
  await page.setContent(`
    <output aria-label="Order status">Processing</output>
    <script>
      setTimeout(() => {
        document.querySelector('output').textContent = 'Confirmed';
      }, 80);
    </script>
  `);

  const status = page.getByLabel('Order status');
  const initialSnapshot = await status.textContent();

  expect(initialSnapshot).toBe('Processing');
  await expect(status).toHaveText('Confirmed');
  expect(initialSnapshot).toBe('Processing');
});
