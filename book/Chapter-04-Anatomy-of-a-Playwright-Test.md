# Chapter 4 — Anatomy of a Playwright Test

You can write a Playwright test after learning three lines of syntax. You can maintain a Playwright suite only after understanding who creates the browser state, when hooks run, how workers divide the work, and which settings win when several scopes disagree.

That distinction matters during a Selenium migration. A direct translation can produce code that looks familiar but carries the old suite's hidden dependencies into a runner designed for isolation and parallelism.

This chapter takes one test apart and rebuilds it as a reliable unit of a larger system.

## What you will learn

By the end of the chapter, you will be able to:

- read the declaration and execution phases of a spec file;
- use `test`, `test.describe`, hooks, and `test.step` deliberately;
- explain the relationship among tests, files, workers, and browser contexts;
- distinguish default file parallelism from `fullyParallel` execution;
- predict when `beforeAll` can run more than once;
- apply annotations and tags without hiding risk;
- explain what Playwright isolates—and what remains shared;
- trace a `use` option from global configuration to project and suite overrides; and
- answer common runner and isolation interview questions with operational detail.

The examples use QualityMart, the controlled application introduced in the companion repository. Until its standalone service is complete, the tests serve deterministic pages through Playwright's routing API. The test structure is the same as it would be against a deployed application; only the dependency is controlled.

---

## 4.1 A test is an executable contract

Start with a complete test:

```ts
import { expect, test } from '@playwright/test';

test('guest can search the catalog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search products' })
    .fill('wireless keyboard');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByRole('heading', { name: 'Search results' }))
    .toBeVisible();
  await expect(page.getByTestId('result-count'))
    .toHaveText(/\d+ products?/);
});
```

This small block contains four different ideas:

1. `test` registers a test case with the runner.
2. The title states the behavior being protected.
3. `{ page }` asks the fixture system for a test-scoped page.
4. The body arranges state, performs an action, and checks an observable outcome.

### The title is operational metadata

The title appears in terminal output, reports, traces, grep searches, and failure notifications. Treat it as part of the design.

Compare these titles:

```ts
test('search test', async ({ page }) => { /* ... */ });
test('guest sees matching products after searching by name', async ({ page }) => { /* ... */ });
```

The first tells an investigator where to look. The second tells the investigator what behavior stopped working.

A useful title normally includes:

- the actor or relevant state;
- the action or condition; and
- the expected business result.

Do not force every title into a rigid template. A title is successful when a reader can understand the failure without opening the test.

### A meaningful oracle makes it a test

Playwright will fail a test if an action times out or code throws an exception. That does not guarantee the test checks the business outcome you intended.

This script may stay green even when search returns the wrong products:

```ts
await page.goto('/');
await page.getByRole('searchbox').fill('wireless keyboard');
await page.getByRole('button', { name: 'Search' }).click();
```

It proves that the controls were actionable. It does not prove that search worked.

Add an oracle that would become false if the feature broke:

```ts
await expect(page.getByRole('heading', { name: 'Search results' }))
  .toBeVisible();
await expect(page.getByTestId('result-count'))
  .toHaveText('2 products');
```

The oracle does not have to be an `expect` call in every kind of automated check, but end-to-end tests should make their protected outcome obvious. “The commands did not throw” is rarely a sufficient business oracle.

> **Interview signal**
>
> A strong answer does not say only, “A test needs assertions.” It says, “A test needs an observable oracle tied to the risk. Actionability failures catch broken mechanics; business assertions catch wrong outcomes.”

### The body receives fixtures, not global singletons

The parameter in this function is destructured:

```ts
async ({ page }, testInfo) => { /* ... */ }
```

`page` is a built-in fixture. Playwright creates it for the test, along with a fresh browser context, and tears that state down afterward. `testInfo` is optional metadata for the current run: title, project, retry number, output paths, attachments, annotations, and more.

This fixture model is a major difference from a Selenium base class that owns one mutable driver field. The test declares what it needs; the runner manages lifecycle and cleanup.

---

## 4.2 Declaration time and execution time

A spec file has two lives.

During **collection**, Playwright loads the file and executes its top-level code to discover tests, suites, hooks, and configuration. During **execution**, a worker runs the selected hooks and test bodies.

That distinction explains several rules that otherwise feel arbitrary.

This loop is safe because it registers a deterministic set of tests during collection:

