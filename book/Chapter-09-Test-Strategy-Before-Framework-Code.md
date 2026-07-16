# Chapter 9 — Test Strategy Before Framework Code

Many automation initiatives begin with the wrong first meeting.

The team debates page-object folders, base classes, reporting libraries, and whether utilities should live under `core/` or `helpers/`. Nobody has yet agreed which product failures matter most, what confidence the pipeline must provide, or why a browser is needed for each scenario.

Six months later, the repository contains 900 tests. Checkout still breaks in production because most of those tests protect catalog filters, cosmetic messages, and duplicated happy paths.

A framework organizes execution. A strategy allocates confidence.

> Decide what must be learned, which risks deserve protection, and where each behavior can be tested most effectively. Only then design the code that supports it.

This chapter does not argue for fewer tests or more tests. It teaches you to build the right portfolio.

## What you will learn

By the end of this chapter, you will be able to:

- translate product risk into explicit confidence goals;
- identify critical journeys and the failures that threaten them;
- use pyramid, trophy, and portfolio models without treating any shape as law;
- choose among unit, component, API, contract, integration, and UI coverage;
- decide what does not belong in an end-to-end suite;
- define smoke, regression, scheduled, and change-based selections;
- turn acceptance criteria into executable scenarios and boundaries;
- measure coverage across journeys, risks, browsers, roles, states, and integrations;
- negotiate testability contracts with developers; and
- answer “How would you design an automation strategy?” in a five-minute interview response.

The examples use QualityMart, but the reasoning works for banking, healthcare, SaaS, logistics, and internal platforms.

---

## 9.1 Start with a confidence question

“We need to automate checkout” is not yet a strategy statement.

Ask what decision the automation must support:

- Can a pull request merge safely?
- Can this build deploy to staging?
- Can the release serve paying customers?
- Does the new pricing rule preserve existing customer contracts?
- Does the product work for the browsers, roles, regions, and accessibility needs we support?
- Can the team detect a production regression before customers report it?

Each question implies a different scope and feedback budget.

| Decision | Needed feedback | Typical budget | Candidate evidence |
|---|---|---:|---|
| Merge a small code change | Fast, focused, deterministic | Minutes | Unit, component, contract, affected API, critical smoke |
| Deploy a build | Broad integration confidence | Tens of minutes | Service integration, critical UI journeys, migration checks |
| Release a major feature | Risk-focused and environment-aware | Hours if justified | Full portfolio, cross-browser, roles, recovery, non-functional checks |
| Monitor production health | Continuous and non-destructive | Seconds to minutes | Synthetic journeys, telemetry, alerts, contract probes |

A test is valuable when its result changes a decision. A two-hour suite that everybody ignores is not providing two hours of confidence.

### Write confidence goals in outcome language

Weak:

> Automate 80% of regression cases in Playwright.

Stronger:

> On every pull request, detect regressions in sign-in, catalog availability, price calculation, and guest checkout within ten minutes. Before release, cover supported payment outcomes, roles, and browser engines, with trace evidence for failures.

The stronger goal names risk, scope, speed, and evidence. It can guide test selection and architecture.

> **Interview answer: Where do you start an automation strategy?**
>
> “I start with the release decisions and product risks, not the framework. I identify critical journeys, failure impact, change frequency, supported users and environments, and the feedback time the team needs. Then I place each check at the cheapest reliable layer and keep only a small number of end-to-end tests for cross-system confidence.”

---

## 9.2 Build a risk inventory before a test inventory

Risk-based testing asks two practical questions:

1. How likely is this behavior to fail?
2. What happens if it does?

Teams may also consider detectability, recoverability, exposure, regulatory impact, or change frequency. A numerical score can make discussion concrete, but the conversation matters more than mathematical precision.

### A QualityMart risk workshop

| Product risk | Likelihood | Impact | Existing detection | Automation response |
|---|---|---|---|---|
| Customer charged but order not created | Medium | Critical | Poor | API idempotency, integration, and one UI journey |
| Incorrect discount at boundary values | High | High | Medium | Dense unit/API boundary coverage |
| Search ranking slightly changes | High | Low | Good analytics | Contract checks plus a small UI sample |
| Admin refunds wrong customer order | Low | Critical | Audit after damage | Role, authorization, API, and UI confirmation tests |
| Third-party recommendations unavailable | Medium | Low | Monitoring | Mocked fallback test; no live dependency in PR suite |
| Safari checkout control is unusable | Medium | High | Customer report | Targeted WebKit critical journey |

