# Chapter 5 — Locator Strategy: Describe Intent, Resolve Late

Most unreliable UI suites do not fail because clicking is difficult. They fail because the test cannot consistently identify what should be clicked.

A locator is therefore not a minor syntax choice. It is the contract between test intent and product behavior. A good locator keeps working through harmless refactoring and fails when the user-facing contract changes. A poor locator does the reverse: it survives the defect and breaks during a CSS cleanup.

For Selenium engineers, this chapter requires one especially important mental shift. Stop thinking, “Find an element and keep it.” Start thinking, “Describe the target, then let Playwright resolve that description when it is needed.”

## What you will learn

By the end of this chapter, you will be able to:

- explain why a locator is different from an element handle;
- choose locators according to the behavior being tested rather than a rigid selector hierarchy;
- use roles, accessible names, labels, text, test IDs, CSS, and XPath deliberately;
- diagnose accessible-name mismatches without guessing;
- explain strictness and distinguish single-target operations from list operations;
- narrow locators with chaining, `filter`, `and`, and `or`;
- use positional selection only when position is part of the requirement;
- work with iframes and open shadow roots;
- review locator code for localization and accessibility risks; and
- answer practical locator interview questions with production-level reasoning.

The runnable examples use deterministic QualityMart pages served inside each test. They are small enough to inspect, but they reproduce the ambiguity, re-rendering, frames, and shadow-root boundaries found in production applications.

---

## 5.1 A locator is a query plan, not a stored node

This line does not immediately search the page:

```ts
const checkoutButton = page.getByRole('button', { name: 'Checkout' });
```

It creates a locator—a description of elements that satisfy the role and accessible-name conditions. When an operation needs the target, Playwright resolves the locator against the current page:

```ts
await checkoutButton.click();
```

If the framework replaces that button after the click, a later assertion resolves the locator again:

```ts
await expect(checkoutButton).toHaveText('Processing…');
```

The locator can now refer to the replacement node because the description still matches.

### Why this reduces stale-element failures

Selenium's `findElement` returns a `WebElement` associated with a particular remote element. If the document replaces that element, using the old reference can produce `StaleElementReferenceException`.

A Playwright `Locator` normally re-resolves before each action or assertion. It does not promise that one DOM node will live forever. It promises to apply the same target description to the current DOM.

That does not make a locator immortal. It can still fail because:

- the description no longer matches;
- the description matches several elements;
- the matching element never becomes actionable;
- the element is in another frame; or
- the product changed its user-facing contract.

It removes stale-reference management, not the need for precise target design.

### Avoid dropping back to element handles

Legacy methods such as `page.$()` return element handles. Handles are appropriate for a small set of low-level operations, but they give up locator re-resolution and much of Playwright's retry-oriented design.

Prefer:

```ts
const save = page.getByRole('button', { name: 'Save' });
await save.click();
```

over:

```ts
const save = await page.$('button');
await save?.click();
```

The second version is eager, ambiguous, nullable, and tied to a node captured earlier.

> **Interview answer: Why are stale-element exceptions uncommon in Playwright?**
>
> “A locator is a lazy target description and is re-evaluated when an action or assertion uses it. Selenium commonly gives me a reference to a specific remote element, which becomes stale if the DOM replaces that node. Playwright usually keeps the query, not the old node. A locator can still time out or become ambiguous, but I do not need retry-and-refind wrappers for ordinary re-rendering.”

---

## 5.2 Choose the locator from the contract

Teams often teach a single ladder: role first, XPath last. That is a useful warning against structural selectors, but it is too simple for serious test design.

The better question is:

> What stable fact about this target is part of the behavior I intend to protect?

Use the answer to choose the locator family.

| Contract being protected | Strong starting point | Example |
|---|---|---|
| Interactive control perceived by a user | Role plus accessible name | `getByRole('button', { name: 'Place order' })` |
| Form control identified by its label | Label | `getByLabel('Delivery address')` |
| Unlabelled field identified only by hint text | Placeholder | `getByPlaceholder('name@example.com')` |
| Non-interactive visible content | Text | `getByText('Order confirmed')` |
| Image identity communicated by alternative text | Alt text | `getByAltText('QualityMart logo')` |
| Stable tooltip or title contract | Title | `getByTitle('Open account menu')` |
| Explicit automation contract | Test ID | `getByTestId('cart-count')` |
| Stable DOM state with no user-facing identity | CSS | `locator('[data-state="open"]')` |
| Relationship not expressible clearly otherwise | CSS or XPath, reviewed carefully | A genuinely structural edge case |

