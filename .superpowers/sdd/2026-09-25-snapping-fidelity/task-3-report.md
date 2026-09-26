# Task 3 report: Spacing hold state — prove it, then delete the dead ports

Status: **DONE**

Commit: `a90bc43` `test(editor): pin equal-spacing hold, drop the dead spacing ports`

## What I implemented

1. `src/web/packages/editor/src/snap-manager/spacing-hold.dom.test.ts` (new) — two behavioural
   tests for the equal-spacing hold, driven through the real `createSnapManager`/`object:moving`
   path (not the resolver directly, so the test exercises the shipped wiring).
2. Deleted the dead ports proven safe by the passing hold tests:
   - `SPACING_CONTEXT_SWITCH_DISTANCE` (`constants.ts:6`)
   - `resolveCommonDisplayDistance` (`distance.ts:32`) **and** its same-file
     `CommonDisplayDistance` type (`distance.ts:22-27`)
   - `calculateSpacingSnap` (`spacing.ts:1312`, unreachable) **and** its newly orphaned
     `SpacingContextByAxis` type (`spacing.ts:21`)

## Sweep output — measured, not derived

Swept with `move(canvas, active, offset)` over the fixture, offset = the raw pointer `left`
(the equal-spacing optimum is the fixed position 200):

| range swept | observed |
|---|---|
| 180–194 | object follows the pointer (180→180 … 194→194) |
| 195–210 | object reads **200** at every offset (the hold) |
| 211–216 | object follows the pointer (211→211 … 216→216) |
| 190–245 (wider confirm) | hold 195–210; then a line snap to 239 for 234–244; raw 245 |

- **Last holding offset = 210. First releasing offset = 211.**
- `HOLD_STEP = 210`, `RELEASE_STEP = 221` (past 211, cannot straddle it).
- Internal consistency: the acquire window alone (`SNAP_THRESHOLD` 5) can only reach 205, so
  206–210 is hold-only; the release window `(5 + 5)` ends at 210, matching the measured 210.
- No flankers (control), swept 195–212: the object followed the pointer at **every** offset —
  confirming the hold above is produced by the flanking rects, not by the artboard.

## Which Step 2 branch happened

**Branch 1 — both tests pass.** Hold state does provide the stickiness, so Step 3's deletions
are safe. Branch 2 was not reached, so nothing was wired back in, no assertions were weakened,
and no fixture was widened to manufacture evidence.

## The brief's fixture could not measure this — two defects, both fixed

The brief's Step 1 fixture, run verbatim, showed **no holding window at all** (every offset
195–230 followed the pointer; the only snap was a line snap to 229 at 224+). Before concluding
"stickiness is missing", I probed the fixture's geometry and found the sweep was measuring
nothing — two independent defects:

1. **Fabric 7 `Rect` defaults to a centre origin.** `getObjectExactBounds` on the brief's
   `Rect({ left: 200, width: 40 })` returns `left: 179.5` — `left` is the shape's *centre*, and
   the bounding rect is padded 0.5px per side for the stroke (width 41, not 40). The brief's
   arithmetic ("Left ends at 160, right starts at 280") assumes edge origin. Fixed with an
   explicit `originX: "left", originY: "top"` on every rect; the true edges are then 161 / 280 /
   width 41, which does give an exact equal-spacing optimum of 200.
2. **The flankers never overlapped the active object's band.** `resolveSpacingNeighbors` →
   `isBoundsAligned` (`spacing.ts:855`) requires overlap on the *perpendicular* axis, and the
   brief's flankers (`top: 40, height: 100` → band 40–140) do not overlap `active`
   (`top: 180, height: 40` → band 180–220). No equal-spacing chain could form on either axis.
   Fixed by spanning the flankers' band (height 300 from `top: 0`), leaving the X geometry — and
   therefore the 200 optimum — untouched.

