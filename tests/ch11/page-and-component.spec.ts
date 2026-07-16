import { expect, test, type Locator, type Page } from '@playwright/test';

class ProductCard {
  constructor(readonly root: Locator) {}

  async addToCart() {
    await this.root.getByRole('button', { name: 'Add to cart' }).click();
  }
}

class CatalogPage {
  readonly results: Locator;

  constructor(readonly page: Page) {
    this.results = page.getByRole('region', { name: 'Search results' });
  }

  async searchFor(term: string) {
    await this.page.getByRole('searchbox').fill(term);
    await this.page.getByRole('button', { name: 'Search' }).click();
  }

  productNamed(name: string) {
    return new ProductCard(this.results.getByRole('article', { name }));
  }
}

test('page and component objects preserve product language and locator scope', async ({ page }) => {
  await page.setContent(`
    <input type="search" aria-label="Search products">
    <button>Search</button>
    <section aria-label="Search results" hidden>
      <article aria-label="Wireless keyboard"><button>Add to cart</button></article>
    </section>
    <output aria-label="Cart count">0</output>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        document.querySelector('section').hidden = false;
      });
      document.querySelector('article button').addEventListener('click', () => {
        document.querySelector('output').textContent = '1';
      });
    </script>
  `);

  const catalog = new CatalogPage(page);
  await catalog.searchFor('keyboard');
  await catalog.productNamed('Wireless keyboard').addToCart();
  await expect(page.getByLabel('Cart count')).toHaveText('1');
});
