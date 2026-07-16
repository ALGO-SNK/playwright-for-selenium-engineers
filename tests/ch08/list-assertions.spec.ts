import { expect, test } from '@playwright/test';

test('exact lists and ordered subsets express different contracts', async ({ page }) => {
  await page.setContent(`
    <ul aria-label="Products">
      <li>Keyboard</li>
      <li>Mouse</li>
      <li>USB hub</li>
      <li>Monitor</li>
    </ul>
  `);

  const products = page.getByRole('listitem');

  await expect(products).toHaveText([
    'Keyboard',
    'Mouse',
    'USB hub',
    'Monitor'
  ]);

  await expect(products).toContainText(['Keyboard', 'Monitor']);
});
