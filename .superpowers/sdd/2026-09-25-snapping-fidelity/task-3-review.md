# Task 3 review: Spacing hold state — prove it, then delete the dead ports

Reviewed commit: `a90bc43` (`798cc77..a90bc43`, 4 files, 1 commit).
Reviewed against the real working tree, not the diff alone.

## Verdicts

- **Spec compliance: PASS.** The diff does what the brief specifies. Two departures, both
  justified and both verified: (a) the fixture geometry fix, explicitly permitted by Step 2
  ("if the numbers turn out to be wrong for the fixture, fix the fixture's geometry"); (b)
  deleting `SpacingContextByAxis`, which is the mandated consequence of the conditionally
  authorised `calculateSpacingSnap` deletion under the brief's own `CommonDisplayDistance`
  precedent.
- **Task quality: PASS.** The deletion is provably safe, the evidence is real, both teeth
  mutations reproduce, and I independently reproduced the claimed boundary.

## Critical findings

**None.**

## Important findings

**None.**

The two things that would have been Important are both clean, and I checked them directly rather
than trusting the report:

- **Over-deletion:** none. All five deleted symbols (`SPACING_CONTEXT_SWITCH_DISTANCE`,
  `resolveCommonDisplayDistance`, `CommonDisplayDistance`, `calculateSpacingSnap`,
  `SpacingContextByAxis`) have **zero** textual hits anywhere under `src/web` on the current tree,
  and at the parent commit `798cc77` each was a single declaration plus its own signature/body
  references — i.e. genuinely unreferenced before removal, not merely newly orphaned. The only
  remaining hits repo-wide are prose in `docs/superpowers/**` and the plan.
- **No live behaviour removed:** `calculateSpacingSnap` is not on Step 2's path. The test drives
  `createSnapManager` → `object:moving` → `MovementSnappingRuntime` → `movement-snapping-resolver`
  → `resolveSpacingConstraint` (`movement-snapping-resolver.ts:752`) →
  `calculateMovementAxisSpacing` (`:869`, live `switchDistance: previousContext ?
  Number.POSITIVE_INFINITY : 0` at `:886`) → `calculateHorizontalSpacing`/`calculateVerticalSpacing`
  (`:890-891`) → `calculateAxisSpacing` (`spacing.ts:1261`) → `resolveSpacingNeighbors`
  (`spacing.ts:860`). `calculateSpacingSnap` was never imported by anything. Both remaining live
  entry points survive and are still imported by the resolver.

## What I verified independently

### Defect 2 (the brief's flankers never overlap the active band) — CONFIRMED as real

The gate is real and is exactly as described. `resolveSpacingNeighbors` (`spacing.ts:860`) filters
candidates through `isBoundsAligned` (`spacing.ts:836`), which resolves both bounds to the
perpendicular-axis segment and requires `getAxisOverlap(...) > 0` (`spacing.ts:849-856`); zero
means merely touching and is rejected. `getAxisOverlap` is `Math.min(end) - Math.max(start)`
(`spacing.ts:60-68`).

Measured on the brief's verbatim fixture via `getObjectExactBounds`:
- active: `top 159.5, bottom 200.5`
- brief flanker (`top: 40, height: 100`, default CENTER origin): `top -10.5, bottom 90.5`

Overlap = `min(200.5, 90.5) - max(159.5, -10.5)` = `90.5 - 159.5` = **-69 < 0** → rejected. The
brief as written cannot form an equal-spacing chain on the horizontal axis.

### Defect 1 (Fabric 7 Rect defaults to CENTER origin) — CONFIRMED, and load-bearing

On the brief's fixture, `getObjectExactBounds({ left: 200, width: 40 })` returns
`left: 179.5, right: 220.5` — width 41, centred on 200, i.e. `left` is the shape's centre. (Already
confirmed by the caller in `defaultValues.mjs`.) The implementer's numbers are exact.

**Both fixes are independently load-bearing.** I swept three variants (active offset → resulting
`left`, init at 183 then 200, offsets 180–245):

| variant | at offset 200 | hold window 195–210 |
|---|---|---|
| A: fixed origin, brief band | reads 200 (pointer, no snap) | **none** — every offset follows the pointer |
| D: default origin, band covering active | reads **190** (wrong position) | none |
| C: fixed origin, spanning band (= committed) | reads 200 | **195–210 held at 200** |

