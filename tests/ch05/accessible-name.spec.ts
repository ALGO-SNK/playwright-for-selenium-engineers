import { expect, test } from '@playwright/test';

test('role-and-name and placeholder locators describe different contracts', async ({ page }) => {
  await page.setContent(`
    <main>
      <span id="search-label">Search products</span>
      <input
        type="search"
        aria-labelledby="search-label"
        placeholder="What do you need?"
      />
    </main>
  `);

  const byAccessibleName = page.getByRole('searchbox', { name: 'Search products' });
  const byPlaceholder = page.getByPlaceholder('What do you need?');

  await byAccessibleName.fill('wireless keyboard');
  await expect(byPlaceholder).toHaveValue('wireless keyboard');

  expect(await byAccessibleName.ariaSnapshot()).toContain('searchbox "Search products"');
});
