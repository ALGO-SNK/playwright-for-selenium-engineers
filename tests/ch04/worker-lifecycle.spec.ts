import { expect, test } from '@playwright/test';

test.describe('worker lifecycle', () => {
  let setupWorkerIndex: number;

  test.beforeAll(async ({}, testInfo) => {
    setupWorkerIndex = testInfo.workerIndex;
  });

  test('first test runs in the worker that executed its suite setup', async ({}, testInfo) => {
    expect(testInfo.workerIndex).toBe(setupWorkerIndex);
  });

  test('second test runs in the worker that executed its suite setup', async ({}, testInfo) => {
    expect(testInfo.workerIndex).toBe(setupWorkerIndex);
  });
});
