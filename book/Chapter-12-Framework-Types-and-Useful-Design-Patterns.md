# Chapter 12 — Framework Types and Useful Design Patterns

An automation framework is not a folder tree with a `BasePage`.

It is the set of conventions, abstractions, extension points, and execution policies that help a team create trustworthy tests repeatedly. A framework should make the preferred path easy and unsafe behavior visible.

Framework labels—data-driven, keyword-driven, BDD, hybrid—are descriptions, not maturity levels. Design patterns—factory, builder, strategy, facade, command, decorator, dependency injection—are tools, not items to collect.

The useful question is:

> Which recurring problem does this structure solve, and what complexity does it introduce?

## What you will learn

By the end of this chapter, you will be able to:

- distinguish linear, modular, data-driven, keyword-driven, hybrid, and BDD frameworks;
- choose a framework style based on team, product, and portfolio needs;
- apply factory, builder, strategy, facade, command, decorator, and dependency-injection patterns;
- separate singleton configuration from a singleton-browser anti-pattern;
- prefer composition over base-class inheritance;
- identify pattern theatre and over-engineering; and
- answer framework-design interview questions with concrete trade-offs.

---

## 12.1 Framework type describes the dominant authoring model

### Linear

A linear test keeps setup, actions, and assertions in one file:

```ts
test('guest checks out', async ({ page }) => {
  await page.goto('/catalog');
  await page.getByRole('button', { name: 'Add keyboard to cart' }).click();
  await page.getByRole('link', { name: 'Checkout' }).click();
  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('heading', { name: 'Order confirmed' }))
    .toBeVisible();
});
```

Linear code is not automatically primitive. It is often the clearest starting point for a small suite or unique scenario. Its weakness appears when stable behavior is duplicated widely.

### Modular

A modular framework extracts cohesive pages, components, tasks, fixtures, and APIs. Chapter 11 built this model.

Use it when product behavior repeats and teams benefit from shared domain vocabulary. Avoid extracting generic wrappers that add no meaning.

### Data-driven

The scenario structure stays stable while inputs and expected outcomes vary:

```ts
for (const example of [
  { tier: 'standard', quantity: 10, discount: 0 },
  { tier: 'gold', quantity: 9, discount: 0 },
  { tier: 'gold', quantity: 10, discount: 20 }
]) {
  test(`${example.tier} quantity ${example.quantity}`, async ({ request }) => {
    const quote = await createQuote(request, example);
    expect(quote.discountPercent).toBe(example.discount);
  });
}
```

Playwright supports test-level parameterization and project-level options. Data-driven testing is strongest for real partitions and boundaries. It becomes harmful when giant spreadsheets encode actions, selectors, waits, and assertions as untyped cells.

### Keyword-driven

A keyword system maps terms such as `OpenPage`, `Fill`, `Click`, and `VerifyText` to executable commands.

It can help when non-programmers genuinely author tests through a governed domain language or when an organization already owns a mature execution platform. It often creates a second programming language with weaker typing, debugging, refactoring, and IDE support.

Prefer business keywords:

```text
CreateGoldCustomer
RequestQuote
PlaceOrder
VerifyConfirmedTotal
```

Avoid browser keywords that merely serialize Playwright:

```text
Click | css=.button:nth-child(2)
Wait  | 5000
Text  | #result | Confirmed
```

### BDD

Behavior-driven development uses examples to create shared understanding among product, engineering, and testing. Given/When/Then syntax can support that conversation.

BDD is not synonymous with Cucumber, feature files, or step-definition layers. If nobody outside automation reviews the examples, a second syntax may add indirection without collaboration.

### Hybrid

Most production frameworks are hybrid: modular objects, fixture-based dependency injection, data-driven boundary cases, and a few BDD specifications for cross-functional workflows.

“Hybrid” should identify deliberate combination, not mean “we added every pattern.”

| Style | Best fit | Main risk |
|---|---|---|
| Linear | small or unique scenarios | duplication |
| Modular | repeated domain behavior | premature abstraction |
| Data-driven | partitions and combinations | opaque data tables |
| Keyword-driven | governed non-code authoring | weak second language |
| BDD | collaborative executable examples | step-definition indirection |
| Hybrid | mixed portfolio needs | inconsistent conventions |

---

## 12.2 Patterns should earn their names

