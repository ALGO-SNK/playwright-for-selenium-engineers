import { expect, test } from '@playwright/test';

test.describe('Chapter 1 — actionability is not business readiness', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://qualitymart.test/checkout', async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: `
          <!doctype html>
          <html lang="en">
            <head><title>QualityMart Checkout</title></head>
            <body>
              <label for="address">Delivery address</label>
              <select id="address">
                <option value="home">Home</option>
                <option value="office">Office</option>
              </select>

              <p>Total: <span data-testid="order-total">$40.00</span></p>
              <button type="button" disabled>Pay now</button>
              <p data-testid="order-number" hidden></p>

              <script>
                const address = document.querySelector('#address');
                const total = document.querySelector('[data-testid="order-total"]');
                const pay = document.querySelector('button');
                const orderNumber = document.querySelector('[data-testid="order-number"]');

                address.addEventListener('change', async () => {
                  pay.disabled = true;
                  const response = await fetch('/api/checkout/quote', {
                    method: 'POST',
                    body: JSON.stringify({ address: address.value })
                  });
                  const quote = await response.json();
                  total.textContent = quote.total;
                  pay.disabled = false;
                });

                pay.addEventListener('click', () => {
                  orderNumber.textContent = 'QM-10001';
                  orderNumber.hidden = false;
                });
              </script>
            </body>
          </html>
        `
      });
    });

    await page.route('https://qualitymart.test/api/checkout/quote', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ total: '$42.00' })
      });
    });

    await page.goto('/checkout');
  });

  test('waits for a business signal before payment', async ({ page }) => {
    const quoteUpdated = page.waitForResponse(response =>
      response.url().endsWith('/api/checkout/quote') &&
      response.request().method() === 'POST' &&
      response.ok()
    );

    await page.getByLabel('Delivery address').selectOption('office');
    await quoteUpdated;
    await expect(page.getByTestId('order-total')).toHaveText('$42.00');

    await page.getByRole('button', { name: 'Pay now' }).click();
    await expect(page.getByTestId('order-number')).toHaveText('QM-10001');
  });
});