The response is not “one UI test per row.” High discount risk produces many cheap boundary tests and perhaps one UI wiring check. A refund authorization risk needs role and service coverage because UI hiding alone is not security.

### A lightweight risk score

One team might use:

```text
risk priority = likelihood × impact × exposure
```

with each factor scored from one to five. Another may add detectability:

```text
risk priority = likelihood × impact × low-detectability factor
```

Do not let a score of `72` pretend to be scientifically more accurate than `68`. Use bands such as critical, high, medium, and low, then record the reasoning.

### Risk changes over time

Revisit priority when:

- code changes frequently;
- an incident reveals a blind spot;
- traffic or revenue shifts;
- a new browser, region, or role is supported;
- architecture moves a boundary; or

- a formerly unreliable dependency becomes stable.

An automation strategy is a maintained product model, not a launch document.

---

## 9.3 Critical journeys are business flows, not long test cases

A critical journey is a sequence whose failure materially harms a user or the organization.

For QualityMart:

1. Customer finds an available product.
2. Customer sees the correct price and delivery promise.
3. Customer adds the product to the cart.
4. Customer completes payment.
5. QualityMart creates exactly one order.
6. Customer can retrieve confirmation and status.

This journey is a map of risk. It does not require one enormous browser test that checks every field and variation.

### Decompose the journey into contracts

| Journey boundary | Risk | Best dense coverage | End-to-end evidence |
|---|---|---|---|
| Search query → results | wrong filters or unavailable items | API/component | one representative search |
| Product → cart | wrong SKU, quantity, or price | component/API | add one item through UI |
| Cart → quote | tax, discount, shipping boundaries | unit/API | verify reviewed total |
| Payment → order | duplicate charge or missing order | service integration | one successful and one decisive failure path |
| Order → confirmation | wrong ID or status | API/contract | correct confirmation visible |

Dense coverage means many values, states, and combinations. Put it where execution is cheap and diagnosis is narrow. End-to-end coverage proves that selected contracts connect.

### A journey map should include failure and recovery

Happy paths are important but insufficient. Ask:

- What if payment is declined?
- What if inventory changes after the cart is created?
- What if the create-order request is retried?
- Can the customer safely refresh confirmation?
- Can support find the order using the displayed identifier?

Not every answer becomes a UI test. Every critical answer should have an owner and a layer.

---

## 9.4 Pyramid, trophy, and portfolio are thinking tools

The test pyramid encourages many fast, narrow tests and fewer expensive end-to-end tests. The testing trophy emphasizes integration confidence. Other teams use honeycombs, diamonds, or entirely different shapes.

Do not interview the diagram. Interview the product architecture.

### What the models agree on

Most useful models encourage:

- fast feedback close to the defect;
- fewer tests at slow or fragile boundaries;
- meaningful integration coverage;
- limited duplication; and

- deliberate end-to-end confidence.

### Why one shape cannot fit every system

A calculation library may need thousands of unit properties and a few API checks. A thin UI over many independently deployed services may need substantial contract and integration coverage. A canvas-based design tool may require more browser-level interaction than a CRUD admin page.

The portfolio model asks four questions for every risk:

1. Which layer finds the defect most cheaply?
2. Which boundary must be integrated to create confidence?
3. Which user-visible evidence still needs a browser?
4. How much duplication is justified by impact?

### Duplication can be intentional

“Do not duplicate tests” is too absolute.

QualityMart may verify the total calculation in:

- hundreds of unit boundary cases;
- API tests for serialization, currency, and authorization; and
- one critical browser checkout using a representative total.

The arithmetic is duplicated only superficially. Each layer protects a different failure mode.

Duplication becomes waste when identical inputs and assertions cross the same effective boundary without adding new evidence.

> **Interview answer: Do you follow the test pyramid?**
>
> “I use it as a cost heuristic, not a quota. I want dense coverage at fast, narrow layers, meaningful integration and contract checks, and a small set of critical end-to-end journeys. The actual shape follows architecture and risk. I justify duplication only when another layer protects a different failure mode.”

---

## 9.5 Choose the layer by the defect you want to locate

