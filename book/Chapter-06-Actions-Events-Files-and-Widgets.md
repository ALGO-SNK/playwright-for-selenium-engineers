# Chapter 6 — Actions, Events, Files, and Difficult Widgets

Chapter 5 taught you to describe a target. This chapter is about expressing what the user intends to do with it.

The distinction between intent and mechanics is one of Playwright's most valuable design choices. A user wants a checkbox checked, not toggled. A user wants a country selected, not a particular `<li>` clicked. A user wants a file uploaded, not an operating-system dialog automated.

When the API can express that intent directly, use it. Low-level mouse coordinates, forced clicks, and JavaScript evaluation remain available, but each step downward gives up information and safety.

## What you will learn

By the end of this chapter, you will be able to:

- select the action that matches user intent;
- explain why different actions perform different readiness checks;
- distinguish mechanical actionability from application business readiness;
- use clicks, keyboard input, text entry, checkboxes, radios, and selects;
- handle hover, scrolling, drag-and-drop, and external data drops;
- upload files through inputs, in-memory buffers, and file chooser events;
- synchronize safely with dialogs, popups, pages, and downloads;
- interact with rich-text editors, date pickers, and canvas widgets;
- review `force`, `dispatchEvent`, `evaluate`, `page.mouse`, and `page.keyboard` as explicit exceptions; and
- answer common interaction interview questions with accurate Playwright 1.61 behavior.

---

## 6.1 Actions encode intent—and readiness is action-specific

Playwright auto-waits before many locator actions, but not every action performs the same checks.

For `locator.click()`, Playwright requires one matching element and waits for it to be:

- visible;
- stable;
- able to receive pointer events; and
- enabled.

For `locator.fill()`, stability is not part of the documented matrix. The element must be visible, receive events, be enabled, and be editable.

For `locator.hover()`, enabled and editable are irrelevant. For `locator.press()` and `locator.pressSequentially()`, the actionability matrix lists no visibility, stability, receives-events, enabled, or editable checks.

This matters because “Playwright waits automatically” is useful only when you can name what it waits for.

| Action | Key documented checks |
|---|---|
| `click`, `dblclick`, `check`, `uncheck`, `setChecked` | Visible, stable, receives events, enabled |
| `hover`, `dragTo` | Visible, stable, receives events |
| `fill`, `clear` | Visible, receives events, enabled, editable |
| `selectOption` | Visible, receives events, enabled |
| `scrollIntoViewIfNeeded` | Stable |
| `press`, `pressSequentially`, `setInputFiles`, `focus`, `dispatchEvent` | No checks in the documented actionability matrix |

Strict locator resolution still matters when an operation needs one element. Other implementation work may occur, but do not invent a universal five-check story.

Chapter 7 studies actionability and synchronization in depth. For now, keep two boundaries clear.

### Mechanical readiness is not business readiness

Suppose a checkout button becomes enabled before a new shipping quote returns:

```ts
await page.getByLabel('Delivery address').selectOption('office');
await page.getByRole('button', { name: 'Pay now' }).click();
```

The click can be mechanically valid while the application is still calculating the wrong total. Playwright can know whether the button receives pointer events. It cannot infer whether your product's quote is current.

The test needs a business signal:

```ts
const quoteUpdated = page.waitForResponse(response =>
  response.url().endsWith('/api/checkout/quote') && response.ok()
);

await page.getByLabel('Delivery address').selectOption('office');
await quoteUpdated;
await expect(page.getByTestId('order-total')).toHaveText('$42.00');
await page.getByRole('button', { name: 'Pay now' }).click();
```

Auto-waiting prevents premature mechanics. Assertions and explicit synchronization protect business state.

### Never replace a condition with a fixed delay

```ts
await page.waitForTimeout(3000);
```

This waits three seconds whether the application needs 30 milliseconds or 30 seconds. It is slow in the first case and insufficient in the second. Keep fixed sleeps for temporary debugging, not committed tests.

---

