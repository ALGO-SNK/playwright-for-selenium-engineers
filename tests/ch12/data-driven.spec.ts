import { expect, test } from '@playwright/test';

const discount = (tier: string, quantity: number) =>
  tier === 'gold' && quantity >= 10 ? 20 : 0;

for (const example of [
  { tier: 'standard', quantity: 10, expected: 0 },
  { tier: 'gold', quantity: 9, expected: 0 },
  { tier: 'gold', quantity: 10, expected: 20 }
]) {
  test(`${example.tier} quantity ${example.quantity}`, () => {
    expect(discount(example.tier, example.quantity)).toBe(example.expected);
  });
}