This is a decision table, not a moral ranking. A test ID may be stronger than visible text for an application translated into twelve languages. A role-and-name locator may be exactly right when the localized label is the contract under test.

### Role plus accessible name is the default for controls

```ts
await page.getByRole('button', { name: 'Place order' }).click();
await page.getByRole('checkbox', { name: 'Gift wrap' }).check();
await page.getByRole('link', { name: 'Order history' }).click();
```

These locators describe what the control is and what it is called. They usually survive wrapper elements, class renames, and layout changes.

Pass the name whenever the role alone is not unique. `getByRole('button')` on a real page often describes dozens of controls and should remain a list until you narrow it.

Role locators follow ARIA role and accessible-name rules. Semantic HTML creates many implicit roles:

- `<button>` → `button`;
- `<a href="…">` → `link`;
- `<input type="checkbox">` → `checkbox`;
- `<input type="search">` → `searchbox`;
- `<h1>` through `<h6>` → `heading`; and
- `<select>` → usually `combobox` or `listbox`, depending on its form.

Roles are semantic names, not tag names. `getByRole('input')` is not meaningful. Also avoid memorizing a simplistic tag table: some elements change role based on attributes, and a password input has no implicit `textbox` role. For form fields, a proper label is often the clearest contract.

Role locators provide useful accessibility feedback, but they do not prove WCAG conformance. Automated rules, manual assessment, keyboard testing, and assistive-technology testing still matter.

### Labels are the strongest form-field contract

```html
<label for="email">Email address</label>
<input id="email" type="email">
```

```ts
await page.getByLabel('Email address').fill('buyer@example.test');
```

`getByLabel` works with associated `<label>` elements and ARIA labelling mechanisms. It expresses the relationship users need, rather than copying the implementation as `[aria-label="Email address"]`.

If the field has no label but has a placeholder, `getByPlaceholder` can locate it:

```ts
await page.getByPlaceholder('name@example.com')
  .fill('buyer@example.test');
```

A placeholder is a weaker user experience because it disappears during entry and is not a substitute for a persistent label. The locator can be valid while the application still has an accessibility problem.

### Text locators are for content

```ts
await expect(page.getByText('Order confirmed')).toBeVisible();
```

Text matching normalizes whitespace. It can use a substring, an exact string, or a regular expression:

```ts
page.getByText('Order confirmed', { exact: true });
page.getByText(/^Order QM-\d+ confirmed$/);
```

For interactive controls, role plus name usually communicates more than text alone. `getByText('Delete')` says nothing about whether the target is a button, link, menu item, or warning. `getByRole('button', { name: 'Delete' })` does.

### Test IDs are explicit engineering contracts

```html
<span data-testid="cart-count">2</span>
```

```ts
await expect(page.getByTestId('cart-count')).toHaveText('2');
```

A test ID is not inherently a second-rate selector. It is a deliberate contract between product code and automation. It is valuable when:

- the element has no stable user-facing name;
- the text changes by locale or experiment;
- repeated visual controls need a language-independent identity; or
- the team wants selectors decoupled from layout and styling.

Its limitation is equally important: a test ID does not prove that the user can perceive or operate the element. Combine it with assertions appropriate to the risk.

Teams can configure a different attribute:

```ts
export default defineConfig({
  use: {
    testIdAttribute: 'data-qa'
  }
});
```

Then `getByTestId('cart-count')` targets `data-qa="cart-count"`.

### CSS and XPath are tools, not defaults

CSS is appropriate when the stable contract is genuinely structural or state-based:

```ts
const openPanel = page.locator('[data-state="open"]');
```

It is brittle when it captures incidental presentation:

```ts
page.locator('div.flex.mt-4 > button.rounded-md');
```

XPath can express ancestor relationships and document structures that are awkward in CSS. But long absolute paths encode the current DOM rather than the behavior:

```ts
page.locator('xpath=/html/body/div[2]/main/div[3]/button[1]');
```

Before approving CSS or XPath, ask whether the selector depends on something developers are free to change without changing the feature. If yes, request a semantic or test contract instead.

---

## 5.3 Accessible names: inspect the computed result

Consider this control:

```html
<span id="search-label">Search products</span>
<input type="search"
       aria-labelledby="search-label"
       placeholder="What do you need?">
```

