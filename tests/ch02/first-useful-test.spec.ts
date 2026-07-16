import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://qualitymart.test/', async route => {
    await route.fulfill({
      contentType: 'text/html',
      body: `
        <!doctype html>
        <html lang="en">
          <head><title>QualityMart</title></head>
          <body>
            <main>
              <h1>QualityMart</h1>
              <label for="search">Search products</label>
              <input id="search" type="search" />
              <button type="button">Search</button>
              <section aria-labelledby="results-heading" hidden>
                <h2 id="results-heading">Search results</h2>
                <p data-testid="result-count">2 products</p>
              </section>
            </main>
            <script>
              const button = document.querySelector('button');
              const results = document.querySelector('section');
              button.addEventListener('click', () => {
                results.hidden = false;
              });
            </script>
          </body>
        </html>
      `
    });
  });
});

test('guest can search the catalog', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('searchbox', { name: 'Search products' })
    .fill('wireless keyboard');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByRole('heading', { name: 'Search results' }))
    .toBeVisible();
  await expect(page.getByTestId('result-count'))
    .toHaveText(/\d+ products?/);
});
