# Playwright for Selenium Test Engineers — Companion

Runnable examples for the book *Playwright for Selenium Test Engineers: Production Automation, Migration, and Interview Mastery*.

## Project structure

- `book/` contains the editorial blueprint and reviewed Markdown manuscript.
- `tests/chNN/` contains the executable examples for each chapter.
- `.github/workflows/playwright.yml` validates the companion project across the configured browser engines.

## Baseline

- Playwright: `1.61.1`
- Node.js: a Playwright-supported 22.x, 24.x, or 26.x release
- Primary language: TypeScript in strict mode

## Start

```bash
npm ci
npx playwright install --with-deps
npm test
```

During local development, install only the browser you need if disk or download size matters:

```bash
npx playwright install chromium
npm run test:chapter-01 -- --project=chromium
```

## Repository contract

- Every chapter has a runnable test area under `tests/chNN/`.
- Examples compile under TypeScript strict mode.
- Deliberate failures are either skipped with an explanation or kept in a separate failure-lab file.
- No committed `.only`, `waitForTimeout`, raw XPath, shared account, or singleton browser.
- Browser-side isolation does not replace backend test-data isolation.

QualityMart, the controlled example application, will be added after its API and failure-mode contract is finalized.

The Chapter 1, Chapter 2, Chapter 4, Chapter 5, Chapter 6, and Chapter 7 examples currently intercept the placeholder QualityMart URL or serve deterministic in-test pages. This keeps the examples runnable while the controlled application contract is being built. Chapter 3 adds object-lifecycle, context-isolation, and event-flow examples. Chapter 4 adds suite structure, tags, annotations, steps, `use` precedence, and worker-lifecycle examples. Chapter 5 adds locator re-resolution, strictness, accessible-name, frame, shadow-root, and composition examples. Chapter 6 adds action semantics, control interactions, file uploads and drops, dialogs, popups, and downloads. Chapter 7 adds actionability, web-first synchronization, network event ordering, and safe polling examples.