| Layer | Strong for | Weak for | Typical speed |
|---|---|---|---:|
| Unit/domain | calculations, validation, state transitions | wiring, browser behavior | milliseconds |
| Component | rendered states and interaction in isolation | deployed integration | milliseconds to seconds |
| API/service | business rules, authorization, data boundaries | actual UI wiring and accessibility | seconds |
| Contract | provider/consumer compatibility | full business workflow | milliseconds to seconds |
| Integration | real collaboration between selected systems | complete user experience | seconds to minutes |
| UI end-to-end | critical user journey and browser integration | dense combinations and narrow diagnosis | seconds to minutes |

Playwright can execute browser and direct API tests in the same runner. That convenience should not erase the layer distinction.

### Unit or domain tests

Use for pure rules:

```ts
expect(calculateDiscount({ quantity: 10, tier: 'gold' })).toBe(20);
```

Boundary partitions, property-based cases, and error conditions belong here when the rule can be called without infrastructure.

### Component tests

A component test can render a cart summary with controlled properties and verify states without deploying the whole application. This is valuable for variants such as empty, loading, error, discount, and long translated text.

Playwright's own component testing remains marked experimental at the current baseline. Teams can also use established framework-specific component tools. The strategy decision is about the boundary; the tool choice follows maturity and stack.

### API tests

Playwright's `APIRequestContext` can test services directly, prepare state before a UI scenario, or verify server-side postconditions afterward.

```ts
const response = await request.post('/api/quotes', {
  data: { sku: 'KEY-001', quantity: 10, customerTier: 'gold' }
});

await expect(response).toBeOK();
expect(await response.json()).toMatchObject({
  discountPercent: 20,
  currency: 'USD'
});
```

API tests are usually the right place for combinations of roles, payloads, boundaries, status codes, and invalid data.

### Contract tests

Contracts protect compatibility between consumers and providers: required fields, types, semantics, versions, and tolerated evolution.

A schema check is not a complete business test. It answers whether the parties can communicate as agreed.

### UI end-to-end tests

Use the browser when confidence depends on browser behavior or connected user experience:

- routing and rendering;
- user interaction and accessibility;
- authentication handoff;
- client-side state and network wiring;
- critical cross-service journeys; and

- browser-engine differences.

The browser is not a badge of realism. A test that drives the UI while mocking every meaningful boundary may be a valuable component-like UI test, but it should not be called production end-to-end coverage.

---

## 9.6 What not to automate in the end-to-end suite

### Every data combination

Ten discount tiers × twenty quantities × six regions × four roles × three browsers yields 14,400 executions before payment states are added. Put combinatorial rules at unit or API level. Select representative integration cases.

### Third-party behavior you do not control

Do not make every pull request depend on a live maps, payment, email, analytics, or social provider. Verify your adapter, payload, fallback, and controlled sandbox contract. Reserve a small scheduled probe for the real integration if the risk justifies it.

### Pure presentation permutations

Component and visual tests can cover long names, translations, responsive widths, empty states, and theme variants more cheaply than complete deployed journeys.

### Internal implementation details

Private functions, framework state, generated classes, database tables, and internal request counts belong only where they are explicit contracts.

### Scenarios with no stable oracle

If nobody can define what correct means, automation will encode accidental behavior. Clarify the requirement or build observability first.

### One-time or rapidly changing experiments

Exploratory testing may be more valuable for an experiment that will disappear next week. Automate when the expected learning and reuse exceed creation and maintenance cost.

### Destructive production workflows

Do not casually run account deletion, real payments, bulk email, or irreversible administration as production synthetics. Use safe test tenants, reversible operations, provider sandboxes, and explicit controls.

### CAPTCHA and anti-automation challenges

Do not teach the suite to defeat security controls. Use a documented test bypass in owned environments and separately verify that production controls are enabled.

---

## 9.7 Turn acceptance criteria into executable scenarios

Suppose the story says:

> Gold customers receive a 20% discount when ordering ten or more eligible items. The discount cannot combine with a promo code.

Do not translate the sentence into one browser test. Extract decisions and partitions.

### Identify rules and boundaries

| Dimension | Partitions or boundaries |
|---|---|
| Tier | gold, non-gold, unknown |
| Quantity | 0 invalid, 1, 9, 10, 11, maximum, over maximum |
| Eligibility | all eligible, mixed, none |
| Promo code | absent, valid, invalid, expired |
| Combination | tier only, promo only, both attempted |
| Currency/region | supported combinations and rounding boundaries |

Most of this belongs in domain and API tests.

### Write the decisive examples