## 6.2 Clicking: normal, trial, and forced

The ordinary click should remain ordinary:

```ts
await page.getByRole('button', { name: 'Add to cart' }).click();
```

Playwright resolves the locator, waits for click actionability, scrolls the target into view if necessary, and clicks a visible point.

Useful variants include:

```ts
await locator.dblclick();
await locator.click({ button: 'right' });
await locator.click({ modifiers: ['Shift'] });
await locator.click({ modifiers: ['ControlOrMeta'] });
await locator.click({ position: { x: 24, y: 18 } });
```

`ControlOrMeta` maps to Control on Windows and Linux and Meta on macOS. Position-based clicking belongs to widgets where coordinates carry meaning—maps, canvases, image regions—not ordinary buttons.

### Trial mode checks readiness without the click

```ts
await page.getByRole('button', { name: 'Place order' })
  .click({ trial: true });
```

`trial: true` performs the actionability checks and skips the action. It can be useful when readiness itself is the condition being investigated.

Do not use a trial click followed immediately by a real click as a universal pattern. The real click performs its own checks, and the page can change between calls. Trial mode is a diagnostic or specialized synchronization tool, not required ceremony.

### `force` disables non-essential checks

```ts
await locator.click({ force: true });
```

The common explanation “force skips every check” is inaccurate. For supported actions, `force` disables non-essential actionability checks. For a forced click, Playwright does not require the target to receive click events in the normal way.

That is still a serious tradeoff. If a modal covers the button, the normal failure is valuable evidence. A forced click can bypass the warning while producing behavior no user could perform.

Require three things in review:

1. the failed actionability check is understood;
2. bypassing it matches the test's purpose; and
3. a comment explains why the exception remains safe.

Reasonable examples are rare: a deliberately invisible drag handle tested at a lower layer, or a third-party overlay that cannot be controlled and is outside the asserted contract. “The click was flaky” is not a justification.

> **Interview answer: What does `force: true` do?**
>
> “It disables non-essential actionability checks for actions that support it—for example, a forced click does not require the element to receive events normally. It is not a generic flake fix. I first identify the failed check and the product state causing it. I use force only when bypassing that check is the intentional contract, and I document the reason.”

---

## 6.3 Text entry: value intent versus keyboard behavior

### Use `fill` for a final value

```ts
await page.getByLabel('Email address').fill('buyer@example.test');
```

`fill()` focuses the control and sets its value, triggering an `input` event. It works with supported `<input>` elements, `<textarea>`, and `[contenteditable]` elements. It replaces the existing value, so a separate select-all and delete sequence is unnecessary.

Clear explicitly when the empty state is the behavior:

```ts
await page.getByLabel('Promo code').clear();
await expect(page.getByLabel('Promo code')).toHaveValue('');
```

### Use `pressSequentially` for per-key behavior

```ts
await page.getByRole('searchbox', { name: 'Search products' })
  .pressSequentially('wireless');
```

`pressSequentially()` sends keyboard events for each character. Use it when the application behavior depends on the sequence:

- input masks;
- autocomplete after each key;
- debounced search listeners;
- keyboard telemetry; or
- a component that deliberately handles key events instead of the final value.

It is slower and does not provide the same actionability checks as `fill()`. Do not choose it merely because character-by-character input feels more human.

The older `locator.type()` method is deprecated; use `pressSequentially()` when per-character input is required.

### Use `press` for one key or shortcut

```ts
const search = page.getByRole('searchbox', { name: 'Search products' });

await search.fill('wireless keyboard');
await search.press('Enter');
```

Other examples:

```ts
await editor.press('ControlOrMeta+A');
await editor.press('ControlOrMeta+B');
await menu.press('ArrowDown');
await menu.press('Escape');
```

Use `page.keyboard` when no meaningful element owns the interaction—for example, an application-wide shortcut or canvas tool. It is a low-level API and does not add locator actionability.

