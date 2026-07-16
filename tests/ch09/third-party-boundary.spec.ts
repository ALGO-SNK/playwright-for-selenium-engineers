import { expect, test } from '@playwright/test';

test('a gating test controls third-party failure and verifies the owned fallback', async ({ page }) => {
  await page.route('https://recommendations.example/**', async route => {
    await route.abort('connectionfailed');
  });

  await page.route('https://qualitymart.test/**', async route => {
    await route.fulfill({
      contentType: 'text/html',
      body: `
        <main>
          <h1>Product details</h1>
          <section aria-label="Recommendations">Loading recommendations</section>
        </main>
        <script>
          fetch('https://recommendations.example/suggestions')
            .then(response => response.json())
            .then(() => {})
            .catch(() => {
              document.querySelector('section').textContent =
                'Recommendations are temporarily unavailable';
            });
        </script>
      `
    });
  });

  await page.goto('/products/KEY-001');

  await expect(page.getByRole('region', { name: 'Recommendations' }))
    .toHaveText('Recommendations are temporarily unavailable');
});
