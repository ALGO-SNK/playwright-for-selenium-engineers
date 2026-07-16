# Chapter 7 — Actionability, Auto-Waiting, and Explicit Synchronization

Most flaky tests are not missing a wait. They are waiting for the wrong fact.

A button can be visible while an overlay still owns the click point. A request can return while the UI is still calculating derived state. The `load` event can fire while an application is still hydrating. A test can pass on retry while the original race remains completely unexplained.

The useful question is therefore not, “How long should I wait?” It is:

> What event or state transition can happen after the test tries to use it?

Name that race first. Then choose the smallest synchronization mechanism that observes its completion.

## What you will learn

By the end of this chapter, you will be able to:

- explain every actionability check and the actions that use it;
- distinguish action auto-waiting, assertion retry, polling, and whole-test retry;
- identify the exact race behind a timeout;
- synchronize navigation, requests, responses, UI state, and external systems;
- use `expect.poll()` and `expect().toPass()` without repeating destructive work;
- explain why `networkidle`, hard waits, and inflated timeouts are weak readiness signals;
- configure timeouts as a bounded hierarchy rather than one global number; and
- answer interview questions about waiting with production-level reasoning.

The examples continue to use QualityMart, where delays are intentional and observable. A deterministic delayed state teaches more than a random sleep ever can.

---

## 7.1 Four mechanisms that engineers call “waiting”

Playwright has several retry and timeout mechanisms. Treating them as one feature creates confused code.

| Mechanism | Scope | Repeats what? | Best use |
|---|---|---|---|
| Action auto-wait | One action | Required readiness checks | Make a target mechanically usable |
| Web-first assertion | One expected outcome | Locator resolution and observation | Wait for UI or page state to become correct |
| `expect.poll` / `toPass` | One polling boundary | A callback or assertion block | Observe asynchronous non-locator state |
| Test retry | Whole test | Setup, test body, and teardown in a new worker | Contain and classify intermittent failures |

These mechanisms are not substitutes.

```ts
await page.getByRole('button', { name: 'Place order' }).click();
```

The click waits for its target to satisfy the click contract. It does not prove that the order was accepted.

```ts
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
```

The assertion repeatedly observes the outcome. It does not repeat the click.

If the whole test fails and the runner retries it, setup and the test body run again. That may create a second order unless test data and operations are designed for retry safety.

> **Interview answer: What is auto-waiting?**
>
> “Before an action, Playwright resolves the locator and waits for the checks required by that action, such as visibility, stability, receiving pointer events, enabled state, or editability. Assertion retry is separate: a web-first assertion repeatedly observes an expected state. Test retry is different again because it reruns the whole test.”

---

## 7.2 The complete actionability matrix

There is no universal five-check sequence. Each action requires the facts relevant to that action.

| Action | Visible | Stable | Receives events | Enabled | Editable |
|---|:---:|:---:|:---:|:---:|:---:|
| `check`, `click`, `dblclick`, `setChecked`, `tap`, `uncheck` | Yes | Yes | Yes | Yes | — |
| `hover`, `dragTo` | Yes | Yes | Yes | — | — |
| `screenshot` | Yes | Yes | — | — | — |
| `fill`, `clear` | Yes | — | Yes | Yes | Yes |
| `selectOption` | Yes | — | Yes | Yes | — |
| `selectText` | Yes | — | — | — | — |
| `scrollIntoViewIfNeeded` | — | Yes | — | — | — |
| `blur`, `dispatchEvent`, `focus`, `press`, `pressSequentially`, `setInputFiles` | — | — | — | — | — |

A single-target action also requires the locator to resolve to exactly one element. Strict resolution is not a visual property, so it appears outside the five-column matrix.

The matrix explains several otherwise surprising results:

- `fill()` does not require geometric stability, but it does require editability.
- `hover()` does not require enabled state because disabled controls can still be hover targets.
- `press()` performs no matrix checks; focus the correct target and establish any prerequisite state yourself.
- `setInputFiles()` sets files on the input contract rather than automating a visible operating-system dialog.

