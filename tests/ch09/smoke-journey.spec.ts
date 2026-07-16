import { expect, test } from '@playwright/test';

test('guest completes the representative checkout journey', {
  tag: ['@smoke', '@critical', '@checkout'],
  annotation: {
    type: 'risk',
    description: 'Customer can pay but no order is created'
  }
}, async ({ page }, testInfo) => {
  await page.route('https://qualitymart.test/**', async route => {
    await route.fulfill({
      contentType: 'text/html',
      body: `
        <main>
          <h1>Checkout</h1>
          <p aria-label="Reviewed total">$42.00</p>
          <button type="button">Place order</button>
          <output aria-label="Order status">Ready</output>
        </main>
        <script>
          document.querySelector('button').addEventListener('click', () => {
            document.querySelector('h1').textContent = 'Order confirmed';
            document.querySelector('output').textContent = 'QM-1042';
          });
        </script>
      `
    });
  });

  await page.goto('/checkout');
  await expect(page.getByLabel('Reviewed total')).toHaveText('$42.00');
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' }))
    .toBeVisible();
  await expect(page.getByLabel('Order status')).toHaveText('QM-1042');

  expect(testInfo.tags).toEqual(expect.arrayContaining([
    '@smoke',
    '@critical',
    '@checkout'
  ]));
});
