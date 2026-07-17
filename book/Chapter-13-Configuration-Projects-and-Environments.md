# Chapter 13 — Configuration, Projects, and Environments

Configuration is executable policy.

It decides which tests run, where they run, how they are isolated, what evidence failures retain, and which conditions make the suite stop. A `playwright.config.ts` file is therefore part of the framework's architecture—not a dumping ground for every URL, credential, timeout, and team preference.

For a Selenium engineer, the biggest shift is that Playwright Test already owns much of the execution model. You usually do not need a driver factory, browser manager, base test, listener registry, or hand-built thread-local configuration. The runner, projects, fixtures, browser contexts, reporters, and artifacts form one typed system.

The design question is:

> Which policy belongs at runner, project, context, fixture, suite, or test scope?

## What you will learn

By the end of this chapter, you will be able to:

- separate runner, assertion, browser-context, project, and infrastructure configuration;
- explain configuration precedence without hiding important overrides;
- model browsers, devices, environments, and capabilities with projects;
- control project-matrix cost instead of creating a Cartesian explosion;
- use setup and teardown projects, `globalSetup`, and `webServer` deliberately;
- parse and validate environment variables as a typed contract;
- design artifact and reporter policy for local and CI execution;
- decide when multiple configs or monorepo boundaries are justified; and
- answer configuration and environment interview questions with trade-offs.

---

## 13.1 Five configuration concerns

Playwright configuration becomes easier to reason about when settings are grouped by responsibility.

| Concern | Typical settings | Question answered |
|---|---|---|
| Runner | `testDir`, `timeout`, `fullyParallel`, `workers`, `retries`, `forbidOnly` | How does the suite execute? |
| Assertions | `expect.timeout`, snapshot settings | How long and how precisely do oracles evaluate? |
| Browser context | `baseURL`, `storageState`, `locale`, `timezoneId`, `trace`, `video`, `screenshot` | What isolated test context is created? |
| Projects | `name`, `testMatch`, `use`, `dependencies`, `teardown` | Which logical execution variants exist? |
| Infrastructure and output | `webServer`, reporters, `outputDir`, metadata | What must run, and what evidence is produced? |

Do not move every value into `use`. Runner options such as `workers` and `retries` are not browser-context options. Keep settings where their lifecycle and ownership are visible.