Do not memorize the table as trivia. Use it to predict which race Playwright can and cannot remove.

### Visibility is a mechanical definition

For actionability, an element is visible when it has a non-empty bounding box and its computed `visibility` is not hidden. Important consequences include:

- `display: none` is not visible;
- a zero-sized element is not visible; and
- `opacity: 0` is still considered visible.

That last point surprises many engineers. Playwright's visibility definition is not a claim that a human can perceive every pixel. If opacity is part of the protected behavior, assert the relevant CSS or user-facing state explicitly.

### Stability is geometric

An element is stable after maintaining the same bounding box for at least two consecutive animation frames. This prevents a normal click from targeting a control while it is moving.

Stability does not mean the application is logically finished. A stationary button can still submit stale prices.

### Receiving events is a hit-test fact

For pointer actions, Playwright checks that the action point will hit the intended element rather than an overlay or another element.

Suppose a loading mask is transparent but remains above Checkout. The button may be visible and enabled, yet it does not receive pointer events. A normal click waits. A forced click may bypass that protection and produce a result no user could produce.

### Enabled follows platform and ARIA state

Form controls with disabled state are not enabled. Disabled fieldsets affect their descendants, and `[aria-disabled=true]` can disable descendants according to Playwright's actionability rules.

Enabled does not mean permitted by the business. A UI can mistakenly enable Refund for an order that is no longer refundable. The test must still verify the business outcome.

### Editable adds the readonly boundary

Editable means enabled and not readonly. It applies to actions such as `fill()` and `clear()`.

If a field becomes editable only after a user chooses a country, express that prerequisite. Do not force a value into a readonly field and call the scenario tested.

---

## 7.3 Actionability ends where business readiness begins

Consider a checkout screen:

```ts
const placeOrder = page.getByRole('button', { name: 'Place order' });

await placeOrder.click();
```

Playwright can establish that the button is mechanically clickable. It cannot infer that:

- inventory reservation completed;
- the final price is current;
- tax calculation succeeded;
- payment configuration loaded; or

- the backend will accept the order.

The application should expose readiness through user-visible state:

```ts
await expect(page.getByLabel('Order total')).toHaveText('$42.00');
await expect(page.getByText('Inventory reserved')).toBeVisible();
await expect(placeOrder).toBeEnabled();

await placeOrder.click();
await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
```

The preconditions explain why the action is valid. The outcome proves what the action achieved.

### Hydration creates a particularly deceptive race

A server-rendered page can display enabled controls before client code attaches listeners. Playwright behaves like a very fast user: it sees an actionable button and clicks. Later hydration replaces the element or resets entered text.

The product fix is to prevent premature interaction—typically by disabling controls until hydration completes. A test-only sleep hides a real user-facing defect.

When a click appears in the trace but nothing happens, ask:

1. Was the control actionable?
2. Was its listener attached?
3. Did hydration replace the node after the action?
4. Did the application expose a true ready state?

---

## 7.4 Web-first assertions are synchronization with meaning

This code takes a one-time snapshot:

```ts
const status = await page.getByTestId('order-status').textContent();
expect(status).toBe('Confirmed');
```

If the status is still `Processing`, the generic assertion fails immediately. It does not know how to read the page again.

Use a web-first assertion:

```ts
await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
```

Playwright re-resolves the locator and rechecks its text until the expectation passes or reaches its timeout.

This is not merely convenient waiting. The assertion names the state that matters. Its failure reports the expected value, the observed value, the locator, and the retry history.

### Prefer the final observable outcome

If clicking Save sends a request and then shows “Profile saved,” the strongest synchronization is usually:

```ts
await page.getByRole('button', { name: 'Save profile' }).click();
await expect(page.getByText('Profile saved')).toBeVisible();
```

Waiting only for the response may be too early. The response can arrive before the application updates the DOM, processes a queue message, or completes a follow-up request.

Use the network response when the network contract itself is under test or when it provides essential diagnostic evidence. Otherwise, the user-visible outcome is closer to the requirement.

---

## 7.5 Navigation: wait for identity, not a vague “loaded” state

