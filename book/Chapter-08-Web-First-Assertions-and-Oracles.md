# Chapter 8 — Web-First Assertions and Oracles

A test can wait perfectly and still prove the wrong thing.

It can verify that a button disappeared without proving that an order was created. It can check a `200` response while the page shows an error. It can compare ten CSS classes and miss the wrong total. It can also contain forty assertions, fail whenever harmless text changes, and still leave the most important business outcome unprotected.

Synchronization answers, “When should I observe?” An oracle answers:

> What observation would prove that the requirement succeeded or failed?

For QualityMart checkout, “the spinner is hidden” is weak evidence. “Order QM-1042 is confirmed with a total of $42.00” is a business oracle. This chapter builds assertions around that distinction.

## What you will learn

By the end of this chapter, you will be able to:

- choose among locator, page, API response, and generic assertions;
- explain why web-first assertions retry while snapshot comparisons do not;
- distinguish exact list matching from ordered subset matching;
- design strong UI, API, event, database, and contract oracles;
- use negative assertions without creating false confidence or long failures;
- collect independent evidence with soft assertions and stop at a safe checkpoint;
- use polling, ARIA snapshots, visual assertions, and custom matchers deliberately;
- avoid assertion noise and implementation-coupled tests; and
- answer interview questions about assertion strategy with production-level reasoning.

---

## 8.1 An assertion is syntax; an oracle is evidence

These assertions can all pass after a customer places an order:

```ts
await expect(page.locator('.spinner')).toBeHidden();
await expect(page).toHaveURL(/\/confirmation/);
await expect(page.getByText('Thank you')).toBeVisible();
await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
```

They do not provide equal confidence.

- A hidden spinner says that one loading indicator is gone.
- A confirmation URL says that navigation occurred.
- “Thank you” identifies a general page state.
- A confirmed order status ties the observation to the business outcome.

The strongest useful oracle is usually the closest stable observation of the requirement. For an end-to-end checkout test, that may include the order identifier, final status, amount, and a backend lookup. For a component test of a spinner, hidden state may be exactly the correct oracle.

Strength is contextual. The question is not, “Is this matcher powerful?” It is, “What defect would still escape if this assertion passed?”

### Build an evidence chain, not an assertion pile

A useful checkout chain might be:

```ts
await page.getByRole('button', { name: 'Place order' }).click();

await expect(page).toHaveURL(/\/orders\/QM-\d+$/);
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
await expect(page.getByTestId('order-total')).toHaveText('$42.00');
```

Each line protects a different claim:

1. the browser reached a concrete order resource;
2. the user sees a successful outcome; and
3. the confirmed amount is correct.

Three independent claims are more valuable than ten ways of restating “the confirmation panel is visible.”

> **Interview answer: What is a test oracle?**
>
> “An oracle is the observation used to decide whether behavior is correct. The assertion is the code that compares it. I choose the closest stable evidence of the requirement—often a user-visible outcome, sometimes reinforced by an API, event, database, or contract check. I avoid treating incidental UI state such as a hidden spinner as proof of business success.”

---

## 8.2 Four assertion families

Playwright Test provides several assertion families. Choose by the value being observed and whether that value can change asynchronously.

| Family | Example | Retries? | Best use |
|---|---|:---:|---|
| Locator | `await expect(status).toHaveText('Confirmed')` | Yes | Element state, content, accessibility, and collections |
| Page | `await expect(page).toHaveURL(/\/orders\//)` | Yes | URL, title, page screenshot, and page ARIA snapshot |
| API response | `await expect(response).toBeOK()` | No state retry | Success status of an `APIResponse` from `APIRequestContext` |
| Generic | `expect(order.total).toBe(42)` | No | Stable values already in memory |

“Retries” does not mean Playwright repeats the action that produced the state. Locator and relevant page assertions repeat the observation until it matches or the assertion timeout is reached. `toBeOK()` is asynchronous, but it checks an already completed, fixed `APIResponse`; use polling that issues a new observational request when API state can change.

