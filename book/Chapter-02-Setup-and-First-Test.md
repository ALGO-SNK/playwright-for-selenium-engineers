# Chapter 2 — Setup, TypeScript, and the First Useful Test

## What you will learn

By the end of this chapter, you will be able to:

- install a Playwright 1.61 toolchain without bringing Selenium driver habits with you;
- explain the files created by the Playwright scaffold;
- write and run one behavior-focused TypeScript test;
- use projects, headed mode, UI Mode, and test filters;
- break the test deliberately and read the failure before changing the code;
- explain what the Playwright CLI launches and why browsers are tied to the package version.

You will finish with more than a green test. You will know what produced the green test, where the configuration lives, and what evidence appears when the test turns red.

That is the correct first day with an automation framework.

---

## 2.1 Start with a supported machine

This book targets Playwright 1.61.1.

At this baseline, the official Node.js system requirements list current 22.x, 24.x, or 26.x releases. Supported desktop/server environments also have minimum versions. Check the current installation page before setting up a corporate runner or an older laptop; do not assume that “Node LTS” or “Linux” is specific enough.

### The four tools you need

For the TypeScript path in this book, install:

1. Node.js;
2. npm, which is distributed with Node;
3. Git;
4. Visual Studio Code with Microsoft’s Playwright Test extension.

You do **not** need:

- a JDK;
- Selenium;
- ChromeDriver, GeckoDriver, or EdgeDriver;
- a globally installed Playwright package;
- a Selenium Grid;
- a system-wide test runner.

If your team chooses Playwright for Java, the list changes. Java, Maven or Gradle, and JUnit or TestNG return. That is a different project path, covered in the Java sidebars and Appendix E.

### Install Node with a version manager

npm’s own documentation recommends a Node version manager. The practical reason is control.

A version manager lets two projects use different Node releases without administrator installs or global permission problems. It also makes CI and onboarding instructions explicit.

Use a tool approved for your operating system and organization. Common choices include `nvm`, `fnm`, and Volta. The exact choice matters less than the rule:

> The repository declares the Node version. Developers and CI use that version intentionally.

A team should not discover its Node dependency only after a CI image updates.

### Verify the toolchain

Open a new terminal and run:

```bash
node --version
npm --version
git --version
```

The first command must print a Node version supported by the pinned Playwright release. The other commands must complete successfully.

If the terminal cannot find a command, do not begin changing Playwright configuration. Fix the installation or `PATH` first.

> **On a real team — corporate proxies**  
> A package download that fails with a certificate, proxy, DNS, or registry error is usually an environment-access problem, not a Playwright defect. Ask for the organization’s approved npm registry, proxy configuration, and certificate process. Do not disable TLS verification as a “temporary” fix that becomes permanent.

### Install the VS Code extension

Install **Playwright Test for VS Code**, published by Microsoft.

The extension can:

- discover and run tests from the editor;
- show the browser during execution;
- debug with breakpoints;
- pick locators;
- record a draft test;
- open trace information;
- select projects.

You can use another editor. The book uses VS Code because the official extension reduces friction for a new TypeScript user and makes failure investigation visible early.

> **Coming from Selenium**  
> Map the ecosystem before you judge it. `package.json` is closest to the dependency-and-script role of `pom.xml`; `package-lock.json` records the resolved dependency tree; `node_modules` contains project-local installed packages; `playwright.config.ts` centralizes responsibilities often split across `testng.xml`, a base test, driver setup, listeners, and environment helpers.

---

## 2.2 Create the project

Create or open the directory that will hold the automation project. Commit or stash unrelated work first if you are adding Playwright to an existing repository.

Run:

```bash
npm init playwright@latest
```

The current installer can initialize a new project or add Playwright to an existing one. It can be run again and does not overwrite existing tests. That does not mean you should run scaffolding carelessly: generated configuration is still a code change, and code changes deserve a clean branch and review.

### What the command means

`npm init` can run a project initializer. `playwright@latest` requests the current Playwright initializer release.

Do not build your mental model around “npm installs and npx runs.” That shortcut is useful for five minutes and inaccurate after that.

