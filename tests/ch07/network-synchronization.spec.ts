import { expect, test } from '@playwright/test';

test('the response waiter starts before the trigger and the final UI is still asserted', async ({ page }) => {
  await page.route('https://qualitymart.test/**', async route => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/orders') {
      await new Promise(resolve => setTimeout(resolve, 60));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'QM-1042', status: 'confirmed' })
      });
      return;
    }

    await route.fulfill({
      contentType: 'text/html',
      body: `
        <button type="button">Place order</button>
        <output aria-label="Order status">Not submitted</output>
        <script>
          document.querySelector('button').addEventListener('click', async () => {
            const response = await fetch('/api/orders', { method: 'POST' });
            const order = await response.json();
            document.querySelector('output').textContent = order.status;
          });
        </script>
      `
    });
  });

  await page.goto('/');

  const responsePromise = page.waitForResponse(response =>
    response.url().endsWith('/api/orders') &&
    response.request().method() === 'POST'
  );

  await page.getByRole('button', { name: 'Place order' }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(201);
  await expect(page.getByLabel('Order status')).toHaveText('confirmed');
});