Its role is `searchbox`. Its accessible name is computed from the applicable web-platform rules; here it is “Search products.” The placeholder remains “What do you need?”

These locators answer different questions:

```ts
page.getByRole('searchbox', { name: 'Search products' });
page.getByPlaceholder('What do you need?');
```

Do not replace the accessible-name algorithm with a memorized four-item priority list. The computation follows W3C and HTML rules and can involve:

- native labels;
- `aria-labelledby` references;
- `aria-label`;
- element text when the role permits naming from content;
- image alternatives;
- embedded controls; and
- rules for hidden or referenced content.

The practical rule is simpler: inspect the computed result.

### Use an ARIA snapshot while debugging

Playwright can expose an accessibility-oriented representation:

```ts
const searchRegion = page.getByRole('search');
console.log(await searchRegion.ariaSnapshot());
```

A simplified result might look like:

```yaml
- searchbox "Search products"
- button "Search"
```

The locator picker and Playwright code generator also display ARIA snapshots. Browser accessibility tools can show the computed role, name, and properties for a selected node.

When `getByRole` appears wrong, do not keep changing strings. Check:

1. the computed role;
2. the computed accessible name;
3. whether the element is hidden from the accessibility model;
4. whether it lives in another frame; and
5. whether several elements have the same role and name.

### ARIA snapshots can assert meaningful structure

For a stable region, an ARIA snapshot can verify several semantic facts together:

```ts
await expect(page.getByRole('navigation', { name: 'Account' }))
  .toMatchAriaSnapshot(`
    - navigation "Account":
      - link "Profile"
      - link "Order history"
      - button "Sign out"
  `);
```

Use this when the semantic structure itself is the contract. Avoid snapshotting an entire volatile page simply because the feature exists; large snapshots produce broad diffs and expensive review.

### Localization changes names

This locator does not survive a French UI unchanged:

```ts
page.getByRole('button', { name: 'Checkout' });
```

The role remains `button`; the accessible name may become `Commander` or `Paiement`, depending on the product translation. Choose a strategy based on the test:

- If the test verifies French content, locate with the expected French name.
- If the scenario is language-independent, use a stable test ID or a translation fixture shared with the product.
- If only the role matters and it is uniquely scoped, role without name may be sufficient—but review ambiguity carefully.

Do not pretend user-facing locators are language-independent. Their sensitivity to language is often the point.

---

## 5.4 Strictness refuses to guess

This action is ambiguous:

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
```

If six product cards contain that button, Playwright throws a strictness violation. Operations that imply one target require the locator to resolve to exactly one element.

That is safer than silently choosing the first match. The test author must explain which product is intended.

### Strictness depends on the operation

A locator is allowed to represent several elements. List-aware operations are valid:

```ts
const addButtons = page.getByRole('button', { name: 'Add to cart' });

await expect(addButtons).toHaveCount(6);
expect(await addButtons.count()).toBe(6);
```

These operations expect a collection. `click()` expects one target and is strict.

This distinction is useful in interviews: Playwright does not require every locator to be unique. It requires uniqueness when the requested operation needs one element.

### The correct response is to add meaning

Scope the button to a product card:

```ts
const keyboard = page
  .getByRole('article')
  .filter({ hasText: 'Wireless keyboard' });

await keyboard.getByRole('button', { name: 'Add to cart' }).click();
```

Now the locator expresses product identity and action. It survives card reordering.

Do not “fix” ambiguity automatically with `.first()`:

```ts
await page.getByRole('button', { name: 'Add to cart' }).first().click();
```

This is correct only when the requirement genuinely says “the first Add to cart button.” Otherwise it suppresses the ambiguity without explaining the target.

> **Interview answer: What is locator strictness?**
>
> “A locator may represent a set, but an operation that requires one target—such as `click`—fails when more than one element matches. Playwright refuses to guess. Collection operations such as `count` remain valid. I resolve a strictness failure by adding business identity through a name, scope, or filter, not by blindly using `first()`.”

---

## 5.5 Compose descriptions instead of building selector strings

The most maintainable locator code usually has two phases:

1. find the meaningful container; and
2. find the target inside it.

### Chaining creates scope

```ts
const cart = page.getByRole('region', { name: 'Shopping cart' });
await cart.getByRole('button', { name: 'Checkout' }).click();
```

The second query searches inside the region located by the first. The chain reads from context to action.

### Filter a collection by text

```ts
const keyboard = page
  .getByRole('article')
  .filter({ hasText: 'Wireless keyboard' });