Both fixes are permitted by the brief ("if the numbers turn out to be wrong for the fixture, fix
the fixture's geometry to reach equal spacing"). The preflight scan had already flagged defect 2
as finding **O4**; defect 1 was new.

## Flanking-rects confirmation

Deleting the two flanking rects and re-running: **the test fails** (object reads the pointer, not
200). So the anchor being held is the spacing candidate, not the artboard's centre guide. The
`bounds()` centreX stays 500, deliberately off the equal-spacing 200.

## What I tested and the results

| check | result |
|---|---|
| `npx vitest run packages/editor/src/snap-manager/spacing-hold.dom.test.ts` | 2 passed |
| Full snapping suite: `npx vitest run packages/editor/src/snap-manager` | **141 passed** (8 files) |
| `npm run typecheck` | clean (editor, player, host, fake-source) |
| `npm run lint` | clean |
| Non-vacuity: delete the flanking rects | **fails** (as required) |
| Non-vacuity: `SPACING_SNAP_HOLD_MARGIN = 0` | **fails** at `HOLD_STEP` (as required) |
| `npx biome check` on the four touched files | clean |

The three "regression test must fail when the fix is disabled" checks were run and then the
deliberate breaks reverted; the constants file was restored to `SPACING_SNAP_HOLD_MARGIN = 5`
and confirmed byte-identical (`git diff` empty before staging).

## Files changed

- `src/web/packages/editor/src/snap-manager/spacing-hold.dom.test.ts` (new, 105 lines)
- `src/web/packages/editor/src/snap-manager/constants.ts` (−1)
- `src/web/packages/editor/src/snap-manager/distance.ts` (−40)
- `src/web/packages/editor/src/snap-manager/spacing.ts` (−70)

Not staged, not mine: `docs/evidence/screenshots/editor-desktop-chromium.png` (modified at
conversation start) and `src/web/packages/editor/src/editor-shell/editor-shell.css` (modified by a
concurrent task mid-run, mtime 15:33 — it carried the only remaining `format:check` error, and I
left it alone).

## Self-review findings

- Fixed a comment inaccuracy before committing: the draft said the release boundary was 211 while
  setting `RELEASE_STEP = 220`; the comment now states both measured numbers (last hold 210,
  first release 211) and `RELEASE_STEP = 221`.
- Caught the same orphan defect the brief warned about, a second time: deleting `calculateSpacingSnap`
  left `SpacingContextByAxis` declared but unreferenced, exactly as deleting
  `resolveCommonDisplayDistance` would have left `CommonDisplayDistance`. Deleted both; verified
  workspace-wide that all five symbols (three functions/constants, two types) now have zero hits.
- Verified the brief's "do not delete" list was respected: `MAX_DISPLAY_DISTANCE_DIFF` and
  `resolveDisplayDistance` are untouched and still imported by `spacing.ts`, `guide-renderer.ts`,
  `spacing-chains.ts`.

## Issues or concerns

1. **The brief's fixture is wrong in two ways** (above). If a reviewer diffs my test against the
   brief's Step 1 verbatim, the geometry changes are intentional and load-bearing: without them
   the sweep measures the artboard/pointer and returns a false "no hold" — which would have
   pushed the task into Step 2 branch 2 and left all five dead exports in place. I recommend
   Task 10's plan step note this, as the plan text for Step 1 still contains the broken fixture.
2. **`calculateSpacingSnap` deletion is beyond the brief's literal Step 3 list** but explicitly
   authorised by it ("if it is genuinely unreachable, delete it in the same commit"). It is
   unreachable: one declaration, zero call sites workspace-wide, and it is not the entry point
   Step 2 exercised — Step 2 goes through `resolveSpacingNeighbors` via
   `calculateHorizontalSpacing`/`calculateVerticalSpacing`, which remain live.
3. The test asserts on `active.left`, which for my explicit-origin rects is the shape's left edge.
   That is the reading the brief intends; noted because the same assertion on a default-origin
   rect would silently measure the centre instead.
