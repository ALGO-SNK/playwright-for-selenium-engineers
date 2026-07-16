# Chapter 1 — Why Playwright, and When Not to Choose It

## What you will learn

By the end of this chapter, you will be able to:

- explain why a page that looks ready to a human may still be unsafe for automation;
- compare Playwright, Selenium, and Cypress without relying on outdated slogans;
- connect Playwright’s locators, actionability checks, contexts, and tooling to specific testing problems;
- name the cases where Playwright is the wrong choice;
- give a strong interview answer to “Why did your team choose Playwright?”

There is almost no Playwright code in this chapter. That is deliberate.

If you learn the commands before you understand the problems they solve, you will write Selenium-shaped tests with Playwright syntax. They may run. They will not earn the reliability you changed tools to get.

---

## 1.1 The page is ready — except it is not

Imagine a checkout page.

You choose a delivery address. The page recalculates shipping. A spinner appears for half a second. The total changes. A promotion banner slides down and moves the **Pay now** button. The button looks enabled, but an invisible transition layer still covers it for two animation frames. Meanwhile, a fraud-check request is running in the background.

You wait without thinking. Your eyes notice the movement. Your hand pauses. When the page settles, you click.

Automation does not have your judgment. It has instructions.

```text
1. Select the address.
2. Click Pay now.
3. Expect an order number.
```

Those instructions omit the difficult part: *when is step 2 safe?*

The HTML may contain the button before the button is visible. It may be visible before it stops moving. It may stop moving while another element still intercepts the click. It may accept the click while the application is still using an earlier shipping total.

The gap between “present in the page” and “ready for the intended action” is where a large share of UI-test flakiness begins.

### The modern page has several clocks

A server-rendered page once had a relatively simple rhythm: request a document, receive it, render it, interact with it.

A modern application may have all of these clocks running independently:

- the document load;
- JavaScript hydration;
- API requests;
- state-store updates;
- component re-renders;
- animations and layout shifts;
- WebSocket or server-sent events;
- service-worker responses;
- third-party scripts;
- a backend process that becomes consistent later.

There is no single “the page is ready” moment that covers every test.

This is not a Playwright problem or a Selenium problem. It is the environment every browser automation tool must control.

The tools differ in where they place that control.

---

## 1.2 Selenium: the foundation, not the villain

Selenium made browser automation portable and mainstream. It supports many languages, integrates with mature test ecosystems, works with remote browser infrastructure, and drives browsers through the WebDriver standard.

If your organization has a stable Selenium platform, strong Java expertise, broad browser requirements, and working Grid infrastructure, “replace it because Playwright is newer” is not an engineering argument.

The honest question is narrower:

> Where does a Selenium team repeatedly pay for synchronization, element lifecycle, infrastructure, and missing integration?

### Classic WebDriver and synchronization

In classic WebDriver, your test issues commands to a browser session. The browser and driver do not infer your full business intention. Selenium provides waiting mechanisms, including implicit and explicit waits, but your framework and test code decide which condition matters and where to apply it.

A typical Java test might include:

```java
WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

WebElement payNow = wait.until(
    ExpectedConditions.elementToBeClickable(By.id("pay-now"))
);

payNow.click();
```

This is not bad code. It is explicit code. The engineer owns the synchronization policy.

At small scale that ownership is manageable. At large scale it often spreads into:

- a base class that creates waits;
- helper methods with inconsistent timeouts;
- page objects that hide sleeps;
- retry wrappers around actions;
- different definitions of “clickable” across teams;
- global timeout increases that make failures slower without making them clearer.

Selenium’s documentation itself treats poor synchronization as a common source of WebDriver problems. The tool provides the mechanisms; your team must apply them consistently.

### Element references can become stale

Selenium can return a reference to an element that exists now. If the application replaces that node during a re-render, the reference no longer identifies an element in the current DOM. A later action can fail with `StaleElementReferenceException`.

That exception is accurate. The page changed after the element was located.

But it gives the test author another lifecycle problem to solve: relocate the element, retry the operation safely, or redesign the page-object method so it does not hold the reference.

Playwright’s locator model attacks this problem differently. A locator is a query plan, not a stored DOM element. It is resolved when an action or assertion needs it and resolved again when reused. Chapter 5 turns that sentence into working practice.