```text
Given a gold customer with ten eligible items
When a quote is calculated without a promo code
Then the quote contains a 20% gold discount
```

```text
Given a gold customer with ten eligible items
When a valid promo code is applied
Then the configured precedence rule selects exactly one discount
And the quote explains which discount was used
```

The second scenario exposes an ambiguity: which discount wins? Automation should not guess.

### Map scenarios to layers

| Scenario | Layer | Reason |
|---|---|---|
| quantities 9, 10, and 11 | unit | boundary of pure rule |
| unauthorized tier in request | API | service authorization/input contract |
| quote response shape | contract | consumer/provider compatibility |
| gold badge and discounted total render | component | view states |
| one gold checkout shows reviewed total | UI | rule is wired into critical journey |

### Preserve requirement identity without binding to a tool

```ts
test('gold customer sees the reviewed checkout total', {
  tag: ['@checkout', '@critical'],
  annotation: {
    type: 'requirement',
    description: 'QM-PRICE-014'
  }
}, async ({ page }) => {
  // representative end-to-end evidence
});
```

Tags support execution selection. Annotations preserve context in reports. Neither replaces a maintained risk and requirement map.

---

## 9.8 Smoke and regression are promises, not folder names

A smoke suite answers whether the build is worth deeper testing or deployment. It should be:

- small enough to run on every required gate;
- broad enough to detect catastrophic failure;
- deterministic enough that failure stops the decision;
- representative of critical business journeys; and

- owned tightly enough that quarantine is exceptional.

For QualityMart, smoke might cover:

1. application health and sign-in;
2. catalog availability;
3. one representative cart and checkout path;
4. order retrieval; and

5. one role-protected administrative action.

“All happy paths” is not a smoke definition. Some happy paths are low impact; one critical failure path may deserve smoke coverage.

### Regression is risk coverage at a broader cadence

Regression may add:

- supported roles and important authorization failures;
- payment and inventory outcomes;
- browser-engine coverage;
- localization and responsive projects;
- recovery, retry, and idempotency scenarios; and

- lower-priority product areas.

### Use tags as one selection dimension

```ts
test.describe('Guest checkout', {
  tag: ['@smoke', '@checkout', '@critical']
}, () => {
  // tests
});
```

```bash
npx playwright test --grep @smoke
npx playwright test --grep "@checkout|@orders"
npx playwright test --grep-invert @quarantined
```

Playwright tags must start with `@` to appear as tags. `--grep` matches the fully qualified test identity, including tags.

Avoid a tag vocabulary with dozens of synonyms such as `@p0`, `@priority0`, `@critical`, and `@blocker`. Define ownership and selection meaning.

### A useful cadence model

| Trigger | Selection | Purpose |
|---|---|---|
| Local change | focused file, UI Mode, affected tests | fast developer feedback |
| Pull request | static checks, affected portfolio, critical smoke | safe merge decision |
| Main branch | broader integration and browser coverage | detect merge interaction |
| Nightly | full regression, slower environments | broad drift detection |
| Release | explicit release-risk selection | deployment decision |
| Production schedule | safe synthetic subset | operational detection |

Do not move unreliable tests to nightly and call the problem solved. Cadence is based on feedback need and cost, not failure embarrassment.

---

## 9.9 Change-based selection needs a safety net

Running everything on every edit can become slow. Running only tests in the changed folder can miss indirect impact.

A change in pricing may affect:

- product cards;
- cart totals;
- checkout;
- invoice generation;
- refund amounts;
- tax reporting; and

- partner APIs.

File proximity is not product dependency.

### Build an impact map

Map tests to stable dimensions:

- service or component ownership;
- requirement and risk ID;
- business capability;
- consumed API or event;
- database migration or schema; and

- critical journey.

Selection can then combine source dependency analysis with metadata.

### Use layered safety

A defensible pull-request selection might run:

1. tests directly affected by code dependencies;
2. tests tagged for impacted capabilities;
3. an always-run critical smoke set; and

4. the complete portfolio later on main or nightly.

Change-based selection is an optimization, not evidence that unselected behavior cannot break. Measure misses and update the map after incidents.

---

## 9.10 Coverage is multidimensional

“We have 85% automation coverage” is incomplete. Coverage of what?

Line coverage can reveal unexecuted code, but it does not prove that important journeys, roles, states, integrations, or browser behaviors are protected.

### Coverage models that matter