Navigation and loading are related but different.

A navigation commits after response headers are processed and session history updates. Loading continues through document parsing, scripts, resources, and load events. A single-page application may then continue fetching data indefinitely.

### Use URL and UI assertions for destination identity

```ts
await page.getByRole('link', { name: 'Order history' }).click();

await expect(page).toHaveURL(/\/account\/orders$/);
await expect(page.getByRole('heading', { name: 'Order history' }))
  .toBeVisible();
```

The URL proves where the browser went. The heading proves that the destination is usable for the scenario.

When several navigations may occur, wait for the specific URL:

```ts
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForURL('**/checkout/payment');
```

Prefer `waitForURL()` over deprecated, racy navigation-wait patterns.

### Load states are lifecycle facts, not application readiness

`domcontentloaded` means the initial document was parsed. `load` means the load event fired. Neither means that QualityMart has finished asynchronous business work.

`page.waitForLoadState()` is occasionally useful for a newly captured popup or a document-level requirement. Most tests do not need it before ordinary locator actions.

Avoid using `networkidle` as a general readiness signal. Playwright documents it as discouraged for testing. Analytics, polling, WebSockets, long requests, and service workers can make quiet-network windows irrelevant or unattainable. Even a perfectly quiet network does not prove that the UI shows the correct result.

> **Interview answer: Why not wait for network idle after every navigation?**
>
> “Network silence is an implementation condition, not a business outcome. Modern applications may poll forever or become usable while other requests continue. I assert the destination URL and the specific UI state the scenario needs. I use a load state only when that lifecycle event is actually the contract.”

---

## 7.6 Network synchronization uses the event-first pattern

When the request or response is part of the contract, start waiting before the trigger.

```ts
const responsePromise = page.waitForResponse(response =>
  response.url().endsWith('/api/orders') &&
  response.request().method() === 'POST'
);

await page.getByRole('button', { name: 'Place order' }).click();
const response = await responsePromise;

expect(response.status()).toBe(201);
```

Do not await the promise before clicking; no request exists yet. Do not start the wait after clicking; a fast response may already have occurred.

The same ordering applies to outgoing requests:

```ts
const requestPromise = page.waitForRequest(request =>
  request.url().endsWith('/api/search') &&
  request.method() === 'GET'
);

await page.getByRole('button', { name: 'Search' }).click();
const request = await requestPromise;

expect(new URL(request.url()).searchParams.get('q')).toBe('keyboard');
```

### Match narrowly enough to identify the operation

This can capture an unrelated background response:

```ts
page.waitForResponse('**/api/**');
```

Prefer a predicate that checks the endpoint, method, status, or request data needed to identify the business call.

### A successful response is not always the final oracle

For an end-to-end order test:

```ts
const responsePromise = page.waitForResponse(response =>
  response.url().endsWith('/api/orders') && response.status() === 201
);

await page.getByRole('button', { name: 'Place order' }).click();
await responsePromise;

await expect(page.getByRole('heading', { name: 'Order confirmed' }))
  .toBeVisible();
```

The response explains the integration. The heading protects the user outcome.

---

## 7.7 Poll external and computed state deliberately

Locator assertions cover browser-visible state. Some systems become consistent outside the page:

- an API reports a shipment after asynchronous processing;
- an email appears in a test inbox;
- a queue consumer updates an order record; or

- several observations must agree before the state is acceptable.

### `expect.poll()` retries a producer and matches its value

```ts
await expect.poll(async () => {
  const response = await request.get('/api/orders/QM-1042');
  const order = await response.json();
  return order.status;
}, {
  message: 'order should eventually be confirmed',
  timeout: 20_000,
  intervals: [250, 500, 1_000]
}).toBe('confirmed');
```

Use `expect.poll()` when the callback produces one value that a matcher can describe clearly.

### `expect().toPass()` retries a block of assertions

```ts
await expect(async () => {
  const response = await request.get('/api/orders/QM-1042');
  expect(response.status()).toBe(200);

  const order = await response.json();
  expect(order.status).toBe('confirmed');
  expect(order.total).toBe(42);
}).toPass({
  timeout: 20_000,
  intervals: [250, 500, 1_000]
});
```