### Classic WebDriver is no longer the whole Selenium story

An interview answer that says “Selenium is only HTTP request and response, so it can never receive browser events” is now outdated.

WebDriver BiDi adds standardized bidirectional communication. Selenium is progressively exposing BiDi capabilities while maintaining compatibility with classic WebDriver. Network events, log events, browsing-context events, and other capabilities are moving through that standard.

This matters for two reasons.

First, Selenium is evolving. A fair comparison must include the Selenium engineers can use now, not the Selenium someone used in 2018.

Second, Playwright’s advantage is not one transport choice. Its advantage is the combination of its protocol implementation, locator and actionability model, cheap browser contexts, integrated test runner in Node, tracing, network control, API client, assertions, and developer tooling.

Remove the slogan and the case becomes stronger.

### Where Selenium remains the better fit

Selenium deserves serious consideration when:

- the organization must stay in a Java-first testing ecosystem;
- existing Grid or cloud infrastructure already meets the need;
- the browser/OS matrix depends on capabilities a provider exposes through WebDriver;
- teams need direct alignment with the W3C WebDriver standard;
- the cost and risk of migration exceed the measured maintenance savings;
- the suite is stable and the business problem is elsewhere.

Migration is not free. A fashionable rewrite can destroy years of working domain knowledge.

> **Coming from Selenium**  
> Your Selenium experience is an advantage if you bring the testing judgment and leave behind only the accidental framework machinery. Test design, risk analysis, debugging discipline, API knowledge, and domain understanding transfer. Driver managers, cached element references, global waits, and singleton drivers usually do not.

---

## 1.3 Cypress: a different optimization

Cypress changed what browser-test development felt like. Its interactive runner, automatic command retry, snapshots, and time-travel-style debugging made fast feedback central to the product.

Its architecture deliberately runs Cypress command logic in the browser environment. That creates powerful visibility into the application and a cohesive authoring experience.

It also creates permanent trade-offs, which Cypress documents openly.

For example, Cypress does not natively control two open browsers at once. Cross-origin workflows use explicit mechanisms such as `cy.origin`. Iframe support has limits. Tasks outside the browser often require a Node-side bridge. Those constraints are not accidental missing features; they follow from the execution model.

Cypress can be an excellent choice when:

- the application and test team are JavaScript/TypeScript-first;
- component testing is a major part of the strategy;
- the interactive development experience is the dominant requirement;
- tests generally stay within one application and one browser at a time;
- the team values Cypress Cloud’s workflow and accepts the platform choice.

Playwright is usually more natural when:

- one scenario controls multiple tabs, contexts, users, or browser sessions;
- the suite needs deep cross-browser behavior across Chromium, Firefox, and WebKit;
- network routing, downloads, popups, and browser events are frequent;
- the team wants the Node test runner and automation library in one package;
- Selenium engineers are replacing a broad end-to-end framework rather than adding component tests.

Do not turn this into a brand contest. Choose the constraints you want.

---

## 1.4 Playwright’s bet

Playwright makes a set of connected design choices.

### Choice 1: keep test code outside the page

Your test runs separately from the application. The page does not own the test’s event loop. That makes multiple pages, multiple contexts, browser events, downloads, popups, and cross-origin journeys natural parts of the model.

### Choice 2: use a client/server protocol internally

The public objects you call—`Browser`, `BrowserContext`, `Page`, and `Locator`—are client-side objects connected to Playwright’s server-side automation implementation through its protocol.

Do not translate that sentence into “there is always a WebSocket to a local driver.” The transport and process arrangement differ:

- Node/TypeScript can run client and server-side pieces locally within the Playwright package’s execution model;
- Java, Python, and .NET bindings launch and communicate with the Playwright driver implementation out of process;
- remote connections can use a WebSocket endpoint created by Playwright’s server APIs;
- Chromium attachment through `connectOverCDP` is a different connection with different capability trade-offs.

Chapter 3 draws each case separately. For now, keep the useful idea: your high-level call is translated through Playwright’s automation layer before the browser performs the low-level work.

### Choice 3: make action readiness part of the action

Before a locator click, Playwright checks the conditions relevant to that action. For `locator.click()`, the current documented checks include:

- the locator resolves to exactly one element;
- the element is visible;
- the element is stable;
- the element receives pointer events at the action point;
- the element is enabled.

If those conditions do not become true within the timeout, the action fails with evidence about what Playwright was waiting for.

This is more than “Playwright waits automatically.”

It is a policy decision: every normal click carries the same baseline readiness contract. The author does not have to remember to attach that contract at every call site.

Different actions require different checks. `fill()` cares about editability. `hover()` does not care whether an element is enabled. Some low-level actions perform no actionability checks. Chapter 7 includes the complete matrix.

### Choice 4: locate by a durable description

A Playwright locator describes how to find an element at the moment of use.

```ts
const payNow = page.getByRole('button', { name: 'Pay now' });

await payNow.click();
await expect(payNow).toBeDisabled();
```

The locator is not a frozen reference to the original node. If the application re-renders the button between those two lines, Playwright resolves the description again.

That removes the common stale-reference workflow. It does not guarantee the locator is good. A vague locator can still match the wrong element or several elements. Strictness makes that ambiguity loud instead of guessing.

### Choice 5: isolate with browser contexts

A browser context is an isolated browser session: cookies, local storage, permissions, and related state are separated from other contexts while browser processes can be reused.

Playwright Test creates a fresh context for each test by default. That makes browser-side isolation cheap enough to be the normal path rather than an expensive special case.

The boundary is important:

```text
Playwright isolates:   cookies, storage, pages, browser session state
Playwright does not:   database rows, user accounts, queues, files, emails,
                       inventory, feature flags, or third-party systems
```

If two tests edit the same order, a fresh browser context will not save them.

### Choice 6: ship a complete Node testing experience

For TypeScript and JavaScript, `@playwright/test` includes more than browser control:

- a test runner;
- fixtures;
- projects;
- parallel workers;
- retries;
- web-first assertions;
- HTML, JUnit, JSON, blob, and other reporting paths;
- traces, screenshots, and video integration;
- UI Mode, Inspector, code generation, and editor support;
- an API-request client;
- sharding and report merging.

This reduces the framework assembly work familiar to Selenium/Java teams.

The language distinction matters. Playwright supports TypeScript/JavaScript, Python, Java, and .NET with shared core browser-automation capabilities, but the testing ecosystems differ. Java uses a runner such as JUnit or TestNG. Python commonly uses the Pytest plugin. .NET integrates with its own test frameworks. The all-in-one Playwright Test experience described in this book is the Node path.

> **In Java**  
> Playwright for Java gives you Playwright’s browser automation API, but it does not turn JUnit or TestNG into Playwright Test. You still make choices about runner configuration, parallel execution, fixtures/extensions, assertions, and reporting. That can be the right choice for a Java organization. It is also why “same browser API” does not mean “same framework experience.”

---

## 1.5 What improves in real test code

Feature lists are forgettable. Consequences are useful.

### Fewer hand-written waits

Normal actions carry actionability checks. Locator assertions retry until their expectation passes or times out.

That removes many waits. It does not remove all synchronization.

You still need explicit signals when the condition is not expressed by the element action or assertion—for example, waiting for a specific response, a background export, an eventually consistent API, or a business event.

The improvement is not “never wait.” It is “wait for meaning, not time.”

### Failures carry more context

Playwright call logs explain what an action attempted and why it waited. Traces can preserve actions, DOM snapshots, network activity, console messages, source locations, and attachments.

A CI failure can become an inspectable artifact rather than a screenshot plus a guess.

That improvement depends on configuration and team behavior. A trace nobody retains or opens provides no value.

### Multi-user flows become ordinary

Two independent contexts can represent a buyer and an admin in one test. Each gets separate storage and pages without requiring two full browser installations or a singleton-driver workaround.

```ts
const buyer = await browser.newContext({ storageState: 'auth/buyer.json' });
const admin = await browser.newContext({ storageState: 'auth/admin.json' });

const buyerPage = await buyer.newPage();
const adminPage = await admin.newPage();
```

This does not mean every collaboration feature belongs in one end-to-end test. It means the browser model no longer makes the scenario awkward before test strategy even begins.

### Cross-browser behavior is one configuration problem

Projects can run the same tests against Chromium, Firefox, and WebKit. Playwright pins compatible browser builds to the package version. Teams can also test supported installed Chrome and Edge channels when branded-browser coverage matters.