```ts
for (const role of ['buyer', 'seller', 'support']) {
  test(`${role} can open the dashboard`, async ({ page }) => {
    await page.goto(`/dashboard?role=${role}`);
    await expect(page.getByRole('heading')).toContainText('Dashboard');
  });
}
```

This pattern is risky:

```ts
const cases = await fetch('https://test-data.example/cases').then(r => r.json());

for (const item of cases) {
  test(item.title, async ({ page }) => { /* ... */ });
}
```

Now test discovery depends on a live network call. Listing tests, editor integration, CI collection, and retries can see different suites. If data controls the identity of tests, keep that data deterministic and local. If data is runtime setup, obtain it through a fixture or hook.

### `test.describe` builds a suite

`test.describe` groups tests and establishes a scope for hooks, annotations, tags, and options:

```ts
test.describe('Catalog search', { tag: '@catalog' }, () => {
  test('guest sees matching products', async ({ page }) => { /* ... */ });
  test('empty query shows guidance', async ({ page }) => { /* ... */ });
});
```

The report title becomes a path:

```text
Catalog search › guest sees matching products
```

Use nesting when each level adds business meaning. `Checkout › Payment › rejects an expired card` is useful. `Checkout › Tests › Group A › Case 1` is taxonomy without information.

Unlike a TestNG XML suite or a JUnit class, a Playwright suite is declared in TypeScript. That makes composition convenient, but it also means top-level side effects are real program behavior. Keep collection fast, deterministic, and unsurprising.

---

## 4.3 Hooks are scoped lifecycle code

Playwright provides four familiar hooks:

| Hook | Purpose | Available fixture scope |
|---|---|---|
| `beforeEach` | Prepare every test | Test-scoped and worker-scoped fixtures |
| `afterEach` | Inspect or clean up after every test | Test-scoped and worker-scoped fixtures |
| `beforeAll` | Prepare a suite in a worker | Worker-scoped fixtures only |
| `afterAll` | Tear down suite resources in a worker | Worker-scoped fixtures only |

A typical suite uses `beforeEach` for navigation:

```ts
test.describe('Catalog search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('guest sees matching products', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search products' })
      .fill('wireless keyboard');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByTestId('result-count')).toHaveText('2 products');
  });
});
```

### Hook scope follows declaration scope

A hook at file level applies to tests in that file. A hook inside `test.describe` applies only to that suite. Nested `beforeEach` hooks run from outer scope to inner scope before the test. Applicable `afterEach` hooks then run after it.

Hooks are helpful until they make behavior invisible. If understanding a test requires searching through a base module, three nested suites, and five hooks, the test has lost locality.

Prefer hooks for setup that is:

- required by every test in the scope;
- cheap enough to repeat; and
- conceptually part of the precondition.

Keep scenario-specific setup in the test or in a clearly named fixture.

### Why `page` is unavailable in `beforeAll`

`page` and `context` are test-scoped fixtures. `beforeAll` runs outside any one test's isolated context, so this is invalid:

```ts
test.beforeAll(async ({ page }) => {
  await page.goto('/');
});
```

The correct default is to navigate in `beforeEach`. If an expensive resource truly belongs to a worker, model it as a worker-scoped fixture. Creating one shared page manually for several tests usually trades a small speed gain for order dependence and state leakage.

### Cleanup should be idempotent

An `afterEach` may run after a failed test, and teardown code can encounter partially created state. Write cleanup so that “already absent” is acceptable:

```ts
test.afterEach(async ({ request }, testInfo) => {
  const orderId = testInfo.annotations
    .find(annotation => annotation.type === 'orderId')?.description;

  if (orderId) {
    await request.delete(`/api/test-support/orders/${orderId}`);
  }
});
```

Do not let cleanup erase the original evidence. When teardown fails, reports become noisier and the primary failure becomes harder to diagnose.

---

## 4.4 Workers, files, and the `beforeAll` trap

This is the section interview questions often compress into a misleading slogan.

Playwright runs tests in operating-system worker processes. Workers are independent: they do not share memory, and each starts its own browser. The runner reuses a healthy worker for compatible files when it can.

The default execution model is:

- test files may run in parallel across workers;
- tests inside one file run in declaration order; and
- a `beforeAll` in that file runs before the file's tests in the worker executing them.

Therefore, adding `--workers=4` does **not** automatically split twenty tests from one file across four workers. Under default mode, that file remains a unit.

### What `fullyParallel` changes

