import { expect, test } from '@playwright/test';

test('browser events flow back to client listeners', async ({ page }) => {
  const consoleMessages: string[] = [];
  page.on('console', message => consoleMessages.push(message.text()));

  await page.setContent(`
    <button type="button">Pay now</button>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        console.log('payment-clicked');
      });
    </script>
  `);

  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect.poll(() => consoleMessages).toContain('payment-clicked');
});
