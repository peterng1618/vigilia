### Task 6: Keyboard nudge and z-order

**Files:**
- Modify: `src/web/packages/editor/src/shortcut-manager/index.ts`
- Modify: `src/web/packages/editor/src/shortcut-manager/index.dom.test.ts`
- Modify: `src/web/packages/editor/src/editor-session.ts`
- Modify: `src/web/packages/editor/src/history-manager/index.test.ts`
- Modify: `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `EditorInteraction` (`layerManager`, `historyManager`).
- Produces: new `ProductShortcutId` members `"canvas.nudge-left" | "canvas.nudge-right" | "canvas.nudge-up" | "canvas.nudge-down" | "canvas.select-all" | "canvas.front" | "canvas.back"`.

- [ ] **Step 1: Write the failing test**

```ts
it("nudges on an arrow key and defers to a text field", () => {
  const manager = new ShortcutManager();
  const nudge = vi.fn();
  manager.register("canvas.nudge-left", nudge);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  expect(nudge).toHaveBeenCalledTimes(1);

  // Dispatched ON the input, not on `window`. `window.dispatchEvent` sets the
  // event's `target` to `window` itself, so `isTextEntryTarget(event.target)`
  // reads the window and the nudge fires a second time — the assertion below
  // could never hold, whatever the binding did. `bubbles: true` is what carries
  // it up to the window listener; this is the idiom every existing deferral
  // test in this file already uses (`:42`, `:61`, `:109`, `:139`).
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  input.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
  );
  expect(nudge).toHaveBeenCalledTimes(1);
  input.remove();
  manager.destroy();
});