With `fullyParallel: true`, or `test.describe.configure({ mode: 'parallel' })`, tests within one file can run independently in separate workers. Each parallel test executes its relevant hooks, including `beforeAll` and `afterAll`.

Consider:

```ts
test.describe.configure({ mode: 'parallel' });

test.beforeAll(async () => {
  console.log('suite setup');
});

test('case A', async ({ page }) => { /* ... */ });
test('case B', async ({ page }) => { /* ... */ });
```

The setup can run once for the worker execution of case A and again for case B. It is not a run-wide singleton.

### A worker restart also repeats `beforeAll`

After a test failure, Playwright shuts down that worker to protect later tests from contaminated process state. Remaining work continues in a new worker. Relevant `beforeAll` hooks run again there.

Retries also run in a fresh worker. As a result, `beforeAll` must tolerate repetition even when a file normally runs sequentially.

The safe mental model is:

> `beforeAll` is suite setup within a worker lifecycle—not “exactly once” infrastructure.

If setup must be safe across workers, make it unique or idempotent. If setup must happen before dependent projects, prefer a setup project so it appears in reports and can use fixtures. The older `globalSetup` option also exists, but project dependencies integrate more fully with traces and reports.

### Do not solve collisions by disabling parallelism first

`workers: 1` may hide a shared-data defect, but it also hides the reason the suite cannot scale. Investigate the contested resource:

- a fixed username;
- one mutable cart;
- a shared output filename;
- a database record with a constant key; or
- an environment-wide feature flag.

Use `testInfo.workerIndex` for worker-level partitions and a per-test identifier when tests inside a worker can still collide.

> **Interview answer: Does `beforeAll` run once?**
>
> “It runs once for its suite in a worker lifecycle, not guaranteed once for the whole run. Files are parallel by default but tests within one file are sequential. With fully parallel tests, relevant `beforeAll` hooks run for each parallel worker execution. A worker restart after failure or for a retry also runs them again. I therefore make `beforeAll` idempotent and never use it as a run-wide singleton.”

---

## 4.5 `test.step` turns commands into a diagnostic story

Named steps group actions in reports and traces:

```ts
test('buyer can place an order', async ({ page }) => {
  await test.step('Add a product', async () => {
    await page.goto('/products/wireless-keyboard');
    await page.getByRole('button', { name: 'Add to cart' }).click();
  });

  await test.step('Submit checkout', async () => {
    await page.getByRole('link', { name: 'Cart' }).click();
    await page.getByRole('button', { name: 'Checkout' }).click();
    await page.getByLabel('Delivery address').fill('14 Lake Road');
    await page.getByRole('button', { name: 'Place order' }).click();
  });

  await test.step('Verify confirmation', async () => {
    await expect(page.getByRole('heading', { name: 'Order confirmed' }))
      .toBeVisible();
    await expect(page.getByTestId('order-number')).toHaveText(/^QM-\d+$/);
  });
});
```

Good step names express business phases. “Submit checkout” is better than “Click button and fill input.” The implementation already records individual actions; the step should add meaning.

Do not wrap every command in a step. Excessive nesting makes traces harder to scan and adds ceremony without information. Add steps where an investigator would naturally ask, “Which phase failed?”

Helper methods can own steps too:

```ts
async function addProductToCart(page: Page, productName: string) {
  await test.step(`Add ${productName} to cart`, async () => {
    const card = page.getByRole('article', { name: productName });
    await card.getByRole('button', { name: 'Add to cart' }).click();
  });
}
```

This improves reporting without forcing the test to duplicate implementation detail.

---

## 4.6 Annotations change expected outcomes

Built-in annotations have different semantics:

| Annotation | Runs the test? | What a healthy result means |
|---|---:|---|
| `test.skip()` | No | The scenario is not applicable in this configuration |
| `test.fixme()` | No | A known problem prevents useful execution |
| `test.fail()` | Yes | The test is currently expected to fail; an unexpected pass is reported |
| `test.slow()` | Yes | The test timeout is tripled |
| `test.only()` | Yes, exclusively | Only focused tests are selected |

Use conditional annotations when applicability depends on a fixture:

```ts
test('touch menu opens on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Touch menu is available only in mobile projects');
  // ...
});
```

Use `test.fail()` carefully:

```ts
test('discount is calculated before tax', async ({ page }) => {
  test.fail(true, 'Known defect QM-482');
  // Assert the correct behavior, not the current defect.
});
```

