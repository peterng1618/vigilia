# Task 1 report — the canvas context menu surface

Status: **DONE** (one brief-level concern, recorded below; no scope change).

Base sha `f783a6d1a60fdaec272ea938fab83babe6228251`.

## What changed and why

| Path | Change |
|---|---|
| `src/web/packages/editor/src/editor-shell/canvas-context-menu.tsx` | New. The menu surface, ~137 lines. |
| `src/web/packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx` | New. Four DOM tests. |
| `src/web/packages/editor/src/editor-shell/shell-layout.tsx` | Mounted `<CanvasContextMenu bridge={store.bridge} />` inside `<main id="stage">`, after the readout. |
| `src/web/packages/editor/src/ui-copy.ts` | `canvasMenu: { label: "Canvas actions" }`. Entry labels reuse the registry's own labels and `chartFamilies` — no new entry copy. |
| `src/web/tests/e2e/editor.spec.ts` | New test `captures the canvas context menu over a selected object` (line 2175). |
| `docs/evidence/screenshots/README.md` | `editor-canvas-context-menu` appended to the existing `Editor mechanics` row (line 34). |
| `docs/evidence/screenshots/editor-canvas-context-menu-desktop-chromium.png` | New capture. |

The brief's Mechanism block held as measured fact and I followed it: no
`ContextMenu.Trigger` anywhere, a controlled `ContextMenu.Root` (`open` /
`onOpenChange`) fed by a listener on the Fabric canvas's own `upperCanvasEl`,
`findTarget(event)` deciding the menu kind, and the hit selected before opening.
`event.preventDefault()` is inside that one canvas listener, so no other surface
in the editor loses its native menu.

Object entries are `OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id))`
— literally the dock's expression, so the two surfaces cannot disagree.
`arrangeActions()` is never called. Creation entries route through
`bridge.session` and never touch `OBJECT_ACTIONS`.

The DOM test queries `document.body`, not the render host, as the brief says.

## Commands run, with output

All from `src/web/` unless noted.

```
npx vitest run packages/editor/src/editor-shell/canvas-context-menu.dom.test.tsx
  Test Files  1 passed (1)
       Tests  4 passed (4)
    Duration  3.60s

npx vitest run packages/editor/src/editor-shell/
  Test Files  8 passed (8)
       Tests  72 passed (72)

npm run typecheck     # clean, all seven packages
npm run lint          # Checked 335 files. No fixes applied.
npm run format:check  # Checked 335 files. No fixes applied.

VIGILIA_CAPTURE=1 npx playwright test tests/e2e/editor.spec.ts \
  --project=desktop-chromium --workers=1 \
  -g "captures the canvas context menu over a selected object"
  1 passed (5.7s)
```

The browser run's true counts: **one** test, in the `desktop-chromium` project
only (the other projects skip it), **1 passed / 0 failed**. That run was repeated
after the final formatting edits and passed again.

## How I know the DOM tests would fail if the behaviour broke

I edited the component to break one thing at a time, ran the suite, and restored
from a copy. Four counterfactuals, each actually executed:

| Break | Actually-observed failure |
|---|---|
| Drop `canvas.setActiveObject(target)` | `expected "vi.fn()" to be called with arguments: [ {} ] / Number of calls: 0` at the `setActiveObject` assertion. All four tests failed. |
| Drop the `actionEnabled` filter | `expected [ 'Duplicate', 'Copy', 'Cut', …(9) ] to deeply equal [ 'Duplicate', 'Copy', 'Cut', …(6) ]` — 12 entries against the 7 the registry declares eligible. |
| Drop `event.preventDefault()` | `expected false to be true // Object.is equality` at the `defaultPrevented` assertion. |
| Use object entries on empty canvas | `expected [] to deeply equal [ Array(5) ]` — five creation labels vs none, because no action is eligible for a `none` target. |

The first assertion's *expected* value is derived from `action.eligible(CHART_TARGET)`,
the registry's own predicate, not from `actionEnabled` — the function the menu
itself calls — so the assertion cannot be satisfied by construction. It also
asserts `expected.length > 0`, so a menu that rendered nothing fails.

## The measured mechanism defect (worth propagating)

The brief's `setTimeout(() => …, 0)` / macrotask flush advice is right but
insufficient, and following the brief literally produced a **157-second suite of
four timeouts**, not a slow suite. I measured the cause rather than guessing.

