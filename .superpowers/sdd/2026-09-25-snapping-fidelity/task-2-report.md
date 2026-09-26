# Task 2 report — ActiveSelection eligibility

- **Plan:** `docs/superpowers/plans/2026-09-25-snapping-fidelity.md`
- **Task:** 2 — ActiveSelection eligibility
- **Agent id:** `a56288c9349e3c980`
- **BASE:** `2a6d0ef` · **Commit:** `4fcd162` (`feat(editor): refuse a snap gesture for an unsupported selection`)
- **Status:** DONE_WITH_CONCERNS (see "Concerns")

## What landed

1. `src/web/packages/editor/src/snap-manager/selection-eligibility.ts` (new) —
   `isSupportedActiveSelection({ selection })`. Three kept clauses: at least two
   members; no parented child; unit scale when a `Textbox` child is present. The
   fork's per-child kind allow-list is dropped, with the reason recorded in the
   file header exactly as the brief's ruling requires: Vigilia's snap path is
   type-agnostic (`getObjectExactBounds` takes any `FabricObject`), whereas the
   fork's movement/scale path was type-specific (`isShapeGroup`); the fork's own
   list would have refused a plain `Rect` and a `VigiliaChart`, so it was never a
   claim about which Vigilia objects snap.
2. `src/web/packages/editor/src/snap-manager/index.ts` — value import of
   `ActiveSelection`, the import of the eligibility helper, and a refusal in
   `startGesture` before the bounds/candidate work begins.
3. `src/web/packages/editor/src/snap-manager/selection-eligibility.test.ts`
   (new) — 5 jsdom cases.
4. `src/web/tests/e2e/editor.spec.ts` — file-scope helpers `selectTwoLabels`,
   `activeGeometry`, `worldLeftOf`, `scaleActiveSelection`, `dragActiveSelection`,
   `dragToLine`, plus two tests: `snaps a two-object selection as a unit` and
   `refuses a snap gesture for a scaled text selection`.
5. `STATUS.md` — "Last completed change" bullets **replaced** (not appended).

## Test evidence

| Command (from `src/web/`) | Result |
|---|---|
| `npx vitest run packages/editor/src/snap-manager/selection-eligibility.test.ts` | 5 passed |
| `npx vitest run` (full workspace) | 405 files, 1455 tests, 1455 passed, 0 failed |
| `npx playwright test --project=desktop-chromium --grep 'snap'` | 3 passed |
| `npx playwright test --project=desktop-chromium tests/e2e/editor.spec.ts` | 48 passed (parallel, 44.5s) |
| `npm run format:check` | clean (339 files) |
| `npm run lint` | clean (339 files) |
| `npm run typecheck` | clean, all 7 packages |
| `npm run status:check` | clean; `STATUS.md` 59 lines |

### Teeth checks (each run against a rebuilt editor bundle)

The editor bundle was rebuilt (`npm run build -w @vigilia/editor`) after every
source change, including each deliberate break and its revert.

- **Unit:** making `isSupportedActiveSelection` return `true` early → 3 of 5 cases
  fail. Restored; file confirmed byte-identical to the intended version.
- **Eligible browser test:** short-circuiting `runStep` (`if (true) return;`) →
  `snaps a two-object selection as a unit` fails at
  `expect(Math.abs(left - line)).toBeLessThan(0.5)`, received `5.239616613418548`.
- **Refusal browser test:** replacing the guard's condition with `false &&` →
  `refuses a snap gesture for a scaled text selection` fails at
  `expect(Math.abs(refused.left - refused.raw)).toBeLessThan(1.5)`, received
  `2.75`.
- Both new tests also fail when `runStep` is short-circuited (the refusal test's
  positive control asserts `snapped.left` within 0.5 of the line, received
  `5.239616613418548`).

## Browser verification and the Step 6 trap

The brief's Step 6 asked for two browser tests and warned that a jsdom test cannot
show Fabric never fires `object:moving`. Building them exposed a trap worth
recording:

**`sceneToClient` quantises to client pixels** (zoom ≈ 0.489), so a drag leg
shorter than ~2 scene px rounds to no pointer movement: the browser sends no
`mousemove`, Fabric never fires `object:moving`, and a test built on that leg
passes while exercising nothing. This was caught by probing with the guard
disabled and seeing the test still green. Every leg in these tests is now ≥30 px,
and `dragToLine` parks the selection 80 px away first when the target line is
nearer than that floor.

Two further findings:

- The snap picks the **nearest** candidate to the raw landing, which is not
  necessarily the line a test names. An early version asserting against a named
  line failed at `2.75` px while the snap path was demonstrably running.
- Judging "did it snap" against the raw landing (`startLeft + travelled`, with
  `travelled` read through the canvas's own `getScenePoint` at the two client
  points actually sent) is the robust discriminator: eligible → the final edge
  sits on the line (deviation 0); guard disabled → it sits on the raw landing
  (deviation 2.75 px for the refusal case).

## Changes the brief did not ask for

1. `// @vitest-environment jsdom` as line 1 of
   `selection-eligibility.test.ts`. The brief's snippet omits it, but Fabric's
   `Textbox` construction throws `ReferenceError: document is not defined` under
   the workspace's default `environment: "node"`. This is the repo's established
   convention for Fabric-touching unit tests. The snippet's cases are otherwise
   verbatim.
2. `STATUS.md` "Last completed change" replacement, which the controller required.
3. Six file-scope helpers in `editor.spec.ts`. The brief did not name them; they
   are the shared vocabulary both new tests (and any later selection-gesture
   test) need, and they keep the tests out of the hand-mapped canvas-box
   arithmetic the parent prohibited.

## Unverified

- The refusal test's exact scenario (a `scaleX/scaleY = 1.5` `ActiveSelection`
  containing a `Textbox`) is not reachable through the product UI — only a scale
  gesture leaves a non-unit scale, and that deselects first. The test sets it
  directly through the live canvas, and `scaleActiveSelection` calls `setCoords()`
  because without it the stale hit area makes the press miss and Fabric drags the
  card behind. The guard therefore protects a state the current UI cannot produce;
  it is defence for a future path, and the test documents that.
- Both new browser tests were run on the desktop-chromium project only, as the
  other editor tests are; phone surfaces are covered by the browser suite
  generally, not by these two.
- The full editor spec was green on one parallel run (48 passed). The parallel-run
  fragility seen earlier is gone with the raw-landing assertion, but this is one
  run, not the plan-level repeated gate.

## Concerns

1. **The `>1` threshold I first used had no teeth.** `expect(Math.abs(left - raw))
   .toBeGreaterThan(1)` passed with `runStep` disabled because the raw-landing
   estimate drifted ~1.2 px. Replaced with assertions against the snap line
   (`<0.5`) and, for the refusal, against the measured raw landing (`<1.5`, where
   the disabled guard gives 2.75). If the zoom or the starter scene changes, the
   4 px offset and the 0.5/1.5 px tolerances are the values to re-measure.
2. **`refused.left - refused.raw` is a narrow margin** (0.4 px enabled vs 2.75 px
   disabled). It holds, but it depends on the refusal landing on its raw position
   rather than near another candidate line. A scene edit that puts a candidate
   within ~2 px of the raw landing would make the refused drag snap to *that* line
   and pass for the wrong reason. Re-measure if the starter scene changes.
