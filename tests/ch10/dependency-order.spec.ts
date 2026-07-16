import { expect, test as base } from '@playwright/test';

type Fixtures = {
  customer: { id: string };
  order: { id: string; customerId: string };
  lifecycle: string[];
};

const test = base.extend<Fixtures>({
  lifecycle: async ({}, use) => {
    await use([]);
  },
  customer: async ({ lifecycle }, use) => {
    lifecycle.push('customer setup');
    await use({ id: 'C-1042' });
    lifecycle.push('customer teardown');
  },
  order: async ({ customer, lifecycle }, use) => {
    lifecycle.push('order setup');
    await use({ id: 'QM-1042', customerId: customer.id });
    lifecycle.push('order teardown');
  }
});

test('dependencies set up before the fixture requested by the test', async ({
  lifecycle,
  order
}) => {
  expect(order).toEqual({ id: 'QM-1042', customerId: 'C-1042' });
  expect(lifecycle).toEqual(['customer setup', 'order setup']);
});
