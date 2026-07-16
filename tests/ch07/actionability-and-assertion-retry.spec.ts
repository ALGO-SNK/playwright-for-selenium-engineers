import { expect, test } from '@playwright/test';

test('a normal click waits until the target receives pointer events', async ({ page }) => {
  await page.setContent(`
    <style>
      [data-testid="overlay"] {
        position: fixed;
        inset: 0;
        z-index: 10;
        background: rgb(255 255 255 / 60%);
      }
    </style>
    <button type="button">Place order</button>
    <div data-testid="overlay">Checking inventory…</div>
    <output aria-label="Order status">Not submitted</output>
    <script>
      const button = document.querySelector('button');
      const overlay = document.querySelector('[data-testid="overlay"]');
      const status = document.querySelector('output');

      setTimeout(() => overlay.remove(), 80);
      button.addEventListener('click', () => {
        status.textContent = 'Submitted';
      });
    </script>
  `);

  await page.getByRole('button', { name: 'Place order' }).click();

  await expect(page.getByLabel('Order status')).toHaveText('Submitted');
});

test('a web-first assertion retries the observation, not the preceding action', async ({ page }) => {
  await page.setContent(`
    <output aria-label="Order status">Processing</output>
    <script>
      setTimeout(() => {
        document.querySelector('output').textContent = 'Confirmed';
      }, 80);
    </script>
  `);

  await expect(page.getByLabel('Order status')).toHaveText('Confirmed');
});
