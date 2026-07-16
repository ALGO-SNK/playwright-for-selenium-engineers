# Chapter 11 — Page Objects, Component Objects, and Tasks

A page object should make a test easier to understand. If reading the object is harder than reading Playwright directly, the abstraction has failed.

Selenium migrations often begin by creating one class per URL, moving every locator into private fields, and adding methods for every click. The result is technically a page-object model but practically a second, less expressive browser API.

Playwright already provides locators, auto-waiting, assertions, frames, and typed browser objects. Your object model should add product language and ownership—not wrap those capabilities mechanically.

This chapter separates four useful abstractions:

- **page objects** for page-level identity and behavior;
- **component objects** for reusable regions such as headers, carts, dialogs, and tables;
- **task or flow objects** for business actions spanning pages or channels; and
- **API objects** for service contracts and test-data operations.

The right model is usually a composition of these, not a hierarchy.

## What you will learn

By the end of this chapter, you will be able to:

- design page objects around cohesive user behavior;
- scope reusable component objects with root locators;
- separate page mechanics from cross-page business tasks;
- create API objects without hiding transport evidence;
- decide where assertions belong;
- construct objects through fixtures without creating global state;
- recognize god objects, wrapper APIs, and inheritance traps;
- organize object models at 50, 500, and 5,000 tests; and
- answer interview questions about maintainable automation architecture.

---

## 11.1 An object should own a stable reason to change

Playwright's official page-object guidance describes page objects as a higher-level application API that centralizes selectors and reusable operations. That is the beginning, not the complete design rule.

A useful object owns a cohesive contract:

| Object | Owns | Should not own |
|---|---|---|
| `CatalogPage` | catalog identity, search, filters, result regions | checkout payment details |
| `CartPanel` | cart lines, quantities, totals, cart actions | global sign-in journey |
| `PaymentDialog` | payment fields, submission, decline/approval UI | order API seeding |
| `PlaceOrderTask` | business sequence across cart, checkout, API evidence | every locator in every page |
| `OrdersApi` | order service requests and response parsing | DOM assertions |

“One class per page” is only a starting heuristic. Modern applications contain persistent shells, embedded components, dialogs, drawers, single-page routes, and workflows that cross several URLs.

> **Interview answer: What is a page object?**
>
> “A page object is a cohesive application-facing API over page-level behavior and locators. It should express product language, centralize stable interaction contracts, and preserve Playwright’s locator semantics. I compose it with component and task objects rather than creating a base-page inheritance tree.”

---

## 11.2 A small page object is explicit

```ts
import type { Locator, Page } from '@playwright/test';

export class CatalogPage {
  readonly heading: Locator;
  readonly searchbox: Locator;
  readonly results: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Catalog' });
    this.searchbox = page.getByRole('searchbox', { name: 'Search products' });
    this.results = page.getByRole('region', { name: 'Search results' });
  }

  async goto() {
    await this.page.goto('/catalog');
  }

  async searchFor(term: string) {
    await this.searchbox.fill(term);
    await this.page.getByRole('button', { name: 'Search' }).click();
  }

  productNamed(name: string) {
    return this.results.getByRole('article', { name });
  }
}
```

The object exposes meaningful locators for assertions and methods for cohesive actions. It does not provide `clickSearchButton()`, `typeSearchText()`, and `getResultText()` wrappers that merely rename Playwright calls.

### Keep locators as locators

```ts
await expect(catalog.productNamed('Wireless keyboard')).toBeVisible();
```

Returning a `Locator` preserves re-resolution, web-first assertions, and diagnostic call logs. Returning an `ElementHandle` or a captured text string prematurely weakens those properties.

### Prefer user-facing contracts

Objects do not justify weak selectors. Continue to prioritize roles, accessible names, labels, text, and deliberate test IDs.

### Avoid automatic navigation in constructors

Constructors should normally be synchronous and side-effect free. A constructor that navigates cannot be awaited and makes object creation surprising. Use `goto()`, a fixture, or a clearly named factory.

---

## 11.3 Component objects own reusable regions

QualityMart's cart appears as a drawer on catalog pages and as a summary on checkout. A component object can scope its locators to a root:

```ts
export class CartPanel {
  readonly lines: Locator;
  readonly total: Locator;

  constructor(readonly root: Locator) {
    this.lines = root.getByRole('listitem');
    this.total = root.getByLabel('Cart total');
  }

  lineFor(productName: string) {
    return this.lines.filter({ hasText: productName });
  }

  async remove(productName: string) {
    await this.lineFor(productName)
      .getByRole('button', { name: 'Remove' })
      .click();
  }
}
```

Compose it into a page:

```ts
export class CheckoutPage {
  readonly cart: CartPanel;

  constructor(readonly page: Page) {
    this.cart = new CartPanel(
      page.getByRole('region', { name: 'Order summary' })
    );
  }
}
```

The root prevents accidental matches elsewhere and makes the component portable.

### Components are not only visual widgets

Useful component boundaries include:

- navigation header;
- data table;
- date picker;
- address form;
- product card;
- toast region;
- modal dialog; and

- file-upload zone.

Create one when the region has reused behavior or meaningful complexity. A class around one button is usually noise.

---

## 11.4 Tasks express business intent across objects

A page object tends to describe what can be done on one page. A task describes why several actions are performed.

```ts
type PlaceOrderResult = {
  orderId: string;
  reviewedTotal: string;
};

export class PlaceOrderTask {
  constructor(
    private readonly cart: CartPanel,
    private readonly checkout: CheckoutPage
  ) {}

  async withProduct(productName: string): Promise<PlaceOrderResult> {
    await expect(this.cart.lineFor(productName)).toBeVisible();
    const reviewedTotal = await this.cart.total.innerText();

    await this.checkout.placeOrder();
    const orderId = await this.checkout.orderId.innerText();

    return { orderId, reviewedTotal };
  }
}
```

Tasks are useful for:

- cross-page journeys;
- repeated business setup performed through UI;
- hybrid API/UI flows;
- orchestration among page, component, API, and email objects; and

- returning evidence used by the test.

### Do not hide the entire scenario

Bad:

```ts
await app.completeEverythingAndVerify();
```

The test no longer communicates protected behavior.

Better:

```ts
const result = await placeOrder.withProduct('Wireless keyboard');

expect(result.reviewedTotal).toBe('$42.00');
await expect(checkout.confirmation).toContainText(result.orderId);
```

The task removes orchestration noise; the test retains decisive claims.

---

## 11.5 API objects protect a different boundary

```ts
export class OrdersApi {
  constructor(private readonly request: APIRequestContext) {}

  async createDraft(data: CreateOrderRequest) {
    const response = await this.request.post('/api/orders', { data });

    if (!response.ok()) {
      throw new Error(`Create order failed: HTTP ${response.status()}`);
    }

    return await response.json() as Order;
  }

  async delete(id: string) {
    return await this.request.delete(`/api/orders/${id}`);
  }
}
```

An API object can centralize endpoints, headers, request types, and parsing. Decide whether methods return domain data or the raw `APIResponse`.

- Return domain data for trusted setup helpers where transport failure is handled centrally.
- Return `APIResponse` when the test protects status, headers, error body, or transport behavior.

Do not convert every non-`2xx` response into an exception if negative API scenarios need to assert it.

---

## 11.6 Where assertions belong

There is no useful rule that all assertions must be inside or outside page objects.

### Keep business outcome assertions in tests

```ts
await checkout.placeOrder();
await expect(checkout.confirmation).toHaveText('Order confirmed');
await expect(checkout.total).toHaveText('$42.00');
```

The scenario remains readable and reviewers can see what is protected.

### Put invariant validation near the abstraction

A method may wait for the state that defines its completion:

```ts
async open() {
  await this.openButton.click();
  await expect(this.root).toBeVisible();
}
```

That assertion is synchronization and a component invariant, not the test's final business oracle.

### Assertion methods can be domain vocabulary

```ts
async expectLine(product: string, quantity: number) {
  const line = this.lineFor(product);
  await expect(line.getByLabel('Quantity')).toHaveText(String(quantity));
}
```

This is reasonable when many tests need the same stable composite assertion. Name it specifically. Avoid `verifyPage()` methods that check dozens of unrelated details.

### A decision rule

| Assertion | Best home |
|---|---|
| Decisive scenario outcome | Test |
| Action completion/invariant | Object method |
| Reused domain composite | Named assertion method or matcher |
| Setup health | Fixture/API helper |
| Universal technical policy | Automatic fixture |

> **Interview answer: Should assertions be inside page objects?**
>
> “Business outcomes should usually remain visible in tests. Objects may assert invariants that define an operation’s completion and may expose specific reusable domain assertions. I avoid giant `verifyPage` methods and hidden final oracles.”

---

## 11.7 Fixtures construct objects; objects do not manage global lifetime

```ts
type CommerceFixtures = {
  catalog: CatalogPage;
  checkout: CheckoutPage;
  placeOrder: PlaceOrderTask;
};

export const test = base.extend<CommerceFixtures>({
  catalog: async ({ page }, use) => {
    await use(new CatalogPage(page));
  },

  checkout: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },

  placeOrder: async ({ checkout }, use) => {
    await use(new PlaceOrderTask(checkout.cart, checkout));
  }
});
```

