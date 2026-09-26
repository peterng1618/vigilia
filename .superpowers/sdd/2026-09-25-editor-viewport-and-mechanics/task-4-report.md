# Task 4 — The zoom readout: report

**Status:** DONE_WITH_CONCERNS
**Commit:** `a2a11563e67dce56b1b6ad62b36aa4d81a7d052b` — `feat(editor): zoom readout with fit and 100% resets`
**Branch:** `claude/superpowers-workflow-cleanup` (no branch created, nothing pushed, no PR)

## What changed and why

| File | Change |
|---|---|
| `src/web/packages/editor/src/editor-shell/zoom-readout.tsx` | New. Presentational; takes `viewport: ViewportManager` as a prop and reads it through `useSyncExternalStore(…, () => viewport.zoom())`. `Menu.Trigger` shows `${Math.round(zoom * 100)}%` and carries `data-vigilia-zoom`; the popup offers Zoom to fit / Zoom to selection / 100 %. |
| `src/web/packages/editor/src/editor-shell/zoom-readout.dom.test.tsx` | New. Brief's Step 1 test verbatim except the popup-picking tail (see Deviations). |
| `src/web/packages/editor/src/editor-shell/shell-layout.tsx` | Imports the readout, deletes a dead `let bridge` local, mounts `{store.bridge === undefined ? null : <ZoomReadout viewport={store.bridge.editor.viewport} />}` in `<main id="stage">`. |
| `src/web/packages/editor/src/editor-shell/shell-layout.dom.test.tsx` | `bridgeStub` now stubs `editor.viewport.zoom` / `editor.viewport.onChange`. |
| `src/web/packages/editor/src/editor-shell/editor-shell.css` | Adds `.editor-shell-zoom`; removes `position: relative` from `.editor-shell-positioner`. |
| `src/web/packages/editor/src/ui-copy.ts` | Adds the `zoom` copy block (`label`, `toFit`, `toSelection`, `actualSize`). |
| `src/web/tests/e2e/editor.spec.ts` | New test `tracks the camera's zoom in the stage readout`. |
| `docs/evidence/screenshots/README.md` | Viewport row now points at `editor-zoom-readout` / `tracks the camera's zoom in the stage readout`. |
| `docs/evidence/screenshots/editor-zoom-readout-desktop-chromium.png` | New capture (205,884 bytes). |

No bridge change: `EditorInteraction.viewport` was already required, so `bridge.editor.viewport` type-checked as-is. `bridge.ts` untouched. `onChange` was already declared and implemented in `ViewportManager`; nothing was added there.

## The one bug the brief's code would have shipped

The brief's call site is literally:

```tsx
{bridge === undefined ? null : <ZoomReadout viewport={bridge.editor.viewport} />}
```

`bridge` is not a binding that exists in `shell-layout.tsx` — it was a `let bridge: EditorShellBridge | undefined;` closure local (old line 266) that nothing ever assigned. The live bridge is `store.bridge`. With the brief's text the branch is provably dead, Rolldown constant-folds it to `null`, and **the entire readout disappears from the built bundle**: the first e2e run failed with `locator('[data-vigilia-zoom]') not found`, and grepping the minified bundle showed `Zoom level`/`Zoom to fit` present (from `ui-copy`) with `data-vigilia-zoom`, `editor-shell-zoom` and `ZoomReadout` at **0 occurrences**, and no `zoom-readout` entry in the sourcemap's `sources`. The minified stage read `children:[…, null]`.

Fix: delete the dead local, guard on `store.bridge`. After rebuild: `editor-shell-zoom: 1`, `data-vigilia-zoom: 1` in the bundle, and the e2e test passes. Comment added at the call site explaining the store is used deliberately.

## Commands run, with measured results

All from `src/web/` unless noted.

| Command | Result |
|---|---|
| `npx vitest run packages/editor/src/editor-shell/zoom-readout.dom.test.tsx packages/editor/src/editor-shell/shell-layout.dom.test.tsx` | 2 files, 7 tests passed, 2.66 s |
| `npm test` | 123 files, **1313 tests passed**, 24.39 s |
| `npm run typecheck` | clean (root + host) |
| `npm run lint` | clean, 317 files |
| `npm run format:check` | clean, 317 files |
| `npm run build` | clean |
| `npx playwright test --project=desktop-chromium --grep "tracks the camera's zoom in the stage readout" --workers=1` | **1 passed (6.7 s)** |

Step 2's intended failure was observed before implementing: `Failed to resolve import "./zoom-readout.js"`.

## Teeth checks (both actually run, both measured)

1. **Unit.** Removing `keepMounted` from `Menu.Portal` →
   `AssertionError: expected "vi.fn()" to be called at least once` — the test fails.