WebKit is not Safari. It is Safari’s browser engine in Playwright’s build, without the complete Safari application and operating-system integration. If the requirement says “real Safari on macOS” or “real Mobile Safari on iOS,” use suitable real-device or cloud coverage.

### Network behavior becomes testable

Tests can observe, block, modify, replay, or fulfill network traffic. That makes slow responses, empty states, failures, rate limits, and third-party dependencies reproducible.

Every mock creates a contract your test team now owns. A perfectly stable mock of yesterday’s payload can hide today’s production integration break.

Power and responsibility arrive together.

---

## 1.6 What Playwright does not solve

This is the section to remember in a tooling meeting.

### It is not native mobile automation

Playwright can emulate viewports, touch, user agents, locale, timezone, geolocation, and device characteristics. The page still runs in a desktop browser engine.

It does not automate native Android or iOS application screens. It does not turn desktop WebKit into a physical iPhone.

Use Appium or another native-mobile tool when the product is a native or hybrid mobile application and the requirement includes real device behavior.

### It is not real Safari

WebKit coverage is valuable. It catches engine-level differences. It is not the same as running the Safari application on Apple hardware.

Make the test claim precise:

- “WebKit engine coverage” is honest for local Playwright WebKit.
- “Safari 26 on macOS 15” requires that actual environment.
- “Mobile Safari on iPhone” requires real or virtualized Apple-device infrastructure that provides it.

### It is not a load-testing tool

Playwright can measure a journey and inspect browser-side timing. It can run tests in parallel. Neither makes it a load generator.

Thousands of browsers are an expensive and noisy way to test server capacity. Use tools designed for protocol-level load, then use a small number of browser tests to measure user experience under that load.

### It does not make tests flake-free

Playwright reduces several timing and element-lifecycle problems. It cannot correct:

- shared test data;
- unpredictable third parties;
- a slow or unstable test environment;
- order-dependent tests;
- weak assertions;
- non-deterministic product behavior;
- expired credentials;
- incorrect mocks;
- a test that clicks before the business state is ready even though the button is actionable.

Auto-waiting asks whether an action is mechanically possible. It cannot know whether the business process is semantically ready unless the application exposes a signal your test can observe.

### It does not remove framework design

You still need decisions about:

- what belongs in UI coverage;
- how tests obtain and isolate data;
- where authentication state comes from;
- how environments are configured;
- how failures are classified;
- how reports reach developers;
- how retries and quarantines are governed;
- who owns a broken test.

Playwright removes boilerplate. It does not remove engineering.

### It does not make experimental features stable

Playwright component testing is still labeled experimental in the official documentation. Agent workflows and newer APIs are moving quickly. A production framework should isolate version-bound features and avoid making its core architecture depend on them without an upgrade plan.

---

## 1.7 A decision matrix you can use

No table can choose a tool for you. This one can expose which question you have not answered.

| Requirement | Playwright | Selenium | Cypress |
| --- | --- | --- | --- |
| TypeScript end-to-end runner out of the box | Strong | Assemble separately | Strong |
| Java-first enterprise ecosystem | Possible, different runner experience | Strong | Weak fit |
| Chromium + Firefox + WebKit engine coverage | Strong | Browser/provider dependent | Browser matrix differs; no WebKit path equivalent |
| Standardized WebDriver alignment | No | Strong | No |
| Existing mature Grid investment | Usually requires a different execution model | Strong | Different cloud model |
| Multiple independent users/browsers in one scenario | Natural with contexts/browsers | Possible, heavier setup | Not a native two-browser model |
| Interactive authoring/debugging | Strong | Tooling depends on stack | Strong |
| Network routing and mocking | Strong | Improving through BiDi/vendor capabilities | Strong |
| Real Safari/iOS | External provider required | External provider required | External provider/integration required |
| Native mobile app automation | No | No; Appium is separate | No |
| Component testing | Experimental | Not Selenium’s focus | Strong |
| Large existing Java suite with low flake | Migration must prove value | Strong reason to stay | Usually a rewrite |

### Choose Playwright when

- browser-test reliability and diagnosis are active problems;
- the team can adopt TypeScript or accepts the ecosystem differences of another binding;
- contexts, network control, tracing, and cross-engine coverage match real requirements;
- you can fund migration as a redesign, not a search-and-replace exercise.