> **Interview answer: `fill` or `pressSequentially`?**
>
> “`fill` expresses the desired value and is my default. It replaces the value and triggers input behavior efficiently. `pressSequentially` emits per-character keyboard events, so I reserve it for behavior that depends on the sequence, such as a mask or autocomplete. It is not automatically more realistic, and its actionability profile differs from `fill`.”

---

## 6.4 Checkboxes, radios, and switches: guarantee state

A click toggles. Tests usually need a final state.

```ts
await page.getByLabel('Gift wrap').check();
await page.getByLabel('Marketing email').uncheck();
await page.getByLabel('Express shipping').check();
```

`check()` is idempotent: if the checkbox or radio is already checked, it leaves it checked. `uncheck()` does the corresponding job for checkboxes. `setChecked()` expresses a computed target state:

```ts
await page.getByLabel('Marketing email').setChecked(wantsMarketing);
```

Pair the action with a business-relevant assertion when state persistence matters:

```ts
await page.getByLabel('Gift wrap').check();
await expect(page.getByLabel('Gift wrap')).toBeChecked();
await expect(page.getByTestId('order-total')).toHaveText('$45.00');
```

The first assertion verifies control state. The second verifies the pricing behavior protected by the scenario.

Custom switches deserve inspection. A properly implemented switch may expose `role="switch"` and `aria-checked`, but it may not be a native checkbox. `check()` supports checkbox and radio inputs; for a custom switch, click the switch and assert its accessible state:

```ts
const notifications = page.getByRole('switch', { name: 'Notifications' });
await notifications.click();
await expect(notifications).toHaveAttribute('aria-checked', 'true');
```

---

## 6.5 Native selects and custom listboxes are different widgets

### Native `<select>`

```ts
await page.getByLabel('Sort products')
  .selectOption({ label: 'Price: low to high' });
```

You can select by value, label, or index:

```ts
await select.selectOption('price-asc');
await select.selectOption({ label: 'Price: low to high' });
await select.selectOption({ index: 2 });
```

Prefer the property that represents the contract. A label is user-facing but localized; a stable value may be the better contract for a language-independent configuration test.

For a multiple select:

```ts
await page.getByLabel('Categories')
  .selectOption(['keyboards', 'accessories']);
```

### Custom dropdown or combobox

A design-system dropdown may be a button plus popup listbox, not a `<select>`. `selectOption()` is not applicable.

```ts
await page.getByRole('combobox', { name: 'Country' }).click();
await page.getByRole('option', { name: 'India' }).click();
```

For an editable combobox:

```ts
const country = page.getByRole('combobox', { name: 'Country' });
await country.fill('Ind');
await page.getByRole('option', { name: 'India' }).click();
```

Inspect semantics before choosing the action. A visual resemblance to a dropdown does not determine the DOM contract.

---

## 6.6 Hover, focus, and scrolling

### Hover to reveal behavior

```ts
const account = page.getByRole('menuitem', { name: 'Account' });
await account.hover();
await page.getByRole('menuitem', { name: 'Sign out' }).click();
```

Assert the revealed state when it matters:

```ts
await account.hover();
await expect(page.getByRole('menu', { name: 'Account actions' }))
  .toBeVisible();
```

If a hover menu closes while the pointer moves, scope the submenu to the menu container and inspect the trace. Do not solve every hover problem with raw coordinates.

### Focus is an explicit event tool

```ts
await page.getByLabel('Password').focus();
await expect(page.getByTestId('password-help')).toBeVisible();
```

`focus()` is useful when focus behavior itself is under test. Ordinary actions focus controls as needed.

### Actions normally scroll automatically

Playwright scrolls targets into view before applicable pointer actions. Manual scrolling is usually needed only when scrolling is the behavior:

```ts
await page.getByTestId('load-more-sentinel').scrollIntoViewIfNeeded();
await expect(page.getByRole('article')).toHaveCount(40);
```

For a scrollable container or wheel-driven component:

```ts
await page.getByTestId('results-panel').hover();
await page.mouse.wheel(0, 600);
```

