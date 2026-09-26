# Task 3 review — Navigation gestures (commit `8d43499`)

## Verdicts

- **Spec compliance: ✅** — every briefed step is implemented; two deliberate
  deviations, both reported by the implementer and both defensible.
- **Task quality: Needs fixes** — two real defects, neither of which any test in
  the package can currently catch.

## 1. Spec compliance, step by step

| Brief step | Status | Evidence |
|---|---|---|
| Step 1 — create `navigation.dom.test.ts` | ✅ | `packages/editor/src/viewport-manager/navigation.dom.test.ts`, 9 tests (brief asked 6 + 1) |
| Step 2 — red run (module does not resolve) | ✅ (reported, not re-run) | Historical run; cannot be re-observed. File resolves today |
| Step 3 — wheel pans `deltaY` | ✅ | `navigation.ts:107` `panBy(0, -event.deltaY)` |
| Step 3 — shift swaps axes | ✅ | `navigation.ts:106` `panBy(-event.deltaY, 0)` |
| Step 3 — ctrl/meta-wheel zooms about the pointer | ✅ | `navigation.ts:98-104`, `getViewportPoint` + `zoomToPoint` |
| Step 3 — space + left-drag pans | ✅ | `navigation.ts:147-157`, `:110-119` |
| Step 3 — `defaultCursor = "grab"` affordance | ✅ | `navigation.ts:12,78,157`; browser-confirmed `grab` on hold, `grabbing` on drag |
| Step 3 — middle-drag pans | ✅ | `navigation.ts:111` `event.button !== 1` |
| Step 3 — every wheel path `preventDefault()` | ✅ | `navigation.ts:97` (browser probe: `defaultPrevented` true for both deltaModes) |
| Step 3 — space state resets on `blur` | ✅ | `navigation.ts:183-187` |
| Step 3 — `+`/`=`/`-` about the viewport centre | ✅ | `navigation.ts:161-168` via `zoomBy` (Task 1 owns the centre) |
| Step 3 — `shift+1` zoom-to-fit | ✅ | `navigation.ts:169-171` |
| Step 3 — **not** added to `PRODUCT_SHORTCUTS` | ✅ | `shortcut-manager/index.ts:23-36` unchanged |
| Step 3 — export `isTextEntryTarget`, import rather than copy | ✅ | `shortcut-manager/index.ts:94`; imported `navigation.ts:2`; **no** copy of the body |
| Step 3 — guard on `event.target` **and** `document.activeElement` | ✅ | `navigation.ts:142-145` |
| Step 3 — sixth test pinning the text-entry deferral | ✅ | test "defers the camera keys to a focused text field" |
| Step 4 — green, all tests pass | ✅ | re-ran: `9 passed (9)` |
| Step 5 — teeth checks | ✅ | two re-run myself, see §3 |
| Step 6 — wire into `createNativeEditor` + unbind in `destroy` | ✅ | `editor-shell.ts:51` (call), `:262` area (`unbindNavigation()` before `viewport.destroy()`) |
| Step 6 — e2e test, desktop-chromium only | ✅ | `tests/e2e/editor.spec.ts:1652`; re-ran: `1 passed (5.8s)` |
| Step 7 — commit | ✅ | `8d43499` |

### Deviations (both reported, both accepted)

1. **`skipTargetFind` / `selection` claim** (`navigation.ts:71-92`) — beyond the
   brief, which only asked for the cursor. Justified: without it a space-drag
   starting over an object hands the press to Fabric's transform path and moves
   authored content. Browser-verified good: with the claim on, a space-drag over
   a real object moved `viewportTransform` and left `object.left/top` at 0.
   This extra surface is the source of findings 2 and 4 below.
2. **Cursor written through `canvas.defaultCursor` + `setCursor`** rather than
   `upperCanvasEl.style` — correct. `showCursor` (`:64-67`) sets `defaultCursor`
   because Fabric re-applies it on hover; the element style is also set by
   `setCursor`, so the existing `element.style.cursor` read at claim time
   (`:74`) is a valid restore value. Browser-confirmed: `""` → `grab` →
   `grabbing` → `""` on release with `defaultCursor` back to `"default"`.

`artboardScreenRect()` is correctly **not** defined here (Task 5 owns it).

## 2. Findings

1. **Important** — `navigation.ts:121-126` `onMouseMove` never consults
   `event.buttons`. A mouseup that never reaches the window (button released
   outside it) leaves `panning` true, so *every* subsequent move pans and
   `skipTargetFind` stays `true` with `selection` `false` until some later
   mouseup or blur. Proven in the browser: after a `mousedown` followed by a
   synthetic `mousemove` with `buttons: 0`, `viewportTransform` still moved
   (`[120,117.9]` → `[220,217.9]`), `skipTargetFind: true`, `selection: false`.
   Whether Chrome actually drops the mouseup depends on the OS/window manager —
   the state machine defect is proven, the exact trigger is not. The report's
   claim that "`blur` clears a wedged hold" covers alt-tab but not this path.
   `blur` and `destroy` **are** clean (both probed: skip/selection/cursor all
   restored).
2. **Important** — `navigation.ts:21-32` `activatesOnSpace` misses native
   `<input type="checkbox">`, `<input type="radio">`, `<summary>` and
   `<a href>`. Space on those is `preventDefault()`-ed (`:151`) and claims the
   canvas. Verified in the browser on the real page: focused native checkbox →
   `defaultPrevented: true, skipTargetFind: true`; radio and `summary` the same.
   This is reachable, not theoretical: `packages/editor/src/chart-manager/panel.ts:136`
   builds `<input type="checkbox">` for chart boolean settings, and a user
   tabbing to it cannot toggle it with Space. This is a regression this task
   introduced, in the same class as the button bug the implementer fixed.