### Keep Selenium when

- the existing suite is healthy and meets delivery needs;
- Java, WebDriver standards, Grid, or provider integration are strategic constraints;
- the measured benefit of change is smaller than the migration and retraining cost;
- the real bottleneck is test strategy, environment instability, or ownership—not browser control.

### Choose Cypress when

- its browser-based development workflow and component-testing story fit the product;
- the suite does not require native control of several browsers at once;
- the team accepts its cross-origin and automation-model constraints;
- the surrounding Cypress platform is a positive requirement.

### Use more than one tool when

Different layers have different needs. A company may keep Selenium for a regulated remote-browser matrix, use Playwright for new product journeys, use Cypress for component testing, and use a protocol tool for load.

Tool consolidation has value. Tool purity does not.

---

## 1.8 Failure lab — identify the missing signal

Consider this test:

```ts
test('buyer places an order', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByLabel('Delivery address').selectOption('office');
  await page.getByRole('button', { name: 'Pay now' }).click();
  await expect(page.getByTestId('order-number')).toBeVisible();
});
```

It fails 4 runs out of 100. The button click succeeds. The order number never appears.

Which tool feature should you add?

The wrong first answers are:

- increase the test timeout;
- add `waitForTimeout(2000)`;
- enable retries;
- use `force: true`;
- replace the role locator with XPath.

None of those identifies the race.

Ask for evidence:

1. Did the address update request finish?
2. Did the price recalculate?
3. What payload did the payment request contain?
4. Did the server accept the order?
5. Did the browser log an application error?
6. Was the order created but the notification delayed?

Suppose the trace shows that the button was visible, stable, enabled, and unobscured. Playwright correctly clicked it. The outgoing payment request used the old shipping quote and the server rejected it with `409 Conflict`.

Auto-waiting worked. The application exposed the button too early, or the test failed to wait for the business signal that the quote was refreshed.

A precise repair might wait for the quote response triggered by the address change and assert the new total before paying:

```ts
const quoteUpdated = page.waitForResponse(response =>
  response.url().endsWith('/api/checkout/quote') &&
  response.request().method() === 'POST' &&
  response.ok()
);

await page.getByLabel('Delivery address').selectOption('office');
await quoteUpdated;
await expect(page.getByTestId('order-total')).toHaveText('$42.00');

await page.getByRole('button', { name: 'Pay now' }).click();
await expect(page.getByTestId('order-number')).toBeVisible();
```

An even better product fix may disable **Pay now** until the quote is current. Then the UI communicates readiness to users and the normal actionability check becomes meaningful.

The lesson:

> Playwright can wait for the condition you express. It cannot invent the business condition you forgot to identify.

---

## 1.9 Common mistakes

### Mistake 1: selling “zero flakiness”

**Symptom:** The team enables retries, sees green dashboards, and discovers that many tests pass only on a second attempt.

**Repair:** Promise reduced timing friction and better diagnosis. Measure first-run pass rate and flaky-test rate separately.

### Mistake 2: porting Selenium line by line

**Symptom:** The Playwright project contains `BaseTest`, singleton browser state, explicit wait wrappers, cached handles, and XPath copied from the old suite.

**Repair:** Migrate behavior and domain knowledge. Rewrite synchronization, isolation, locators, fixtures, and reporting around Playwright’s model.

### Mistake 3: choosing TypeScript without funding the learning curve

**Symptom:** Java engineers reproduce class-heavy framework patterns, avoid `async` reasoning, and disable strict TypeScript checks.

**Repair:** Teach the small TypeScript subset the suite needs, pair reviews during the first migration batch, and enforce a simple style.

### Mistake 4: assuming WebKit means Safari certification

**Symptom:** A release is labeled Safari-tested even though it ran only in Playwright WebKit on Linux.

**Repair:** Name the tested engine and environment precisely. Add real Safari/iOS coverage where the risk requires it.

### Mistake 5: using network mocks as the whole regression suite

**Symptom:** UI tests are stable while the real frontend/backend contract breaks in staging.

**Repair:** Use mocks for hard-to-produce states and deterministic focused tests. Preserve contract, integration, and real-backend journeys.