The assertion should describe what the scroll caused, not merely that the wheel event was sent.

---

## 6.7 Drag elements and drop external data

Two APIs solve different problems.

### `dragTo` moves one page element to another

```ts
const card = page.getByRole('article', { name: 'Invoice 1042' });
const done = page.getByRole('region', { name: 'Done' });

await card.dragTo(done);
await expect(done.getByRole('article', { name: 'Invoice 1042' }))
  .toBeVisible();
```

`dragTo()` performs hover, mouse down, movement, and mouse up. It supports source and target positions and a `steps` option for widgets that depend on intermediate movement.

Use raw mouse input only when the component requires a sequence `dragTo()` cannot represent:

```ts
await source.hover();
await page.mouse.down();
await target.hover();
await target.hover(); // second movement can be required for dragover
await page.mouse.up();
```

Low-level movement is viewport-dependent and has no locator actionability once the raw mouse takes over. Keep the sequence short and verify the resulting state.

### `drop` simulates external files or clipboard-like data

Playwright 1.60 added `locator.drop()`. It dispatches drag-enter, drag-over, and drop events using a `DataTransfer` populated with files, data, or both.

Drop an in-memory file:

```ts
await page.getByTestId('upload-zone').drop({
  files: {
    name: 'invoice.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('id,total\nQM-1042,42.00')
  }
});
```

Drop clipboard-like content:

```ts
await page.getByTestId('drop-target').drop({
  data: {
    'text/plain': 'QualityMart',
    'text/uri-list': 'https://qualitymart.test'
  }
});
```

The drop target must accept the drag by preventing the default `dragover` behavior. If it rejects the drop, Playwright emits `dragleave` and throws.

Use `setInputFiles()` when the product contract is a file input, even if the visual component looks like a drop zone. Use `drop()` when external drag-and-drop events are the behavior being tested.

---

## 6.8 File inputs and file chooser events

### Set files directly on the input

```ts
await page.getByLabel('Upload invoice').setInputFiles(
  path.resolve('tests/fixtures/invoice.pdf')
);
```

Relative paths are resolved from the current working directory, which can surprise tests run from different locations. Use a path anchored to a known repository or module location.

Multiple files:

```ts
await page.getByLabel('Upload evidence').setInputFiles([
  path.resolve('tests/fixtures/photo.png'),
  path.resolve('tests/fixtures/receipt.pdf')
]);
```

Generate a file in memory:

```ts
await page.getByLabel('Upload catalog').setInputFiles({
  name: 'catalog.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('sku,name\nKB-01,Wireless keyboard')
});
```

Clear the selection:

```ts
await page.getByLabel('Upload catalog').setInputFiles([]);
```

`setInputFiles()` targets `<input type="file">` and does not require the visible operating-system chooser. It can work with the hidden input behind a styled upload button.

### Catch a dynamically created file chooser

If the file input is created only when the user clicks:

```ts
const chooserPromise = page.waitForEvent('filechooser');
await page.getByRole('button', { name: 'Choose invoice' }).click();
const chooser = await chooserPromise;

await chooser.setFiles(path.resolve('tests/fixtures/invoice.pdf'));
```

Start waiting before the action. Browser events can happen immediately; waiting afterward can miss them.

---

## 6.9 Event-first synchronization: dialogs, popups, and downloads

The reusable pattern is:

1. create the event promise or handler;
2. perform the action that may emit the event; and
3. await or resolve the event.

### Dialogs

Playwright auto-dismisses JavaScript dialogs when no listener is registered. To inspect or accept one, register a handler first:

```ts
page.once('dialog', async dialog => {
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toBe('Delete order QM-1042?');
  await dialog.accept();
});

await page.getByRole('button', { name: 'Delete order' }).click();
```

Use `page.once` for a one-off dialog. Use `page.on` only when repeated dialogs are part of the test, and remove long-lived listeners when their scope ends.

