import { expect, test } from '@playwright/test';

test('a disappearance assertion follows a known starting state', async ({ page }) => {
  await page.setContent(`
    <button type="button">Place order</button>
    <p aria-label="Progress" hidden>Processing payment</p>
    <h1>Checkout</h1>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        const progress = document.querySelector('[aria-label="Progress"]');
        progress.hidden = false;

        setTimeout(() => {
          progress.hidden = true;
          document.querySelector('h1').textContent = 'Order confirmed';
        }, 80);
      });
    </script>
  `);

  const progress = page.getByLabel('Progress');

  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(progress).toBeVisible();
  await expect(progress).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Order confirmed' }))
    .toBeVisible();
});

test('soft assertions collect independent evidence before a hard checkpoint', async ({ page }) => {
  await page.setContent(`
    <main>
      <output aria-label="Order status">Confirmed</output>
      <output aria-label="Order total">$42.00</output>
      <output aria-label="Delivery method">Express</output>
      <a href="#receipt">View receipt</a>
      <h2 id="receipt">Receipt</h2>
    </main>
  `);

  await expect.soft(page.getByLabel('Order status'), 'order status')
    .toHaveText('Confirmed');
  await expect.soft(page.getByLabel('Order total'), 'charged total')
    .toHaveText('$42.00');
  await expect.soft(page.getByLabel('Delivery method'), 'delivery method')
    .toHaveText('Express');

  expect(test.info().errors).toHaveLength(0);

  await page.getByRole('link', { name: 'View receipt' }).click();
  await expect(page.getByRole('heading', { name: 'Receipt' })).toBeVisible();
});