So A reproduces the implementer's central claim exactly: with only the origin fixed, the sweep
shows no holding window, which would have driven Step 2 into branch 2 and left all five dead
exports in the repository while reporting a false finding. D independently shows the origin fix is
also required — the brief fixture with only the band fixed fails its *first* assertion
(`expect(active.left).toBe(200)` reads 190). Neither fix is cosmetic.

I also reproduced the brief's fixture verbatim and swept it: `195→195 … 223→223`, then a line snap
`224→229 … 234→229`, `235→235 … 244→244`, `245→249.5`. No hold at any offset. The implementer's
account of the broken fixture is accurate.

### The fixture now genuinely measures the hold

Geometry re-derived from measured bounds, not from the comments:
- left flanker `right = 161` (100–161), right flanker `left = 280`, active bounds width `41`
  (200–241), heights: flankers `0–301`, active `180–221` → perpendicular overlap positive.
- equal-spacing optimum = `161 + (280 - 161 - 41) / 2 = 161 + 39 = 200`. The response says 161 and
  280/41; both check out.
- artboard `centerX` is 500, so 200 cannot come from the artboard centre guide. Confirmed
  behaviourally: removing the two flankers makes the test fail at 210 (object reads the pointer).

### The measured boundary — RE-DERIVED and CONFIRMED

My independent sweep of the committed fixture (raw output, offset → `active.left`):

```
180-194 -> follows pointer
195-204 -> 200
205 -> 200
206-210 -> 200
211 -> 211, then follows pointer through 233
234-244 -> 239 (line snap), 245 -> 245
```

- **Acquire reach:** fresh acquire threshold is `SNAP_THRESHOLD / zoom = 5`
  (`movement-snapping-resolver.ts:1300`), so a fresh acquire can only land on 200 from pointer
  offsets 195–205. `HOLD_STEP = 210` has |delta| = 10 > 5, so no acquire — fresh or otherwise —
  can produce 200 there. Only the hold can. Argument holds.
- **Release:** window is `(SNAP_THRESHOLD + SPACING_SNAP_HOLD_MARGIN) / zoom = 10`
  (`movement-snapping-resolver.ts:1302`), so the held candidate covers ~190–210. `RELEASE_STEP =
  221` is 21 away — comfortably outside, does not straddle. Measured release is 211, matching
  `5 + 5` exactly.

### The two teeth mutations — RE-RUN, verbatim

**Mutation 1 — delete the flanking rects** (`canvas.add(left, right, active)` → `canvas.add(active)`):

```
FAIL packages/editor/src/snap-manager/spacing-hold.dom.test.ts > equal-spacing hold > keeps the chosen spacing while the pointer stays near it
AssertionError: expected 210 to be 200 // Object.is equality
- Expected: 200
+ Received: 210
 ❯ packages/editor/src/snap-manager/spacing-hold.dom.test.ts:90:25
Test Files  1 failed (1)
     Tests  1 failed | 1 passed (2)
```

**Mutation 2 — `SPACING_SNAP_HOLD_MARGIN = 0`** (`constants.ts:6`):

```
FAIL packages/editor/src/snap-manager/spacing-hold.dom.test.ts > equal-spacing hold > keeps the chosen spacing while the pointer stays near it
AssertionError: expected 210 to be 200 // Object.is equality
- Expected: 200
+ Received: 210
 ❯ packages/editor/src/snap-manager/spacing-hold.dom.test.ts:88:25
Test Files  1 failed (1)
     Tests  1 failed | 1 passed (2)
```

Mutation 2 is the decisive one and it behaves correctly: with the margin gone the release window
collapses to 5, the hold ends at 205, and 210 reads the pointer. The test therefore observes the
**hold**, not the acquire. Both deliberate breaks were reverted; `git status` afterwards shows only
the three pre-existing unrelated modifications.

### Required survivors — CONFIRMED present and imported

- `MAX_DISPLAY_DISTANCE_DIFF` — `distance.ts:19`, imported `spacing.ts:2`, read at `spacing.ts:555`
  (`return distanceDiff <= MAX_DISPLAY_DISTANCE_DIFF;`). The brief's cited `spacing.ts:561` is now
  `:555` after the deletions; the symbol is live either way.