Once a listener takes responsibility, it must accept or dismiss the dialog. An unresolved dialog blocks the page and can make the triggering action time out.

Prompts accept text:

```ts
page.once('dialog', async dialog => {
  await dialog.accept('QM-1042');
});
```

### Popups and new tabs

```ts
const popupPromise = page.waitForEvent('popup');
await page.getByRole('link', { name: 'Open invoice' }).click();
const invoicePage = await popupPromise;

await expect(invoicePage.getByRole('heading', { name: 'Invoice QM-1042' }))
  .toBeVisible();
await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
```

Both `Page` objects remain usable. There is no global current-window handle to switch and restore.

Use `context.waitForEvent('page')` when the new page is not clearly a popup of one existing page.

### Downloads

```ts
const downloadPromise = page.waitForEvent('download');
await page.getByRole('link', { name: 'Export CSV' }).click();
const download = await downloadPromise;

expect(download.suggestedFilename()).toBe('orders.csv');
await download.saveAs(testInfo.outputPath('orders.csv'));
```

Downloads live in temporary storage associated with the browser context. Save the file when the test or report needs it after that lifecycle. Validate contents, not only the filename, when the export data is the protected behavior.

> **Interview answer: Why start the event wait before the click?**
>
> “The event can be emitted as part of the click. If I click first and subscribe later, I can miss it. I create the promise or handler without awaiting it, perform the trigger, then await the captured event. The same event-first pattern applies to popups, downloads, and file choosers.”

---

## 6.10 Difficult widgets

### Native and custom date pickers

A native date input accepts an ISO date value:

```ts
await page.getByLabel('Delivery date').fill('2026-08-15');
```

A custom calendar must be driven through its exposed controls:

```ts
await page.getByRole('button', { name: 'Choose delivery date' }).click();
await page.getByRole('gridcell', { name: '15 August 2026' }).click();
```

Do not locate a day only by `15`; adjacent months and repeated calendars may contain several. Prefer a complete accessible date name or scope to the visible month.

For dates far from the current month, compute navigation from the calendar's displayed month. Avoid “click next three times,” which becomes wrong as time passes.

### Rich-text editors

Many editors expose a `[contenteditable]` element with a textbox role:

```ts
const editor = page.getByRole('textbox', { name: 'Order notes' });
await editor.fill('Leave the package at reception.');
```

If the editor lives in an iframe:

```ts
const editor = page
  .frameLocator('iframe[title="Order notes"]')
  .getByRole('textbox');

await editor.fill('Leave the package at reception.');
```

Use keyboard shortcuts when formatting behavior is under test:

```ts
await editor.fill('Urgent');
await editor.press('ControlOrMeta+A');
await editor.press('ControlOrMeta+B');
```

### Canvas and coordinate-driven widgets

A canvas is one DOM element; its painted contents do not provide ordinary locators. Interact with coordinates relative to its bounding box:

```ts
const canvas = page.getByTestId('signature-pad');
const box = await canvas.boundingBox();

if (!box) throw new Error('Signature pad has no visible bounding box');

await page.mouse.move(box.x + 40, box.y + 40);
await page.mouse.down();
await page.mouse.move(box.x + 180, box.y + 90, { steps: 8 });
await page.mouse.up();
```

Verification needs another observation surface:

- compare a focused screenshot in a controlled rendering environment;
- assert the saved drawing model through an API; or
- inspect an application-owned state signal.

“I sent mouse events” is not an outcome assertion.

---

## 6.11 JavaScript evaluation and synthetic events

`page.evaluate()` runs code in the browser page context:

```ts
const theme = await page.evaluate(() => localStorage.getItem('theme'));
expect(theme).toBe('dark');
```

Locator-scoped evaluation receives the matched element:

```ts
const color = await page.getByTestId('order-total')
  .evaluate(element => getComputedStyle(element).color);
```

Use evaluation to read page-owned state or exercise a deliberately programmatic API. Do not use it as a shortcut around failed user interactions:

```ts
// Avoid as a replacement for locator.click().
await page.evaluate(() => {
  document.querySelector<HTMLButtonElement>('#pay')?.click();
});
```

This bypasses locator actionability and produces programmatic behavior. It may click a hidden or covered element that a user cannot reach.

`locator.dispatchEvent()` similarly dispatches an event without the actionability checks listed for user input:

```ts
await page.getByTestId('integration-hook').dispatchEvent('custom-ready');
```

That can be correct in component or integration tests where the event itself is the public contract. It is a poor imitation of a real click.

### Exception hierarchy

Prefer, in order:

1. intent-revealing locator action;
2. locator action with justified options;
3. high-level page or event API;
4. low-level mouse or keyboard input;
5. `dispatchEvent` or `evaluate` for a deliberate programmatic contract.

The further you descend, the more setup, synchronization, and verification you own.

---

## 6.12 A complete interaction example

```ts
test('buyer uploads a purchase order and completes checkout', async ({ page }) => {
  await page.goto('/checkout');

  await test.step('Configure the order', async () => {
    await page.getByLabel('Gift wrap').check();
    await page.getByLabel('Shipping speed')
      .selectOption({ label: 'Express' });
    await page.getByLabel('Order notes')
      .fill('Deliver before 5 PM');
  });

  await test.step('Attach the purchase order', async () => {
    await page.getByLabel('Purchase order').setInputFiles({
      name: 'po-1042.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('PO 1042\nApproved')
    });

    await expect(page.getByTestId('attachment-name'))
      .toHaveText('po-1042.txt');
  });

  await test.step('Submit and verify', async () => {
    const orderCreated = page.waitForResponse(response =>
      response.url().endsWith('/api/orders') &&
      response.request().method() === 'POST' &&
      response.ok()
    );

    await page.getByRole('button', { name: 'Place order' }).click();
    await orderCreated;

    await expect(page.getByRole('heading', { name: 'Order confirmed' }))
      .toBeVisible();
  });
});
```

Notice the division of responsibility:

- intent-specific actions configure controls;
- `setInputFiles` avoids the operating-system picker;
- the network promise captures the business event before the trigger; and
- the final assertion verifies a user-visible result.

No forced action or fixed delay is needed.

---

## 6.13 Selenium-to-Playwright interaction traps

### Trap 1: Rebuilding `elementToBeClickable`

Do not wrap every click with a visibility and enabled wait. `locator.click()` already owns its documented actionability. Add synchronization only for a condition the action cannot infer.

### Trap 2: Clicking checkboxes

`click()` toggles. Use `check`, `uncheck`, or `setChecked` to guarantee the desired state.

### Trap 3: Treating every dropdown as `Select`

`selectOption` is for native `<select>`. Custom comboboxes and listboxes need user-facing interactions.

### Trap 4: Automating native file dialogs

Set files on the input or capture the file chooser event. Do not add desktop automation to a browser suite for ordinary uploads.

### Trap 5: Porting `JavascriptExecutor` fixes

JavaScript clicks often concealed Selenium synchronization or overlay problems. Translate the behavior, not the workaround.

### Trap 6: Global window and frame switching

Playwright gives frames through locator scope and new tabs as `Page` objects. Keep references to the objects you need; do not invent a current-window manager.

---

## 6.14 Interview corner

### 1. Do all Playwright actions run the same actionability checks?

“No. Checks are action-specific. Click waits for visible, stable, receives-events, and enabled. Fill needs visible, receives-events, enabled, and editable but not stability in the documented matrix. Press and setInputFiles list no actionability checks there. I use the current matrix rather than saying every action performs five universal checks.”

### 2. Why use `check()` instead of clicking a checkbox?

“Click toggles and depends on the starting state. Check is idempotent and guarantees the final checked state. I then assert the business outcome if checking changes pricing or permissions.”

### 3. How do native and custom dropdowns differ?

