import { expect, test } from '@playwright/test';

class OrderBuilder {
  private quantity = 1;
  withQuantity(value: number) { this.quantity = value; return this; }
  build() { return { sku: 'KEY-001', quantity: this.quantity }; }
}

interface PaymentStrategy { authorize(): { approved: boolean } }
class Approve implements PaymentStrategy { authorize() { return { approved: true }; } }
class Decline implements PaymentStrategy { authorize() { return { approved: false }; } }
const createPayment = (mode: 'approve' | 'decline'): PaymentStrategy =>
  mode === 'approve' ? new Approve() : new Decline();

interface OrdersPort { create(): { id: string } }
class OrdersApi implements OrdersPort { create() { return { id: 'QM-1042' }; } }
class LoggedOrders implements OrdersPort {
  readonly events: string[] = [];
  constructor(private readonly inner: OrdersPort) {}
  create() {
    this.events.push('create:start');
    const order = this.inner.create();
    this.events.push(`create:success:${order.id}`);
    return order;
  }
}

class CommerceFacade {
  constructor(private readonly orders: OrdersPort) {}
  createPaidOrder() { return { ...this.orders.create(), status: 'paid' }; }
}

test('builder creates readable independent scenario data', () => {
  const builder = new OrderBuilder();
  expect(builder.withQuantity(10).build()).toEqual({ sku: 'KEY-001', quantity: 10 });
  expect(builder.withQuantity(1).build()).toEqual({ sku: 'KEY-001', quantity: 1 });
});

test('factory selects a strategy implementation', () => {
  expect(createPayment('approve').authorize()).toEqual({ approved: true });
  expect(createPayment('decline').authorize()).toEqual({ approved: false });
});

test('decorator adds diagnostics while preserving the interface', () => {
  const orders = new LoggedOrders(new OrdersApi());
  expect(orders.create()).toEqual({ id: 'QM-1042' });
  expect(orders.events).toEqual(['create:start', 'create:success:QM-1042']);
});

test('facade coordinates a narrow subsystem operation', () => {
  expect(new CommerceFacade(new OrdersApi()).createPaidOrder())
    .toEqual({ id: 'QM-1042', status: 'paid' });
});