| Dimension | QualityMart examples | Blind spot if omitted |
|---|---|---|
| Journey | browse, quote, checkout, refund | connected customer failure |
| Risk | wrong price, duplicate charge, data exposure | low-value tests dominate |
| Role | guest, customer, support, admin | authorization defect |
| State | empty, active, declined, cancelled, refunded | happy-path bias |
| Integration | payment, tax, inventory, email | boundary failure |
| Browser/device | Chromium, Firefox, WebKit, mobile | engine-specific defect |
| Region/locale | currency, tax, language, timezone | market-specific defect |
| Accessibility | keyboard, name/role, focus, contrast | excluded user journey |

Do not multiply every dimension into every UI test. Use pairwise or risk-driven representatives where combinations are expensive, and put dense combinations at cheaper layers.

### Create a coverage matrix that reveals gaps

| Capability | Critical risk | Unit | API/contract | UI | Browser scope | Owner |
|---|---|:---:|:---:|:---:|---|---|
| Pricing | wrong total | Dense | Dense | 1 critical path | Chromium + targeted WebKit | Pricing |
| Checkout | duplicate order | Some | Integration | success + decisive failure | All engines for smoke | Commerce |
| Refund | wrong authorization | Rule | Role matrix | admin representative | Chromium | Operations |
| Search | unavailable results | Ranking unit | Contract | representative query | Chromium | Discovery |

The matrix is a conversation tool. Empty cells may be deliberate. Record why.

### Browser coverage should follow exposure and risk

Playwright projects make multi-browser execution easy, but “easy” does not mean every scenario needs every browser on every pull request.

One policy might run:

- critical smoke on Chromium, Firefox, and WebKit;
- broader regression on Chromium;
- browser-sensitive components on the affected engine; and

- mobile projects for supported high-traffic journeys.

Another product with strict contractual support may run the full suite on all engines. Use user analytics, support commitments, architecture, and defect history.

---

## 9.11 Testability is a product contract

Automation quality is not owned by QA alone. A system designed for observation and control is cheaper to verify and easier to operate.

### Observable outcomes

Ask developers to expose stable user and system evidence:

- meaningful status and error states;
- correlation and order identifiers;
- accessible roles and names;
- structured logs and events;
- health and readiness endpoints; and

- query APIs for asynchronous state.

### Controllable inputs

Tests need safe ways to establish state:

- API or builder-based data creation;
- provider sandboxes and deterministic stubs;
- a controllable clock where time is business input;
- feature-flag control;
- per-test accounts or namespaces; and

- idempotent cleanup or retention policies.

### Stable contracts

Agree on:

- semantic locators or deliberate test IDs where user semantics are insufficient;
- API and event schemas;
- error codes and retry behavior;
- authentication test paths that do not weaken production; and

- ownership of breaking changes.

### Failure injection

A resilient product must be testable under failure. Provide controlled ways to simulate:

- decline and timeout;
- partial dependency outage;
- duplicate delivery;
- stale or malformed data;
- authorization failure; and

- eventual-consistency delay.

Do not depend on random environment failure to test recovery.

> **Interview answer: How do you improve testability?**
>
> “I treat it as a cross-team product requirement. We agree on observable states and identifiers, semantic UI contracts, APIs for safe setup and cleanup, controllable external dependencies and clocks, schemas, and deterministic failure injection. These same capabilities improve support and production diagnosis.”

---

## 9.12 Measure confidence and suite health—not test count

Useful strategy metrics include:

- critical risks with automated evidence;
- time to trustworthy feedback;
- failure detection before release;
- escaped defects by missing layer or scenario;
- flaky rate and retry-only pass rate;
- median and tail duration;
- diagnosis time;
- quarantine age; and

- maintenance cost by capability.

### Pass rate can mislead

A 99.9% pass rate may mean stable software. It may also mean weak assertions, excessive mocking, skipped tests, or a suite that never exercises critical failures.

### Test count can reward duplication

Adding 100 parameterized browser cases can increase count while decreasing feedback quality. Track protected risks and decisions instead.

### Coverage percentage needs a denominator

Good:

> 12 of 14 release-critical risks have automated pre-release evidence; the two gaps are manual recovery drills with owners and dates.

Weak:

> Regression is 86% automated.

### Quarantine is debt with a clock

If a test cannot gate decisions, label the reason, owner, date, and replacement evidence. A permanent ignored suite is undocumented risk acceptance.

---