The test should describe the desired contract. When the product is fixed and the test unexpectedly passes, Playwright tells you to remove the expected-failure annotation.

### `test.only` is a local tool and a CI hazard

A focused test is convenient while debugging. If it reaches CI without protection, the selected test can pass while the rest of the suite never runs.

Make the runner reject that condition:

```ts
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
});
```

The companion project already enables this guard.

### Custom annotations preserve context

Tags select tests; annotations explain them. For example:

```ts
test('buyer can place an order', {
  tag: ['@smoke', '@checkout'],
  annotation: {
    type: 'requirement',
    description: 'QM-CHECKOUT-014'
  }
}, async ({ page }) => {
  // ...
});
```

Reports and custom reporters can read that metadata without encoding ticket IDs into the test title.

---

## 4.7 Tags and grep create execution slices

Tags start with `@` and become part of the title information used by grep:

```ts
test('guest can search', { tag: ['@smoke', '@catalog'] }, async ({ page }) => {
  // ...
});
```

Run smoke tests:

```bash
npx playwright test --grep @smoke
```

Exclude slow tests:

```bash
npx playwright test --grep-invert @slow
```

Require two tags with a regular expression:

```bash
npx playwright test --grep '(?=.*@smoke)(?=.*@checkout)'
```

Use tags to represent stable execution policy, not every fact about a test. A maintainable scheme might define:

- `@smoke`: fast, release-critical behavior;
- `@regression`: broader behavioral coverage;
- `@destructive`: modifies environment-wide state; and
- feature tags such as `@catalog` and `@checkout`.

Document ownership and selection rules. Tag drift—`@Smoke`, `@critical`, `@quick-smoke`—turns a policy into guesswork.

Do not confuse tagging with prioritization. A smoke tag does not make a weak test important. It identifies a test that already protects a critical risk and is reliable enough for fast feedback.

---

## 4.8 Isolation has a boundary

For the built-in `page` fixture, every test receives a fresh browser context. That isolates:

- cookies;
- local storage and session storage;
- browser cache associated with the context;
- permissions granted to the context; and
- pages opened inside that context.

The browser process may be shared by tests in a worker for efficiency, but their contexts are separate.

This does **not** automatically isolate:

- database records;
- server-side carts or saved preferences;
- shared user accounts;
- message queues;
- files written to a common path;
- third-party sandboxes; or
- environment-wide configuration.

The difference becomes visible in parallel execution. Two fresh contexts can both authenticate as `buyer@example.test`. If both tests modify the same server-side cart, their cookies are isolated while their data collides.

Choose an isolation strategy based on the behavior:

1. **Per-test data** — create a unique order, user, or record for every test. This is the strongest default for mutable state.
2. **Per-worker accounts** — useful when account creation is expensive and tests assigned to one worker can safely share the account.
3. **Shared read-only accounts** — acceptable only when all concurrent tests can use the account without changing server-side state.
4. **Environment reset** — useful as a baseline, but not a replacement for concurrency-safe data design.

Authentication state files restore browser credentials. They do not clone the server-side user. Reusing one storage state across tests is safe only when the tests do not contend for that user's mutable backend state.

> **Interview answer: What does Playwright isolate?**
>
> “The standard test fixtures isolate browser state by creating a fresh context for each test. Cookies, storage, permissions, and pages do not leak. The browser process may still be shared within a worker, and everything beyond the context—database state, accounts, queues, files, and external systems—remains my responsibility. I use unique test data or worker partitions for those resources.”

---

## 4.9 Configuration is scope plus precedence

The configuration file contains two broad families of settings.

Top-level settings control the runner:

```ts
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: 'html'
});
```

`use` settings control the environment provided to tests:

```ts
export default defineConfig({
  use: {
    baseURL: 'https://qualitymart.test',
    locale: 'en-US',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
});
```

Putting `workers` or `retries` inside `use` is a category error. Putting `locale` at the top level misses the fixture option scope. TypeScript catches many such mistakes when the config is typed through `defineConfig`.

### The `use` cascade

A `use` option can be set globally, overridden by a project, and overridden again with `test.use()` in a file or suite. The most specific applicable value wins.

```ts
// playwright.config.ts
export default defineConfig({
  use: { locale: 'en-US' },
  projects: [
    {
      name: 'firefox-germany',
      use: {
        ...devices['Desktop Firefox'],
        locale: 'de-DE'
      }
    }
  ]
});
```