A useful baseline is small:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'https://qualitymart.test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
```

This is policy, not universal truth. A resource-limited CI runner may need one worker. A fast API suite may need no video. A release pipeline may run more browsers than a pull-request pipeline.

---

## 13.2 Precedence: broad defaults, narrow exceptions

Configuration is layered. More specific scopes can override broader defaults:

1. shared config establishes suite defaults;
2. project configuration specializes a variant;
3. file or `describe`-level `test.use()` specializes a group;
4. test-level configuration handles a justified exception; and
5. command-line options can override supported settings for an invocation.

For example:

```ts
// playwright.config.ts
export default defineConfig({
  use: { locale: 'en-US' },
  projects: [
    {
      name: 'india-chromium',
      use: { locale: 'en-IN', timezoneId: 'Asia/Kolkata' }
    }
  ]
});
```

```ts
test.describe('French catalog', () => {
  test.use({ locale: 'fr-FR' });

  test('formats the price', async ({ page }) => {
    // This suite receives fr-FR even inside the en-IN project.
  });
});
```

Use broad scopes for stable policy and narrow scopes for real exceptions. If every file overrides timeouts, locale, storage state, and artifact behavior, the effective configuration becomes difficult to predict.

> **Interview answer: How does Playwright configuration precedence work?**
>
> “I start with top-level defaults, specialize them per project, and use `test.use()` only for narrower suites or tests. Supported CLI flags can override an invocation. I keep overrides rare and reviewable because the effective value is the most specific applicable setting, not simply whatever appears in the main config.”

---

## 13.3 Projects are named execution contracts

A project is a logical group of tests that share configuration. Browser engines are the most familiar example, but projects can also represent:

- desktop and mobile device profiles;
- anonymous and authenticated states;
- regional locale and timezone combinations;
- deployment environments;
- smoke, regression, accessibility, or destructive capabilities; and
- product surfaces in a monorepo.

```ts
projects: [
  {
    name: 'desktop-chromium',
    use: { ...devices['Desktop Chrome'] }
  },
  {
    name: 'mobile-safari',
    use: { ...devices['iPhone 15'] }
  }
]
```

All projects run by default. A developer can select one or more with `--project`:

```bash
npx playwright test --project=desktop-chromium
```

Project names are operational interfaces. Make them stable, readable in reports, and meaningful to CI users. `chrome-env2-role1` communicates less than `staging-admin-chromium`.

Projects do not create backend data isolation. Two projects can still mutate the same account, order, inbox, or tenant. Browser-context isolation protects cookies and local storage; test-data design must protect shared systems.

---

## 13.4 Control the matrix

Suppose a suite supports:

- 3 browsers;
- 4 roles;
- 3 regions;
- 3 environments; and
- 2 device classes.

The full product is 216 variants before test-data cases. Encoding every dimension as a project can turn a useful suite into an expensive scheduling problem.

Choose coverage by risk:

| Pipeline | Example coverage |
|---|---|
| Pull request | Chromium, critical smoke, one stable environment |
| Main branch | all engines, selected regional and role risks |
| Nightly | broader device and data partitions |
| Release | production-like environment, critical cross-browser journeys |

Keep orthogonal data in typed test parameters when it does not require a different browser context or runner policy. Use projects when a variation truly changes configuration, selection, dependencies, or fixtures.

Avoid destructive production tests merely because a `production` project is technically possible. Production checks should be separately governed, read-only where possible, and protected by explicit capability flags.

---

## 13.5 Device descriptors and override order

Playwright device descriptors contain several context values. JavaScript spread order therefore matters:

```ts
use: {
  ...devices['iPhone 15'],
  locale: 'en-IN',
  timezoneId: 'Asia/Kolkata',
  baseURL: environment.webURL
}
```

The explicit values come after the descriptor and win.

This ordering can accidentally reverse policy:

```ts
use: {
  locale: 'en-IN',
  ...devices['iPhone 15']
}
```

Treat a descriptor as a baseline, then apply deliberate overrides. The same rule applies when composing shared config objects: later object properties replace earlier ones.

Device emulation is valuable but does not prove behavior on every physical device. It changes browser-context characteristics; it does not reproduce hardware, operating-system services, or all real-browser constraints.

---

## 13.6 Setup and teardown projects

Project dependencies make suite-wide prerequisites observable:

```ts
export default defineConfig({
  projects: [
    {
      name: 'seed-test-data',
      testMatch: /global\.setup\.ts/,
      teardown: 'remove-test-data'
    },
    {
      name: 'remove-test-data',
      testMatch: /global\.teardown\.ts/
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['seed-test-data']
    }
  ]
});
```

```ts
// global.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('create controlled tenant', async ({ request }) => {
  const response = await request.post('/test-support/tenants', {
    data: { key: process.env.RUN_ID }
  });
  expect(response).toBeOK();
});
```

Dependencies run before dependent projects. A dependent project starts only after its dependencies pass. The teardown project runs after dependent projects finish.

Because setup is a Playwright test, it can use fixtures, assertions, traces, retries, and normal reporting. Filtering the main tests does not normally remove required dependencies; use `--no-deps` only when intentionally bypassing them.

Setup is not “once forever.” It belongs to the selected test invocation. Make it idempotent, safe to retry, uniquely namespaced, and explicit about cleanup.

Do not seed thousands of records through UI steps. Prefer a controlled API, database support boundary, or disposable environment mechanism. Use the UI only when UI-based setup is itself the behavior under test.

---

## 13.7 `globalSetup` still exists

Playwright also supports `globalSetup` and `globalTeardown` functions.

| Capability | Setup project | `globalSetup` |
|---|---|---|
| Playwright fixtures | Yes | No built-in test fixtures |
| Reported as a test | Yes | No |
| Trace and artifact integration | Natural | Manual |
| Project dependency graph | Yes | No |
| Simple process-level bootstrap | Possible | Direct |

Prefer a project dependency when setup benefits from fixtures, retries, traces, reporting, or an explicit dependency graph. A `globalSetup` function can still be appropriate for a small process-level action that is not meaningfully a test and does not need those facilities.

Do not put half the framework into either mechanism. Authentication state can often be produced by a setup project; test-scoped data belongs in fixtures; service startup may belong in `webServer`; environment parsing belongs in a typed configuration module.

---

## 13.8 `webServer` manages local application processes

The `webServer` option can launch an application before tests and wait until it is reachable:

```ts
webServer: {
  command: 'npm run start:test',
  url: 'http://127.0.0.1:4173/health',
  timeout: 120_000,
  reuseExistingServer: !process.env.CI,
  stdout: 'pipe',
  stderr: 'pipe'
}
```

Multiple servers are supported:

```ts
webServer: [
  {
    command: 'npm run start:api',
    url: 'http://127.0.0.1:4010/health'
  },
  {
    command: 'npm run start:web',
    url: 'http://127.0.0.1:4173/health'
  }
]
```

Readiness is not the same as “the process started.” Point the probe at an endpoint that confirms required dependencies are ready. A listening port can still hide incomplete migrations, unavailable message brokers, or an unhealthy API.

`reuseExistingServer: true` improves local feedback, but it can attach tests to a stale or incorrectly configured process. CI should usually start a controlled server instead of reusing unknown state.

Use explicit loopback addresses, predictable ports, bounded startup timeouts, and logs that help diagnose failure. Do not print secrets in the command, environment, or server output.

---

## 13.9 Environment variables need a typed boundary

`process.env` is effectively an untyped map of optional strings. Scattering access across tests produces late failures and inconsistent defaults.

Parse once:

```ts
type Stage = 'local' | 'test' | 'staging';