### Mistake 6: blaming the tool before reading the artifact

**Symptom:** A timeout triggers selector edits, sleep additions, and reruns before anyone opens the trace.

**Repair:** Establish a diagnosis order: page state, network, console, locator resolution, actionability, assertion, environment, product.

---

## 1.10 Interview corner

### Q1. Why would you choose Playwright over Selenium?

**30-second answer**

> I choose Playwright when the team benefits from its locator/actionability model, isolated browser contexts, network control, tracing, and integrated TypeScript test runner. Those features reduce framework plumbing and make modern multi-page or multi-user workflows easier to diagnose. I would not claim Selenium cannot do serious automation; I would compare the current suite’s measured pain and migration cost.

**2-minute answer**

Add one example from your work:

> In our Selenium suite, synchronization and CI diagnosis were the main costs. The Playwright pilot replaced repeated explicit-wait patterns with locator actions and web-first assertions, and the trace gave DOM, network, and console evidence for CI failures. Contexts also let us isolate roles cheaply. We kept a small Selenium slice for a browser/provider requirement the Playwright pilot did not cover. The decision was based on maintenance time and coverage, not a claim that one tool is universally better.

**Likely follow-up:** What did migration cost, and what did you deliberately not port?

### Q2. Does Playwright eliminate flaky tests?

**30-second answer**

> No. It removes or reduces common timing and stale-element problems, but it cannot isolate backend data, stabilize third parties, fix product races, or improve a weak assertion. I track first-run pass rate and treat passed-on-retry as flaky, not green.

**Likely follow-up:** Name the categories of flake in your last project.

### Q3. Why does Playwright usually avoid stale element exceptions?

**30-second answer**

> A locator is a reusable description, not a permanently stored element reference. Playwright resolves it when an action or assertion uses it and can resolve it again if the page re-renders. An `ElementHandle` is closer to an eager reference, which is one reason locators are the preferred API.

**Likely follow-up:** Can a locator still be flaky? Yes—if its description is ambiguous, unstable, or points at state that never appears.

### Q4. What is auto-waiting?

**30-second answer**

> Before an action, Playwright waits for the action’s required readiness checks. A click requires one matched element that is visible, stable, enabled, and able to receive the pointer event. Assertion retry is separate: `expect(locator)` repeatedly evaluates the expectation until it passes or times out.

**Likely follow-up:** When do you still use `waitForResponse` or `expect.poll`?

### Q5. How is modern Selenium different from the common comparison?

**30-second answer**

> Classic WebDriver is command/response oriented, but Selenium is adding standardized bidirectional capabilities through WebDriver BiDi. So I do not say Selenium can never receive events or intercept network behavior. I compare current capabilities, ecosystem, isolation, tooling, and migration cost.

**Likely follow-up:** Why might a standards-based protocol matter to an enterprise?

### Q6. Is Playwright WebKit the same as Safari?

**30-second answer**

> No. It provides WebKit engine coverage through Playwright’s build. It is valuable for engine differences, but it is not the Safari application on macOS and not Mobile Safari on an iPhone. Real Safari or iOS claims require the corresponding environment.

### Q7. Why are browser contexts important?

**30-second answer**

> A context is an isolated browser session with separate cookies and storage. Playwright Test gives each test a fresh context by default, so browser-side isolation is cheap and parallel execution is practical. Contexts do not isolate shared backend data, so account and record design still determine whether the suite is parallel-safe.

### Q8. When would you not choose Playwright?

**30-second answer**

> I would not choose it for native mobile automation or load generation. I would also hesitate if a stable Selenium/Grid platform already meets the requirement, if the organization must remain Java-first and does not accept the runner differences, or if real browser/device coverage depends on an existing WebDriver provider. The tool must solve a measured problem worth the migration cost.

---

## 1.11 Review checklist

Before approving a Playwright adoption proposal, can the team answer all of these?

- [ ] Which current failures or maintenance costs are we trying to reduce?
- [ ] Which coverage must remain on real browsers, real Safari, or real devices?
- [ ] Are we adopting TypeScript, or using another binding with a separate runner ecosystem?
- [ ] What Selenium domain knowledge will we preserve?
- [ ] Which Selenium framework patterns will we deliberately retire?
- [ ] How will test data become parallel-safe?
- [ ] What evidence will CI retain on failure?
- [ ] How will we measure migration benefit: runtime, first-pass rate, triage time, maintenance effort, or defect yield?
- [ ] What is the rollback or coexistence plan?
- [ ] Who owns the new framework after the pilot?