Use `toPass()` when several observations form one consistency boundary.

Current Playwright defaults matter: `toPass()` has a timeout of `0` unless you set one, and it does not inherit the normal configured expect timeout. Specify a timeout when you intend real polling.

### Repeated callbacks must be safe

Every polling callback can run multiple times. Keep it observational.

Bad:

```ts
await expect(async () => {
  await request.post('/api/orders', { data: order });
  // This may create another order on every attempt.
}).toPass({ timeout: 20_000 });
```

Better:

```ts
const created = await request.post('/api/orders', { data: order });
const { id } = await created.json();

await expect.poll(async () => {
  const response = await request.get(`/api/orders/${id}`);
  return (await response.json()).status;
}, { timeout: 20_000 }).toBe('confirmed');
```

Perform the mutation once. Poll the observation.

---

## 7.8 Hard waits turn timing into probability

```ts
await page.waitForTimeout(3_000);
```

This statement proves only that three seconds passed.

If the application becomes ready in 200 ms, the test wastes 2.8 seconds. If it needs 3.2 seconds, the test still fails. Under load, the threshold moves again.

Replace duration with a condition:

```ts
await expect(page.getByText('Inventory reserved')).toBeVisible();
```

Hard waits have narrow diagnostic uses while observing a test locally. They should not be the synchronization contract committed to a production suite.

### Timeout inflation is the same mistake at a larger scale

Changing every timeout from 5 seconds to 60 seconds may reduce immediate failures, but it also:

- turns real defects into minute-long stalls;
- increases CI cost;
- hides which operation is slow;
- delays feedback for impossible conditions; and

- leaves the race undefined.

A legitimate slow operation may deserve a specific larger timeout. The code should name the reason:

```ts
await expect.poll(checkNightlyExport, {
  message: 'nightly export should reach object storage',
  timeout: 90_000,
  intervals: [1_000, 2_000, 5_000]
}).toBe(true);
```

The exception is local, observable, and reviewable.

---

## 7.9 Timeouts form a hierarchy

Playwright Test has several timeout domains. At the current baseline:

| Timeout | Default | What it bounds |
|---|---:|---|
| Test | 30 seconds | Test body, fixture setup, and `beforeEach` time |
| Expect | 5 seconds | One auto-retrying assertion |
| Action | No separate timeout by default | One action, still bounded by the test |
| Navigation | No separate timeout by default | One navigation, still bounded by the test |
| `beforeAll` / `afterAll` | 30 seconds | Each suite hook |
| Global | None | Entire test run |
| Fixture-specific | None unless configured | One fixture setup/teardown contract |

The test timeout is not replaced by a larger assertion timeout. The enclosing test budget still wins. A 60-second assertion inside a 30-second test cannot consume 60 seconds unless the test timeout is also extended.

Configure broad defaults conservatively:

```ts
export default defineConfig({
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 20_000
  }
});
```

The action and navigation values are optional policy choices, not universal recommended numbers. Some teams prefer the enclosing test timeout as the only default cap. What matters is that the hierarchy is intentional and failure messages reveal the boundary reached.

Use `test.slow()` when a scenario is predictably slow as a category; it triples the test timeout. Use `test.setTimeout()` for a justified explicit budget. Do not mark every flaky test slow.

### Diagnose the timeout that actually fired

| Failure text or location | Likely boundary | First question |
|---|---|---|
| `locator.click: Timeout...` | Action | Which actionability check never passed? |
| `expect(...).toHaveText` | Assertion | Did the expected state occur, and did the locator observe it? |
| `page.waitForResponse` | Event wait | Was the waiter started first, and did the predicate identify the real response? |
| `page.waitForURL` | Navigation | Did navigation occur, redirect elsewhere, or become a download? |
| `Timeout of 30000ms exceeded` | Test | Which nested operation consumed the remaining test budget? |
| Passes only on retry | Whole-test race | What changed between attempts: data, timing, worker, or environment? |