interface TestEnvironment {
  stage: Stage;
  webURL: string;
  apiURL: string;
  workerCount: number;
  serviceToken: string;
}

function required(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requiredURL(source: NodeJS.ProcessEnv, name: string): string {
  const value = required(source, name);
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
}

export function loadEnvironment(source = process.env): TestEnvironment {
  const stage = required(source, 'TEST_STAGE');
  if (!['local', 'test', 'staging'].includes(stage)) {
    throw new Error(`TEST_STAGE has unsupported value: ${stage}`);
  }

  const workerCount = Number(required(source, 'TEST_WORKERS'));
  if (!Number.isInteger(workerCount) || workerCount < 1) {
    throw new Error('TEST_WORKERS must be a positive integer');
  }

  return Object.freeze({
    stage: stage as Stage,
    webURL: requiredURL(source, 'WEB_URL'),
    apiURL: requiredURL(source, 'API_URL'),
    workerCount,
    serviceToken: required(source, 'SERVICE_TOKEN')
  });
}
```

This contract fails before expensive browser work starts. It also gives the config and fixtures one trusted representation.

Separate secrets from ordinary configuration:

- inject secrets through the CI secret store;
- never commit `.env` credentials;
- do not include tokens in project names, annotations, URLs, screenshots, or logs;
- redact sensitive request and response data; and
- rotate a credential if it appears in an artifact.

Failing fast is safer than silently falling back to production, a shared tenant, or an empty token.

---

## 13.10 Environment is a contract, not only a URL

An execution environment includes more than `baseURL`:

| Contract area | Questions |
|---|---|
| Deployment | Which application and API versions are running? |
| Identity | Which roles, tenants, and authentication provider are available? |
| Data | Can tests create unique data? Who cleans it? |
| Dependencies | Are email, payments, search, and queues real, fake, or sandboxed? |
| Capabilities | Are destructive, privileged, or third-party actions permitted? |
| Observability | Can failures be correlated with server logs and a run ID? |

When an environment violates this contract, retries merely repeat uncertainty. A mature suite distinguishes product failure from unavailable prerequisite and exposes enough evidence to act.

Assign a unique run identifier. Namespace created resources with it. Record non-secret environment metadata in reports. Cleanup by ownership, not by broad queries such as “delete every test user.”

---

## 13.11 Reporters and artifacts are policy

Local output should optimize fast diagnosis. CI output must also support durable evidence and machine integration.

```ts
reporter: process.env.CI
  ? [
      ['line'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['junit', { outputFile: 'test-results/junit.xml' }]
    ]
  : [
      ['list'],
      ['html', { open: 'never' }]
    ],
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

Artifacts have cost. Always-on video and trace can increase storage, transfer time, and secret exposure. `on-first-retry` often balances evidence with cost: the first attempt stays lean, and the retry captures deeper diagnostics.

Retries are not a quality score. Report flaky recovery separately, preserve the first failure, and investigate recurring retries.

Keep output paths unique when CI shards or jobs upload in parallel. Merge reports deliberately rather than letting jobs overwrite the same folder.

---

## 13.12 Multiple configuration files

One config is easiest to understand. Multiple configs are justified when suites have materially different execution contracts, for example:

- UI versus performance-sensitive API checks;
- pull-request checks versus production-safe monitoring;
- independent products with different owners and release pipelines; or
- packages in a monorepo that deploy separately.

Extract a small shared base instead of copying entire files:

```ts
// config/base.ts
export const baseConfig = {
  forbidOnly: Boolean(process.env.CI),
  use: { trace: 'on-first-retry' as const }
};
```

```ts
// playwright.checkout.config.ts
export default defineConfig({
  ...baseConfig,
  testDir: './packages/checkout/tests',
  projects: checkoutProjects
});
```

Be careful with shallow object spread: replacing `use` or `expect` can discard nested defaults. Prefer explicit composition functions when merging becomes complex.

Do not create one config per environment by copying files. A typed environment contract plus a small project builder is usually clearer and resists drift.

---

## 13.13 Monorepo boundaries follow ownership

A monorepo does not require one enormous Playwright config. Align test projects and packages with deployable systems, team ownership, and CI boundaries.

A practical structure might contain:

```text
packages/
  checkout/
    playwright.config.ts
    tests/
  identity/
    playwright.config.ts
    tests/
test-platform/
  config/
  fixtures/
  reporters/
```

Share stable platform capabilities: environment parsing, reporter setup, approved fixtures, and artifact policy. Keep product selectors, domain workflows, and test data close to the product that owns them.

Version shared test packages. A change to a common fixture or config factory can affect many teams even when application code does not change.

The boundary test is simple: can a team understand, run, and release its suite without loading unrelated product policy?

---

## 13.14 Common configuration anti-patterns

- **God config:** one file contains secrets, data factories, page objects, CI branches, and every product project.
- **Boolean maze:** dozens of `if (CI && REGION && !MOBILE)` branches hide the effective policy.
- **Matrix explosion:** every data variation becomes a project.
- **Silent fallback:** a missing environment variable points to production or a shared account.
- **Secret metadata:** tokens appear in names, annotations, logs, or URLs.
- **Setup black box:** a long `globalSetup` has no fixtures, steps, trace, or useful reporting.
- **Shared mutable setup:** one account or record is reused across parallel workers.
- **Stale server reuse:** local tests connect to an old process with different code or environment.
- **Copied configs:** environment-specific files drift in retries, reporters, and browser options.
- **Timeout inflation:** slow infrastructure is hidden by increasing every timeout.
- **CLI dependence:** critical CI policy exists only in an undocumented shell command.

---

## 13.15 Selenium-to-Playwright migration traps

1. Do not recreate `DriverFactory`, `ThreadLocal<WebDriver>`, and browser lifecycle in a base class.
2. Replace suite XML browser matrices with typed projects, but prune combinations by risk.
3. Replace listener-based screenshots with Playwright artifact policy and traces.
4. Replace configuration property bags with a validated environment object.
5. Replace opaque suite setup with fixtures or setup projects where observability matters.
6. Keep useful environment contracts and CI controls; remove driver-specific ceremony.
7. Do not assume browser isolation also isolates backend accounts or records.

---

## 13.16 A design rubric

For each configuration value, ask:

1. **Scope:** Is it runner, project, context, fixture, suite, or test policy?
2. **Owner:** Which team or platform owns the decision?
3. **Variation:** What legitimate dimension changes it?
4. **Validation:** Can an invalid value fail before test execution?
5. **Visibility:** Can a developer see the effective value in a report or project name without exposing secrets?
6. **Cost:** How does it affect runtime, storage, and matrix size?
7. **Isolation:** Could parallel workers or projects collide?
8. **Override:** Is a narrower override necessary and discoverable?

If a value has no clear owner or scope, moving it into config does not resolve the design problem.

---

## 13.17 Interview corner

### What are projects in Playwright?

“Projects are named logical test groups with shared configuration. I use them for browser engines, devices, environments, test selection, or capabilities that genuinely change execution. All projects run by default, and CI or developers can select projects. I avoid encoding every data combination as a project.”

### Project dependency or `globalSetup`?

“I prefer a setup project when I need fixtures, assertions, retries, trace, reporting, or an explicit dependency graph. `globalSetup` is acceptable for a small process-level bootstrap that does not benefit from those facilities.”

### How do you manage multiple environments?

“I parse environment variables once into a typed, immutable object; validate URLs, enums, integers, required capabilities, and secrets; and fail before browser work. Projects select meaningful execution variants, while credentials come from the CI secret store and never enter reports.”

### How do you reduce cross-browser execution time?

“I select the matrix by pipeline risk: fast Chromium smoke on pull requests, broader engines on main or nightly, and release-critical coverage before deployment. I also keep data partitions out of projects unless they change execution policy, and I measure worker capacity rather than maximizing parallelism blindly.”

### What does `webServer` solve?

“It starts one or more local application processes and waits for a readiness URL or port before tests. I use a meaningful health endpoint, bounded timeout, diagnostic logs, and controlled CI startup. Local reuse can be convenient, but CI should not attach to unknown stale state.”

---

## 13.18 Exercises

1. Group an existing config into runner, assertion, context, project, and infrastructure concerns.
2. Add desktop Chromium and mobile Safari projects with explicit locale overrides.
3. Calculate the full browser-role-region-environment matrix, then design smaller PR and nightly matrices.
4. Build a setup project that creates a namespaced tenant and a teardown project that removes only its records.
5. Replace a scattered `process.env` implementation with a typed parser and negative tests.
6. Configure two local servers with meaningful readiness endpoints.
7. Design local and CI reporter/artifact policies and justify their cost.
8. Decide whether two sample product suites need one config, multiple configs, or separate packages.

---

## 13.19 Review checklist

- Are runner options separate from browser-context options?
- Are broad defaults stable and narrow overrides rare?
- Do project names describe meaningful execution contracts?
- Is the project matrix selected by risk rather than completeness theatre?
- Are device descriptor overrides applied in the intended order?
- Do projects avoid shared backend data and account collisions?
- Are setup actions observable, idempotent, retry-safe, and cleaned by ownership?
- Is `globalSetup` used only when its lower observability is acceptable?
- Does `webServer` wait for real readiness and avoid stale CI reuse?
- Are environment variables parsed once and validated before execution?
- Can a missing value ever fall back to production or shared state?
- Are secrets absent from source, names, logs, URLs, and artifacts?
- Do artifact settings balance diagnostic value and cost?
- Are shard and job output paths collision-safe?
- Do multiple configs represent real ownership or execution boundaries?
- Is shared monorepo policy small, stable, and versioned?

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Configuration behavior was checked against current official documentation:

- [Test configuration](https://playwright.dev/docs/test-configuration)
- [Projects](https://playwright.dev/docs/test-projects)
- [Global setup and teardown](https://playwright.dev/docs/test-global-setup-teardown)
- [Web server](https://playwright.dev/docs/test-webserver)
- [Parameterization](https://playwright.dev/docs/test-parameterize)
- [Reporters](https://playwright.dev/docs/test-reporters)

---

## What comes next

Chapter 14 turns configuration into scalable execution: parallel workers, serial constraints, sharding, retries, repeat-each, data ownership, resource capacity, flake classification, and CI orchestration.