- `npm install` resolves and installs dependencies.
- `npm run` executes scripts from `package.json`.
- `npm exec` runs a command in a package context.
- modern `npx` is built on `npm exec` and can prompt to fetch a missing package.
- `npm init <initializer>` runs a project creation flow.

The important behavior here is simple: npm obtains the Playwright initializer and the initializer edits the project.

### Answer the current prompts

The official 1.61 setup flow asks you to confirm:

1. **TypeScript or JavaScript?** Choose TypeScript.
2. **Tests folder?** Accept `tests` unless the repository has a clear convention such as `e2e`.
3. **Add a GitHub Actions workflow?** For the book companion, choose yes. For a company repository using Jenkins, Azure DevOps, or GitLab, choose based on the actual CI system.
4. **Install Playwright browsers?** Choose yes on a development machine unless your organization uses a controlled browser-cache process.

Why TypeScript?

Not because every QA engineer must become a frontend developer.

TypeScript gives this project:

- API autocomplete;
- compile-time checks for misspelled methods and wrong option types;
- typed fixtures and configuration;
- safer refactoring as the framework grows;
- an editor that teaches while you type.

The book introduces TypeScript only as needed. You need `async`/`await`, objects, arrays, functions, classes, interfaces, and a small amount of generic typing. You do not need to learn the entire language before writing a test.

### Pin the book baseline

The initializer uses the current release. This book’s examples use exactly 1.61.1, so align the project:

```bash
npm install --save-dev @playwright/test@1.61.1
npx playwright install
```

Why exact pinning if `package-lock.json` already records exact resolved versions?

The lock file makes installations reproducible for the current dependency ranges and tree. An exact direct dependency also makes the project’s intended Playwright baseline obvious and prevents an intentional lock refresh from silently moving the main tool to a newer minor version.

That policy is especially useful for a book, training course, or regulated suite. Other teams may choose a compatible range plus automated update pull requests. The key is a deliberate upgrade policy, not one sacred punctuation mark.

---

## 2.3 Read the generated project

Your repository now contains a shape similar to this:

```text
playwright-project/
├── .github/
│   └── workflows/
│       └── playwright.yml
├── tests/
│   └── example.spec.ts
├── .gitignore
├── package.json
├── package-lock.json
└── playwright.config.ts
```

The exact scaffold can change. The responsibilities should not surprise you.

### `package.json` — declared dependencies and commands

A minimal book companion looks like this:

```json
{
  "name": "playwright-for-selenium-engineers",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "typescript": "^5.9.0"
  }
}
```

`devDependencies` lists packages required to develop and test the project. `scripts` gives the team stable command names.

Use scripts for team workflows:

```bash
npm test
npm run typecheck
```

Do not hide every useful Playwright option behind a script. Engineers should still understand the underlying CLI.

### `package-lock.json` — the resolved installation

npm generates the lock file when it modifies the dependency tree. The file describes the exact tree so later installations can reproduce it.

Commit it.

In CI, use:

```bash
npm ci
```

`npm ci` requires an existing lock file, removes an existing `node_modules` directory, installs the locked project, fails if the package manifest and lock disagree, and does not rewrite them.

That is why it belongs in automation: it treats dependency drift as an error instead of a decision the CI runner may make.

### `node_modules/` — installed packages

This directory may contain many files. Do not edit or commit it.

If a dependency installation becomes corrupted, a clean install can rebuild the directory from the manifest and lock. Do not turn “delete `node_modules`” into the first response to every failure; read the error first.

### `playwright.config.ts` — runner and browser policy

This file can define:

- test discovery;
- projects;
- workers and retries;
- timeouts;
- browser-context options;
- base URL;
- trace, screenshot, and video modes;
- reporters;
- web-server startup;
- CI-specific behavior.

Do not try to master it all today. Read enough to answer three questions:

1. Where are the tests?
2. Which projects will run?
3. What evidence is retained on failure?

Chapter 4 explains configuration scope. Chapter 13 designs the production configuration.

### `tests/example.spec.ts` — executable behavior

