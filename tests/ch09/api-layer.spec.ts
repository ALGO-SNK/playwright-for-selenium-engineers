import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';

test('dense pricing rules can be checked below the UI', async ({ request }) => {
  const server = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
    const quote = JSON.parse(Buffer.concat(chunks).toString()) as {
      quantity: number;
      customerTier: string;
    };

    const discountPercent =
      quote.customerTier === 'gold' && quote.quantity >= 10 ? 20 : 0;

    outgoing.writeHead(200, { 'content-type': 'application/json' });
    outgoing.end(JSON.stringify({ discountPercent, currency: 'USD' }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const { port } = server.address() as AddressInfo;
    const response = await request.post(`http://127.0.0.1:${port}/quotes`, {
      data: { quantity: 10, customerTier: 'gold' }
    });

    await expect(response).toBeOK();
    expect(await response.json()).toEqual({
      discountPercent: 20,
      currency: 'USD'
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