If the proposal begins and ends with “Playwright is faster and less flaky,” it is not ready.

---

## 1.12 Exercises

### Exercise 1 — Build an honest comparison

Choose one Selenium test from your current or previous project. Record:

- its purpose;
- locator strategy;
- synchronization logic;
- setup and cleanup;
- browser and data isolation;
- CI artifacts;
- average duration;
- its last three failure causes.

Now describe which parts Playwright would improve and which parts would remain exactly the same problem.

### Exercise 2 — Find the business wait

Take a flaky UI flow. List every asynchronous event between the action and the expected result. Mark each event as:

- browser actionability;
- UI state;
- network completion;
- backend eventual consistency;
- third-party dependency;
- shared data.

Choose the narrowest observable signal for each. If your answer is a duration, try again.

### Exercise 3 — Give the interview answer aloud

Answer “Why Playwright over Selenium?” in 30 seconds. Record yourself. Your answer must include:

- one mechanism;
- one concrete benefit;
- one trade-off;
- one reason Selenium may remain appropriate.

If you cannot finish in 30 seconds, remove adjectives before removing mechanisms.

### Exercise 4 — Make a tool decision

For each scenario, choose Playwright, Selenium, Cypress, a mix, or another tool. Defend the choice in three sentences.

1. A Java bank with 2,000 stable Selenium tests and a regulated Grid provider.
2. A TypeScript startup building a new React application with six critical end-to-end journeys.
3. A collaboration product that must test two users editing the same document in real time.
4. A native iOS banking application.
5. A checkout service that must sustain 10,000 requests per second.

The last two should make the limits of the comparison obvious.

---

## 1.13 Summary

1. The hard part of browser automation is not finding a button. It is knowing when the application is ready for the action and when the business outcome is ready to assert.
2. Selenium is a mature standards-based ecosystem. Classic WebDriver places substantial synchronization policy in the test framework, while WebDriver BiDi is expanding bidirectional capabilities. Compare modern Selenium, not a caricature.
3. Cypress optimizes for an in-browser development model with an excellent interactive workflow and explicit architectural trade-offs.
4. Playwright combines lazy locators, actionability checks, browser contexts, protocol-level automation, network control, tracing, and an integrated Node test runner.
5. Auto-waiting removes several mechanical races. It does not solve backend data, product defects, eventual consistency, environment instability, or weak test design.
6. WebKit is not Safari, emulation is not a real device, parallel browsers are not load testing, and a passing retry is not proof of reliability.
7. Choose Playwright when its mechanisms solve measured problems worth the migration cost. Keep or mix tools when requirements say so.

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Version-sensitive statements should be rechecked before publication.

- [Playwright installation and supported environments](https://playwright.dev/docs/intro)
- [Playwright browsers and branded channels](https://playwright.dev/docs/browsers)
- [Playwright auto-waiting and actionability](https://playwright.dev/docs/actionability)
- [Playwright locators](https://playwright.dev/docs/locators)
- [Playwright library versus Playwright Test](https://playwright.dev/docs/library)
- [Playwright supported languages](https://playwright.dev/docs/languages)
- [Playwright component testing — experimental](https://playwright.dev/docs/test-components)
- [Selenium WebDriver](https://www.selenium.dev/documentation/webdriver/)
- [Selenium waiting strategies](https://www.selenium.dev/documentation/webdriver/waits/)
- [Selenium WebDriver BiDi](https://www.selenium.dev/documentation/webdriver/bidi/)
- [Selenium stale-element guidance](https://www.selenium.dev/documentation/webdriver/troubleshooting/errors/)
- [Cypress architectural trade-offs](https://docs.cypress.io/app/references/trade-offs)

---

## What comes next

Chapter 2 creates the project you will use for the rest of the book. You will install a supported Node release, scaffold a Playwright 1.61 project, write one behavior test by hand, break it in three different ways, and read the resulting evidence.

The goal is not merely to produce a green check mark. It is to understand every file and every process that produced it.

