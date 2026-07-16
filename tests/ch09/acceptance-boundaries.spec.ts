import { expect, test } from '@playwright/test';

const goldDiscountPercent = (quantity: number) =>
  quantity >= 10 ? 20 : 0;

for (const example of [
  { quantity: 9, expected: 0, label: 'below boundary' },
  { quantity: 10, expected: 20, label: 'at boundary' },
  { quantity: 11, expected: 20, label: 'above boundary' }
]) {
  test(`gold discount is correct ${example.label}`, () => {
    expect(goldDiscountPercent(example.quantity)).toBe(example.expected);
  });
}