```

Use a regular expression when the text includes variable values:

```ts
const order = page
  .getByRole('row')
  .filter({ hasText: /^QM-1042\s+Processing/ });
```

`hasNotText` excludes content:

```ts
const activeOrders = page
  .getByRole('row')
  .filter({ hasNotText: 'Cancelled' });
```

### Filter by a descendant locator

```ts
const editableOrder = page
  .getByRole('row')
  .filter({
    has: page.getByRole('button', { name: 'Edit' })
  });
```

The inner locator is evaluated relative to each candidate outer element. It does not mean “an Edit button anywhere on the page.” The inner locator must be in the same frame and must not contain a `FrameLocator`.

`hasNot` excludes candidates containing a descendant:

```ts
const unpaidOrder = page
  .getByRole('row')
  .filter({
    hasNot: page.getByText('Paid', { exact: true })
  });
```

### Combine locator conditions with `and`

```ts
const destructiveButton = page
  .getByRole('button')
  .and(page.getByTestId('delete-account'));
```

The result must satisfy both locators. This is useful when two independent contracts describe the same element.

### Represent alternatives with `or`

```ts
const nextAction = page
  .getByRole('button', { name: 'Continue' })
  .or(page.getByRole('button', { name: 'Resume checkout' }));
```

If both alternatives are present, a single-target action is still ambiguous. Use `.first()` only when either is acceptable and choosing the first is intentional, or handle the two states explicitly:

```ts
const resume = page.getByRole('button', { name: 'Resume checkout' });

if (await resume.isVisible()) {
  await resume.click();
} else {
  await page.getByRole('button', { name: 'Continue' }).click();
}
```

Do not use `or` to hide uncertainty about product state. If the state matters, assert it.

---

## 5.6 Lists, ordering, and legitimate indexing

Position is sometimes the requirement:

- open the newest notification;
- verify the first search result;
- check the last message in a conversation; or
- compare a sorted table in order.

In those cases, `.first()`, `.last()`, and `.nth()` are honest:

```ts
const results = page.getByRole('article');
await expect(results.first()).toContainText('Wireless keyboard');
await expect(results.last()).toContainText('USB-C cable');
```

When the requirement is “Invoice 1042,” position is not identity:

```ts
// Fragile: third row today may be another invoice tomorrow.
page.getByRole('row').nth(2);

// Durable: identifies the business record.
page.getByRole('row').filter({ hasText: 'Invoice 1042' });
```

### Assert collections as collections

Playwright assertions can verify ordered lists:

```ts
await expect(page.getByRole('listitem')).toHaveText([
  'Wireless keyboard',
  'Laptop stand',
  'USB-C cable'
]);
```

This assertion retries until the located list matches the expected array. It is usually better than reading text into an array and applying a non-retrying assertion.

### Be careful with `locator.all()`

`locator.all()` returns the locators currently present; it does not wait for a dynamic list to finish loading. If the list is still changing, the returned set can be incomplete.

First assert the stable state:

```ts
const products = page.getByRole('article');
await expect(products).toHaveCount(3);

for (const product of await products.all()) {
  await expect(product).toBeVisible();
}
```

The wait belongs to a meaningful condition—three products—not an arbitrary delay.

---

## 5.7 Frames are explicit locator scope

An iframe contains a separate document. A locator rooted at the main page does not search inside it.

```html
<iframe title="Secure payment"></iframe>
```

```ts
const payment = page.frameLocator('iframe[title="Secure payment"]');

await payment.getByLabel('Card number').fill('4111111111111111');
await payment.getByRole('button', { name: 'Pay' }).click();
```

The frame is part of the locator chain. There is no global “current frame” to switch into and later restore.

This differs from stateful Selenium code:

```java
driver.switchTo().frame("payment");
// interact
driver.switchTo().defaultContent();
```

Forgetting the switch back can make unrelated later locators fail. `FrameLocator` keeps frame scope local to the expression.

Frames can be nested:

```ts
const pay = page
  .frameLocator('#outer')
  .frameLocator('#payment')
  .getByRole('button', { name: 'Pay' });
```

The frame locator itself must be unambiguous. If several iframes match `iframe`, identify the correct one by title, test ID, URL-related attribute, or meaningful container.

---

## 5.8 Open shadow roots are pierced automatically

Modern web components often place implementation inside a shadow root:

```html
<product-card></product-card>
```

If the component uses an **open** shadow root, Playwright locators can generally reach inside without manual traversal:

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
```