“A native `<select>` uses `selectOption`. A custom dropdown is ordinary interactive DOM, ideally a combobox and listbox with options, so I open it and choose an option. I inspect semantics instead of relying on appearance.”

### 4. How do you upload a file?

“I use `setInputFiles` on the file input, with paths or an in-memory buffer. For a dynamically created input, I start waiting for `filechooser` before the click and set files on the captured chooser. I never automate the OS picker for a normal browser test.”

### 5. What is the difference between `dragTo()` and `drop()`?

“`dragTo` moves one page element to another through mouse-style dragging. `drop`, added in 1.60, simulates external files or clipboard-like data with a `DataTransfer` and drag events. I use the one matching the product contract.”

### 6. What is the risk of a dialog listener?

“Without a listener, Playwright auto-dismisses dialogs. Once my listener handles the event, it must accept or dismiss it. Leaving the dialog unresolved blocks the page and stalls the triggering action.”

### 7. When is raw mouse input appropriate?

“For coordinate-driven surfaces such as canvas, or a custom drag interaction the high-level API cannot represent. I compute coordinates relative to a bounding box and verify a real outcome. I do not use raw coordinates for normal DOM controls.”

### 8. When would you use `evaluate`?

“To read page-context state or invoke a deliberate programmatic contract. I avoid using it to imitate normal clicks and fills because it bypasses locator actionability and can exercise behavior a user cannot perform.”

---

## 6.15 Exercises

1. Build a form with text, checkbox, radio, native select, and custom combobox controls. Use the most intent-specific action for each and assert final business state.
2. Create an autocomplete field. Compare `fill()` with `pressSequentially()` and record which browser events the component receives.
3. Implement a drag zone that accepts a text file. Test the hidden input path with `setInputFiles()` and the true external-drop path with `locator.drop()`.
4. Trigger a confirm dialog, popup, file chooser, and download. Use event-first synchronization for each without fixed delays.
5. Create a native date input and a custom calendar. Fill the native input with ISO format and select a fully identified date from the custom widget.
6. Draw on a canvas with coordinates relative to its bounding box. Propose both a visual and a state-based verification strategy.
7. Add an overlay over a button. Observe the normal click failure, diagnose the receives-events problem, then remove the overlay through the user flow. Compare that with a forced click and explain which test protects real behavior.

---

## 6.16 Review checklist

Before approving interaction code, ask:

- Does the API express the intended final state?
- Is the action's actual readiness profile understood?
- Is a business condition being confused with mechanical actionability?
- Is `fill` used unless per-key behavior matters?
- Are checkboxes guaranteed with `check` or `setChecked`?
- Is a native select distinguished from a custom widget?
- Does event waiting start before the trigger?
- Does every dialog handler resolve the dialog?
- Are file paths stable, or can an in-memory buffer remove filesystem dependence?
- Is `drop` being used only for genuine external drag data?
- Is `force` justified and documented?
- Could a high-level locator action replace raw mouse, keyboard, dispatch, or evaluation?
- Does the test assert an outcome rather than only sending input?

---

## Source notes

Behavior in this chapter was checked against the Playwright 1.61 documentation:

- [Actions](https://playwright.dev/docs/input)
- [Auto-waiting and actionability](https://playwright.dev/docs/actionability)
- [Locator API, including `dragTo` and `drop`](https://playwright.dev/docs/api/class-locator)
- [Dialogs](https://playwright.dev/docs/dialogs)
- [Pages and popups](https://playwright.dev/docs/pages)
- [Downloads](https://playwright.dev/docs/downloads)
- [Events](https://playwright.dev/docs/events)
- [Evaluating JavaScript](https://playwright.dev/docs/evaluating)

---

## What comes next

You can now express the user's action precisely. Chapter 7 examines the races around that action.

You will learn the complete actionability model, navigation and network synchronization, assertion retrying, `waitForResponse`, load states, `expect.poll`, `expect.toPass`, timeout budgets, and the diagnostic question that matters most: exactly which condition are we waiting for?