### Locator assertions observe the live page

```ts
const status = page.getByTestId('order-status');

await expect(status).toBeVisible();
await expect(status).toHaveText('Confirmed');
await expect(status).toHaveAccessibleName('Order status: Confirmed');
```

Locator assertions cover state such as visibility, enabled state, focus, values, attributes, CSS, count, accessible name, text, screenshots, and ARIA snapshots. Because the locator remains a query, Playwright can re-resolve it if the framework replaces the DOM node.

### Page assertions observe page-level identity or presentation

```ts
await expect(page).toHaveURL(/\/orders\/QM-1042$/);
await expect(page).toHaveTitle(/Order QM-1042/);
```

Use them when the page—not one element—is the natural subject.

### API response assertions have a narrow contract

```ts
const response = await request.get('/api/orders/QM-1042');
await expect(response).toBeOK();
```

`toBeOK()` applies to Playwright's `APIResponse` and accepts a status in the `200`–`299` range. It proves transport-level success, not schema correctness or business correctness.

Continue with explicit data assertions:

```ts
const order = await response.json();

expect(order).toMatchObject({
  id: 'QM-1042',
  status: 'confirmed',
  total: 42
});
```

Do not confuse an `APIResponse` returned by the request fixture with the browser-network `Response` captured by `page.waitForResponse()`. For the latter, inspect `status()`, headers, or body with generic assertions.

### Generic assertions compare the value they receive

```ts
expect(order.total).toBe(42);
expect(order.lines).toHaveLength(2);
expect(order).toMatchObject({ status: 'confirmed' });
```

Generic matchers are correct for values that are already final: parsed response bodies, computed values, fixture output, configuration, and pure domain functions. They do not know how to fetch a new value from the page.

Use Playwright's `expect` from `@playwright/test`. A separately installed Jest-style `expect` is not fully integrated with the Playwright runner and its reporting.

---

## 8.3 `toHaveText()` is not a shorter `textContent()` check

This code captures one moment:

```ts
const status = await page.getByTestId('order-status').textContent();
expect(status).toBe('Confirmed');
```

If the DOM contains `Processing` at that instant, the assertion fails immediately. The locator call completed successfully; no element lookup is pending. The string stored in `status` cannot change later.

This code observes a condition over time:

```ts
await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
```

Playwright repeatedly resolves the locator and reads its text until the expected state appears or the expect timeout expires. The default assertion timeout is five seconds unless configuration or local options change it.

### Snapshot values are sometimes intentional

One-time reads are not forbidden. They are useful when the test deliberately compares two moments:

```ts
const before = await page.getByTestId('cart-count').textContent();

await page.getByRole('button', { name: 'Add keyboard' }).click();
await expect(page.getByTestId('cart-count')).not.toHaveText(before ?? '');
```

The first value is historical evidence; the second assertion observes change. Be explicit about that intent.

If you must derive a value that has no locator matcher, poll the derivation:

```ts
await expect.poll(async () => {
  const text = await page.getByTestId('discount').textContent();
  return Number(text?.replace('%', ''));
}).toBeGreaterThanOrEqual(20);
```

Prefer a built-in locator assertion when one expresses the requirement. It normally produces better locator-aware diagnostics.

> **Interview answer: Why is `toHaveText()` less flaky than `textContent()` plus `toBe()`?**
>
> “`textContent()` returns a snapshot string, and the generic matcher checks it once. `toHaveText()` is an asynchronous locator assertion: it re-resolves the locator and rechecks the live DOM until the text matches or its timeout expires. It also reports locator-specific diagnostics.”

---

## 8.4 Exact text, contained text, and collection semantics

Choose the matcher whose strictness matches the requirement.

```ts
await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
await expect(page.getByTestId('banner')).toContainText('Order confirmed');
```

For a string expected value, `toHaveText()` matches the element's full normalized text. `toContainText()` allows surrounding content. Regular expressions are useful for controlled dynamic parts:

```ts
await expect(page.getByTestId('order-number')).toHaveText(/^QM-\d+$/);
```

Do not use an overly broad regular expression merely to make a test pass. `/QM-/` would accept `QM-error` and may not protect the identifier format.

### Lists make the difference more important

Given these visible items:

```text
Keyboard
Mouse
Monitor
```

This requires the same number of elements in the same order, matched one-to-one:

```ts
await expect(page.getByRole('listitem')).toHaveText([
  'Keyboard',
  'Mouse',
  'Monitor'
]);
```

This requires an ordered subset and allows other elements between the matches:

```ts
await expect(page.getByRole('listitem')).toContainText([
  'Keyboard',
  'Monitor'
]);
```

Use exact list matching when count and order are requirements. Use ordered subset matching when only selected milestones matter. Do not add a separate `toHaveCount(3)` beside exact `toHaveText([...])` unless the count communicates an independent requirement; the exact list assertion already constrains it.

### Text is not always the strongest state

A checkbox labeled “Email receipt” should usually be checked by state:

```ts
await expect(page.getByRole('checkbox', { name: 'Email receipt' }))
  .toBeChecked();
```

An input should usually be checked by value:

```ts
await expect(page.getByLabel('Promo code')).toHaveValue('SAVE20');
```

An error summary may deserve text and accessibility assertions because both content and discoverability are requirements:

```ts
const error = page.getByRole('alert');

await expect(error).toContainText('Card number is required');
await expect(error).toHaveAccessibleName(/Card number is required/);
```

Match the user-facing state, not the convenient DOM property.

---

## 8.5 Strong oracles across system boundaries

Not every scenario needs to query every layer. The right boundary depends on what the test claims to cover.

| Oracle | What it proves | Typical use | Common limitation |
|---|---|---|---|
| Observable UI outcome | What the user can see or use | End-to-end journey | May not prove downstream persistence |
| API state | Service response and resource representation | API/integration or UI setup verification | May bypass rendering and accessibility defects |
| Event/message | Integration emitted the expected business signal | Event-driven workflow | Publication may not prove consumption |
| Database state | Persistence or projection reached expected state | Controlled integration test | Couples test to storage implementation |
| Contract/schema | Shape and compatibility rules hold | Provider/consumer boundary | Valid shape can still contain wrong business values |

### UI oracle: protect the customer outcome

```ts
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
await expect(page.getByTestId('order-total')).toHaveText('$42.00');
```

This is usually the primary oracle for a UI journey.

### API oracle: verify service state without guessing from presentation

```ts
await expect.poll(async () => {
  const response = await request.get('/api/orders/QM-1042');
  if (!response.ok()) return `HTTP ${response.status()}`;

  const order = await response.json();
  return order.status;
}, {
  message: 'order QM-1042 should become confirmed',
  timeout: 20_000
}).toBe('confirmed');
```

This is appropriate when the scenario explicitly covers persistence or asynchronous processing. Keep the callback observational because polling may invoke it multiple times.

### Event oracle: identify the business event precisely

An event check should match stable business fields such as event type, entity ID, version, and essential payload—not a raw timestamp or broker-generated offset unless those are requirements.

```ts
expect(event).toMatchObject({
  type: 'OrderConfirmed',
  aggregateId: 'QM-1042',
  data: { total: 42 }
});
```

### Database oracle: use only at an owned boundary

A direct database assertion can provide valuable integration confidence in a controlled environment. It can also tie a UI suite to table names, joins, and eventual-consistency details that customers never see.

Prefer querying a supported test API when it represents the same contract. Use a database check when persistence itself is under test, when no stable service boundary exists, or when diagnosis justifies the coupling. Keep credentials and cleanup in fixtures rather than page objects.

### Contract oracle: shape is necessary but not sufficient

A schema assertion can prove that `orderId` is a string and `total` is a number. It cannot prove that the total is the one the customer approved.

Combine structure with business values:

```ts
expect(order).toEqual(expect.objectContaining({
  id: expect.stringMatching(/^QM-\d+$/),
  status: 'confirmed',
  total: 42
}));
```

### Layer only independent evidence

For a critical checkout path, a defensible chain could be:

1. UI shows the correct confirmed order and amount.
2. API eventually reports the same order as confirmed.
3. A separate event-contract test validates `OrderConfirmed` publication.

The event check need not be repeated in every browser test. Place each oracle at the cheapest layer that still protects its risk.

---

## 8.6 Negative assertions prove absence—not history

Negative web-first assertions retry until the opposite condition becomes true:

```ts
await expect(page.getByRole('alert')).not.toBeVisible();
await expect(page.getByText('Processing payment')).toBeHidden();
await expect(page.getByRole('listitem')).not.toContainText('Cancelled');
```

They can pass immediately if the unwanted state is already absent. This is correct behavior, but it creates an important reasoning trap.

```ts
await page.getByRole('button', { name: 'Place order' }).click();
await expect(page.getByText('Processing payment')).toBeHidden();
```

This does **not** prove that processing started and then completed. The message may never have appeared.

If the transition matters, establish its start and finish:

```ts
await page.getByRole('button', { name: 'Place order' }).click();
await expect(page.getByText('Processing payment')).toBeVisible();
await expect(page.getByText('Processing payment')).toBeHidden();
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
```

If the intermediate state is too brief to observe reliably and is not itself a requirement, assert only the final business outcome. Tests should not slow the product to capture decorative transitions.

### Absence has three different meanings

```ts
await expect(locator).toBeHidden();
await expect(locator).not.toBeVisible();
await expect(locator).toHaveCount(0);
```

- `toBeHidden()` and `not.toBeVisible()` accept an element that is absent or not visible.
- `toHaveCount(0)` requires the locator to resolve to no matching elements.

Choose based on the requirement. “The customer cannot see the banner” differs from “the application removed the banner from the DOM.”

### Negative assertions can be expensive when the product is wrong

Every retrying negative assertion may consume its full expect timeout if the unwanted state remains. A test with five broad negative checks can add twenty-five seconds at a five-second default before failing.

Prefer one meaningful negative at the correct scope:

```ts
await expect(page.getByRole('alert')).not.toContainText('Payment declined');
```

Better still, assert the positive successful outcome when it makes the negative redundant:

```ts
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
```

Do not lower negative timeouts blindly. A very short timeout can miss a delayed error. Decide whether the requirement is immediate absence, eventual disappearance, or absence throughout an interval. The last is a monitoring problem and is not proved by one point-in-time assertion.

> **Interview answer: Why can a negative assertion be misleading?**
>
> “It proves the unwanted condition is absent when observed; it does not prove a prior transition occurred or that the condition stayed absent for an entire period. It may also pass immediately if the element never existed. I establish a known starting state when history matters, and I prefer a positive business outcome when that gives stronger evidence.”

---

## 8.7 Soft assertions collect evidence but do not make failure harmless

Normal assertions stop the test body when they fail. Soft assertions record the failure, mark the test failed, and allow execution to continue:

```ts
await expect.soft(page.getByTestId('order-status'), 'order status')
  .toHaveText('Confirmed');
await expect.soft(page.getByTestId('order-total'), 'charged total')
  .toHaveText('$42.00');
await expect.soft(page.getByTestId('delivery-method'), 'delivery method')
  .toHaveText('Express');
```

This is useful when several independent observations on one result should appear in the same report. It avoids the repair-run-repair cycle where one mismatch hides the next.

Soft assertions are dangerous when later actions require the failed condition. This sequence may create misleading secondary failures:

```ts
await expect.soft(page.getByText('Signed in')).toBeVisible();
await page.getByRole('button', { name: 'Delete account' }).click();
```

If sign-in failed, the delete action is no longer meaningful.

Create a checkpoint before dependent work:

```ts
await expect.soft(page.getByTestId('order-status')).toHaveText('Confirmed');
await expect.soft(page.getByTestId('order-total')).toHaveText('$42.00');

expect(test.info().errors).toHaveLength(0);

await page.getByRole('link', { name: 'View receipt' }).click();
```

The checkpoint is a normal generic assertion. It stops the test if any earlier soft assertion failed.

Soft assertions work only with the Playwright test runner. You can also create a configured instance:

```ts
const auditExpect = expect.configure({ soft: true, timeout: 10_000 });

await auditExpect(page.getByTestId('order-status')).toHaveText('Confirmed');
await auditExpect(page.getByTestId('order-total')).toHaveText('$42.00');
```

Use custom messages to explain the business claim. Avoid messages that merely repeat the matcher.

---

## 8.8 Polling turns a generic observation into a retrying oracle

Chapter 7 introduced the mechanics:

- `expect.poll()` retries a callback that returns one value;
- `expect().toPass()` retries an assertion block; and
- repeated callbacks must be safe to run more than once.

From an oracle perspective, choose the smallest stable observation.

```ts
await expect.poll(readOrderStatus, {
  message: 'warehouse projection should confirm QM-1042',
  timeout: 20_000,
  intervals: [250, 500, 1_000]
}).toBe('confirmed');
```

If several fields must become consistent together, use `toPass()`:

```ts
await expect(async () => {
  const order = await readOrder('QM-1042');

  expect(order.status).toBe('confirmed');
  expect(order.total).toBe(42);
  expect(order.currency).toBe('USD');
}).toPass({ timeout: 20_000 });
```

Remember that `toPass()` currently defaults to timeout `0` and does not inherit the configured expect timeout. Set a timeout when retry is intended.

Polling should observe a contract, not recreate it. Create the order once; poll only its state.

---

## 8.9 ARIA snapshots assert accessible structure

An ARIA snapshot represents the accessible tree in a compact YAML-like form. It can protect the roles, accessible names, and hierarchy that assistive technology receives.

For a scoped order summary:

```ts
const summary = page.getByRole('region', { name: 'Order summary' });

await expect(summary).toMatchAriaSnapshot(`
  - heading "Order summary" [level=2]
  - list:
    - listitem: Keyboard, quantity 1
    - listitem: Mouse, quantity 1
  - text: Total $42.00
  - button "Place order"
`);
```

ARIA snapshots are especially useful when a component's accessible structure is the contract: navigation, dialogs, forms, menus, tables, and landmark regions.

### Keep the scope small and the intent reviewable

A page-wide snapshot can become a large approval surface. Small unrelated copy or navigation changes may obscure an important checkout change. Scope to the component or journey state that matters.

ARIA matching is partial by default: the actual accessible tree may contain additional nodes. Child order is preserved for the expected nodes. Strict child matching modes are available when exact structure is genuinely required.

Store larger templates in separate `.aria.yml` files when that improves review. An empty template can be used to generate a proposed snapshot, but generated output is not automatically correct; review roles, names, hierarchy, and dynamic values before accepting it.

### An ARIA snapshot is not an accessibility audit

It can show that the accessible tree matches an expected structure. It does not prove keyboard usability, focus order, color contrast, announcements, or conformance with every accessibility criterion. Combine it with focused interaction tests and appropriate accessibility analysis.

---

## 8.10 Visual assertions protect rendering—with environmental cost

```ts
await expect(page.getByTestId('receipt')).toHaveScreenshot('receipt.png');
```

Visual comparison is appropriate when appearance is the behavior: layout, clipping, theming, charts, or a receipt that must render correctly.

Playwright waits for two consecutive screenshots to match before comparing with the stored baseline. This reduces transient rendering differences, but visual tests still require controlled fonts, browser versions, operating system, viewport, animation, data, and time.

Do not use a screenshot to replace a semantic assertion that would explain the failure more clearly:

```ts
await expect(page.getByTestId('order-total')).toHaveText('$42.00');
```

A screenshot can reveal that the total looks wrong. A text assertion immediately reports the expected and received values. Use both only when content and rendering are independent risks.