`@floating-ui/dom`'s `isTopLayer()` calls `element.matches(':popover-open')` and
`element.matches(':modal')` while positioning. jsdom's nwsapi selector engine
cannot answer either, and each unanswerable call costs **~0.45–1.05 s** of
selector parsing. Measured counts from one menu open: `matches` entered ~72
million times, `:modal` alone accounting for ~25 s. All four spellings are
affected equally — bare `Menu.Root`, `ContextMenu.Root` without an anchor,
with a zero-size virtual anchor, and with an element anchor each stalled 30–39 s
per open. It is Base UI + jsdom + floating-ui, not this component.

The fix in the test file is nine lines and is a correction of a jsdom
incompleteness, not a hack:

```ts
beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(
    function (this: Element, selector: string): boolean {
      if (selector === ":modal" || selector === ":popover-open") return false;
      return matches.call(this, selector);
    },
    matches,
  );
});
```

Result: 35,600 ms → 205 ms per open, whole suite 157 s of timeouts → 3.6 s green.
`pretendToBeVisual: false` was tested as an alternative and rejected: it removes
the stall by removing `requestAnimationFrame`, and the popup then never renders
at all. **Any future jsdom test that opens a Base UI popup will hit this**; the
stub belongs wherever such tests live.

## Arrow keys and Escape (the added scope)

Answer: **Base UI already stops the arrow key; no code change was made, and
`ShortcutManager` is untouched.**

`PRODUCT_SHORTCUTS` binds bare `arrowdown` to `canvas.nudge-down`, and
`ShortcutManager.#onKeyDown` never consults `event.defaultPrevented`. So the
risk the coordinator described was real in principle. I measured it in the
browser, in the test above, on a selected `load-gauge` with the menu open:

* ArrowDown while the menu is open — the object did **not** move, and the menu
  stayed open with a visible item. Base UI's list navigation takes the key.
* Escape — the menu closed (`await expect(menu).toBeHidden()` passes), and the
  object's position was unchanged.

I added a **control** to that same test, because "did not move" is worthless
without it: after Escape, with no menu open, ArrowDown is pressed again and the
test asserts the object *does* move. It does. So the nudge machinery is live and
the menu is what stops it — not a broken shortcut.

One correction to my own first attempt at this measurement, since it is the kind
of thing that produces a vacuous pass: I initially read only `left`. `nudge-down`
moves `top`, so that assertion would have reported "did not move" whether or not
the nudge ran. The measurement now reads both axes. The browser test asserts the
non-movement explicitly, and the comment says it is recorded evidence rather
than a requirement.

Verified at the source level too: `useListNavigation` calls `stopEvent`
(preventDefault + stopPropagation) for main-orientation keys, and `useDismiss`
does the same for Escape when `escapeKeyBubbles` is false (the default). Since
the browser agrees, no guard was added — adding one would have been a second
owner for a key nobody was stealing.

## The capture

`editor-canvas-context-menu-desktop-chromium.png`, 220,369 bytes, inspected by
eye. It shows the editor with `load-gauge` selected, the dock visible at the
canvas bottom, and the context menu open at the gesture point listing Duplicate,
Copy, Cut, Bring to front, Bring forward, Send backward, Send to back, Lock,
Delete — nine entries, matching the dock and containing no `Align left`. The
capture is taken **after** the assertions that the menu is visible and that its
entry set equals the dock's. I did not have a way to witness that the older
`await page.keyboard.press("Enter")` variant of the test *would* have captured an
unopened menu, so that statement is by construction, not by measurement.

Staged by explicit path only. `docs/evidence/screenshots` was **not** staged as a
directory; only my own PNG by name, plus the README whose row I appended.

## Not verified / open

* The `:modal`/`:popover-open` stub is a jsdom fidelity gap, not a product
  behaviour. Chromium answers both selectors, so nothing in the browser test
  depends on the stub.
* The capture is one screenshot on one platform (Chromium, 1280×720) and is
  evidence, not a golden file.
* I did not run the full `npm test` sweep or `test:e2e` suite — only the focused
  DOM file, the whole `editor-shell/` directory, and the one browser test. The
  dispatch asked for focused proof during implementation.
* `docs/evidence/screenshots` holds one file modified by another task
  (`README.md` was mine to change; the PNG I added is mine). I staged no other
  task's PNG.

