# Task 2 fix round — report

**Status:** DONE
**Base commit:** `8d43499ad3c81f92cf208058308560cacea5d2b7` (Task 3's commit — verified before any edit)
**Fix commit:** `419a5124f43b3da71903fc80c112f4873aa90477` — `test(editor): pin host-sized canvas against a fitted one`
**Files changed:** 2 (`src/web/packages/editor/src/editor-shell.ts`, `src/web/packages/editor/src/editor-shell.dom.test.ts`), +6 -6

## Fix 1 — vacuous `getWidth()` assertion

`editor-shell.dom.test.ts`, test `"exposes a camera over the mounted canvas"` (`:212`).

- `clientHeight` changed `800` → `400`, so host is 1000×400.
- Fit scale is now `min(1000/1280, 400/720) = 0.5556`; a fitted canvas would be
  **711×400**, a host-sized canvas **1000×400** — the width assertion now
  discriminates.
- Expectations updated to `1000` / `400`; both dimensions kept.
- Comment rewritten:
  `// The canvas fills the host, not the artboard: a canvas sized to the`
  `// artboard would be 711 wide at this host's fit scale; it must fill the`
  `// host instead.`
- `expect(shell.editor.viewport.zoom()).toBeGreaterThan(0)` left as-is.

### Teeth check (required) — verbatim output

Temporarily changed the width expectation to `711`:

```
 × exposes a camera over the mounted canvas 10ms

⎯⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  packages/editor/src/editor-shell.dom.test.ts > native editor shell > exposes a camera over the mounted canvas
AssertionError: expected 1000 to be 711 // Object.is equality

- Expected
+ Received

 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

Exact match for the brief's required `expected 1000 to be 711`. Expectation
restored to `1000`; suite green again.

## Fix 2 — `setFitMode` advertised an ignored parameter

`editor-shell.ts`:

- `:78` → `setFitMode(): void;` (parameter removed). Method **not** deleted.
- Implementation body and its comment unchanged — it already read
  "The authoring view always frames the whole board; `cover` is the player's
  crop of it, which the stage does not draw." and never referred to a
  parameter, so no doc edit was needed.
- `type FitMode` import (`:6`) removed. Verified by grep before/after:

  before: `6: type FitMode,` / `78: setFitMode(fitMode: FitMode): void;` / `438: setFitMode() {`
  after (post-signature, pre-import-removal): `6: type FitMode,` / `78: setFitMode(): void;` / `438: setFitMode() {`
  after import removal: no `FitMode` matches remain.

- `artboard-panel.ts:78` not touched; `setFitMode` not deleted.

Workspace-wide caller check confirms the brief: only the declaration and the
implementation reference `setFitMode` (now `editor-shell.ts:77` and `:437`).

## Verification

From `src/web/`:

| Check | Result |
|---|---|
| `npx vitest run packages/editor/src/editor-shell.dom.test.ts` | 1 file, 7 tests passed |
| `npm run typecheck` | exit 0, 0 `error TS` lines |
| `npx biome lint packages/editor/src/editor-shell.ts packages/editor/src/editor-shell.dom.test.ts` | exit 0, "Checked 2 files. No fixes applied." |
| `npx biome format <same two files>` | exit 0, "Checked 2 files. No fixes applied." |

Full gate (`npm run test:e2e`, `npm run build`) deliberately not run — Task 11 owns it.

## Constraints honoured

- Staged explicit paths only for the two brief files; `git add -A` / `git commit -a`
  not used. The six pre-existing modified docs/screenshot paths were left
  unstaged and untouched.
- No subagents dispatched; no temp files created in the repo tree.
- Read `editor-shell.ts` fresh before editing (it had moved under Task 3).

## Concerns

None. Both fixes were applied verbatim from the brief; no redesign, no scope
beyond the two findings.