## 9.13 Selenium-to-Playwright strategy traps

### Trap 1: Migrating every Selenium test one-to-one

Migration is a portfolio review, not a syntax project. Classify each legacy test:

- retain as critical UI coverage;
- move dense cases to API/component/unit;
- combine duplicated journeys;
- rewrite around user-visible behavior; or

- delete because the risk no longer exists.

### Trap 2: Calling speed a strategy

Playwright may run browser tests faster and more reliably, but a faster low-value suite is still low value.

### Trap 3: Rebuilding the old framework before the first test

Base pages, driver factories, waits, listeners, and utility wrappers may encode Selenium constraints that Playwright does not have. Start with representative tests and extract only repeated, stable needs.

### Trap 4: Running every test on every browser

Cross-browser support is a product decision. Use projects to express the browser matrix, then allocate breadth according to exposure and risk rather than multiplying cost automatically.

### Trap 5: Equating manual cases with automation candidates

Manual cases may include exploration, visual judgment, one-time validation, and procedural checks. Reframe them as risks and evidence before automating.

### Trap 6: Treating flaky tests as unavoidable UI tax

Flakiness is a signal about race conditions, data ownership, environment control, or weak observability. It reduces the suite's ability to gate decisions and therefore changes the strategy.

---

## 9.14 The strategy document before the repository structure

Before choosing folders, write a short strategy that answers:

1. **Product and users:** What capabilities, roles, regions, and platforms matter?
2. **Decisions:** Which gates need which confidence and by when?
3. **Risks:** What failures have the greatest likelihood and impact?
4. **Portfolio:** Which layers protect each risk, and why?
5. **Critical journeys:** Which connected flows must work?
6. **Selections:** What runs locally, on pull requests, main, nightly, release, and production?
7. **Environments and data:** Who owns setup, isolation, dependencies, and cleanup?
8. **Testability:** Which product contracts are required?
9. **Evidence:** What reports, traces, logs, and identifiers support diagnosis?
10. **Health:** Which metrics trigger investment or redesign?

Then build the smallest framework capable of executing the first portfolio slice.

### A sensible first slice

For QualityMart:

- one critical guest checkout UI journey;
- pricing boundary tests at domain/API level;
- a payment-to-order idempotency integration test;
- a contract check for order creation;
- deterministic setup and cleanup; and

- CI selection and trace-on-first-retry.

This slice tests the strategy and the technical foundation. Page objects, fixtures, and utilities emerge from observed repetition rather than prediction.

---

## 9.15 The five-minute interview answer

When asked, “How would you design an automation strategy for our product?” use a clear sequence.

### Minute 1: Understand product and decisions

“I would first understand the users, critical capabilities, architecture, release process, supported browsers and regions, incident history, and the feedback time required at pull request and release gates.”

### Minute 2: Prioritize risks and journeys

“I would workshop likelihood and impact with product, engineering, QA, security, and operations. I would map critical journeys and failure/recovery paths, then record which risks need pre-merge, pre-release, or production evidence.”

### Minute 3: Allocate layers

“I would put calculations and boundaries in unit tests, service rules and role matrices in API tests, compatibility at contract boundaries, rendered variants in component tests, and keep a small set of end-to-end tests for critical connected user journeys. Duplication would be intentional only when another layer protects a different failure mode.”

### Minute 4: Design execution and testability

“I would define a deterministic smoke suite, broader regression cadence, change-based selection with an always-run safety net, and a browser matrix based on support and risk. I would negotiate APIs for setup, isolated data, controllable dependencies, observable states, stable locators, and failure injection.”

### Minute 5: Measure and evolve

“I would track risk coverage, feedback time, flaky and retry-only passes, escaped defects, diagnosis time, and quarantine age—not just test count. I would start with one vertical slice, review incidents and change patterns, and evolve the portfolio and framework based on evidence.”

This answer demonstrates business reasoning, technical layering, execution design, collaboration, and continuous improvement. Tailor the examples to the interviewer’s domain.

---

## 9.16 Interview corner

### 1. Smoke versus regression?

“Smoke is a small, deterministic gate that proves the build is viable for the next decision, focusing on catastrophic and critical journey failures. Regression is broader risk coverage run at a cadence its cost supports. The boundary is an explicit promise, not merely a folder or priority label.”

### 2. What should not be in a UI suite?

