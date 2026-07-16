import { expect, test as base, type Page } from '@playwright/test';

class CheckoutPage {
  constructor(readonly page: Page) {}

  async placeOrder() {
    await this.page.getByRole('button', { name: 'Place order' }).click();
  }
}

class PlaceOrderTask {
  constructor(private readonly checkout: CheckoutPage) {}

  async run() {
    const total = await this.checkout.page.getByLabel('Reviewed total').innerText();
    await this.checkout.placeOrder();
    return { total };
  }
}

const test = base.extend<{
  checkout: CheckoutPage;
  placeOrder: PlaceOrderTask;
}>({
  checkout: async ({ page }, use) => {
    await page.setContent(`
      <p aria-label="Reviewed total">$42.00</p>
      <button>Place order</button>
      <h1>Checkout</h1>
      <script>document.querySelector('button').onclick = () =>
        document.querySelector('h1').textContent = 'Order confirmed'</script>
    `);
    await use(new CheckoutPage(page));
  },
  placeOrder: async ({ checkout }, use) => {
    await use(new PlaceOrderTask(checkout));
  }
});

test('a task removes orchestration while final assertions remain visible', async ({
  checkout,
  placeOrder
}) => {
  const result = await placeOrder.run();
  expect(result.total).toBe('$42.00');
  await expect(checkout.page.getByRole('heading', { name: 'Order confirmed' }))
    .toBeVisible();
});
