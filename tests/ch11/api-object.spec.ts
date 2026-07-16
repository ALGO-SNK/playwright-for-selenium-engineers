import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type APIRequestContext } from '@playwright/test';

class OrdersApi {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string
  ) {}

  async createDraft() {
    const response = await this.request.post(`${this.baseURL}/orders`);
    if (!response.ok()) throw new Error(`Create failed: HTTP ${response.status()}`);
    return await response.json() as { id: string; status: string };
  }
}

test('an API object owns transport mechanics and returns domain evidence', async ({ request }) => {
  const server = createServer((_incoming, outgoing) => {
    outgoing.writeHead(201, { 'content-type': 'application/json' });
    outgoing.end(JSON.stringify({ id: 'QM-1042', status: 'draft' }));
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address() as AddressInfo;
    const order = await new OrdersApi(request, `http://127.0.0.1:${port}`).createDraft();
    expect(order).toEqual({ id: 'QM-1042', status: 'draft' });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close(error => error ? reject(error) : resolve()));
  }
});
