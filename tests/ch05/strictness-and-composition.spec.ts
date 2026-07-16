import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.setContent(`
    <main>
      <h1>Products</h1>
      <section aria-label="Catalog">
        <article aria-label="Wireless keyboard">
          <h2>Wireless keyboard</h2>
          <button type="button">Add to cart</button>
        </article>
        <article aria-label="Laptop stand">
          <h2>Laptop stand</h2>
          <button type="button">Add to cart</button>
        </article>
        <article aria-label="USB-C cable">
          <h2>USB-C cable</h2>
          <button type="button">Add to cart</button>
        </article>
      </section>
      <p>Cart: <span data-testid="cart-count">0</span></p>
    </main>
    <script>
      let count = 0;
      document.querySelectorAll('article button').forEach(button => {
        button.addEventListener('click', () => {
          count += 1;
          document.querySelector('[data-testid="cart-count"]').textContent = String(count);
        });
      });
    </script>
  `);
});

test('list operations accept multiple matches while a click is strict', async ({ page }) => {
  const addButtons = page.getByRole('button', { name: 'Add to cart' });

  await expect(addButtons).toHaveCount(3);
  await expect(addButtons.click()).rejects.toThrow(/strict mode violation/i);
});

test('filtering by business identity selects the intended product', async ({ page }) => {
  const keyboard = page
    .getByRole('article')
    .filter({ hasText: 'Wireless keyboard' });

  await keyboard.getByRole('button', { name: 'Add to cart' }).click();

  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