A pattern is a reusable design response to a recurring problem. Do not name every helper a pattern or force code into a catalogue.

Evaluate a pattern by:

1. the variation it isolates;
2. the coupling it removes;
3. the failure diagnostics it preserves;
4. the authoring cost it adds; and
5. whether the team can maintain it.

> **Interview answer: What framework type do you prefer?**
>
> “Usually a typed hybrid: direct tests where simple, modular domain objects for stable reuse, fixtures for dependencies, and data-driven cases for genuine partitions. I use BDD or keywords only when they solve a collaboration or authoring need. The framework follows risk, team skills, and product architecture.”

---

## 12.3 Factory selects an implementation

A factory centralizes object selection when configuration chooses among implementations.

```ts
interface PaymentDriver {
  authorize(amount: number): Promise<{ approved: boolean }>;
}

class SandboxPayment implements PaymentDriver {
  async authorize() {
    return { approved: true };
  }
}

class DecliningPayment implements PaymentDriver {
  async authorize() {
    return { approved: false };
  }
}

function createPaymentDriver(mode: 'sandbox' | 'decline'): PaymentDriver {
  return mode === 'decline'
    ? new DecliningPayment()
    : new SandboxPayment();
}
```

Use factories for browser-independent provider modes, role-specific clients, test-data sources, or page objects selected by stable variants.

Do not create `PageObjectFactory.get('checkout')` when `new CheckoutPage(page)` is clearer and type-safe.

---

## 12.4 Builder creates valid complex data

Builders make defaults explicit and allow relevant variation:

```ts
class OrderBuilder {
  private value: CreateOrderRequest = {
    customerId: 'customer-default',
    currency: 'USD',
    lines: [{ sku: 'KEY-001', quantity: 1 }]
  };

  forCustomer(customerId: string) {
    this.value.customerId = customerId;
    return this;
  }

  withQuantity(quantity: number) {
    this.value.lines = [{ sku: 'KEY-001', quantity }];
    return this;
  }

  build(): CreateOrderRequest {
    return structuredClone(this.value);
  }
}
```

Good builders:

- produce valid objects by default;
- make scenario-relevant variation readable;
- validate impossible combinations;
- return independent objects; and

- do not silently create backend data.

Separate building data from persisting it. A fixture or API object owns creation and cleanup.

---

## 12.5 Strategy swaps one algorithm or policy

```ts
interface CleanupStrategy {
  cleanup(orderId: string): Promise<void>;
}

class DeleteOrder implements CleanupStrategy {
  constructor(private readonly orders: OrdersApi) {}
  async cleanup(id: string) { await this.orders.delete(id); }
}

class RetainOnFailure implements CleanupStrategy {
  constructor(
    private readonly orders: OrdersApi,
    private readonly failed: () => boolean
  ) {}

  async cleanup(id: string) {
    if (!this.failed()) await this.orders.delete(id);
  }
}
```

Strategies are useful when one policy varies: cleanup, retry classification, environment selection, screenshot masking, or test-data allocation.

Avoid a strategy interface with one implementation and no expected variation. That is speculative indirection.

---

## 12.6 Facade presents a narrow subsystem API

A facade coordinates several lower-level capabilities:

```ts
class CommerceFacade {
  constructor(
    private readonly customers: CustomersApi,
    private readonly orders: OrdersApi,
    private readonly payments: PaymentsApi
  ) {}

  async createPaidOrder(input: PaidOrderInput) {
    const customer = await this.customers.create(input.customer);
    const order = await this.orders.create(customer.id, input.lines);
    await this.payments.authorize(order.id, input.payment);
    return order;
  }
}
```

Facades are useful for test setup and stable subsystem operations. They become god objects when they expose every domain through one `App` class.

The test should still show the protected action and oracle. Use a facade to establish prerequisites, not hide the scenario under test.

---

## 12.7 Command represents an executable action

```ts
interface Command<T> {
  execute(): Promise<T>;
}

class PlaceOrderCommand implements Command<{ orderId: string }> {
  constructor(private readonly checkout: CheckoutPage) {}

  async execute() {
    await this.checkout.placeOrder();
    return { orderId: await this.checkout.orderId.innerText() };
  }
}
```

Commands help when actions must be queued, logged, retried under controlled policy, composed, or generated from a domain specification.

A method is simpler when no command lifecycle exists. Do not wrap every click in a class.

