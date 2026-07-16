import { expect, test } from '@playwright/test';

test('frame scope stays inside the frame-locator chain', async ({ page }) => {
  await page.setContent(`
    <main>
      <h1>Checkout</h1>
      <iframe
        title="Secure payment"
        srcdoc="
          <label for='card'>Card number</label>
          <input id='card' />
          <button type='button'>Pay</button>
        "
      ></iframe>
    </main>
  `);

  const payment = page.frameLocator('iframe[title="Secure payment"]');

  await payment.getByLabel('Card number').fill('4111111111111111');
  await expect(payment.getByLabel('Card number')).toHaveValue('4111111111111111');
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
});

test('semantic locators pierce an open shadow root', async ({ page }) => {
  await page.setContent(`
    <main>
      <h1>Catalog</h1>
      <product-card></product-card>
    </main>
    <script>
      const host = document.querySelector('product-card');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<button type="button">Add to cart</button>';
    </script>
  `);

  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
});
