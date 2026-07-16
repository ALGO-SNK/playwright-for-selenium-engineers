# Playwright for Selenium Test Engineers — Companion

Runnable examples for the book *Playwright for Selenium Test Engineers: Production Automation, Migration, and Interview Mastery*.

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

The Chapter 1 and Chapter 2 examples currently intercept the placeholder QualityMart URL and serve deterministic in-test pages. This keeps the examples runnable while the controlled application contract is being built. Chapter 3 adds object-lifecycle, context-isolation, and event-flow examples.