The `.spec.ts` convention tells Playwright that the file contains tests under the configured test directory.

The generated example proves the toolchain. Read it, run it, then replace it with a test against the product you own. Demo code should not become unexplained permanent regression coverage.

### `.gitignore` — generated output and secrets stay out

The ignore file should cover at least:

```text
node_modules/
playwright-report/
test-results/
.env
auth/*.json
```

Reports and traces normally belong in CI artifact storage, not source control. Authentication state can contain sensitive cookies or tokens and must never be committed.

### The CI workflow

If generated, read it now even though Chapter 23 explains it fully.

A typical workflow checks out code, sets up Node, runs `npm ci`, installs Playwright browsers and system dependencies, runs tests, and uploads the report.

The file is not magic. It is your local setup written as a repeatable machine job.

---

## 2.4 Where the browsers come from

Playwright needs browser executables that match its automation implementation.

When you run:

```bash
npx playwright install
```

Playwright downloads the browser builds associated with the installed package. The default project commonly includes Chromium, Firefox, and WebKit projects.

### Why not just use the installed Chrome?

Bundled/pinned browser builds provide:

- a known browser revision for a known Playwright release;
- consistent developer and CI execution;
- patched or integrated support required by Playwright’s Firefox and WebKit paths;
- an upgrade unit: package plus matching browsers.

Playwright can run supported branded channels such as installed Chrome or Edge. Use those projects when the product risk requires the branded browser.

The choice is not “bundled good, installed bad.” It is:

- bundled builds for reproducibility and engine coverage;
- branded channels for a specific user-browser claim;
- real Safari/device infrastructure for claims the local builds cannot make.

### Browser cache and CI images

Browser binaries live in a cache location by default rather than inside your source tree. Playwright supports `PLAYWRIGHT_BROWSERS_PATH` when a team needs a controlled shared or project-specific location.

In Linux CI and containers, use:

```bash
npx playwright install --with-deps
```

The `--with-deps` option installs required operating-system dependencies as well as browsers where supported. In a locked-down environment, teams often bake browsers and dependencies into a versioned container image instead of downloading them during every job.

> **Trap — package/browser mismatch**  
> Updating `@playwright/test` without installing its corresponding browsers can produce “executable doesn’t exist” or revision-mismatch failures. Treat the package and browser install as one upgrade operation.

---

## 2.5 Write the first useful test

Delete or move the generated demo and create:

```text
tests/ch02/first-useful-test.spec.ts
```

Write:

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

This is small, but it is a test rather than a recording.

- The name describes user behavior.
- The test receives a `page` fixture.
- `goto` uses the configured `baseURL`.
- locators describe user-facing controls.
- assertions check an outcome, not merely that a click occurred.
- every browser operation is awaited.

### Read the syntax

```ts
import { expect, test } from '@playwright/test';
```

Imports the test declaration and assertion API.

```ts
test('guest can search the catalog', async ({ page }) => {
```

Declares a test with an asynchronous function. `{ page }` asks Playwright’s fixture system for a fresh page in the test’s isolated browser context.

```ts
await page.getByRole(...).fill(...);
```

The locator describes a searchbox. `fill` returns a promise. `await` pauses this test function until the operation completes or fails.

```ts
await expect(locator).toHaveText(...);
```

This is a web-first assertion. It retries the locator and expectation until the text matches or the assertion timeout expires.

### Why not copy the generated example?

Because typing the first test forces you to notice the shape. Generated code is useful later for discovery. On day one, your hands should learn the four-part rhythm:

```text
arrange state → perform behavior → observe outcome → clean up automatically
```

---

## 2.6 Run it several ways

### Run the suite

```bash
npx playwright test
```

The runner loads configuration, discovers tests, expands the project matrix, starts workers, executes tests, and reports results.

If one test is configured for three browser projects, the run contains three test cases.

### Run one browser project

```bash
npx playwright test --project=chromium
```

Use one fast project while developing. Let CI or a deliberate local command run the required matrix.

### Show the browser

```bash
npx playwright test --project=chromium --headed
```