## Concern about the brief

The Mechanism block states the DOM test must flush with a 0 ms timeout and
queries `document.body`. Both are correct. What it does not carry is that opening
a Base UI popup in jsdom stalls ~35 s per open, which is why the brief's own
acceptance criteria cannot be met with the flush alone — the tests time out
rather than fail. That is a gap in the brief's measured facts, not a disagreement
with them, and it is now recorded above so the next person writing a jsdom popup
test does not rediscover it.

## Fix round 1

Base `391f18c`. Only `src/web/tests/e2e/editor.spec.ts` was edited; the component,
its DOM test and everything else are untouched.

### Measured values (not assumed)

I forced a failing assertion that printed the real numbers, ran it in the browser,
and read the diff out of the JSON reporter:

```
-  "before": null,
-  "nudged": null,
+  "before": Object { "left": 432, "top": 418 },
+  "nudged": Object { "left": 432, "top": 419 },
```

So the delta is exactly `(0, +1)`, which agrees with the derivation from
`NUDGE_STEP = 1` (`canvas-nudge.ts:8`) and `nudgeBy(0, stepFor(event))`
(`editor-session.ts:355-357`). `left` is untouched, as the centre-origin write
predicts. **The coordinator's predicted `+1` is confirmed by measurement.**

### The assertion written

```ts
await page.keyboard.press("ArrowDown");
const nudged = await activePosition();
expect(nudged).toEqual({ left: before.left, top: before.top + 1 });
```

`activePosition()` now throws when `getActiveObject()` is undefined or either
field is missing, instead of returning `{left: null, top: null}`. That is the
defect the review found: with nulls, a lost selection made `not.toEqual(before)`
true and the control passed over a dead nudge. It now returns `{left: number;
top: number}`, so a lost selection is a loud failure, not a silent pass.

### Counterfactual

I made the nudge dead for the control's duration by replacing the
`canvas.nudge-down` registration in `editor-session.ts` with an empty handler,
rebuilt, and ran the case. Observed failure:

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "left": 432,
-   "top": 419,
+   "top": 418,
  }
```

An exact-value mismatch, not a timeout and not a null-vs-object comparison. Then
reverted (`git diff --stat` clean) and rebuilt; the case passes again.

Note on method, because I nearly recorded a false green: the first counterfactual
run **passed** with the break in source. Playwright previews the built bundle, so
the source edit had not reached the browser. `npm run build` before re-running is
what made the break visible. Rebuilding after reverting is the matching step.

### The redundant `moved` key

Dropped. `moved: JSON.stringify(before) !== JSON.stringify(after)` asserted
exactly what the `after: before` key beside it already asserted. The block is now
two focused assertions with no restatement:

```ts
// The requirement this task exists to prove: with the menu open, the arrow
// reaches no canvas owner, so the selection does not move at all.
expect(after).toEqual(before);
```

The misleading comment — "Recorded as evidence, not as a requirement" — is gone.
It now says what the code does: this is the requirement that an open menu blocks
the arrow, and the control below is what stops "it did not move" from being
vacuous.

### Fix 3 — rejected, no action

I agree with the rejection and took no action. `aria-label` *replaces* an
element's text content in accessible-name computation rather than being appended
to it, so `ContextMenu.Item` with both a label and children yields one name, not
two. Those labels are also the stable handle the DOM test and the e2e query both
select by ("Duplicate", "Gauge"); removing them would force both tests onto text
matching and make the entry-set comparison weaker, not stronger. Recorded here so
the reviewer sees it was considered rather than missed.

### Verification this round

```
npx playwright test tests/e2e/editor.spec.ts --project=desktop-chromium --workers=1 \
  -g "captures the canvas context menu over a selected object"
  1 passed (5.2s)
npm run format:check  # Checked 335 files. No fixes applied.
npm run lint          # Checked 335 files. No fixes applied.
npm run typecheck     # clean
```

The broad `npm test` / `test:e2e` gates were not run — per `AGENTS.md`, focused
proof during implementation, and the broad gate belongs to the plan boundary.

One cleanup worth noting: my first JSON-reporter invocation used a relative
`--output` path and Playwright created `src/web/.pw.json/` inside the repo. I
removed it; `git status` shows only `src/web/tests/e2e/editor.spec.ts` modified.
