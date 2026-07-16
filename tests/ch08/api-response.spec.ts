import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';

test('an API response oracle combines transport and business evidence', async ({ request }) => {
  const server = createServer((_incoming, outgoing) => {
    outgoing.writeHead(200, { 'content-type': 'application/json' });
    outgoing.end(JSON.stringify({
      id: 'QM-1042',
      status: 'confirmed',
      total: 42
    }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const { port } = server.address() as AddressInfo;
    const response = await request.get(`http://127.0.0.1:${port}/orders/QM-1042`);

    await expect(response).toBeOK();
    expect(await response.json()).toMatchObject({
      id: 'QM-1042',
      status: 'confirmed',
      total: 42
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
