import { expect, test } from '@playwright/test';

test('expect.poll observes one eventually consistent value', async ({ page }) => {
  await page.setContent(`
    <main data-order-status="processing"></main>
    <script>
      setTimeout(() => {
        document.querySelector('main').dataset.orderStatus = 'confirmed';
      }, 80);
    </script>
  `);

  await expect.poll(async () =>
    page.locator('main').getAttribute('data-order-status'),
  {
    message: 'order projection should become confirmed',
    timeout: 2_000,
    intervals: [25, 50, 100]
  }).toBe('confirmed');
});

test('toPass retries a read-only block of related observations', async ({ page }) => {
  await page.setContent(`
    <main data-order-status="processing" data-order-total="0"></main>
    <script>
      setTimeout(() => {
        const order = document.querySelector('main');
        order.dataset.orderStatus = 'confirmed';
        order.dataset.orderTotal = '42';
      }, 80);
    </script>
  `);

  await expect(async () => {
    const order = page.locator('main');
    expect(await order.getAttribute('data-order-status')).toBe('confirmed');
    expect(await order.getAttribute('data-order-total')).toBe('42');
  }).toPass({
    timeout: 2_000,
    intervals: [25, 50, 100]
  });
});