Fixtures connect objects to the correct test-scoped `page`, request client, configuration, and data. They also make the dependency graph explicit.

Avoid module-level instances:

```ts
// Wrong: which test owns this page?
export const checkout = new CheckoutPage(globalPage);
```

Objects should not launch browsers, create singleton contexts, or read secrets independently. Inject dependencies.

---

## 11.8 Composition beats inheritance

The classic `BasePage` often grows methods such as:

- `click()`;
- `waitForElement()`;
- `scroll()`;
- `takeScreenshot()`;
- `retryAction()`; and

- `getText()`.

This recreates a weaker version of Playwright and couples every object to one superclass.

Prefer composition:

```ts
class CheckoutPage {
  readonly header: Header;
  readonly cart: CartPanel;
  readonly payment: PaymentForm;

  constructor(readonly page: Page) {
    this.header = new Header(page.getByRole('banner'));
    this.cart = new CartPanel(page.getByRole('region', { name: 'Order summary' }));
    this.payment = new PaymentForm(page.getByRole('form', { name: 'Payment' }));
  }
}
```

Small helpers may be injected where real cross-cutting behavior exists, such as money parsing or attachment creation. Do not use inheritance to distribute generic browser commands.

### A justified base type is narrow

A small abstract type defining `goto()` or route identity can be acceptable, but it should not become the framework's utility warehouse. Ask whether an interface or composed helper would couple less.

---

## 11.9 Recognize the god object

Warning signs include:

- more than one product domain;
- dozens of unrelated locators;
- methods that navigate across the entire application;
- API, database, email, and UI logic in one class;
- boolean parameters controlling many flows;
- `verifyEverything()`;
- frequent merge conflicts; and

- tests that depend on only 5% of the object.

Split by stable responsibility:

```text
CommerceApp
├── CatalogPage
│   └── ProductCard
├── CheckoutPage
│   ├── CartPanel
│   ├── AddressForm
│   └── PaymentForm
├── OrdersApi
└── PlaceOrderTask
```

Do not split mechanically into hundreds of one-method classes. Cohesion, reuse, and independent change justify a boundary.

---

## 11.10 Folder structures at different scales

### Around 50 tests

Keep the structure close to features:

```text
tests/
  catalog/
    catalog.spec.ts
    catalog.page.ts
  checkout/
    checkout.spec.ts
    checkout.page.ts
    cart.component.ts
```

Locality is more valuable than a grand framework layer.

### Around 500 tests

Shared domain abstractions become worthwhile:

```text
tests/
  catalog/
  checkout/
  orders/
test-support/
  commerce/
    pages/
    components/
    tasks/
    api/
    fixtures.ts
  shared/
```

Ownership remains domain-based. Avoid global `pages/` and `utils/` folders that every team edits.

### Around 5,000 tests

Treat test support as internal products:

```text
packages/
  test-commerce/
  test-identity/
  test-admin/
  test-observability/
suites/
  commerce-e2e/
  identity-contract/
  admin-regression/
```

Each package needs ownership, semantic versioning or coordinated change policy, documentation, examples, and compatibility expectations. Centralize true platform capabilities; keep business language with domain teams.

The number of tests is not the only scaling factor. Team count, deployment boundaries, ownership, and change rate matter more.

---

## 11.11 Common anti-patterns

### One method per click

`clickSubmit()` adds no product meaning. Use direct Playwright or name the business action: `placeOrder()`.

### Getters for every locator

Boilerplate accessors can obscure a useful public locator. TypeScript `readonly` fields are clear.

### Passing selectors from tests

```ts
await pageObject.click('#submit');
```

The object is only a generic wrapper. Let it own stable product locators.

### Storing changing values in object fields

Captured text, IDs, and response data can become stale. Return evidence from methods or keep scenario data in the test/fixture.

### Assertions swallowed by broad catches

Objects should not catch every error, take a screenshot, and continue. Let Playwright preserve the original failure; use fixtures/reporting for artifacts.

### Pages creating pages

An object that calls `browser.newPage()` hides ownership. The fixture or test should own pages and pass them in. A popup method may return the captured `Page` or a new typed object when that event is the operation.

### Inheritance for roles

`AdminCheckoutPage extends CheckoutPage` often duplicates product differences in subclasses. Inject role/state through fixtures and compose capability-specific objects.

---

## 11.12 Selenium-to-Playwright migration traps

### Porting `BasePage`

Delete wrappers for implicit waits, JavaScript clicks, driver access, and element lookup. Playwright locators and actions already own those mechanics.

### Replacing `WebElement` fields with handles