---

## 12.8 Decorator adds behavior without changing the subject

```ts
class LoggedOrdersApi implements OrdersPort {
  constructor(
    private readonly inner: OrdersPort,
    private readonly log: Logger
  ) {}

  async create(request: CreateOrderRequest) {
    this.log.info('creating order', { customerId: request.customerId });
    const result = await this.inner.create(request);
    this.log.info('created order', { orderId: result.id });
    return result;
  }
}
```

Decorators can add logging, metrics, redaction, caching, or diagnostics while preserving an interface.

Do not use decorators to swallow failures, add blind retries around mutations, or change business meaning invisibly.

Playwright's `test.step()` is often enough when the need is readable reporting rather than a reusable object decorator.

---

## 12.9 Dependency injection connects patterns

Chapter 10 showed Playwright fixtures as dependency injection:

```ts
const test = base.extend<{
  orders: OrdersApi;
  orderBuilder: OrderBuilder;
}>({
  orders: async ({ request }, use) => {
    await use(new OrdersApi(request));
  },
  orderBuilder: async ({}, use) => {
    await use(new OrderBuilder());
  }
});
```

Dependencies arrive from outside rather than being constructed secretly. This enables:

- test-scoped ownership;
- typed substitution;
- explicit configuration;
- controlled provider strategies; and

- composition without inheritance.

Avoid service-locator code such as `Container.get('orders')` inside page objects. It hides dependencies and weakens types.

---

## 12.10 Singleton configuration versus singleton browser

An immutable configuration value loaded and validated once can be reasonable:

```ts
export const environment = Object.freeze({
  apiURL: requireURL('API_URL'),
  tenant: requireString('TEST_TENANT')
});
```

The value has no mutable test state.

A singleton browser context or page is dangerous:

```ts
// Anti-pattern
export const sharedPage = await browser.newPage();
```

It shares cookies, storage, navigation, open dialogs, routes, and failure state. It conflicts with parallelism, retries, and Playwright's built-in isolation.

Playwright already shares the browser efficiently while providing isolated contexts/pages per test. Do not trade isolation for an unmeasured optimization.

> **Interview answer: Is Singleton useful in automation?**
>
> “An immutable validated configuration module can behave like a singleton safely. A singleton page, context, account, or mutable data store is an anti-pattern because tests leak state and break parallelism and retries. I use runner-managed fixture scopes instead.”

---

## 12.11 Composition over framework inheritance

Inheritance answers “is a.” Test architecture usually needs “uses a.”

```ts
class CheckoutPage {
  constructor(
    readonly page: Page,
    readonly cart: CartPanel,
    readonly payment: PaymentForm
  ) {}
}
```

This is easier to vary than:

```text
BaseTest
  └── AuthenticatedTest
      └── CommerceTest
          └── CheckoutTest
```

Deep base classes hide setup and couple unrelated suites. Fixtures, interfaces, and composed objects make dependencies visible.

Inheritance can be justified for a narrow stable type relationship. It should not be the dependency-management system.

---

## 12.12 BDD and keyword decisions

Use BDD tooling when:

- product and engineering actively refine shared examples;
- feature files are reviewed as requirements;
- domain wording is stable; and

- traceability benefits exceed step-maintenance cost.

Avoid it when feature files are written after implementation by automation engineers and every sentence maps to generic browser steps.

Use keyword-driven tooling when:

- the author population cannot or should not edit code;
- the supported vocabulary is intentionally small;
- schema validation and versioning exist;
- debugging maps failures to business commands; and

- a platform team owns compatibility.

TypeScript data objects and helper functions are usually better for engineering-authored tests.

---

## 12.13 A decision table

| Context | Start with | Add when needed | Avoid initially |
|---|---|---|---|
| 1 team, 50 tests | direct + modular | builders, fixtures | keyword engine |
| Many data boundaries | API + data-driven | builders, strategies | UI spreadsheet matrix |
| Repeated cross-page flows | pages/components | tasks, facade | god page object |
| Multiple provider modes | typed fixtures | factory, strategy | boolean branches everywhere |
| Cross-functional specifications | examples in code | BDD if collaboration is real | feature-file ceremony |
| Non-code test authors | governed keywords | command schema/platform | raw selectors and sleeps |
| Many teams, shared platform | domain packages + DI | decorators, contracts | deep shared inheritance |

