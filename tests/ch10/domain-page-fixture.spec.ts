import { expect, test as base, type Page } from '@playwright/test';

class CatalogPage {
  constructor(readonly page: Page) {}

  async search(term: string) {
    await this.page.getByRole('searchbox').fill(term);
    await this.page.getByRole('button', { name: 'Search' }).click();
  }
}

const test = base.extend<{ catalogPage: CatalogPage }>({
  catalogPage: async ({ page }, use) => {
    await page.setContent(`
      <label>Search products <input type="search"></label>
      <button type="button">Search</button>
      <output aria-label="Result count">0 products</output>
      <script>
        document.querySelector('button').addEventListener('click', () => {
          document.querySelector('output').textContent = '2 products';
        });
      </script>
    `);

    await use(new CatalogPage(page));
  }
});

test('a domain fixture removes plumbing while the scenario stays visible', async ({
  catalogPage
}) => {
  await catalogPage.search('keyboard');
  await expect(catalogPage.page.getByLabel('Result count')).toHaveText('2 products');
});
