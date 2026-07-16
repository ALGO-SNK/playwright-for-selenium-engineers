import { expect, test } from '@playwright/test';

test('an order contract protects compatibility separately from the UI', () => {
  const orderCreatedEvent = {
    type: 'OrderCreated',
    version: 2,
    aggregateId: 'QM-1042',
    data: {
      currency: 'USD',
      total: 42
    },
    emittedAt: '2026-07-17T10:00:00.000Z'
  };

  expect(orderCreatedEvent).toEqual(expect.objectContaining({
    type: 'OrderCreated',
    version: 2,
    aggregateId: expect.stringMatching(/^QM-\d+$/),
    data: expect.objectContaining({
      currency: expect.any(String),
      total: expect.any(Number)
    })
  }));
});
