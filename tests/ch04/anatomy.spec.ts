import { expect, test } from '@playwright/test';

test.describe('Catalog search', { tag: ['@smoke', '@catalog'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.route('https://qualitymart.test/', async route => {
      await route.fulfill({
        contentType: 'text/html',
        body: `
          <!doctype html>
          <html lang="en">
            <head><title>QualityMart Catalog</title></head>
            <body>
              <main>
                <h1>QualityMart</h1>
                <label for="search">Search products</label>
                <input id="search" type="search" />
                <button type="button">Search</button>
                <section aria-labelledby="results-heading" hidden>
                  <h2 id="results-heading">Search results</h2>
                  <p data-testid="result-count">2 products</p>
                  <article aria-label="Wireless keyboard">
                    <h3>Wireless keyboard</h3>
                  </article>
                </section>
              </main>
              <script>
                document.querySelector('button').addEventListener('click', () => {
                  document.querySelector('section').hidden = false;
                });
              </script>
            </body>
          </html>
        `
      });
    });

    await page.goto('/');
  });

  test('guest sees matching products after searching by name', {
    annotation: {
      type: 'requirement',
      description: 'QM-CATALOG-002'
    }
  }, async ({ page }) => {
    await test.step('Search the catalog', async () => {
      await page.getByRole('searchbox', { name: 'Search products' })
        .fill('wireless keyboard');
      await page.getByRole('button', { name: 'Search' }).click();
    });

    await test.step('Verify matching results', async () => {
      await expect(page.getByRole('heading', { name: 'Search results' }))
        .toBeVisible();
      await expect(page.getByTestId('result-count')).toHaveText('2 products');
      await expect(page.getByRole('article', { name: 'Wireless keyboard' }))
        .toBeVisible();
    });
  });
});