Store `Locator` queries, not `ElementHandle` snapshots. Locators re-resolve against the current DOM.

### PageFactory annotations

Do not recreate annotation-driven element injection. Constructor-created locators are typed, explicit, and composable.

### Forced encapsulation

Private every locator plus a getter plus an assertion method creates ceremony. Expose stable locators when tests need flexible assertions; hide implementation details that should not become contracts.

### Giant business flows in page classes

Move cross-page orchestration to task objects and keep pages cohesive.

---

## 11.13 An object-design rubric

Before creating or reviewing an object, ask:

1. What stable responsibility does it own?
2. Does it add product language beyond Playwright?
3. Is it page-level, component-level, task-level, or service-level?
4. Are locators user-facing and scoped correctly?
5. Does it preserve locators rather than snapshotting elements?
6. Are cross-page actions separated from page behavior?
7. Are decisive assertions still visible?
8. Is construction tied to the correct fixture scope?
9. Could composition reduce coupling?
10. Would a direct locator be clearer than this abstraction?

Not every repeated line deserves a class. Repetition can reveal a future abstraction; premature abstraction can hide the shape you still need to learn.

---

## 11.14 Interview corner

### 1. Page object versus component object?

“A page object owns page-level identity and cohesive behavior. A component object is scoped to a reusable region through a root locator. Pages compose components so shared widgets do not duplicate selectors and actions.”

### 2. Page object versus task object?

“A page object describes capabilities of one page or route. A task expresses a business operation across pages, components, or APIs. Tasks remove orchestration noise without swallowing the scenario’s final assertions.”

### 3. What should a page object return?

“Locators for flexible web-first assertions, domain values or result objects when an operation produces evidence, and typed objects for newly owned pages or components. I avoid stale handles and generic booleans that discard diagnostics.”

### 4. How do you prevent god objects?

“I split by stable responsibility and product ownership, compose reusable components, move cross-page workflows into tasks, and keep service operations in API objects. I watch for unrelated locators, boolean-driven methods, and frequent multi-team conflicts.”

### 5. Why composition over inheritance?

“Composition models the application’s real parts and allows independent evolution. Base-page inheritance commonly becomes a dumping ground for wrappers that duplicate Playwright and couples every page to one hierarchy.”

### 6. Do all tests need page objects?

“No. A short, unique scenario is often clearer with direct locators. I introduce objects when they create stable product vocabulary, encapsulate meaningful complexity, or support reuse.”

---

## 11.15 Exercises

1. Build a `CatalogPage` that exposes result locators and one meaningful search method.
2. Extract a cart drawer into a root-scoped `CartPanel` used on two pages.
3. Move a checkout journey spanning three pages into a task while keeping final assertions in the test.
4. Design an `OrdersApi` that supports both setup convenience and negative response testing.
5. Refactor a `BasePage` containing click, wait, text, and screenshot wrappers.
6. Split a 40-method checkout god object by stable responsibility.
7. Construct page, component, task, and API objects through fixtures.
8. Compare direct Playwright code with a one-method wrapper and delete the less readable version.
9. Design folder structures for one team with 50 tests and eight teams with 5,000 tests.
10. Review assertion placement in an existing page object and classify each assertion.

---

## 11.16 Review checklist

- Does each object own one cohesive product responsibility?
- Does the abstraction add vocabulary or hide meaningful complexity?
- Are reusable regions modeled as root-scoped components?
- Are cross-page journeys modeled separately from page capabilities?
- Are API boundaries kept out of DOM objects?
- Are locators resilient, current, and available for web-first assertions?
- Are constructors side-effect free?
- Are decisive business assertions visible in tests?
- Are invariant assertions narrow and intentional?
- Are objects constructed with test-scoped fixtures?
- Is composition preferred over base-class utility inheritance?
- Is there any generic wrapper that duplicates Playwright?
- Is a god object emerging through unrelated responsibilities?
- Does folder ownership follow domains and teams?
- Would direct Playwright code be simpler?

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Version-sensitive behavior was checked against current official documentation:

- [Playwright page-object model guidance](https://playwright.dev/docs/pom)
- [Locator behavior, composition, and user-facing contracts](https://playwright.dev/docs/locators)
- [Fixture construction and dependency injection](https://playwright.dev/docs/test-fixtures)
- [API testing and `APIRequestContext`](https://playwright.dev/docs/api-testing)

---

## What comes next

Page, component, task, and API objects are examples of design patterns used deliberately. Chapter 12 broadens the decision: linear, modular, data-driven, keyword-driven, hybrid, and BDD frameworks; factory, builder, strategy, facade, command, decorator, and dependency injection; and why composition usually beats framework inheritance.