```ts
// tests/checkout/france.spec.ts
test.use({
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris'
});
```

The France spec runs with `fr-FR` even in the German project because the suite-level override is more specific. Other files in that project remain `de-DE`; other projects retain their own or the global value.

The cascade applies to options, not every runner setting. `test.use()` does not override `workers`, `reporter`, or `testDir`.

### Projects multiply tests

A project is a named configuration. Chromium, Firefox, and WebKit projects cause one declared test to produce three executions. Projects can also model devices, locales, authenticated roles, environments, or setup dependencies.

When a report says “18 tests” for six declarations, ask whether three projects ran. Distinguishing declared tests from test executions prevents misleading coverage and duration claims.

### Retries classify; they do not repair

With retries enabled, Playwright distinguishes:

- **passed** — passed on the first attempt;
- **flaky** — failed first and passed on retry; and
- **failed** — failed on every allowed attempt.

Retries are useful diagnostic policy, especially with traces retained on the first retry. They are not permission to ignore flakiness. A test that passes only after a worker restart may be revealing leaked state, contested data, or a timing defect.

---

## 4.10 A complete, maintainable example

The following test combines the chapter's ideas without turning them into ceremony:

```ts
import { expect, test } from '@playwright/test';

test.describe('Catalog search', { tag: ['@smoke', '@catalog'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('guest sees matching products after searching by name', {
    annotation: {
      type: 'requirement',
      description: 'QM-CATALOG-002'
    }
  }, async ({ page }) => {
    await test.step('Search the catalog', async () => {
      await page.getByRole('searchbox', { name: 'Search products' })
        .fill('wireless keyboard');
      await page.getByRole('button', { name: 'Search' }).click();
    });

    await test.step('Verify matching results', async () => {
      await expect(page.getByRole('heading', { name: 'Search results' }))
        .toBeVisible();
      await expect(page.getByTestId('result-count'))
        .toHaveText('2 products');
      await expect(page.getByRole('article', { name: /wireless keyboard/i }))
        .toBeVisible();
    });
  });
});
```

The structure exposes behavior and hides only repeated precondition. The suite communicates:

- feature area through `describe`;
- execution policy through tags;
- traceability through an annotation;
- common navigation through `beforeEach`;
- diagnostic phases through steps; and
- business outcome through web-first assertions.

More structure would not necessarily make it better. A page object, custom fixture, or helper should be introduced only when it earns its abstraction cost.

---

## 4.11 Selenium-to-Playwright translation traps

### Trap 1: Rebuilding the driver singleton

```ts
let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});
```

This recreates a shared-driver design. Tests become order-dependent and lose default context isolation. Prefer the built-in `page` fixture.

### Trap 2: Treating `beforeAll` like TestNG `@BeforeSuite`

`beforeAll` belongs to a suite in a worker lifecycle. It can repeat under full parallelism, failure recovery, and retries. Use project dependencies or carefully designed global setup when the concern is run-wide orchestration.

### Trap 3: Hiding all setup in hooks

Long inheritance chains often make Selenium preconditions invisible. Moving every line into Playwright hooks preserves the same problem in a new syntax. A reader should see the scenario's important state in the test.

### Trap 4: Disabling parallelism to protect shared accounts

Serial execution is sometimes required, but it should be a conscious business constraint. If unique data can remove the collision, fix the data design and keep parallel execution.

### Trap 5: Counting green executions as independent coverage

One scenario across three browser projects is valuable cross-browser evidence, not three different behaviors. Report both dimensions: six scenarios, eighteen browser executions.

---

## 4.12 Failure lab

Use these experiments in a disposable branch.

### Lab A — prove the context boundary

In one test, set a local-storage value. In another, assert that the value is absent. Run both with `fullyParallel` enabled. Then replace local storage with a shared backend record and observe that browser isolation does not reset the server.

### Lab B — observe worker recovery

Add a `beforeAll` log containing `process.env.TEST_WORKER_INDEX`. Force the first test to fail and allow another test to continue. Observe the new worker index and the repeated setup. Remove the intentional failure afterward.

### Lab C — prove `forbidOnly`

Add `test.only` locally and run the suite. Then run:

```bash
CI=1 npx playwright test
```

The build should fail during collection instead of silently running only the focused test.

### Lab D — prove option precedence

Set `locale: 'en-US'` globally, `de-DE` in one project, and `fr-FR` with `test.use()` in one suite. Assert `navigator.language` in each scope. Predict the resolved value before running.