Headed mode is useful for orientation. It is not a diagnosis strategy by itself. A fast failure can still be impossible to understand by watching live.

### Run one file or one title

```bash
npx playwright test tests/ch02/first-useful-test.spec.ts
npx playwright test --grep "guest can search"
```

The short grep form is also common:

```bash
npx playwright test -g "guest can search"
```

Use precise selection during development. Before merge, run the affected suite with normal parallelism and the required projects.

### Run failures again

```bash
npx playwright test --last-failed
```

This accelerates a fix loop. It does not replace a clean confirmation run after the fix.

### Open UI Mode

```bash
npx playwright test --ui
```

UI Mode adds test selection, watch behavior, action details, locator exploration, source, and trace-style time travel.

Developers who treat UI Mode as “beginner mode” often replace it with slower habits: rerunning whole files, adding logs, and trying to watch a headless race in headed mode.

Use the strongest tool for the question.

---

## 2.7 Break the test on purpose

A framework earns trust when it fails clearly.

### Failure 1: the locator finds nothing

Change:

```ts
page.getByRole('button', { name: 'Search' })
```

to:

```ts
page.getByRole('button', { name: 'Find everything' })
```

Run the one test.

Read the output from top to bottom:

- the failing test title;
- the source line;
- the locator call;
- what Playwright waited for;
- the timeout;
- any attachment or error context.

Do not add a wait. The description is wrong. More time will not create a button with that accessible name.

### Failure 2: the assertion receives the wrong value

Restore the locator. Change the result assertion to:

```ts
await expect(page.getByTestId('result-count'))
  .toHaveText('999 products');
```

Now the element can be found. The failure is the oracle: expected and received values do not agree.

That distinction matters.

```text
Action/locator failure: the test could not reach or operate the intended UI state.
Assertion failure:      the state was observable and contradicted the expectation.
```

Either can represent a product defect or a test defect. The category tells you where to begin, not who to blame.

### Failure 3: the application never loads

Set `baseURL` to an invalid local port or break the route. The failure now occurs during navigation.

This is neither a locator nor an assertion problem. It is environment, server, URL, certificate, DNS, proxy, or application startup until evidence says otherwise.

One red test can therefore represent three different systems:

- navigation/environment;
- interaction and page state;
- expected business outcome.

Learn to identify the system before proposing the fix.

---

## 2.8 Record and inspect a trace

The production-friendly default is often:

```ts
use: {
  trace: 'on-first-retry'
}
```

That mode is valuable in CI when retries are enabled. During a local failure lab, record a trace explicitly so the first failure has one:

```bash
npx playwright test tests/ch02/first-useful-test.spec.ts \
  --project=chromium \
  --trace=on
```

Open the HTML report:

```bash
npx playwright show-report
```

Open the failed test and its trace attachment.

Inspect:

- the action timeline;
- the DOM snapshot before and after an action;
- locator details and call log;
- network requests and responses;
- console messages and page errors;
- the highlighted source line;
- metadata such as project and duration.

The DOM snapshot is not merely a screenshot. It lets you inspect captured page structure around the recorded action.

Chapter 20 teaches a full CI-only investigation. Today, learn one rule:

> Open the artifact before editing the test.

### Trace cost and policy

`trace: 'on'` is appropriate for a short debugging session. It is rarely the default for a large passing suite because artifacts consume time and storage.

Choose a mode based on the question your CI must answer and the cost your organization accepts. Do not repeat “on-first-retry costs nothing” as a literal statement. It reduces routine artifact generation; the suite and runner still have instrumentation and retry costs governed by configuration.

---

## 2.9 Use codegen without outsourcing test design

Run:

```bash
npx playwright codegen https://qualitymart.example
```

Or use **Record new** in the VS Code extension.

Codegen can help you:

- explore an unfamiliar page;
- discover a strong locator;
- learn Playwright syntax;
- capture the rough sequence of a journey.

Its output is a draft.

Before committing generated code:

- rename the test around behavior;
- remove exploratory clicks;
- replace incidental locators;
- add meaningful assertions;
- move setup to fixtures or APIs where appropriate;
- isolate test data;
- verify cleanup;
- run it repeatedly and in normal parallelism;
- review every line as if a junior engineer submitted it.

> **AI review gate**  
> The same rule applies to AI-generated tests. Syntax generation is not test design. A generated test must still prove intent, oracle quality, data isolation, security, and maintainability.

---

## 2.10 Common setup mistakes

### Mistake 1: using an unsupported Node release

**Symptom:** Installation or runtime errors differ across laptops and CI.

**Repair:** Declare and enforce a supported Node line. Check Playwright’s current system requirements during upgrades.

### Mistake 2: installing Playwright globally

**Symptom:** `playwright --version` differs from the project’s package and browser revision.

**Repair:** Keep Playwright in project `devDependencies` and run it through `npx`, `npm exec`, or package scripts.

### Mistake 3: omitting the lock file

**Symptom:** developers and CI resolve different dependency trees.

**Repair:** Commit `package-lock.json` and use `npm ci` in automation.

### Mistake 4: committing authentication state

**Symptom:** cookies or tokens appear in Git history.

**Repair:** ignore the auth directory before creating state files, rotate exposed credentials, and use dedicated test accounts.

### Mistake 5: updating the package without browsers

**Symptom:** missing executable or incompatible browser revision.

**Repair:** update the package and run the matching browser install in the same change.

### Mistake 6: running the entire matrix during every edit

**Symptom:** the feedback loop is slow, so engineers skip local testing.

**Repair:** develop against one project and one focused test; confirm the required matrix before merge and in CI.

### Mistake 7: watching instead of diagnosing

**Symptom:** engineers rerun headed mode repeatedly hoping to see a fast race.

**Repair:** use UI Mode, Trace Viewer, call logs, network evidence, and controlled failure reproduction.

---

## 2.11 Interview corner

### Q1. What happens when you run `npx playwright test`?

**30-second answer**

> The local Playwright CLI loads configuration, discovers matching spec files, expands them across configured projects, starts worker processes, provides each test its fixtures such as a fresh browser context and page, collects results and attachments, and sends them to the configured reporters.

**Follow-up:** Are all tests parallel? Explain file-level defaults, tests within a file, workers, projects, and `fullyParallel` rather than saying simply yes.

### Q2. Why does Playwright install its own browsers?

**30-second answer**

> The package is tested with specific browser revisions, so installing matching builds makes developer and CI runs reproducible and supports Playwright’s Firefox and WebKit integration. I can add projects for installed Chrome or Edge when branded-browser coverage matters. WebKit is still not the Safari application.

### Q3. What is the difference between `npm install` and `npm ci`?

**30-second answer**

> `npm install` resolves dependencies allowed by `package.json` and may update the lock file. `npm ci` requires a lock file, fails if it disagrees with the manifest, removes existing `node_modules`, installs the locked tree, and does not rewrite the manifest or lock. I use `npm ci` in CI for a frozen clean install.

### Q4. What is a Playwright project?

**30-second answer**

> A project is a named test configuration. It can represent a browser, device, environment, role, or another configuration dimension. One declared test can become several test cases when it runs in several projects.

### Q5. Why use TypeScript for Playwright?

**30-second answer**

> Playwright’s Node testing experience is TypeScript-friendly. Types improve API discovery, fixture contracts, configuration, and refactoring. The business reason is maintainability and faster feedback, not fashion. A Java team can still use Playwright for Java, but it keeps JUnit/TestNG and a different runner ecosystem.

### Q6. What is a trace?

**30-second answer**

> A trace is a structured recording of a test run with actions, DOM snapshots, network and console evidence, source, timing, and attachments. I retain it according to a CI policy such as on first retry, then use it to diagnose the state that existed on the remote runner.

### Q7. Would you commit codegen output?

**30-second answer**

> Not without rewriting and review. Codegen is useful for exploration and locator discovery, but generated flows often contain incidental actions and weak or missing business assertions. It saves typing; it does not decide what should be tested.

### Q8. A test passes locally and fails in CI. What do you check first?