it("routes both plain and shift+arrow to the same action", () => {
  const manager = new ShortcutManager();
  const nudge = vi.fn();
  // One id, one handler: the large step is the handler reading event.shiftKey,
  // not a second action id. `ShortcutHandler` takes no argument today, so the
  // shift step is the handler's own concern — Step 5 proves it in the browser.
  // The Produces union above is the authority on which ids exist.
  manager.register("canvas.nudge-left", nudge);

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", shiftKey: true }),
  );
  expect(nudge).toHaveBeenCalledTimes(2);
  manager.destroy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run packages/editor/src/shortcut-manager/index.dom.test.ts`
Expected: FAIL — `canvas.nudge-left` is not a known action.

- [ ] **Step 3: Add the bindings**

**The `key` field is lower-case, and this is the step most likely to fail silently.** `bindingFor` lower-cases the event key and compares it to `binding.key` with `===` (`shortcut-manager/index.ts:40-47`), so every existing entry is lower-case (`"n"`, `"delete"`, `"backspace"`, `:24-35`). Write the arrow bindings as `"arrowleft"`, `"arrowright"`, `"arrowup"`, `"arrowdown"` — a binding written `"ArrowLeft"` matches nothing, and Task 3's browser test would have been the only thing to notice.

`]` and `[` have no case, so `"mod+]"`/`"mod+["` are written `{ key: "]", modifier: true, ... }` and `{ key: "[", modifier: true, ... }` as the existing table's shape requires.

Arrow keys are unmodified, so they already defer to text entry; verify that rather than assuming it — and note the deferral is on `event.target`, so it only works when the event actually originates at the field (see Step 1). `Shift`-qualified bindings must precede their plain forms, as the existing table's comment requires — but the nudge bindings need **no** `shift` field at all: `bindingFor` matches when `binding.shift === undefined`, so one `{ key: "arrowleft", modifier: false, action: "canvas.nudge-left" }` covers both the plain and the shifted press and the handler decides the step.

`ShortcutHandler` is `() => void` today (`shortcut-manager/index.ts:1`), so it cannot read `shiftKey`. Widen it to `(event: KeyboardEvent) => void` and pass the event in `#onKeyDown`; the eleven existing handlers take no parameters and stay assignable unchanged.

**`mod+a` must defer to text entry, and the existing mechanism does not cover it.** `mod+a` is modifier-qualified, and the deferral rule at `shortcut-manager/index.ts:66-69` only consults the deferred set for modifier bindings — a set that holds `file.new`, `edit.undo`, `edit.redo` and **not** this new action. Left alone, Ctrl+A would select every object on the canvas while the author is renaming a layer and expecting to select the text they just typed. Ctrl+A is not a product action while an editable field has focus; it is the field's own select-all.

**Note on the file's current state:** Task 3 already exported the element check in `shortcut-manager/index.ts` (declared `:94`; this read `:93`) as `isTextEntryTarget` so its keyboard zoom could reuse it. That export is the check on the **target**; the set below is the separate list of **action ids** that a modifier binding must be in to defer. Do not conflate them, and do not move the export back to private.

**Ruled: rename the constant to `MODIFIED_KEY_DEFERRED_ACTION_IDS`, add `canvas.select-all`, and keep `TEXT_ENTRY_DEFERRED_ACTIONS` as the unmodified-key set it already names.** The current name describes only one of the two cases the predicate handles, which is why the gap was easy to miss.

`edit.delete` is worse and is **not** this task's to fix, but do not make it worse: `delete` and `backspace` are unmodified and already defer, so they are fine. Adding a modifier variant of either without adding its id to the renamed set would silently delete the object behind a rename field.

Add `canvas.select-all` on `mod+a` and z-order on `mod+]` / `mod+[`. Register the handlers in `editor-session.ts` beside the existing eleven. For z-order, call the same `layerManager` methods the bridge already maps for `front`/`back` (`bridge.ts:275`, `:280`) — do not reimplement ordering, and do not route through the bridge from the session. Those two already `save()` internally, so their handlers need no further history call:

```ts
this.#shortcuts.register("canvas.front", () => {
  options.shell.editor.layerManager.bringToFront();
});
this.#shortcuts.register("canvas.back", () => {
  options.shell.editor.layerManager.sendToBack();
});
```

**`canvas.select-all` and the four nudges need a sketch, because the obvious implementation is wrong in two places. Read `arrange.ts:19-42` first — it is the repo's own answer to both.**

**1. Selecting every object must not select the non-selectable ones — and the object that matters is the theme's `scene` rect, not `artboardPlate`.** Cite both by symbol: Task 5 deleted the local `artboardScreenRect` and shifted `editor-shell.ts` by −17, so any line number for this file is already stale.

`artboardPlate` is assigned to `canvas.backgroundImage` (`editor-shell.ts`, in `applyArtboardPaint`), so it is **not** in `canvas.getObjects()` and select-all would never see it. The object that genuinely needs excluding is the starter theme's full-artboard background rect: `new-fabric-theme.ts` emits `rect("background", 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly, "scene")` — id `"scene"`, artboard-sized, `selectable: false, evented: false` via `backgroundOnly`. It *is* returned by `getObjects()`, so select-all without the filter puts a 1280x720 non-selectable rect into the selection and a subsequent nudge or drag **moves the background off the artboard**. Measured: it is a scene object, not a plate.

So the filter is load-bearing and its reason is the opposite of "it would move the artboard itself" — it would move the *background*. Filter on `selectable`:

```ts
const selectableObjects = (): FabricObject[] =>
  canvas.getObjects().filter((object) => object.selectable === true);
```

`selectable === true` is an exact-match against the default, and it is the same predicate `snap-manager/index.ts:38` uses. A locked object is `selectable: false` (`object-lock-manager/index.ts:14`), so it is excluded by the same test — which is correct: Ctrl+A must not put a locked object into a selection the author can then drag. `ActiveSelection` of one object is not a selection, so guard `objects.length < 2` and return without touching history.

```ts
this.#shortcuts.register("canvas.select-all", () => {
  const objects = selectableObjects();
  if (objects.length < 2) return;
  canvas.discardActiveObject();
  canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
  canvas.requestRenderAll();
});
```

No `historyManager.saveState()` and no `object:modified`: selection is transient, never authored. §67 spells this out, and `selectLayer` (`bridge.ts:143-153`) is the existing precedent — it selects and notifies, and never saves.

**2. A nudge must move the objects, not the selection's own `left`/`top`.** `canvas.getActiveObject()` returns the `ActiveSelection` when several objects are selected, and setting `left`/`top` on it does translate its members — measured, `sel.set({left: sel.left + 1})` then `sel.setCoords()` moves both members by exactly 1 scene unit, because `ActiveSelection.set` converts the delta into each member's own transform. But it also leaves `sel.left` reading `26` for a selection whose members sit at 1 and 51 (Fabric's `left` is the group origin, not the bounding-box left), so a handler that nudges by reassigning `left` then reading it back drifts. Use the repo's own idiom instead: `object.setPositionByOrigin(new Point(x + dx, y + dy), "center", "center")` per object, exactly as `arrange.ts:143-151` does — and skip `locked` objects, which `arrange.ts:53` also refuses.

```ts
const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;

const nudge = (dx: number, dy: number): void => {
  const active = canvas.getActiveObject();
  if (active === undefined) return;
  const targets = (
    active instanceof ActiveSelection ? active.getObjects() : [active]
  ).filter((object) => object.get("locked") !== true);
  if (targets.length === 0) return;
  for (const object of targets) {
    const centre = object.getCenterPoint();
    object.setPositionByOrigin(
      new Point(centre.x + dx, centre.y + dy),
      "center",
      "center",
    );
    object.setCoords();
  }
  canvas.requestRenderAll();
  ...
};
```

`getCenterPoint()` is the **origin** point under `originX/originY` — Fabric returns `{x: left, y: top}` for a default object and only computes the true geometric centre when the origin is `"center"`. `arrange.ts` uses it exactly this way, paired with `setPositionByOrigin(..., "center", "center")`, and that pairing is what makes it correct: the read and the write must name the same origin. Do not "fix" it to a hand-computed centre; the pair is the idiom.

Then the wiring, which is where the coalescing from the paragraphs below lands:

```ts
const nudgeBy = (dx: number, dy: number): void => {
  const active = canvas.getActiveObject();
  if (active === undefined) return;
  if (release === undefined) {
    release = input.editor.historyManager.suspend();
  }
  if (idle !== undefined) clearTimeout(idle);
  idle = window.setTimeout(endBurst, NUDGE_IDLE_MS);
  nudge(dx, dy);
  // Fired per press and deliberately NOT the thing that records history: it has
  // three other listeners that need it, and `save` is a no-op for the whole
  // burst because the suspension counter is still non-zero. `endBurst` is what
  // records the entry. Do not "simplify" this call away, and do not delete the
  // explicit saveState inside `endBurst`.
  canvas.fire("object:modified", { target: active });
};

// Four literal registrations, not a loop over a key map: `ProductShortcutId` is
// a closed union and a template literal is not assignable to it without a cast.
this.#shortcuts.register("canvas.nudge-left", (event) => {
  nudgeBy(-stepFor(event), 0);
});
this.#shortcuts.register("canvas.nudge-right", (event) => {
  nudgeBy(stepFor(event), 0);
});
this.#shortcuts.register("canvas.nudge-up", (event) => {
  nudgeBy(0, -stepFor(event));
});
this.#shortcuts.register("canvas.nudge-down", (event) => {
  nudgeBy(0, stepFor(event));
});
```

with

```ts
const NUDGE_STEP = 1;
const NUDGE_STEP_LARGE = 10;
const NUDGE_IDLE_MS = 300;
const stepFor = (event: KeyboardEvent): number =>
  event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
```

**Return before suspending when there is nothing to move.** The `active === undefined` guard is above the `suspend()` call on purpose: suspending with no selection would open a burst that never records anything, and the next `saveState` from any other action would be swallowed into it. `deleteActive` and `arrange` both refuse on an empty selection the same way.

**`{ target: active }` is the payload Fabric itself sends** — `this.fire("object:modified", options)` where `options.target` is the transformed object (`index.mjs`, the `endCurrentTransform` path). `chart-manager`'s listener reads `event.target` and returns early unless it is a `VigiliaChart`, and `indicator-manager`'s reads the same field, so an empty payload would silently skip both.

Capturing `active` before the move rather than re-reading it after is a readability choice, not a correctness one: measured, moving the targets through `setPositionByOrigin` leaves `canvas.getActiveObject()` identical, so both orders give the same payload. Prefer naming the thing once.

Write the four `register` calls out rather than deriving the id by string concatenation — `ProductShortcutId` is a closed union and a template literal is not assignable to it without a cast, which the repo's `noUncheckedIndexedAccess`-strict style avoids. The loop above is a sketch of the *shape*; the four literal calls are the implementation.

**Declaration order:** `release`, `idle`, `endBurst` and `NUDGE_IDLE_MS = 300` are the block two paragraphs below. Put that block **above** `nudgeBy`, since `nudgeBy` closes over all four; the sketch order here is for reading, not for transcribing.

`nudgeBy` must call `endBurst` before the next `nudge`, or a burst that spans the idle boundary leaves the first `release` dangling — which is why `endBurst` clears `idle` and nulls `release` itself.

**Coalescing, precisely — and the suspend/resume pair alone does not produce an entry.** A burst of nudges must be one history entry. `HistoryManager.suspend()` is a **counter** (`history-manager/index.ts:41-49`), so it batches one *gesture*, not one idle window: suspend on the first nudge, resume on a short idle timeout (~300ms) or on any other action, whichever comes first.

**But `save()` early-returns while suspended, and nothing re-triggers it on release.** Read it: `save()` is `if (this.#suspended > 0) return;` (`:51-52`), and the two paths that could record the burst — `saveState` and the `object:modified` listener, both in `editor-shell.ts` (cite by symbol — Task 5 shifted this file by −17) — are both that same function. So `suspend()` → nudge → fire `object:modified` → `release()` records **nothing**, and the burst never enters history. Step 5's `Control+z` assertion is the test that catches it, which is why it is there.

Record the entry **explicitly, after the release**, and in that order:

```ts
let release: (() => void) | undefined;
let idle: number | undefined;

/** The burst ends on the idle window or on any other action. Resuming before
 * saving is what makes the entry exist at all: `save()` is a no-op while the
 * suspension counter is non-zero. */
const endBurst = (): void => {
  if (idle !== undefined) clearTimeout(idle);
  idle = undefined;
  if (release === undefined) return;
  release();
  release = undefined;
  input.editor.historyManager.saveState();
};
```

**Still fire `object:modified` on each nudge** — it has three other listeners that need it (`chart-manager/index.ts:87` rerasterizes a scaled chart, `indicator-manager/index.ts:113,121` hides the angle and size indicators, `selection-inspector/index.ts:306` re-renders the fields). It simply cannot be the thing that records history here, because it is suppressed for the whole burst. Say that in a comment, or the next reader will "simplify" the explicit `saveState` away.

The alternative — fire `object:modified` and let it save, without suspending — gives one entry *per keypress*, so a ten-step nudge needs ten undos. That is the behaviour this paragraph exists to avoid.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run packages/editor/src/shortcut-manager`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

```ts
test("nudges the selection and records one history entry", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface");
  await page.goto(EDITOR);
  // Select through the bridge, not the layer row: a focused panel row is a
  // different starting state, and this test is about the nudge binding.
  await page.evaluate(() => {
    (window as unknown as { vigiliaEditorBridge: { selectLayer(id: string): void } })
      .vigiliaEditorBridge.selectLayer("header-wash");
  });
  const left = (): Promise<number | undefined> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getObjects(): Array<{ id?: string; left?: number }> } };
        };
      }).vigiliaEditorBridge;
      return b.editor.canvas
        .getObjects()
        .find((object) => object.id === "header-wash")?.left;
    });
  const before = await left();
  expect(before).toBeTypeOf("number");
  await page.keyboard.press("ArrowRight");
  expect(await left()).toBe(before + 1);
  await page.keyboard.press("Shift+ArrowRight");
  expect(await left()).toBe(before + 1 + 10);

  // The burst only becomes a history entry when its idle window closes (300ms),
  // and Control+z before that finds nothing to undo — measured: the object stays
  // at `before + 11` and the undo is a silent no-op. Waiting past the window is
  // what makes the two assertions below measure coalescing rather than timing.
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+z");
  expect(await left()).toBe(before);
  // Both presses are one entry, so one redo must restore the *whole* burst. A
  // mechanism that recorded two entries would land at `before + 1` here.
  await page.keyboard.press("Control+y");
  expect(await left()).toBe(before + 11);

  const selectedCount = (): Promise<number> =>
    page.evaluate(() => {
      const b = (window as unknown as {
        vigiliaEditorBridge: {
          editor: { canvas: { getActiveObjects(): unknown[] } };
        };
      }).vigiliaEditorBridge;
      return b.editor.canvas.getActiveObjects().length;
    });

  // Ctrl+A inside a text field belongs to the field, not to select-all. Focus
  // the layer rename input (Plan B Task 5) and confirm the selection is
  // untouched; without this the binding silently steals the field's own
  // select-all and the author's typed text is never selected.
  await page.locator('[data-vigilia-layer="header-wash"]').dblclick();
  const rename = page.locator('input[aria-label^="Rename"]');
  await expect(rename).toBeFocused();
  await rename.press("Control+a");
  expect(await selectedCount()).toBe(1);
});
```

Both helpers are defined **inside** the test, beside `left`; `page` is the only thing they close over, so they are test-local and not hoisted anywhere. Neither is imported.

Run: `npx playwright test --project=desktop-chromium --grep "nudges the selection" --workers=1`
Expected: PASS.

**Teeth check 1 — the coalescing, and which assertion actually has the teeth.** Make `endBurst` release *without* calling `saveState`, and run the browser test. Measured against the real `EditorHistory` with this exact shape, the two mechanisms diverge on the **redo** assertion, not the undo one:

| `endBurst` | after `Control+z` | after `Control+y` | e2e verdict |
|---|---|---|---|
| with the explicit `saveState` | `before` ✓ | `before + 11` ✓ | PASS |
| without it (the break) | `before` ✓ (passes) | `before + 11` ✓ (passes) | **PASS — the break is invisible** |

Without the explicit save the burst still produces an entry, because the **`Control+z` handler itself** calls `historyManager.undo()`, and Fabric's `reviveScene` re-drives the canvas, which fires `object:modified` → `save()` — no longer suspended by then, so it records the *current* position as an entry before stepping back. The single undo then lands on `before` anyway. So neither assertion in this test distinguishes the two mechanisms, and the explicit `saveState` is unproven by it.

**The unit test is what pins the mechanism, and it does not belong in the shortcut-manager file.** Put it in `src/web/packages/editor/src/history-manager/index.test.ts`, beside the existing "revives an earlier authored scene without saving the revive". That file is the mechanism's owner, it already has a `describe("EditorHistory")` block and the `EditorHistory` import, and it needs **no** `// @vitest-environment jsdom` — the probe below runs green in the default node environment. Add `src/web/packages/editor/src/history-manager/index.test.ts` to this task's **Files** list and to Step 6's `git add`. It drives `EditorHistory` directly and distinguishes the two mechanisms with no timing in it:

```ts
it("records one entry for a suspended burst, and none while suspended", async () => {
  let value = 0;
  const history = new EditorHistory({
    canvas: { fire: () => undefined } as never,
    serialize: () => ({ value }) as never,
    revive: async (_canvas, scene) => {
      value = (scene as { value: number }).value;
    },
  });
  history.reset();

  const release = history.suspend();
  value = 1;
  history.save(); // suppressed: the counter is non-zero
  release();
  history.save(); // the entry `endBurst` must produce

  value = 2;
  history.save();

  await history.undo();
  expect(value).toBe(1);
  await history.undo();
  expect(value).toBe(0); // straight past the burst: it is ONE entry
});
```

Both undos must step exactly one place. A mechanism that recorded per-press entries would need three undos to reach `0`. Run teeth check 1 against **this** test: delete the second `history.save()` and it must fail on the first `expect(value).toBe(1)` — measured, it fails with `expected +0 to be 1`, because the undo steps straight past the burst to `0`. Restore.

**Teeth check 2 — the deferral.** Remove `canvas.select-all` from the deferred set and confirm the Ctrl+A assertion fails. Restore.

**The idle window is a real race in the browser, and the `waitForTimeout(400)` above is what closes it.** A `Control+z` inside the 300ms window does nothing, because `release` has not run and no entry exists yet — measured: the object stays at `before + 11` and the undo is a silent no-op. Do not remove the wait on the grounds that the presses "usually" finish in time; a loaded CI machine is exactly where it will bite. Report the measured gap between the two presses.

The rename field's label is `` `${uiCopy.panels.rename} ${row.name}` `` (`layer-panel.tsx:229`, and `uiCopy.panels.rename` in `ui-copy.ts` — cite it by symbol, not by line: this file gains entries as the plan proceeds), so `input[aria-label^="Rename"]` matches. If Plan B Task 5 has been reordered after this task and the field does not exist, focus any inspector text field instead and say which you used.

**`page.keyboard.press("ArrowRight")` needs focus on the document, not on a form control.** `page.goto` leaves focus on `<body>`, which is what the window-level dispatcher needs. If the assertion `expect(await left()).toBe(before + 1)` fails while the unit tests pass, check whether an earlier interaction in this test focused something — the bridge call at the top does not, and the rename field is not focused until the Ctrl+A block near the end.

- [ ] **Step 6: Commit**

```bash
git add src/web/packages/editor/src/shortcut-manager \
  src/web/packages/editor/src/editor-session.ts \
  src/web/packages/editor/src/history-manager/index.test.ts \
  src/web/tests/e2e/editor.spec.ts
git commit -m "feat(editor): keyboard nudge, z-order and select-all"
```

---

