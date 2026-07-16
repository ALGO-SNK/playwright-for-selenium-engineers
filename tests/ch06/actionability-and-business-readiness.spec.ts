import { expect, test } from '@playwright/test';

test('mechanical actionability and business readiness are separate contracts', async ({ page }) => {
  await page.setContent(`
    <main>
      <h1>Shipping quote</h1>
      <button type="button" disabled>Book shipment</button>
      <output aria-label="Quote status">Calculating quote…</output>
    </main>
    <script>
      const button = document.querySelector('button');
      const status = document.querySelector('output');

      setTimeout(() => {
        button.disabled = false;
      }, 20);

      setTimeout(() => {
        status.textContent = 'Quote ready: $12.00';
      }, 80);

      button.addEventListener('click', () => {
        status.textContent = status.textContent.startsWith('Quote ready')
          ? 'Shipment booked'
          : 'Booking rejected: quote not ready';
      });
    </script>
  `);

  const bookShipment = page.getByRole('button', { name: 'Book shipment' });
  const quoteStatus = page.getByLabel('Quote status');

  await expect(bookShipment).toBeEnabled();
  await expect(quoteStatus).toHaveText('Quote ready: $12.00');
  await bookShipment.click();

  await expect(quoteStatus).toHaveText('Shipment booked');
});