CSS locators also pierce open shadow roots. Two limits matter:

- XPath does not pierce shadow roots.
- Closed shadow roots cannot be entered through ordinary page APIs.

If several components contain the same control, scope to the host or an identifying descendant:

```ts
const keyboardCard = page
  .locator('product-card')
  .filter({ hasText: 'Wireless keyboard' });

await keyboardCard.getByRole('button', { name: 'Add to cart' }).click();
```

Shadow DOM should not force XPath or JavaScript evaluation. Start with the same semantic locator strategy used elsewhere.

---

## 5.9 A systematic locator debugging workflow

Changing selectors at random destroys evidence. Diagnose in a fixed order.

### Step 1 — Classify the failure

Ask which category you have:

- **zero matches until timeout** — wrong scope, wrong identity, missing state, or element never appeared;
- **multiple matches** — the description is ambiguous;
- **matched but not actionable** — correct target, wrong UI state or obstruction;
- **assertion mismatch** — target was found, observed value did not reach the expected result.

Do not label all four “locator failures.” They require different fixes.

### Step 2 — Inspect the page at the failing moment

Open the trace and select the failed action. Inspect:

- DOM snapshot;
- action log;
- network activity;
- console messages;
- previous steps; and
- screenshots before and after the action.

The live page in a rerun may no longer match the failure. The trace preserves the useful moment.

### Step 3 — Measure the locator

Temporarily inspect the match count:

```ts
const target = page.getByRole('button', { name: 'Checkout' });
console.log('matches:', await target.count());
```

Use this for diagnosis, not as a substitute for a proper assertion.

### Step 4 — Verify role and accessible name

Use the locator picker, ARIA snapshot, or browser accessibility tools. Confirm what the platform computed rather than copying visible text by sight.

### Step 5 — Verify document scope

Check for:

- iframe boundaries;
- nested frames;
- a popup or new tab;
- a different page object; or
- a component inside a closed shadow root.

### Step 6 — Verify product state

If the locator matches but the element remains hidden, disabled, covered, or unstable, ask why. A missing API response or unfulfilled business prerequisite is not fixed by changing the selector.

Do not add `waitForTimeout(2000)`. An arbitrary delay makes a fast failure slow and a slow failure intermittent. Wait for an observable condition through an action, assertion, response, URL, or application signal.

### Step 7 — Improve the contract

If no stable user-facing fact identifies the element, ask the product team for a test ID. This is an engineering improvement, not an automation defeat.

---

## 5.10 Selenium-to-Playwright locator traps

### Trap 1: Translating every XPath character for character

A migration is an opportunity to express user intent. Converting:

```java
By.xpath("//div[@class='product'][3]//button")
```

into:

```ts
page.locator("xpath=//div[@class='product'][3]//button");
```

preserves the original fragility. Rewrite it:

```ts
page
  .getByRole('article')
  .filter({ hasText: 'Wireless keyboard' })
  .getByRole('button', { name: 'Add to cart' });
```

### Trap 2: Recreating PageFactory element fields

```ts
class CheckoutPage {
  readonly submit = this.page.getByRole('button', { name: 'Place order' });

  constructor(private readonly page: Page) {}
}
```

Storing a locator is fine because it is a lazy description. Storing an element handle during construction is not. The page-object design chapter will add behavior and boundaries; for now, keep locators descriptive and avoid eager lookups.

### Trap 3: Using `.nth()` because Selenium returned the first match

Strictness is telling you information is missing. Add business identity instead of restoring silent first-match behavior.

### Trap 4: Assuming a role locator is automatically accessible

An element may expose a role and name while still failing contrast, keyboard, focus-order, error-identification, or many other accessibility requirements. Role locators are feedback, not an audit.

### Trap 5: Assuming role names survive translation

The role survives; the accessible name may not. Make localization sensitivity an explicit design choice.

---

## 5.11 A locator review rubric

Score a proposed locator against five questions.

### 1. Identity

Does it identify the intended business object or control, not merely something in the same position?

### 2. Uniqueness

Would a single-target action resolve to exactly one element in every supported state?

### 3. Stability

Which harmless changes break it: class rename, wrapper, reorder, locale, experiment, or accessible-name improvement?

### 4. Observability

Does it protect a user-facing contract, an explicit test contract, or an incidental implementation detail?

### 5. Diagnosability

When it fails, will the error tell an investigator what target was intended?

Compare:

```ts
page.locator('.card:nth-child(3) .btn-primary');
```