3. **Minor** — `navigation.ts:106-107` (and `:101`) ignore `event.deltaMode`.
   A `DOM_DELTA_LINE` wheel (deltaY 3 per notch) panning 3 px is indistinguishable
   from nothing. Measured on the real page: pixel mode `deltaY 100` → 100 px,
   line mode `deltaY 3` → 3 px. Chromium-only today, so low impact.
4. **Minor** — `navigation.ts:81-92` `release()` writes `skipTargetFind = false`
   / `selection = true` unconditionally while the adjacent cursor handling
   carefully captures and restores the prior value. If those two flags ever gain
   a second writer, this clobbers it. Symmetry with `resumeDefaultCursor` would
   be both shorter and safer.
5. **Minor** — `navigation.ts:24-31` allocates a `new Set([...])` per keydown and
   restates a role list that `isTextEntryTarget` already restates. A shared
   module-level constant would remove both.
6. **Minor** — the wheel zoom arithmetic (`viewport.zoom() * Math.exp(-deltaY/1000)`)
   is not asserted anywhere in the unit suite: the stub's `zoom` is a fixed `1`,
   and the ctrl-wheel test asserts only `toHaveBeenCalled()` / `not.toHaveBeenCalled()`.
   Sign and magnitude are pinned only by the e2e `>` assertion and by the
   implementer's manual browser log.
7. **Minor** — `navigation.ts:147-160`: the ctrl/meta/alt early return sits
   *after* the Space branch, so `ctrl+Space` and `alt+Space` still
   `preventDefault()` and claim the pan. IME/screen-reader keys.
8. **Informational** — `tests/e2e/editor.spec.ts` is outside every workspace
   `tsconfig.include`, so the `exactOptionalPropertyTypes` /
   `noUncheckedIndexedAccess` rules the repo enables are not in force for the
   new e2e code. Pre-existing, not this task's doing.

No code path writes `canvas.viewportTransform` directly: the only writers are
`ViewportManager.commit` and Fabric's own `zoomToPoint`, both in
`viewport-manager/index.ts`. Camera ownership holds.

## 3. Teeth checks I re-ran personally

Breaks applied to a working tree, then reverted; the tree is byte-identical to
`8d43499` afterwards (`diff` clean, `git status --porcelain` empty for both files).

| Break | Observed |
|---|---|
| `if (true \|\| event.ctrlKey \|\| event.metaKey)` at `navigation.ts:98` | `2 failed \| 7 passed` — exactly "pans vertically on a wheel" (`expected "vi.fn()" to be called with arguments: [ +0, -100 ]`) and "pans horizontally on a shifted wheel" (`[ -100, +0 ]`). Matches the report's row 1 exactly. |
| Text-entry deferral short-circuited (`false && (...)`) at `navigation.ts:142` | `1 failed \| 8 passed` — "defers the camera keys to a focused text field", `expected "vi.fn()" to not be called at all, but actually been called 3 times`. Matches row 2. |
| `activatesOnSpace` forced to return `false` at `navigation.ts:22` | `1 failed \| 8 passed` — "leaves Space to the control that activates on it", `expected true to be false`. Matches row 3. |

Rows 4-8 of the report's table (claim, anchor, browser zoom, browser clamp) were
not independently re-run; row 4 is trivially true by inspection (the test asserts
`canvas.skipTargetFind` directly), and rows 6-8 are consistent with what I
measured by hand in the browser.

Green state re-confirmed after restore: `9 passed (9)`.

## 4. Verification I ran

- `npx vitest run packages/editor/src/viewport-manager/navigation.dom.test.ts` — 9 passed.
- `npx vitest run` (whole workspace) — **122 files, 1298 tests, all passed.**
- `npm run typecheck` — clean (all four workspace projects).
- `npx biome lint` on the five changed files — clean. `npm run format:check` — clean. `npm run status:check` — exit 0.
- `npx playwright test --config=playwright.config.ts --project=desktop-chromium tests/e2e/editor.spec.ts --workers=1` — **36 passed, 2 failed**, the two failures being exactly `persists an ordinary drag and restores it through undo` and `rehydrates a chart runtime after undo` (the known-red Task 10 pair). The report's count is accurate.
- The new e2e test alone: `1 passed (5.8s)`.
- Browser inspection against a real `vite preview` on `packages/editor` (`127.0.0.1:4174`, Chromium 1280×720, canvas 626×594, fit zoom 0.4890625):
  - ctrl-wheel zooms about the pointer (drift at the anchor 0.23 px at fit zoom, 0.09 px at 1.27x — the drift is `clampPan`'s doing, not `getViewportPoint`'s);
  - plain wheel zooms by exactly 0;
  - `=` 0.4891 → 0.5380, `-` back to 0.4891, `shift+1` back to fit, `+` in;
  - a pan over a real object moved the transform and left `object.left/top` untouched, then restored `skipTargetFind`/`selection`/cursor;
  - selection still works after both pan kinds (`selectedCount` 1 on a real click);
  - a space-drag starting on empty pasteboard selects nothing;
  - typing into a focused input: zoom unchanged, field value `=` — the deferral works on real keystrokes, not just synthetic ones;
  - Space on a focused `View` button opens its 3-item menu; Escape closes it.
- Tearing down mid-drag (`unbind()` with the claim held) restores both flags — probed.

**Not verified:** the red run in Step 2 (historical), and teeth-check rows 4-8 in
the report's table. The implementer's own browser measurements (the `[60,163.4]
-> [120,143.4]` middle-drag numbers, the `grabbed`-collapses-to-`grab` finding)
were not reproduced number-for-number, though the behaviour they describe was.