Mask or stabilize truly irrelevant dynamic regions. Do not mask the subject of the test until the screenshot always passes.

---

## 8.11 Custom matchers should preserve Playwright's strengths

A domain matcher can make intent readable:

```ts
await expect(cart).toHaveItemCount(3);
```

The implementation should delegate to a built-in web-first assertion instead of taking one DOM snapshot:

```ts
import { expect as baseExpect, type Locator } from '@playwright/test';

export const expect = baseExpect.extend({
  async toHaveItemCount(
    locator: Locator,
    expected: number,
    options?: { timeout?: number }
  ) {
    const assertionName = 'toHaveItemCount';
    let pass = false;
    let matcherResult: any;

    try {
      const target = this.isNot
        ? baseExpect(locator).not
        : baseExpect(locator);

      await target.toHaveAttribute('data-item-count', String(expected), options);
      pass = true;
    } catch (error: any) {
      matcherResult = error.matcherResult;
    }

    if (this.isNot) pass = !pass;

    return {
      name: assertionName,
      pass,
      expected,
      actual: matcherResult?.actual,
      message: () =>
        `${this.utils.matcherHint(assertionName, undefined, undefined, {
          isNot: this.isNot
        })}\n\n` +
        `Locator: ${locator}\n` +
        `Expected item count: ${this.utils.printExpected(expected)}\n` +
        (matcherResult
          ? `Received: ${this.utils.printReceived(matcherResult.actual)}`
          : '')
    };
  }
});
```

Delegation retains retry behavior and locator-aware diagnostics. A custom matcher should also support `.not`, timeouts, useful expected/actual values, and TypeScript declarations in production framework code.

Do not create a matcher for every sentence in the product vocabulary. Add one when it centralizes a repeated, stable domain assertion or substantially improves failure messages.

---

## 8.12 Too few, too many, and implementation-coupled assertions

### Too few: the test performs a journey without proving it

```ts
await page.getByLabel('Card number').fill('4242 4242 4242 4242');
await page.getByRole('button', { name: 'Place order' }).click();
```

No exception does not mean success. The click can complete while the application displays a decline, navigates to sign-in, or silently loses the action.

Add the decisive outcome:

```ts
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
```

### Too many: every detail becomes a reason to fail

```ts
await expect(card).toHaveClass('card card--success shadow-md');
await expect(card).toHaveCSS('border-color', 'rgb(34, 197, 94)');
await expect(card.locator('svg')).toHaveAttribute('data-icon', 'check');
await expect(card).toHaveAttribute('data-state', 'complete');
await expect(card).toContainText('Order confirmed');
```

If the requirement is “the customer sees a confirmed order,” most of these checks restate one condition through implementation details. A redesign can break the test without changing behavior.

Prefer the user contract:

```ts
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
await expect(page.getByTestId('order-number')).toHaveText(/^QM-\d+$/);
```

### Implementation-coupled assertions protect mechanisms instead of outcomes

Examples include:

- asserting framework-generated class names;
- checking private application state in the browser;
- requiring a specific number of internal API calls when caching is allowed;
- querying a database table from every UI test; and
- snapshotting an entire page to protect one button label.

Implementation assertions are valid when the implementation is the contract. A design-system test may protect a class or CSS property. A caching test may assert request count. Name that narrower purpose so reviewers understand the coupling.

### A practical assertion budget

For each scenario, ask:

1. What is the one outcome without which the scenario has failed?
2. Which additional facts protect distinct risks?
3. Which assertions merely restate another assertion?
4. Which details are likely to change without changing the requirement?
5. Could a cheaper API, component, or contract test protect this risk better?

There is no ideal number of assertions. The goal is a minimal set of independent, diagnostic claims.

---

## 8.13 Selenium-to-Playwright assertion traps

### Trap 1: Porting `getText()` comparisons literally

Selenium:

```java
assertEquals(driver.findElement(By.id("status")).getText(), "Confirmed");
```

