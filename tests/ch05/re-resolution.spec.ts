import { expect, test } from '@playwright/test';

test('a locator resolves again after the application replaces its button', async ({ page }) => {
  await page.setContent(`
    <main>
      <button type="button">Refresh price</button>
      <output aria-label="Current price">$40.00</output>
    </main>
    <script>
      let price = 40;

      function renderButton() {
        const current = document.querySelector('button');
        const replacement = current.cloneNode(true);

        replacement.addEventListener('click', () => {
          price += 1;
          document.querySelector('output').textContent = '$' + price + '.00';
          renderButton();
        });

        current.replaceWith(replacement);
      }

      renderButton();
    </script>
  `);

  const refreshPrice = page.getByRole('button', { name: 'Refresh price' });
  const currentPrice = page.getByLabel('Current price');

  await refreshPrice.click();
  await expect(currentPrice).toHaveText('$41.00');

  await refreshPrice.click();
  await expect(currentPrice).toHaveText('$42.00');
});