Choose the smallest architecture that supports the current portfolio and a plausible next stage.

---

## 12.14 Pattern anti-patterns

- **Pattern theatre:** naming simple constructors factories without a selection problem.
- **Interface explosion:** one interface per class with no substitution boundary.
- **Boolean strategy:** one class with ten flags instead of cohesive implementations.
- **Facade god object:** one entry point for the entire company product.
- **Builder mutation leaks:** `build()` returns the internal object reused by later tests.
- **Decorator surprise:** logging wrapper changes retry or exception semantics.
- **Keyword browser:** untyped spreadsheet reproduces Playwright poorly.
- **BDD duplication:** the same scenario exists in feature files, step code, page objects, and test data.
- **Singleton state:** shared account/page makes order-dependent tests.
- **Framework before portfolio:** months of infrastructure precede the first valuable test.

---

## 12.15 Selenium-to-Playwright migration traps

1. Do not port Java inheritance, driver managers, explicit-wait wrappers, and reflection factories automatically.
2. Replace `WebElement` factories with Playwright locators that re-resolve.
3. Replace base-test setup with typed fixtures and projects.
4. Keep useful builders and domain strategies; remove browser-mechanics wrappers.
5. Review XML/Excel keyword suites as requirements, not mandatory implementation.
6. Preserve business traceability while simplifying technical layers.

---

## 12.16 Interview corner

### What patterns have you used in automation?

“Fixtures for dependency injection and lifecycle, builders for valid test data, strategies for provider or cleanup policies, factories when configuration selects implementations, facades for stable setup operations, and page/component/task objects through composition. I use commands and decorators only when execution lifecycle or cross-cutting behavior justifies them.”

### Data-driven versus keyword-driven?

“Data-driven tests vary inputs and expected results while code owns behavior. Keyword-driven frameworks encode actions in an external vocabulary and need an interpreter. Data-driven is ideal for partitions; keywords are justified mainly for governed non-code authoring.”

### What is a hybrid framework?

“A deliberate combination of models, such as modular objects, fixture DI, parameterized API boundaries, and selected BDD specifications. Hybrid should describe purposeful choices, not accumulation.”

### How do you avoid over-engineering?

“Start with representative tests, extract after stable repetition, require every pattern to isolate real variation, and measure maintenance and diagnostics. Direct Playwright remains acceptable when it is clearest.”

---

## 12.17 Exercises

1. Convert three duplicated order payloads into a valid-by-default builder.
2. Create payment strategies for approval, decline, and timeout.
3. Add a logging decorator to an API object without changing errors.
4. Compare a direct method with a command class and justify the simpler one.
5. Replace a singleton page with test-scoped fixtures.
6. Refactor a four-level base-test hierarchy using composition and DI.
7. Turn a browser-keyword spreadsheet into typed business examples.
8. Decide whether a sample team genuinely benefits from BDD tooling.

---

## 12.18 Review checklist

- Does the framework type match actual authoring and collaboration needs?
- Does data represent real partitions rather than hidden scripts?
- Do keywords express business language and have governed schemas?
- Is BDD producing shared understanding?
- Does each pattern isolate real variation?
- Are factories selecting implementations rather than hiding constructors?
- Do builders return independent valid data?
- Are strategies cohesive and substitutable?
- Are facades narrow rather than application-wide?
- Do commands have a meaningful execution lifecycle?
- Do decorators preserve behavior and errors?
- Are dependencies injected explicitly?
- Is shared configuration immutable?
- Are page, context, account, and data state isolated?
- Is composition preferred to deep inheritance?
- Would direct Playwright be clearer?

---

## Sources and version notes

This chapter targets Playwright 1.61.1. The patterns are language-level concepts; Playwright-specific mechanisms were checked against current official documentation:

- [Test and project parameterization](https://playwright.dev/docs/test-parameterize)
- [Fixtures and dependency injection](https://playwright.dev/docs/test-fixtures)
- [Page-object model guidance](https://playwright.dev/docs/pom)
- [Test steps and reporting](https://playwright.dev/docs/api/class-teststep)

---

## What comes next

Chapter 13 applies these decisions to configuration, projects, and environments: runner settings, browser-context options, device and environment matrices, project dependencies, setup and teardown projects, `webServer`, typed environment validation, multiple configs, and monorepos.