Literal Playwright translation:

```ts
expect(await page.locator('#status').textContent()).toBe('Confirmed');
```

Prefer the live locator assertion:

```ts
await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
```

### Trap 2: Building a custom explicit wait around every assertion

Do not wrap `toHaveText()` in a loop or repeatedly call `isVisible()`. Locator assertions already retry and produce better failure evidence.

### Trap 3: Using `isVisible()` as an assertion

```ts
expect(await locator.isVisible()).toBe(true);
```

This captures a boolean snapshot. Use:

```ts
await expect(locator).toBeVisible();
```

### Trap 4: Treating HTTP success as journey success

A `2xx` response can contain the wrong order, fail to render, or be followed by a client error. Assert the response when it is part of the contract, then assert the final user or system outcome.

### Trap 5: Verifying every locator before acting

```ts
await expect(button).toBeVisible();
await expect(button).toBeEnabled();
await button.click();
```

The normal click already waits for its actionability requirements. Keep precondition assertions only when visibility or enabled state is itself protected behavior.

### Trap 6: Making every assertion soft

Soft mode is not “collect all errors safely.” Once a prerequisite fails, later actions can become invalid and generate noise. Use soft assertions for independent observations and a hard checkpoint before dependent work.

---

## 8.14 An oracle design framework

Use this sequence in test design and review.

### 1. State the business claim

“The order is confirmed at the reviewed total,” not “the green panel appears.”

### 2. Choose the closest stable observation

| Claim | Strong first oracle |
|---|---|
| Customer can complete checkout | Confirmation heading, order ID, and total |
| Route reached the order resource | Page URL with concrete order ID |
| API created the resource | Status, identifier, and response body |
| Async worker completed | Polled API or owned projection state |
| Accessible dialog structure is correct | Scoped ARIA snapshot plus keyboard behavior |
| Receipt rendering is correct | Stabilized component screenshot |

### 3. Decide whether the value can change

- Live DOM or page state: use a web-first assertion.
- External eventually consistent state: use polling.
- Stable in-memory value: use a generic matcher.

### 4. Add only independent evidence

URL, heading, and total may protect different risks. Class, border color, icon attribute, and `data-state` may all describe the same implementation state.

### 5. Bound failure deliberately

Use the standard expect timeout unless the operation has a justified different latency. Remember that multiple failing negative or soft assertions can each consume their own timeout.

### 6. Optimize the failure report

Use specific locators, expected business values, and concise custom messages. The best failure should tell the engineer what claim failed without opening the test first.

---

## 8.15 Interview corner

### 1. What are web-first assertions?

“They are asynchronous Playwright assertions that repeatedly observe browser state, such as locator text, visibility, URL, or title, until the condition passes or its expect timeout expires. They re-resolve locators and do not repeat the action that caused the state.”

### 2. What assertion types does Playwright provide?

“Locator assertions cover element state and content; page assertions cover URL, title, screenshots, and ARIA snapshots; API response assertions include `toBeOK` for an `APIResponse`; generic assertions compare stable in-memory values without retry. Polling can add retry to a computed or external observation.”

### 3. When would you use a generic matcher on UI data?

“When the snapshot is intentional—for example, comparing before and after values—or after the test has obtained a stable structured value. If the page value can still change, I prefer a locator assertion or `expect.poll` for a derived value.”

### 4. Hard versus soft assertions?

“A normal failed assertion stops the test body. A soft assertion records the error, marks the test failed, and continues. I use soft assertions for independent observations of one result, then check `test.info().errors` before any step that depends on them.”

### 5. How do you test that an element disappears?

“I choose `toBeHidden` when absent or invisible both satisfy the requirement, and `toHaveCount(0)` when DOM removal matters. If the transition matters, I establish the starting state first. I still assert the final positive business outcome because disappearance alone may be weak evidence.”

### 6. What is an ARIA snapshot?

