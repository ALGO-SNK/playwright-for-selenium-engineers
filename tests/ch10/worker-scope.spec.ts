import { expect, test as base } from '@playwright/test';

type WorkerFixtures = {
  catalogSnapshot: {
    version: string;
    parallelSlot: number;
    products: readonly string[];
  };
};

const test = base.extend<{}, WorkerFixtures>({
  catalogSnapshot: [async ({}, use, workerInfo) => {
    await use({
      version: 'catalog-v1',
      parallelSlot: workerInfo.parallelIndex,
      products: Object.freeze(['KEY-001', 'MOU-001'])
    });
  }, { scope: 'worker' }]
});

test('worker scope shares an immutable reference snapshot', async ({
  catalogSnapshot
}) => {
  expect(catalogSnapshot.version).toBe('catalog-v1');
  expect(catalogSnapshot.parallelSlot).toBeGreaterThanOrEqual(0);
  expect(catalogSnapshot.products).toContain('KEY-001');
});