- `resolveDisplayDistance` — `distance.ts:4`, imported by `guide-renderer.ts:5`, `spacing-chains.ts:1`,
  `spacing.ts:3`, and `spacing.test.ts:2`.

`git status --porcelain --untracked-files=all -- src/web/packages/editor/src/snap-manager` is empty
— no stray concurrent file in this package, and no leftover from my probes.

### Gates — all green

- `npx vitest run packages/editor/src/snap-manager` → **8 files, 141 tests passed** (matches the
  report).
- `npm run typecheck` → clean across editor, player, host, scene-fabric, theme-package, fake-source.
  This is the load-bearing gate for a deletion and it passes.
- `npm run lint` → clean (335 files). The 4 touched files are clean under `biome check` and
  `biome format`; the 7 pre-existing biome errors under `snap-manager/scaling/*` are in files this
  commit does not touch and are not attributable to it.
- Commit scope: exactly the 4 declared paths, nothing else staged.

## Minor findings

**1. Stale arithmetic in the plan's copy of the fixture — `docs/superpowers/plans/2026-09-25-snapping-fidelity.md:399`**

```
// 200 is the exact equal-spacing position: 160 + (280 - 160 - 40) / 2.
```

The corrected geometry in the same block (`:378-379`, `161` / `280` / 41-wide object) makes the
right expression `161 + (280 - 161 - 41) / 2`. The value is still 200, so nothing is *wrong* in
behaviour, but the plan retained the brief's original edge-origin arithmetic that this task proved
incorrect — exactly the stale-comment class the review brief asked me to check. The **committed test
file is clean**: `spacing-hold.dom.test.ts` contains no `160`, no `top: 40`, no `splits evenly`
surviving from the brief, and its comments state the corrected 161/280/41 numbers.

Fix: change that one line to `161 + (280 - 161 - 41) / 2`. Note this line is outside the reviewed
commit (it was carried over by the follow-up plan-fix commit `ffe8f40`), so it is a documentation
cleanup, not a defect in `a90bc43`.

**2. Report wording, not a code defect — `task-3-report.md:27`**

The sweep table says "180–194 | object follows the pointer" and "211–216 | object follows the
pointer". Both are accurate as far as they go, but 211–233 all follows the pointer; the 216 cutoff
is just where the listed range ended, and the report's own wider confirm covers it. No action.

## Assessment of the two judged questions

**Are the implementer's fixes the right ones?** Yes, and they are the *minimum* fixes. The origin
fix is a helper (`rect()`), not three duplicated option objects; the band fix changes only `top` and
`height` on the two flankers and leaves all X geometry — and therefore the 200 optimum — untouched.
No assertion was weakened to `toBeGreaterThan`/`not.toBe`, no band was widened beyond what the
overlap gate needs, and the artboard stays off-centre so 200 cannot come from the centre guide. The
one thing Step 1 explicitly forbids was not done.

**Does the resulting fixture genuinely measure the hold?** Yes. It acquires at 200 (offset 195),
holds through 210 (past the 205 acquire reach, so hold-only), and releases at 211 (exactly the
`5 + 5` window). Mutating the hold margin to 0 collapses it to 205 and fails; removing the
neighbours removes the snap and fails. Both directions have teeth.

## Deviations from the brief, judged

| deviation | authorised? | verdict |
|---|---|---|
| Fixture geometry (origin + flanker band) | Yes — Step 2 line 120 | Justified; both changes independently load-bearing, reproduced |
| Delete `SpacingContextByAxis` too | Not named in Step 3, but mandated by its `CommonDisplayDistance` precedent and by deleting `calculateSpacingSnap` | Justified; the type was referenced only by `calculateSpacingSnap`'s signature (`798cc77:spacing.ts:21,1324,1330`) |
| Delete `calculateSpacingSnap` | Yes — Step 3 conditionally authorises it, and it is unreachable | Justified; zero call sites, not on Step 2's path |
| Sweep removed after measuring | Yes — Step 1 instructs removal | Done; constants replaced by the derivation comment |

Nothing in the deletion set is beyond what the brief authorises or what it requires as a direct
consequence. `MAX_DISPLAY_DISTANCE_DIFF` and `resolveDisplayDistance` — the two named must-survive
declarations — are both present and both still imported.