**30-second answer**

> I start with the CI artifact and classify the failure: navigation/environment, locator/action, assertion, data collision, or product error. I inspect the trace, network, console, project settings, and worker behavior before changing timeouts. Then I reproduce with the CI configuration, including parallelism and environment data.

---

## 2.12 Review checklist

- [ ] Node version is supported and declared.
- [ ] Playwright is a project dependency, not a global dependency.
- [ ] The Playwright version and browser install are updated together.
- [ ] `package-lock.json` is committed.
- [ ] CI uses `npm ci`.
- [ ] TypeScript strict checking is enabled.
- [ ] Auth state, environment files, reports, and test results are ignored.
- [ ] One local project provides a fast edit loop.
- [ ] The required browser matrix runs before release.
- [ ] Failure artifacts are configured and retained.
- [ ] Generated code is reviewed as a draft.

---

## 2.13 Exercises

### Exercise 1 — Explain every generated file

Create a new scaffold in a temporary directory. Without searching, write one sentence for the responsibility of every generated file and folder. Then compare your explanation with this chapter.

### Exercise 2 — Produce three failure classes

Create:

1. a navigation failure;
2. a locator/action failure;
3. an assertion failure.

For each, record the first useful line in the error output and the artifact that gives the next piece of evidence.

### Exercise 3 — Compare the run matrix

List tests with:

```bash
npx playwright test --list
```

Then run or list one project and one file. Explain why the number of declared `test()` calls can differ from the number of executed test cases.

### Exercise 4 — Record and rewrite

Use codegen for a short search or login journey. Save the draft. Rewrite it so that:

- the title describes behavior;
- every action contributes to the scenario;
- locators reflect user-facing semantics or an explicit test contract;
- at least one assertion proves a business outcome;
- data and cleanup assumptions are written down.

Review the before/after diff. The removed lines are often more educational than the generated ones.

---

## 2.14 Summary

1. A Playwright 1.61 TypeScript project needs a supported Node release, npm, Git, and an editor. It does not need Selenium drivers or a global Playwright installation.
2. `npm init playwright@latest` can initialize or add Playwright to a project. Review its generated changes and align the dependency to the book’s pinned baseline.
3. `package.json` declares intent; `package-lock.json` records the resolved tree; `npm ci` performs a frozen clean installation for automation.
4. Playwright installs browser builds matched to the package. Branded Chrome/Edge, WebKit engine coverage, and real Safari/device testing are different claims.
5. A useful first test describes behavior and asserts an outcome. A generated click sequence is only a draft.
6. Use focused CLI runs and UI Mode for a fast development loop. Use the required project matrix for confirmation.
7. Break the test deliberately. Classify navigation, action/locator, and assertion failures before attempting a fix.
8. Open traces and reports before editing timeouts or selectors.

---

## Sources and version notes

This chapter targets Playwright 1.61.1. Recheck setup prompts and system requirements before publication.

- [Playwright installation, scaffold prompts, and system requirements](https://playwright.dev/docs/intro)
- [Playwright command line](https://playwright.dev/docs/test-cli)
- [Running and debugging tests](https://playwright.dev/docs/running-tests)
- [Playwright UI Mode](https://playwright.dev/docs/test-ui-mode)
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright VS Code extension](https://playwright.dev/docs/getting-started-vscode)
- [Playwright browser management](https://playwright.dev/docs/browsers)
- [npm clean installs](https://docs.npmjs.com/cli/v10/commands/npm-ci/)
- [npm lock-file behavior](https://docs.npmjs.com/cli/v10/configuring-npm/package-lock-json/)
- [npm exec and npx](https://docs.npmjs.com/cli/v9/commands/npx/)
- [npm guidance for installing Node](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)

---

## What comes next

You now know how to create and operate the project from the outside.

Chapter 3 opens the box. It separates the test runner, client objects, Playwright protocol, server-side automation implementation, language-binding driver process, browser protocol, and browser process. Most importantly, it explains why “one WebSocket from the test to the browser” is not an accurate universal architecture diagram.

