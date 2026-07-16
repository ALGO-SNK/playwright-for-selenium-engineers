import { expect, test } from '@playwright/test';

test('fill replaces the value and emits one input event', async ({ page }) => {
  await page.setContent(`
    <label>
      Customer name
      <input value="Old customer">
    </label>
    <output aria-label="Input event count">0</output>
    <script>
      const input = document.querySelector('input');
      const count = document.querySelector('output');
      input.addEventListener('input', () => {
        count.textContent = String(Number(count.textContent) + 1);
      });
    </script>
  `);

  await page.getByLabel('Customer name').fill('Ada Lovelace');

  await expect(page.getByLabel('Customer name')).toHaveValue('Ada Lovelace');
  await expect(page.getByLabel('Input event count')).toHaveText('1');
});

test('pressSequentially drives per-key behavior when the widget requires it', async ({ page }) => {
  await page.setContent(`
    <label>
      Search products
      <input>
    </label>
    <output aria-label="Key sequence"></output>
    <script>
      const input = document.querySelector('input');
      const sequence = document.querySelector('output');
      input.addEventListener('keydown', event => {
        sequence.textContent += event.key;
      });
    </script>
  `);

  await page.getByLabel('Search products').pressSequentially('QA');

  await expect(page.getByLabel('Search products')).toHaveValue('QA');
  await expect(page.getByLabel('Key sequence')).toHaveText('QA');
});

test('control-specific actions express checkbox and select intent', async ({ page }) => {
  await page.setContent(`
    <label><input type="checkbox"> Include gift receipt</label>
    <label>
      Delivery speed
      <select>
        <option value="standard">Standard</option>
        <option value="express">Express</option>
      </select>
    </label>
  `);

  const giftReceipt = page.getByRole('checkbox', { name: 'Include gift receipt' });
  await giftReceipt.check();
  await expect(giftReceipt).toBeChecked();

  await giftReceipt.setChecked(false);
  await expect(giftReceipt).not.toBeChecked();

  await page.getByLabel('Delivery speed').selectOption({ label: 'Express' });
  await expect(page.getByLabel('Delivery speed')).toHaveValue('express');
});