---

## 4.13 Interview corner

### 1. What is the default unit of parallelism?

“Test files run in parallel across worker processes by default, while tests inside one file run in order. `fullyParallel` or parallel describe mode allows individual tests in a file to run in separate workers. Workers do not share memory.”

### 2. Can `beforeAll` run more than once?

“Yes. It runs for its suite in a worker lifecycle. Full parallelism gives each test its relevant hooks, and Playwright restarts workers after failures and for retries, which runs the hook again. I design it to be repeatable.”

### 3. Why can’t the built-in `page` fixture be used in `beforeAll`?

“`page` is test-scoped and belongs to the fresh context created for one test. `beforeAll` is worker-suite setup outside an individual test. If I need shared worker setup, I use a worker-scoped fixture, but I keep pages test-scoped to preserve isolation.”

### 4. What is the difference between a worker and a browser context?

“A worker is an operating-system process used by the test runner. It owns a browser instance and may run multiple files. A browser context is an isolated browser session. The runner normally creates a fresh context for each test even when the browser process is reused.”

### 5. When is a shared authenticated account safe?

“Only when concurrent tests do not modify server-side state for that account. Reusing storage state isolates browser sessions, not the backend user. For stateful tests I allocate unique accounts or partition them by worker.”

### 6. How do global, project, and suite `use` settings interact?

“They form a specificity cascade: global `use` provides defaults, project `use` overrides them for that configuration, and `test.use()` overrides them for its file or describe scope. Runner options such as workers are not part of that cascade.”

### 7. What does `test.fail()` do?

“It marks failure as the expected status but still runs the test. The test should assert the desired behavior. If the defect is fixed and the test unexpectedly passes, Playwright reports that mismatch so the annotation can be removed.”

### 8. How would you design smoke and regression execution?

“I tag stable, release-critical scenarios `@smoke` and select them on pull requests with `--grep`. I run broader regression coverage on merge or scheduled builds. I document tag semantics and track flaky tests separately rather than excluding them silently.”

---

## 4.14 Exercises

1. Create a `Catalog search` suite with success, zero-result, and invalid-input scenarios. Use `beforeEach` only for setup shared by all three. Give each test a business oracle.
2. Run a two-test file first with default parallelism and then with `fullyParallel`. Log the worker index and explain the different hook behavior.
3. Add `@smoke` and `@catalog` tags, then run tests containing both tags and tests containing either tag. Record the regular expressions you used.
4. Create a suite-level French locale override and prove it with `navigator.language`. Confirm a test in another file retains the project or global locale.
5. Review one Selenium suite you maintain. List every piece of state stored on the base class. Classify each as test-scoped, worker-scoped, run-scoped, or external shared state before translating it.

---

## 4.15 Review checklist

Before approving a Playwright test file, ask:

- Do titles describe protected behavior?
- Does every scenario have an oracle tied to the intended risk?
- Are tests independent of declaration order?
- Are hooks small, scoped, and repeatable?
- Is any test-scoped browser state being shared manually?
- Can parallel executions collide through backend data or files?
- Are `test.only` and unexplained skips blocked by policy?
- Do tags have documented semantics?
- Are steps adding business meaning rather than wrapping every action?
- Can a reviewer predict the resolved `use` options?

---

## Source notes

Behavior in this chapter was checked against the Playwright 1.61 documentation:

- [Writing tests](https://playwright.dev/docs/writing-tests)
- [Parallelism and worker processes](https://playwright.dev/docs/test-parallel)
- [Fixtures and fixture scopes](https://playwright.dev/docs/test-fixtures)
- [Annotations and tags](https://playwright.dev/docs/test-annotations)
- [Test API: hooks, suites, and steps](https://playwright.dev/docs/api/class-test)
- [Configuration](https://playwright.dev/docs/test-configuration)
- [Configuration scopes and `use` precedence](https://playwright.dev/docs/test-use-options)
- [Global setup and project dependencies](https://playwright.dev/docs/test-global-setup-teardown)
- [Retries and worker recovery](https://playwright.dev/docs/test-retries)

---

## What comes next

You now know what the runner considers a test, where its state comes from, and when its lifecycle code repeats.

Chapter 5 moves from test structure to element targeting. You will learn why a locator is a re-evaluated description rather than a stored element, how accessibility roles produce resilient tests, how strictness exposes ambiguity, and when a test ID is the right explicit contract.
