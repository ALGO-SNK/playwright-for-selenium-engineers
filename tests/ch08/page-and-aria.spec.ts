import { expect, test } from '@playwright/test';

test('page identity and accessible structure protect different claims', async ({ page }) => {
  await page.route('https://qualitymart.test/**', async route => {
    await route.fulfill({
      contentType: 'text/html',
      body: `
        <!doctype html>
        <html>
          <head><title>Order QM-1042</title></head>
          <body>
            <main>
              <h1>Order confirmed</h1>
              <section aria-label="Order summary">
                <h2>Order summary</h2>
                <ul>
                  <li>Keyboard, quantity 1</li>
                  <li>Mouse, quantity 1</li>
                </ul>
                <p>Total $42.00</p>
                <button type="button">Download receipt</button>
              </section>
            </main>
          </body>
        </html>
      `
    });
  });

  await page.goto('/orders/QM-1042');

  await expect(page).toHaveURL(/\/orders\/QM-1042$/);
  await expect(page).toHaveTitle('Order QM-1042');
  await expect(page).toMatchAriaSnapshot(`
    - main:
      - heading "Order confirmed" [level=1]
      - region "Order summary":
        - heading "Order summary" [level=2]
        - list:
          - listitem: Keyboard, quantity 1
          - listitem: Mouse, quantity 1
        - paragraph: Total $42.00
        - button "Download receipt"
  `);
});