with:

```ts
page
  .getByRole('article')
  .filter({ hasText: 'Wireless keyboard' })
  .getByRole('button', { name: 'Add to cart' });
```

The second carries business identity into the trace and error message. That diagnostic value matters at 2 a.m.

---

## 5.12 Interview corner

### 1. What is a locator?

“A locator is a description of elements on the page at a given moment. It is lazy and normally re-resolved for each action or assertion. It is central to Playwright's auto-waiting and retry behavior.”

### 2. What locator strategy do you use?

“I start from the contract. For interactive behavior, role and accessible name are usually strongest; labels for form controls; text for content; test IDs for explicit language-independent automation contracts; and CSS or XPath only when structure is genuinely the contract. I optimize for identity, stability, and useful failure messages—not a selector popularity ranking.”

### 3. Why can a visible button fail a role-and-name locator?

“The visible text may not be its computed accessible name, the implicit or explicit role may differ, it may be hidden from the accessibility model, or it may live in another frame. I inspect the ARIA snapshot or browser accessibility tools before changing the locator.”

### 4. Does strictness mean every locator must match one element?

“No. A locator can represent a collection. Strictness applies when an operation requires one target, such as `click`. List operations such as `count` and list assertions are valid on multiple matches.”

### 5. How do you select one of ten identical Delete buttons?

“I locate the business container—such as the row for Invoice 1042—then find Delete inside it. I use filtering and chaining instead of an index, unless the requirement is explicitly positional.”

### 6. When is `first()` acceptable?

“When first is part of the requirement, such as the first search result, or when either alternative is intentionally acceptable and the ordering contract is understood. It is not a generic fix for ambiguity.”

### 7. How are iframes different from shadow DOM?

“An iframe is another document, so I scope through `frameLocator`. The frame scope stays in the locator chain; there is no global switch-back state. Playwright locators generally pierce open shadow roots automatically, but XPath does not and closed roots remain inaccessible.”

### 8. Are test IDs good or bad?

“They are explicit contracts. They are excellent when semantics or text are unstable, repeated, or localized. They do not validate the user's perception, so I combine them with the right behavior assertions. The bad selector is the one whose contract does not match the risk.”

---

## 5.13 Exercises

1. Locate the same form field by label, placeholder, test ID, CSS attribute, and XPath. For each version, list the harmless product changes that would break it.
2. Create three product cards with identical Add to cart buttons. Trigger a strictness failure, then fix it with container filtering and chaining. Do not use an index.
3. Add `aria-label` and `aria-labelledby` variations to a search control. Inspect its ARIA snapshot and predict which role-and-name locator will match before running the test.
4. Build a list that loads asynchronously. Demonstrate why calling `locator.all()` before asserting the final count can return an incomplete set.
5. Put a button inside an iframe and another inside an open shadow root. Write the correct locator for each and explain the difference.
6. Run one scenario in English and French. Decide whether localized role names, translation data, or test IDs best match the purpose of that test.

---

## 5.14 Review checklist

Before approving locator code, ask:

- Does the locator describe a user-facing or explicit automation contract?
- Is the interactive target identified by role and name where appropriate?
- Does a form control have a label?
- Is localization sensitivity intentional?
- Could the locator match several elements in another valid state?
- Does filtering use business identity rather than DOM position?
- Is `.first()` or `.nth()` justified by the requirement?
- Is a frame boundary represented explicitly?
- Is CSS tied to stable state rather than styling?
- Has raw XPath preserved a Selenium-era implementation dependency?
- Would the failure message help another engineer identify the intended target?

---

## Source notes

Behavior in this chapter was checked against the Playwright 1.61 documentation:

- [Locators](https://playwright.dev/docs/locators)
- [Locator API](https://playwright.dev/docs/api/class-locator)
- [Locator assertions](https://playwright.dev/docs/api/class-locatorassertions)
- [Best practices](https://playwright.dev/docs/best-practices)
- [ARIA snapshots](https://playwright.dev/docs/aria-snapshots)
- [Accessibility testing](https://playwright.dev/docs/accessibility-testing)
- [Test generator and locator picker](https://playwright.dev/docs/codegen)

---

## What comes next

A locator describes the target. Chapter 6 explains what happens when you act on it.

You will learn actionability checks, clicking, filling, typing, selecting, checking, hovering, dragging, uploading, keyboard input, and the important boundary between Playwright's mechanical readiness and your application's business readiness.