“It is a YAML-like representation of accessible roles, names, and hierarchy that can be matched for a page or locator. I scope it to a stable component and review the generated structure. It is useful accessibility evidence but not a complete accessibility audit.”

### 7. When would you create a custom matcher?

“When a repeated, stable domain assertion becomes clearer or more diagnostic as one matcher. I delegate to built-in Playwright assertions where possible so retries and diagnostics are preserved, and I support negation, timeouts, expected and actual values, and TypeScript types.”

### 8. How many assertions should a test contain?

“There is no target count. I start with the decisive business outcome, then add assertions only for independent risks. I remove restatements and implementation details that can change without changing behavior. Each failure should identify a meaningful broken claim.”

### 9. UI versus API versus database oracle?

“Use the boundary the scenario claims to cover. A UI journey needs a user-visible oracle. An API test should verify status, data, and contract. A database check is justified when persistence is the owned contract or no stable API exists, but it creates implementation coupling. Critical workflows may layer independent evidence without putting every check in every browser test.”

---

## 8.16 Exercises

1. Create a status that changes from `Processing` to `Confirmed`. Compare `textContent()` plus `toBe()` with `toHaveText()` and explain the retry difference.
2. Build a three-item list. Assert its exact ordered contents, then assert only the first and last item as an ordered subset.
3. Write a disappearance test that passes even though the loading message never appeared. Repair it by establishing a starting state or by asserting the final business outcome.
4. Add three soft assertions to an order summary. Make one fail, inspect `test.info().errors`, and add a hard checkpoint before navigation.
5. Poll a fake order API until status becomes `confirmed`. Keep creation outside the polling callback.
6. Create a scoped ARIA snapshot for a checkout dialog. Change a heading level and an accessible button name; inspect the failures.
7. Replace five CSS and attribute assertions with two user-facing assertions that protect distinct requirements.
8. Design an oracle chain for password reset using UI, email-event, and API evidence. Decide which layer should own each check.
9. Implement a custom domain matcher that delegates to `toHaveText()` or `toHaveAttribute()` and supports `.not`.
10. Review an existing Selenium test. Find snapshot assertions, weak absence checks, and duplicated preconditions; migrate them without changing the business scope.

---

## 8.17 Review checklist

Before approving assertion code, ask:

- Is the decisive business outcome asserted?
- Does each additional assertion protect a different risk?
- Is a live page value checked with a web-first assertion?
- Is a generic assertion intentionally operating on a stable snapshot?
- Does text matching use the correct exact, contains, regular-expression, or list semantics?
- Does a negative assertion prove the intended absence, disappearance, or DOM removal?
- Could a negative assertion pass because the expected transition never started?
- Are soft assertions independent, with a hard checkpoint before dependent actions?
- Is polling observational and safe to repeat?
- Is an API `2xx` check followed by data or business validation where needed?
- Are ARIA and visual snapshots scoped to stable, reviewable regions?
- Does a custom matcher preserve retry and useful diagnostics?
- Are implementation details asserted only when they are the contract?
- Would the failure message identify the broken claim quickly?
- Could a cheaper layer protect the same risk more reliably?

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Version-sensitive behavior was checked against current official documentation:

- [Playwright assertions, soft assertions, polling, and custom matchers](https://playwright.dev/docs/test-assertions)
- [Locator assertion semantics](https://playwright.dev/docs/api/class-locatorassertions)
- [Page assertions](https://playwright.dev/docs/api/class-pageassertions)
- [API response assertions](https://playwright.dev/docs/api/class-apiresponseassertions)
- [ARIA snapshots and matching rules](https://playwright.dev/docs/aria-snapshots)
- [Visual comparisons](https://playwright.dev/docs/test-snapshots)

---

## What comes next

Strong assertions tell you whether one automated scenario succeeded. Chapter 9 moves one level higher: which scenarios deserve automation at all?

You will learn to build a risk-based automation strategy before choosing framework folders, balance UI, API, component, and contract coverage, define smoke and regression boundaries, and answer the interview question, “How would you design an automation strategy for this product?”