“Dense data combinations, pure calculations, provider behavior we do not control, most schema permutations, and internal implementation details. I move those to unit, API, contract, component, or controlled integration tests and keep representative UI evidence for connected user behavior.”

### 3. How do you decide what to automate?

“I compare risk reduction and repeat value with implementation and maintenance cost. High-impact, repeatable, deterministic behavior with a clear oracle is a strong candidate. Rapid experiments, ambiguous requirements, and one-time subjective checks may be better explored manually until the contract stabilizes.”

### 4. How do you handle cross-browser scope?

“I use support commitments, traffic, engine-sensitive architecture, and defect history. Critical smoke often runs across all supported engines; broader cases may run on a primary engine with targeted cross-browser coverage. Playwright projects express the policy but do not decide it.”

### 5. What is change-based testing?

“It selects tests using code dependencies and product metadata such as capability, contract, risk, and journey. Because impact maps can be incomplete, I combine affected tests with an always-run critical set and run the complete portfolio later. I measure escaped impacts and refine the map.”

### 6. How do you measure automation success?

“By decisions improved and risks detected: critical-risk coverage, trustworthy feedback time, pre-release detection, escaped defects, flakiness, diagnosis time, and maintenance cost. Test count and raw pass rate are supporting metrics, not the goal.”

### 7. What would you automate first in a new project?

“One high-value vertical slice: the most critical user journey, dense rule coverage at cheaper layers, one important integration or contract, deterministic data, and CI evidence. That validates both product assumptions and the minimum framework before broad expansion.”

---

## 9.17 Exercises

1. Create a risk inventory for QualityMart with likelihood, impact, detectability, owner, and proposed evidence.
2. Map guest checkout into contracts. Choose which cases belong at unit, API, contract, component, integration, and UI layers.
3. Take twenty Selenium tests and classify them as retain, move down, combine, rewrite, or delete.
4. Define a smoke suite that must finish in ten minutes. Explain every included and excluded scenario.
5. Build a coverage matrix across journeys, roles, states, integrations, and browsers. Find three gaps hidden by test count.
6. Convert the gold-discount acceptance criterion into partitions and boundary cases, then allocate them to layers.
7. Design change-based selection for a pricing-service change. Add an always-run safety net.
8. Write a testability contract for payment decline, timeout, duplicate callback, and order-status observation.
9. Review a flaky test and describe how its unreliability changes release confidence, not only code quality.
10. Deliver the five-minute interview answer for a banking transfer, healthcare appointment, or SaaS role-management product.

---

## 9.18 Review checklist

Before approving an automation strategy, ask:

- Are release and merge confidence goals explicit?
- Are critical product risks prioritized with business and engineering input?
- Are critical journeys mapped across failure and recovery paths?
- Does each risk have evidence at the cheapest reliable layer?
- Is end-to-end coverage limited to behavior that needs connected browser evidence?
- Are dense combinations tested below the UI?
- Are third-party dependencies controlled in gating suites?
- Are smoke and regression selections defined by purpose, budget, and ownership?
- Does change-based selection include an always-run safety net?
- Does coverage include journeys, roles, states, integrations, and browser exposure?
- Are browser projects based on product support and risk?
- Are acceptance-criterion ambiguities resolved before automation encodes them?
- Does the product provide deterministic setup, observation, cleanup, and failure injection?
- Are flaky and quarantined tests treated as lost evidence with owners?
- Do metrics measure confidence and feedback rather than reward test count?
- Is the first implementation a small vertical slice rather than a speculative framework?

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Strategy principles are tool-independent; version-sensitive execution mechanisms were checked against current official documentation:

- [Playwright best practices and testing philosophy](https://playwright.dev/docs/best-practices)
- [API testing and hybrid UI/API workflows](https://playwright.dev/docs/api-testing)
- [Tags and annotations](https://playwright.dev/docs/test-annotations)
- [Projects for browsers, devices, and environments](https://playwright.dev/docs/test-projects)
- [Command-line selection with `--grep` and projects](https://playwright.dev/docs/test-cli)
- [Playwright component testing status](https://playwright.dev/docs/test-components)

---

## What comes next

A strategy identifies the dependencies each test needs: authenticated users, seeded orders, API clients, page models, configuration, logging, and cleanup.

Chapter 10 turns those dependencies into explicit Playwright fixtures. You will learn setup/use/teardown, test and worker scope, dependency ordering, option and automatic fixtures, fixture-versus-hook decisions, and how to avoid state leakage while keeping suites fast.