Do not increase a timeout until the trace answers that first question.

---

## 7.10 Test retries contain failures; they do not repair races

With retries enabled, a failed test is rerun until it passes or exhausts the configured attempts. Playwright Test discards the failed worker process and browser before continuing in a new worker.

This fresh-worker behavior reduces contamination from a failed test. It does not guarantee fresh backend data.

If a test creates order `QM-1042`, fails after creation, and retries with the same ID, the second attempt may collide with the first. Retry-safe tests need:

- unique or idempotent data creation;
- cleanup that runs after partial failure;
- assertions that do not depend on an earlier attempt; and

- evidence retained from the first failure.

The runner classifies a test that fails first and passes later as flaky. Treat that as a defect signal, not a green test to ignore.

Use retries to collect evidence and protect pipeline continuity while the cause is investigated. Do not use them as the synchronization strategy.

---

## 7.11 Selenium-to-Playwright waiting traps

### Trap 1: Recreating a global implicit wait

Selenium's implicit wait influences element lookup. Mixing it with explicit waits can produce difficult timing interactions.

Playwright locators and actions already have operation-specific retry behavior. Do not build a wrapper that sleeps or repeatedly calls `count()` before every action. Let the action express mechanical readiness and add an assertion for business readiness.

### Trap 2: Translating every `WebDriverWait` literally

This Selenium pattern:

```java
new WebDriverWait(driver, Duration.ofSeconds(10))
    .until(ExpectedConditions.visibilityOfElementLocated(
        By.id("confirmation")));
```

often becomes one Playwright assertion:

```ts
await expect(page.getByTestId('confirmation')).toBeVisible();
```

The semantic question remains important: is visibility the correct outcome, or should the test assert confirmation text and order identity?

### Trap 3: Adding a wait before an action that already waits

```ts
await expect(saveButton).toBeVisible();
await expect(saveButton).toBeEnabled();
await saveButton.click();
```

If those assertions are not business preconditions, the click already waits for its required checks. The extra lines add time and may imply coverage that does not exist.

Keep explicit precondition assertions when they explain protected behavior. Remove them when they merely duplicate actionability.

### Trap 4: Using forced clicks as synchronization

```ts
await checkout.click({ force: true });
```

Force disables non-essential checks; for click, it can skip the receives-events protection. It does not make the application ready. Review why a real user cannot perform the normal action.

### Trap 5: Waiting for a request when the response matters

`waitForRequest()` proves that the browser sent something. It does not prove success. Use it for payload and routing contracts. Use `waitForResponse()` for response behavior, and a UI or system assertion for the final outcome.

---

## 7.12 A synchronization decision framework

Use this order during design and review.

### 1. Name the race

Examples:

- overlay may still cover the button;
- destination URL may not have committed;
- order response may not have arrived;
- UI may not have rendered response data;
- backend projection may not contain the new order.

### 2. Choose the closest observable fact

| Race | Closest observation |
|---|---|
| Target not mechanically usable | Normal locator action |
| UI outcome not rendered | Web-first assertion |
| Destination not reached | `toHaveURL` or `waitForURL` |
| Specific request/response not observed | Event-first `waitForRequest/Response` |
| External state eventually consistent | `expect.poll` |
| Several observations must agree | `expect().toPass` |

### 3. Bound it locally

Use the default when it reflects normal service expectations. Add a local timeout only when the operation has a documented, different service-level expectation.

### 4. Preserve failure evidence

Give polling operations messages. Keep traces on first retry. Make locators and predicates specific enough that the failure identifies the missing contract.

### 5. Verify retry safety

Ask whether the callback, test, or setup can run again without creating duplicate or conflicting state.

---

## 7.13 Interview corner

### 1. What checks does Playwright perform before a click?

“The locator must resolve to one element, and the element must be visible, stable, enabled, and able to receive the pointer event at the action point. Different actions use different checks; for example, fill also requires editability but not stability.”

### 2. When do you need an explicit wait?

“When the required condition is outside the action's mechanical contract. I first name the race, then wait for the closest observable fact: a web-first assertion for UI state, a URL assertion for navigation, an event-first request or response wait for a network contract, or polling for external eventually consistent state.”