2. **Browser.** Replacing `useSyncExternalStore(subscribe, () => viewport.zoom())` with a plain `subscribe; return viewport.zoom();` (render-once behaviour) →
   e2e fails with `Expected: 73, Received: 49` — the readout stays at the fit value while the camera is at 73 %. The test's teeth are on the tracking contract, not just on the element existing.

## Browser evidence (Step 4)

Playwright, real Chromium at 1280×720, against the built bundle served by `vite preview`:

```
fit                readout 49%  camera 0.4890625            viewportTransform translate [ 0,      120.4375 ]
after space-drag   readout 49%  camera 0.4890625            translate [ 160,    240.4375 ]
after ctrl-wheel   readout 73%  camera 0.7295955161901838   translate [ 140.327, 260.418  ]
```

This is the pair the brief asked for: the space-drag moved the canvas by (160, 120) with the percentage **unchanged at 49 %**, and ctrl-wheel over the canvas (pointer from `.hover({position:{x:200,y:200}})` on `canvas.upper-canvas`, per the brief's idiom and its required comment) moved the readout **49 % → 73 %** in step with `viewport.zoom()`.

Note on the canvas measure: `boundingBox()` of the canvas element is its element box and never moves (first attempt measured `0 0`). The meaningful measure is `canvas.viewportTransform.slice(4, 6)`, used above.

The captured screenshot `editor-zoom-readout-desktop-chromium.png` was inspected before staging (per AGENTS.md): the stage renders with the canvas zoomed to fit and a **73 %** pill in the bottom-right corner. No unrelated UI regressed.

## Deviations from the brief, and why

1. **The Step 1 test's popup tail had to change.** The brief's `host.querySelector('[aria-label="Zoom to fit"]')` can never match: Base UI portals `Menu.Popup` to `document.body`, and while the menu is closed the popup is not mounted at all. The shipped test adds `aria-label={label}` to each `Menu.Item`, uses `document.querySelector`, and relies on `Menu.Portal keepMounted`. A comment in the test states why. *Separately:* a non-`keepMounted` Base UI portal popup hangs jsdom ~35 s at teardown when the popup mounts-on-open and unmounts-on-close. This is a Base UI/jsdom interaction, not Vigilia code — reproduced with a bare `Menu.Root` + `Menu.Portal` and nothing else. `keepMounted` fixes it (isolated probe: passes in 1.79 s). `Menu.Popup` does not accept `keepMounted` (type error); only `Menu.Portal` does.

2. **`.editor-shell-positioner` had `position: relative` removed.** With the popup portalled out, `relative` makes the positioner the containing block for the popup's fixed positioning, trapping it inside the stage's `overflow: hidden`. `z-index: 60` is kept; the two adjacent explanatory comments were merged into one. Without this the menu is clipped by the stage.

3. **`shell-layout.dom.test.tsx` was modified.** Not in the brief's Files list or its `git add` list, but required: its `bridgeStub` used `editor: {} as EditorShellBridge["editor"]`, a lie that the now-actually-mounting readout exposes as `TypeError: Cannot read properties of undefined (reading 'zoom')`. Stubbed `viewport.zoom` and `viewport.onChange`. **This file must stay in the commit** — without it the editor-shell suite is red.

4. **Screenshot name is mine:** `editor-zoom-readout-desktop-chromium.png`, following the repo's existing `-desktop-chromium` suffix convention. The brief named no file.

5. **Dead local deleted.** `let bridge: EditorShellBridge | undefined;` was removed rather than left unused; Biome's lint would flag it.

## Concerns

1. **`STATUS.md` was not updated.** AGENTS.md says to replace `STATUS.md`'s "Last completed change" before each completed task commit, but the brief's Files list and `git add` list both exclude it, and this workstream's own history separates that into a following `docs(status): …` commit (`673efb7` is exactly that, sitting after `9067a96`). I did not want to unilaterally add a commit the orchestrator may own. If the intent was to fold STATUS.md into this feature commit, say so and I will.
2. **The brief over-specified the guard.** Its literal `bridge === undefined` was a silent no-op in production; the type system did not catch it because the local's declared type was valid. Any other task whose brief references a shell-layout local by that name should be re-checked the same way.
3. **`act(...)` stderr noise.** `zoom-readout.dom.test.tsx` prints "The current testing environment is not configured to support act(...)" to stderr. The assertions pass and the run is 2.66 s; the repo's `vitest.config.ts` sets no `setupFiles` and other dom tests behave the same way. Not introduced by this task, but it is noise.
4. **Untracked pre-existing modifications left alone**, as required: `docs/superpowers/plans/2026-09-25-*.md` (3), `docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md`, `docs/evidence/screenshots/editor-background-media-desktop-chromium.png`, `docs/evidence/screenshots/editor-desktop-chromium.png`. Unrelated to Task 4.
5. **`editor.spec.ts` is long.** The new test adds 48 lines to a file that is already large; AGENTS.md's 500/800-line signal applies to source files and this is a test, but a future task may want a split.