### 3. What is the difference between action retry and assertion retry?

“An action waits until its target is actionable, then performs the action once. A web-first assertion repeatedly observes state until the expectation passes. It does not repeat the previous action.”

### 4. Why are hard waits flaky?

“They synchronize to elapsed time, not readiness. A fixed delay is wasteful when the system is fast and insufficient when it is slow. The correct replacement is an observable condition with a bounded timeout.”

### 5. When would you use `waitForResponse()`?

“When a specific response is part of the contract or needed for diagnosis. I create the response promise before the triggering action, match the endpoint and method narrowly, then await it. For end-to-end behavior I still assert the final UI or system outcome.”

### 6. `expect.poll` versus `toPass`?

“Poll is best when a callback produces one value for a matcher. `toPass` retries a block containing several assertions. Both callbacks may run repeatedly, so I keep mutations outside. I set a timeout explicitly for `toPass` because its default timeout is zero.”

### 7. Are retries a fix for flakiness?

“No. They rerun the whole test in a new worker and can contain intermittent failures while preserving evidence. A pass on retry is classified as flaky and still needs investigation. Tests also need retry-safe data because browser isolation does not undo backend mutations.”

### 8. How do timeout types interact?

“The test timeout is the enclosing budget. Expect, action, navigation, fixture, hook, and global timeouts govern narrower scopes. A long inner timeout cannot outlive the remaining test budget. I diagnose which boundary fired before changing any number.”

---

## 7.14 Exercises

1. Build a button covered by an overlay for 500 ms. Show that normal `click()` waits, then inspect why `force: true` is a poor fix.
2. Create a server-rendered control whose listener attaches late. Reproduce the hydration race, then fix the application by disabling the control until it is ready.
3. Trigger an API call that returns before the UI updates. Compare waiting for the response with asserting the final status text.
4. Write a request predicate that accidentally captures a background call. Narrow it by method, path, and business identifier.
5. Poll an eventually consistent order API with `expect.poll()`. Move order creation outside the polling callback and explain why.
6. Configure a 10-second assertion inside a 5-second test. Observe which timeout fires, then fix the budget intentionally.
7. Replace three `waitForTimeout()` calls in a sample test with a URL assertion, a locator assertion, and an event-first response wait.
8. Enable one retry and make test data non-idempotent. Observe the collision, then redesign the data contract.

---

## 7.15 Review checklist

Before approving synchronization code, ask:

- Is the race named in business or browser terms?
- Does the chosen action already cover the mechanical readiness needed?
- Is the final user-visible outcome asserted?
- Is an event promise created before the action that can emit it?
- Is a request or response predicate narrow enough?
- Is `networkidle` being used as a vague substitute for application readiness?
- Does polling observe state without repeating mutations?
- Does `toPass()` have an intentional timeout?
- Is a local timeout justified by the operation's expected latency?
- Would the test remain safe if the whole body ran again?
- Does a retry preserve evidence and remain visible as a flaky result?
- Has timeout inflation replaced diagnosis?

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Version-sensitive behavior was checked against current official documentation:

- [Auto-waiting and the actionability matrix](https://playwright.dev/docs/actionability)
- [Assertions, `expect.poll`, and `toPass`](https://playwright.dev/docs/test-assertions)
- [Playwright Test timeout domains](https://playwright.dev/docs/test-timeouts)
- [Navigation, hydration, and URL waiting](https://playwright.dev/docs/navigations)
- [Network events and response waiting](https://playwright.dev/docs/network)
- [Page API: request, response, load-state, and URL waits](https://playwright.dev/docs/api/class-page)
- [Test retries and worker replacement](https://playwright.dev/docs/test-retries)

---

## What comes next

Synchronization gets the test to the right observation point. Chapter 8 asks a different question: what should the test prove once it gets there?

You will learn to build strong web-first oracles, distinguish retrying and non-retrying assertions, use negative and soft assertions carefully, and verify business outcomes without coupling tests to incidental implementation details.
