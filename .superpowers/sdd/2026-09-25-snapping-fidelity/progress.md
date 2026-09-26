# SDD ledger — plan: docs/superpowers/plans/2026-09-25-snapping-fidelity.md

Spec: docs/superpowers/specs/2026-09-25-snapping-fidelity.md (binding authority)
Reference: fork `9efdd78a` at `D:\git-repos\fabricjs-image-editor`, branch `codex/fabric-es`, **read-only**
Base before Task 1: (recorded at dispatch)

## Pre-flight scan

`preflight-scan.md` (550 lines) was produced by a dedicated scan agent and read in full. Its
three tables plus the fork-symbol audit are adopted here by reference; this section records
only what I ruled on.

Scan summary as delivered: pair scan (18 rows), self-consistency scan (10 rows), fork-symbol
audit (**46 symbols, 45 exact, 1 wrong return type — no invented symbol**), 12 confirmed
defects (D1–D12), 5 unverified suspicions, per-task verdicts: Tasks 6, 9, 10 clean; 2, 4, 5
nearly clean; 1, 3, 7, 8 not clean.

**Ruling: the defect class is the harness, not the instruction.** Verdicts 1, 3, 7 and 8 are
"not clean" almost entirely because their *fixtures* cannot fail, not because the behaviour
they specify is wrong. I verified the two structural claims myself before accepting the rest:

- `object:scaled` does not exist in Fabric 7.4.0. The `object:*` keys in
  `src/web/node_modules/fabric/dist/src/EventTypeDefs.d.ts` are `object:moving` (:98),
  `object:scaling` (:101), `object:rotating` (:104), `object:skewing` (:107),
  `object:resizing` (:110), `object:modifyPoly` (:113), `object:modifyPath` (:116),
  `object:modified` (:119), `object:added` (:185), `object:removed` (:188). Grep for the
  literal `object:scaled` over that file returns nothing. **D7 confirmed.**
- `refineScaleSnapPlan` returns the refined plan, not the refinement. Fork
  `scaling/scale-snapping-resolver.ts:342-348` reads
  `refineScaleSnapPlan({plan, refinement}: {plan: ScaleSnapPlan; refinement: ScaleSnapPlanRefinement}): ScaleSnapPlan`.
  **D8 confirmed**, and the plan contradicts itself (`:663` against Task 7's `:863-865`).
- `applyRectangularScalePlan` decodes modes and restores the anchor. Fork
  `scaling/rectangular-scale-interaction.ts:74-105` calls
  `resolveRectangularScaleMultipliers({projectionMode, effectiveValues})` then
  `target.setPositionByOrigin(new Point(projection.fixedAnchor...), transform.originX, originY)`
  then `setCoords()`. **D9 confirmed.**
- `STANDARD_RECTANGULAR_SCALE_CONTROLS` is module-private in the fork.
  `scaling/standard-scale-control.ts:10-12` is `const … = Object.freeze(…)` with no `export`.
  **D12 confirmed.**
- The three dead exports are genuinely unreferenced: `SPACING_CONTEXT_SWITCH_DISTANCE`
  (`constants.ts:6`), `resolveCommonDisplayDistance` (`distance.ts:32`),
  `calculateSpacingSnap` (`spacing.ts:1312`) each have exactly one hit across
  `src/web/packages` — their own declaration. **Task 3 Step 3's deletion list is correct.**
- `index.ts:1` is `import type { Canvas, FabricObject } from "fabric/es";`. **D5 confirmed.**

**Cost if wrong.** The scan is the plan's only adversarial read before 10 tasks of ported
geometry. If it over-reports, the cost is rework I can see in the diff; if it under-reports,
a decorative-`selectable:false` object aligns against content and a resize never releases.

### Rulings on the plan file

I ruled by **amending `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` in place**, not
by carrying 12 corrections in six separate dispatch prompts. `scripts/task-brief` extracts
each task's text from that file, so an amended plan produces amended briefs and there is one
authority rather than two. Each ruling below names the edit made.

| # | Ruling | Cost if wrong |
|---|---|---|
| D1 | **Test 2's fixture is rebuilt** so the plate's centre is genuinely the near candidate at an edge gap < `SNAP_THRESHOLD`, and the step states the test must be shown red before the change. The plan's arithmetic (a 2-unit *centre-to-centre* gap) does not describe the resolver's *edge-gap* test (`movement-snapping-resolver.ts:672`), so adopting it as-is would ship a test that is green before any change. | A fixture that still does not reach the plate. The step now demands the red-before-green run, so it surfaces at the implementer rather than after. |
| D2 | **Test 1's dragged rect is narrowed** so only the neighbour's left edge is in range. The original `left: 98, width: 40` puts the neighbour's *right* edge (140) at the same 2-unit gap as its left (100), and the tie-break resolves to `98`, not `100`. Step 5's teeth check also gains a second assertion so it cannot pass on the self-alignment failure. | A test that fails for the wrong reason and a teeth check that "passes". Both are visible in Step 2/Step 5 output. |
| D3 | **Test 3 stays, relabelled as a regression guard**, and is removed from Step 2's list of tests that must fail. It passes against unmodified code, so as a TDD "failing test" it is misleading; as a pin on behaviour Task 1 preserves it is worth its three lines. | One test that cannot fail. Cheap, and honest once labelled. |
| D4 | **Task 3's fixture and steps are corrected** to the scan's proposal: the hold test steps to `left 208` (past the ~5 acquire threshold, inside the ~10 release threshold) and the release test steps to `215`. The original `203` step sits inside the *acquire* window, so the resolver simply re-acquires the same equal-spacing candidate and the hold is not what produces `200`. Step 2's decision table can therefore report "hold works" when no hold exists, and Step 3 deletes two exports on that evidence. | Task 3's deletion decision rests on a test that cannot distinguish hold from re-acquire. With the corrected fixture it can. |
| D5 | **`ActiveSelection` is imported as a value**, not a type. `instanceof` against a type-only import is erased at runtime; the throw lands inside `guard` (`index.ts:278-286`) and becomes a swallowed `errors.error("snapping", …)`, so the gesture silently never starts. | Silent: a selection gesture that does nothing, with no compile error and no test failure. |
| D6 | **Task 7's `resize()` helper stops asserting its own setup.** The helper sets `scaleX = widthScale` directly, so `getScaledWidth()` is `200 * widthScale` by construction and Task 8's Ctrl test passes with snapping disabled — a direct breach of the plan's own global constraint (`:25`). I ruled the harness must compare the Ctrl step against the non-Ctrl step at the same raw multiplier, plus the exact snapped value for the non-Ctrl case. | Task 8's entire point is unverified, and its test cannot fail. |
| D7 | **The `["object:scaled", stopGesture]` binding is deleted.** The event does not exist; the bindings array casts through `as never` (`index.ts:304`) so the compiler accepts a name that never fires. The existing `mouse:up` binding (`index.ts:269`) already ends the session and clears guides, so nothing is lost. | A resize leaves hold state behind until the next `mouse:down`. Visible as a stale guide. |
| D8 | **Task 5's "Produces" line is corrected** to the fork's signature: it takes `{plan, refinement}` and returns `ScaleSnapPlan`. | A compile error on first use. Low. |
| D9 | **Task 7 Step 3 calls the ported exports** — `resolveRectangularScaleMultipliers` and `applyRectangularScalePlan` — instead of hand-rolling items 5 and 6. The plan's two-line apply reads `effectiveValues[1]` on a `uniform` step (giving `NaN` scaleY) and the wrong axis on a `vertical` step, and skips the `setPositionByOrigin` fixed-point restoration that Task 5 Step 3 requires the resolver to prove. | Wrong resize geometry on uniform and vertical steps, surfacing only in the browser step. |
| D10 | **Task 7 Step 1 authors `SNAPPING_MULTIPLIER`** as a named constant in its test block, marked as the shared value Task 8 imports. Task 8 references a constant Task 7 never creates, and the plan states the rule (`:1046`) without following it. | A compile error in Task 8. Low. |
| D11 | **The stray code fence at `:953` is deleted.** Fence parity over the file: 51 openings, 49 genuine closings, imbalance starting at `:953`, so Steps 2-onward render as code. | An implementer misreads rendered prose as literal instructions. |
| D12 | **Task 6 Step 2 gains one sentence**: taking the "extend `STANDARD_RECTANGULAR_SCALE_CONTROLS`" option means editing a ported file and therefore requires a `// ported: fork 9efdd78a …` marker under the rule at `:20`, because the fork does not export it. | A silent vendored-file divergence. Low; the option is second of three. |

### Rulings on the pair-scan conflicts

**Ruling: Tasks 4 and 5 are dispatched as one unit, not as two independently landable tasks.**
`scale-snap-candidates.ts` imports `ScaleSnapCandidateCategory` and `ScaleSnapCandidateInput`
from `./scale-snapping-resolver` (`:6-9` in the fork), which Task 5 creates — so Task 4 alone
does not compile. The plan acknowledges the tension at `:471` and offers two resolutions
without choosing, and its own sequencing note at `:1225` already treats Tasks 4–8 as one
block. **Decision:** keep the file split as the plan's file lists have it (do not move
`createScaleSnapCandidates` into Task 5), dispatch Task 4 and Task 5 as one brief, and review
their combined diff once.
**Cost if wrong.** A larger review surface for two tasks. The alternative — one task that
writes ~1400 lines of ported geometry — is a worse review surface.

**Ruling: Task 2's `ActiveSelection` guard and Task 7's widening of `readMovementModifiers`
both edit `startGesture` (`index.ts:120-124`), and Task 2 goes first.** The plan gives Task 2
no insertion anchor that survives Task 7's later edit of the same function. Task 2's dispatch
names the anchor explicitly — the guard goes immediately after
`const active = canvas.getActiveObject()` and before the `getObjectExactBounds` read — and
Task 7's dispatch is told the guard is already present. No plan edit needed; the ordering is
already sequential and only the anchor was missing.
**Cost if wrong.** Task 7's edit displaces Task 2's guard. Caught by Task 2's own test, which
Task 7 must keep green.

**Ruling: two line-citation drifts are corrected in the plan** — Task 1 Step 6's
`new-fabric-theme.ts:15-19` (the `backgroundOnly` *style constant*) becomes `:320-330` (the
plate object, one `backgroundOnly` use at `:328`); Task 7 Step 3's `index.ts:126-143` becomes
`:133-143` for the artboard `domain-boundary` push.
**Cost if wrong.** An implementer reads the wrong block. Non-blocking either way.

**Ruling: Task 3 Step 2's "wire `SPACING_CONTEXT_SWITCH_DISTANCE` with the exact value `5`"
branch is struck.** `movement-snapping-resolver.ts:886` already passes
`switchDistance: previousContext ? Number.POSITIVE_INFINITY : 0`, which is strictly stronger
than 5, so following that branch would *weaken* the live hold while claiming to restore it.
Under D4's corrected fixture the branch should not be reached at all; if it is, the
implementer reports it rather than wiring the constant in.
**Cost if wrong.** The constant stays dead and Task 3 deletes it. It has no importers.

### Scan suspicions I did not act on

Items 1–5 of the scan's "Unverified suspicions" are recorded as unresolved and left alone:
`captureVisualReview`'s weak assertion (Task 9 exists to replace it, and Tasks 2/7 inheriting
it is expected); the artboard-plate-versus-artboard-edge guide ambiguity (an inspection step,
not code); the `/none/` phone fixture wait (Task 9's own risk); Task 10's fallback decision
(an open decision the plan deliberately leaves to the implementer); and the `fabric/es` barrel
re-export question (the plan's imports follow existing `snap-manager/*.ts` usage). None blocks
a dispatch; each is visible to the task that would be harmed.

## Second scan pass (after my amendments)

The scan agent re-ran its probes against the amended plan and re-hashed it (`sha256 f04b7d5e…`,
1312 lines). It reported most of D1–D12 as **fixed by my edits** and raised six new items,
O1–O10, of which O4 is the only silent one. Its probe ledger retracts two of its own earlier
readings, which is the reason I asked for the re-run:

- **The Task 1 locked-neighbour fixture was not failing on self-alignment.** Measured: no
  flags → `100`; `locked: true` → `98`; `selectable: false` → `98`. So the current filter *is*
  the cause and my D2 rewrite (narrowing the dragged rect) was aimed at a mis-diagnosis. The
  narrowed rect is still correct — it removes a genuine tie-break hazard — but it is not what
  makes the test red. **Ruling: keep the narrower rect and the revised teeth-check values
  (`98`/`160`), and do not claim in the brief that self-alignment was the cause.**
- **The old plate fixture was `179.5` with and without the plate.** Confirms the plate was
  redundant with the artboard's own `bounds()` and that `178` was unreachable — my D1 rewrite
  was necessary. The revised fixture fails for the stated reason (`158` → `160.5` when the
  plate is admitted).
- **`203 → 200`, `205 → 200`, `206 → 206` at `centerX 200`, and the same hold with the two
  spacing neighbours deleted.** So `bounds()` centre `200` coincided with the equal-spacing
  position and the fixture measured the artboard centre guide, not spacing. **O4 — the one
  finding that would have silently deleted live code.** Fixed: `bounds()` is now off-centre
  (`centerX: 500`), and Step 1's constants are measured by a sweep rather than derived, with
  a delete-the-neighbours confirmation.

| # | Ruling | Cost if wrong |
|---|---|---|
| O4 | **Task 3's `bounds()` is moved off the equal-spacing position (`centerX: 500`) and the hold/release offsets are measured by a sweep, not derived from the constants.** The scan's boundary measurement (206) contradicts the plan's derived 210. | Step 2 reads "hold works" from an artboard-guide artifact and Step 3 deletes two exports on that evidence. Silent. |
| O1 | **Task 7 Step 3 names the exports it needs**: `readMovementMarker` and `readMovementModifiers` are module-private to `index.ts` today, so the step now says to export and import them. | A compile error. Loud. |
| O2 | **Task 2 Step 4 names the `isSupportedActiveSelection` import.** The guard called a symbol no step imported. | A compile error. Loud. |
| O5/O6 | Already ruled (the guard constants live in `scaling-snap-guard.ts`, which Task 5 creates); the scan's second pass independently confirms it, and adds that `scaling-step-snap-guards.ts` imports six symbols from the same file. No further edit. | — |
| O7 | **Task 7's file line drops "minus its `ImageEditor` coupling".** The runtime has no such import; the coupling is in the controller, which is not ported. | An implementer hunts for a coupling that does not exist. |
| O9 | **Task 4's duplicated opening paragraph is deleted** (it appeared verbatim near the top of the task and again mid-task). | Nothing. Cosmetic. |
| O10 | **Task 10 Step 4's "flip the spec's status line from 'design; not yet planned'" is replaced** with a check that it still reads "planned" — the spec line already names the plan (`specs/2026-09-25-snapping-fidelity.md:3`). | An implementer looks for a status string that is not there. |
| O3 | Cosmetic ("three equal-width shapes" where the widths are 60/60/40): the comment now states the widths. | Nothing. |

**The one thing the scan could not settle, which I resolved from source.** Task 7 passes
`event.pointer` as the projection's `pointerStart`. Fabric builds that field in
`commonEventInfo` (`fabric/dist/index.mjs:3193-3199`) from the `x`/`y` given to the action
handler, and `_transformObject` (`:12633-12636`) supplies `localPointer` — the scene point
sent through `target.group.calcTransformMatrix()` when the target is grouped, and the plain
scene point otherwise. So it is the point in the *object's own plane*, not the canvas scene
point, and the fork's controller reads `event.scenePoint` instead. **Ruling: pass `pointer`
through, and do not "correct" it to `scenePoint`** — for an ungrouped target they coincide, and
for a grouped target `pointer` is the one the object's bounds are in. Task 7 Step 3 now states
this and tells the implementer to confirm it in the browser rather than trusting the plan.
**Cost if wrong.** A grouped resize projects the wrong origin, so guides attach to the wrong
edge. Task 7's own capture is the check, and it is the last step before Task 8.

## Task status

(none dispatched yet)

### Plan-text repair pass (before Task 1 dispatch) — placeholders and undefined types

A read-through of Tasks 4–6 against the fork source found five code-block
placeholders and four types referenced but defined nowhere. Every fix below was
made by reading the fork at `9efdd78a`, not by inference.

**Placeholders replaced with the fork's real signatures:**

| Site | Was | Now |
|---|---|---|
| Task 6 Produces | `resolveRectangularScaleMultipliers(/* the fork's inputs */)` | `{ projectionMode: string; effectiveValues: readonly number[] }` |
| Task 6 Produces | `resolveRectangularScalePointerMultipliers(/* the fork's inputs */)` | `{ projection, pointer, mode }` → `…Multipliers \| null` |
| Task 6 Produces | `createRectangularScaleProjectionModes(/* the fork's inputs */)` | `{ projection }` |
| Task 5 Produces | `ScaleHoldState` with `/* the fork's FreeScaleAxisHold \| HeldScaleAxisHold per axis */` | The four real types: `FreeScaleAxisHold`, `HeldScaleAxisHold`, `ScaleAxisHold`, `ScaleHoldState` |

**A production function the plan omitted entirely:** the fork also exports
`createRectangularScaleValues({ mode, multipliers }): readonly number[]`, whose
value arrays Task 5's resolver consumes. Added to Task 6's Produces list with a
test requirement, because Task 5 cannot be written without it.

**Four+ types consumed but never defined.** Task 5's `ScaleSnapPlan` names
`ScaleScenePoint`, `ProjectedScaleEdgePositions` and `ScaleProjectionConstraint`;
Task 6 names `ScaleProjectionModeInput`. None appeared anywhere in the plan.
Added all four, plus `ScaleProjectionEdge`, `ScaleProjection` and
`ScaleProjectionSolution` (the last three are the linear-model types Task 5's
signatures return and were equally absent) at their real owner, Task 4.
`ScaleScenePoint` and `ScaleProjectionModeInput` are noted as living in Task 5's
file because that is where the fork declares them.

**Cost if wrong.** Small and self-correcting: the implementer reads the fork
anyway, so a wrong signature is caught at compile time in the task that uses it.
The reason for fixing it now is different — four tasks named types that no task
defined, which means Task 6's implementer would have had to invent
`ScaleProjectionModeInput`'s shape and Task 5's would have had to invent it
again, differently. Two independent inventions of one type is the failure this
pass prevents.

### Task 10 (Plan A) — two repairs, recorded in Plan A's ledger

Folded into Plan A's Task 10 and recorded there: its Step 1 was a placeholder
comment, and its capture would have been written but never registered.

### Second type pass: six more types referenced across Tasks 5–7 with no definition

The first pass added four types. A systematic sweep (`declared=` vs `referenced=`
per identifier across the whole plan) found six more that Tasks 5, 6 and 7
consume and no task defined. All six are now written out from the fork:

| Type | Owner in the plan | Fork location |
|---|---|---|
| `ScaleProjectionInput` | Task 4 | `scale-projection.ts:20` |
| `ScaleProjectionEdgeInput` | Task 4 | `scale-projection.ts:14` |
| `ScaleSnapCandidateInput` | Task 4 | `scale-snapping-resolver.ts:46` |
| `ScaleGestureBaseline` | Task 5 | `scale-snapping-resolver.ts:95` |
| `ScaleProjectionMode` | Task 5 | `scale-snapping-resolver.ts:38` |
| `ScaleStepProjectionInput` | Task 5 | `scale-snapping-resolver.ts:119` |
| `ScaleSnapPlanRefinement` | Task 5 | `scale-snapping-resolver.ts:153` |

`ScaleProjectionEdgeInput` was not on my list when I started the sweep — it fell
out of writing `ScaleProjectionInput` correctly, which references it.

**One deliberate duplication, resolved rather than left ambiguous.**
`ScaleSnapCandidateInput` is *declared in the fork's resolver* but *produced by*
the fork's candidates module, and Task 4's own note requires keeping the fork's
import direction. My first edit put the definition in Task 4 and then a second
paragraph told the implementer to port the same type from the fork — two
instructions for one type, which is how two homes get invented. Resolved: the
definition lives once, in Task 4's `scale-snap-candidates.ts`; Task 5's resolver
imports and re-exports it. The paragraph in Task 5 now lists which types have
authoritative definitions and where, instead of telling the implementer to
re-derive them.

**A correction to my own first pass.** I wrote that `ScaleSnapCandidateInput` was
"written out in Task 4, first block" before it was — the table asserted coverage
that did not exist yet. Caught by re-running the sweep after editing rather than
trusting the table I had just written.

**Cost if wrong.** Two independent inventions of one type, arriving at Task 6 and
Task 7, producing a structural mismatch that `tsc` reports in a file neither
implementer wrote. Cheap to prevent now; expensive to unwind once both tasks are
committed.

### Correction to my own fix: I introduced a circular type dependency, then removed it

My first attempt at `ScaleSnapCandidateInput` put its definition in Task 4's
`scale-snap-candidates.ts` and told Task 5's resolver to import it. That is wrong,
and the reason is visible only by reading the fork's actual declarations rather
than my summary of them:

- `ScaleSnapCandidateCategory` is declared at `scale-snapping-resolver.ts:30` —
  Task 5's file (`:705` in the plan).
- `ScaleSnapCandidateInput` references it (`:46`).
- So a definition in Task 4 would need `ScaleSnapCandidateCategory` from Task 5.

Task 4 already imports `ScaleProjectionModeInput` and `ScaleScenePoint` from Task 5.
Adding `ScaleSnapCandidateCategory` made **Task 4 import three types from Task 5
while Task 5 imported one from Task 4** — a cycle, in a pair of files the plan
deliberately dispatches as one unit precisely because they are already coupled.

**Fixed: all three candidate/point/mode types live in the resolver, and the
candidates module imports them all.** That is also what the fork does, so the
plan now matches the import direction it claims to preserve. Verified: each of
`ScaleSnapCandidateInput`, `ScaleScenePoint`, `ScaleProjectionModeInput`,
`ScaleSnapCandidateCategory` and `ScaleProjectionInput` has **exactly one**
definition in the plan.

**What I got wrong, precisely.** I wrote a rule ("keep the fork's import
direction"), then made an edit that violated it, then wrote a second paragraph
justifying the violation as "a deliberate duplication, the only one in this
plan". It was neither deliberate nor necessary — it was an artifact of my having
put the definition in the wrong file first. The giveaway was that the
justification had to explain why a duplication was fine, when the fork has no
duplication at all.

**Cost if wrong.** Had this shipped, Task 4's implementer would have hit TS2459
or a genuine cycle the moment it wrote the import, and the fix would have moved a
type between two files after both were written against each other. Caught here
for the price of reading the fork's declarations instead of my notes about them.

### Full-gate step carried a false "known pre-existing failures" claim — third plan to do so

Plan C's Task 10 carried the same sentence as Plan A's and Plan B's gates:
`display-fabric.spec.ts` has two known pre-existing phone-chromium failures,
"confirm unchanged and report; do not absorb them."

**Both tests pass.** Measured on this branch:

```
✓ tests\e2e\display-fabric.spec.ts:322 › keeps repainting as samples arrive  (28.5s)
✓ tests\e2e\display-fabric.spec.ts:671 › is byte-stable at a fixed clock on one platform  (29.4s)
```

All three plans had the identical sentence, presumably copied between them when
they were written. All three are now corrected.

**Why the duplication matters.** Three independent plans granting three
independent implementers permission to accept the same two red tests is three
chances for a real regression to be filed as "the known one". A gate step whose
instruction is "confirm the red tests are still red" is not a gate.

## Citation sweep audited — no action needed here, and one fabricated finding rejected

A cross-plan citation sweep reported rows against this file. Each was re-measured against source
before any edit. **The sweep was wrong on every Plan C row it raised**, so nothing in this plan
changed:

| Sweep claim | Measured |
|---|---|
| `index.ts:78`/`:92` — `readMovementMarker`/`readMovementModifiers` "already **exported**", so Task 8's "export them" is a no-op | **Private.** `:66 function readMovementMarker({` and `:82 function readMovementModifiers({`, both without `export`. The file exports exactly three symbols (`:21`, `:25`, `:95`). The plan at `:1148` is **correct** and its instruction is real work. |
| `index.ts:66-79` / `:82-93` ranges are stale | Correct as written: `readMovementMarker` `:66-79`, `readMovementModifiers` `:82-93`. |
| `:133-143` / `:126-131` (artboard source) stale | Correct: `startGesture` at `:120`, sources built `:126-143`, artboard pushed `:132-143`. |
| `index.ts:1098-1146` "fork-only, unlabeled" | Already labelled at `:1377` — reads "fork `index.ts:1098-1146`". |
| Bare fork paths (`utils/object-filter.ts:28-45`, `scale-snapping-resolver.ts:46`, `standard-scale-control.ts:10-12`) are "ambiguous, need a root" | The fork root is stated **once globally** at plan `:13` and the convention is per-use prose ("The fork's …", `// ported: fork 9efdd78a <path>`). Not ambiguous. |
| `new-fabric-theme.ts:15-19` is wrong, should be `:16-20` | `:15-19` **is** `backgroundOnly` exactly (open `:15`, close `:19`). Plan correct. |

**Ruling: no edit to this plan from the sweep.** The one row with a real defect in it — the
module-private claim — the sweep got exactly backwards, and acting on it would have deleted a
necessary instruction from Task 8 and produced a controller that calls a function it never exported.
**Cost if wrong:** if a reader later finds a genuine stale citation here, this entry records that the
sweep's Plan C rows were measured and rejected individually rather than waved off.

**Standing lesson for this plan's dispatch:** the sweep ran while another plan's implementer held
`ui-copy.ts`, and it reported stale-at-the-time observations with the same confidence as verified
ones. Plan C's tasks are all undispatched, so each brief regenerates from the corrected plan at
dispatch time — and any citation a brief carries gets measured then, not trusted from this sweep.

## Task 1's brief amended before dispatch — one wrong fork path, one claim of mine that was false

Two edits, and the second is the more useful record because I got it wrong first.

**1. The fork path was wrong.** The brief cited `utils/object-filter.ts`; the file is at
`src/editor/utils/object-filter.ts`. Measured with `git ls-tree -r --name-only 9efdd78a | grep
object-filter`. The amendment gives the full `git show` invocation and repeats the read-only rule.

**2. I nearly removed `IGNORED_IDS = ["scene"]`, believing it guarded a rect that does not exist.**
My reasoning: the only full-artboard rect I could find was `artboardPlate`, which carries no id and
is assigned to `canvas.backgroundImage`, so an id filter for it would be dead. I had already written
the amendment saying so when I checked what actually owns the id `"scene"`:

`new-fabric-theme.ts:321-329` — `rect("background", 0, 0, 1280, 720, twilightGradient, 0,
backgroundOnly, "scene")`. A real scene object, id `"scene"`, artboard-sized, `selectable: false,
evented: false` via `backgroundOnly` at `:15-19`.

So dropping `object.selectable === true` genuinely does promote it to a snap target, sitting exactly
on the artboard boundary where it wins most snaps. Step 3's `IGNORED_IDS` is the field that replaces
`selectable`, and the brief was right. **Amendment rewritten to say that, with the citation.**

**Ruling: the brief's `IGNORED_IDS = ["scene"]` stands; the relaxation and the id filter ship
together.** They are one change — removing the structural field without adding the id filter trades
one bug for a subtler one that no existing test would catch.

**Cost if wrong:** if `"scene"` were ever renamed or removed, the ignore entry becomes dead and the
background rect returns as a snap target. The visible symptom is snaps collapsing to the artboard
edge, and Step 1's new fixtures plus Plan C Task 9's behaviour matrix are where it would show.

**Process note, since it is the second time this session:** I formed a confident architectural
conclusion from a partial grep (I searched `artboardPlate`, not the id). What caught it was asking
what value the line I was about to delete actually consumes. Reading a deletion's *argument* is
cheaper than reasoning about its *purpose*.

## Task 2's brief de-lined before dispatch

C2 cited `snap-manager/index.ts:120-133` for the `startGesture` guard. Measured **exact** right now —
but C1 runs first and deletes two clauses from `isSnapTarget` (`object.selectable === true &&` and
`object.get("locked") !== true &&`) a few lines above it, so the citation would be stale by the time
C2's implementer read it. Replaced with the symbol.

**Ruling: for the remainder of these plans, a citation into a file an earlier task rewrites is given
by symbol, not by line.** Four briefs have now been amended for line drift (B9, C2, and A6 twice),
and every drift had the same cause: a brief written from a reading of the tree, consumed after other
tasks moved it. Symbols survive rewrites; line numbers do not. C1's own citations were re-measured
and are exact.

This is cheaper than re-verifying every citation before every dispatch, which is what I was doing and
what does not scale to the ~18 tasks left.

## Task 1 DONE_WITH_CONCERNS — commit `8be1364`; gates run by me, all clean

`npm run typecheck` 0 errors; `npm run lint` clean (317 files); `npm run status:check` passes.

Diff: 3 files, +83/-11 — `excluded-objects.ts` (+6/-…), `index.ts` (+11/-…), `index.dom.test.ts`
(+77). The evidence is the deliverable, exactly as the brief demanded: two new tests with
red-before-green shown.

**Its concern 3 is the third vacuous-fixture catch by an implementer in this plan** — "Brief's Step 2
plate fixture was green before the change", fixed by dropping `selectable: false` from the fixture so
the id, not selectability, is what excludes it. That is the right diagnosis: with `selectable: false`
the plate was already excluded by the field Step 3 removes, so the test proved nothing about the id
list. This is the same failure class as A5's broken instrument and A5's vacuity hole, and it is now
the third time an implementer has caught a defect the brief's author (me) did not.

Concern 2 is also correct and I verified its shape: with `IGNORED_IDS` holding `"scene"`, re-adding
the `selectable` gate does not redden the plate test, because the id list is the arm that excludes
it. The brief's Step 5 teeth check was written against the wrong arm. Reported, not papered over.

Concern 3's measured number (`expected 160.5 to be 158`, not the brief's `160`) is honest reporting
of a Fabric bounds detail — 1px stroke included. Fixture geometry unchanged.

## Ruling: `STATUS.md` is carried in the dispatch prompt, not patched into nine briefs

**Found:** none of Plan C's ten briefs mentions `STATUS.md`. All nine remaining tasks end with an
explicit `git add <src paths>` list, so an implementer following the brief literally never stages it.
C1 has already committed without updating it. AGENTS.md is unambiguous: *"Before each completed task
commit, replace `STATUS.md`'s 'Last completed change'"*.

**Ruling: fix it in the dispatch prompt for every remaining Plan C task; do not edit nine briefs.**
Writing-plans' contract puts a brief's omissions that the brief *cannot know* into the dispatch, and
the dispatch already carries a "Vigilia rules that apply" block naming AGENTS.md requirements the
briefs leave out (probe files outside the tree, don't hand-edit `package-lock.json`, and so on).
`STATUS.md` belongs in that block — it is a repo-wide rule, not task content. Nine brief edits to
restate an AGENTS.md rule would be churn, and the rule would drift out of them again at the next
amendment.

**For C1 specifically:** carried into its review as an explicitly named check, so its fix round (if
any) picks it up; otherwise it becomes a one-line docs commit. Cost if wrong: one task's STATUS entry
lands a commit late, and the file's "Last completed change" briefly describes A6 rather than C1.

**Also noted:** C10 does stage `STATUS.md`, but as part of "close the review" — that is a final
summary task, not the per-task update this rule requires, so it does not discharge the obligation for
C1-C9.

## Task 1 review adjudicated (review-<base>..8be1364.diff) — 1 Critical accepted, and it was MY brief's error

Verdict: spec compliance ❌, task quality **Needs fixes**. One Critical, one Important, Minors.

**The Critical is real, and I verified it three ways before accepting it — because it contradicts an
assertion I made in C1's own brief.**

The plate call is `rect("background", 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly, "scene")`
(`new-fabric-theme.ts:320-330`), and the helper is
`rect(id, left, top, width, height, fill, radius, interaction, paletteId?)` (`:541-563`). So
**`"background"` is the `id`; `"scene"` is the ninth argument**, becoming
`vigiliaPaint: { fill: "palette.scene" }`. Confirmed by `new-fabric-theme.test.ts:64`, which asserts
the plate object's `id` is `"background"`, and by a product-wide grep for `id: "scene"` returning
exactly one hit — C1's own fixture. The fork's list is
`['montage-area', 'background', 'interaction-blocker']`.

### Root cause: the spec asserted it, I propagated it, and I "verified" it by misreading an argument

This is not a brief typo. **`specs/2026-09-25-snapping-fidelity.md:83-84` — the binding authority —
states "`IGNORED_IDS` is currently empty; the id for the artboard plate is `scene`
(`new-fabric-theme.ts:329`)".** Line 329 is the `paletteId` argument.

I then wrote C1's brief from that, and — worse — the brief records that I *doubted it and re-verified*:
"**Step 3's `IGNORED_IDS = ["scene"]` is load-bearing… verified, after I first doubted it.**" What I
verified was that the plate is a real, `selectable: false`, artboard-spanning object in
`getObjects()`. That is true. What I took on trust was **which string is its id**, and my "verification"
consisted of reading the call site and reading a positional argument as the id.

That is the third instance this session of the same error class, and the first where the error is in
the *spec* rather than in my reading of it: **my rulings about what code should do have been sound;
my rulings about which existing thing to touch have needed the read, and here I read the right line
and mis-parsed it.**

**Corrected in the spec** (the plate's id, the misreading, and the fork's real list, so the authority
no longer says `scene` anywhere). C1's brief's own claim is superseded by `task-1-fix-brief.md`.

**Also corrected: two stale current-doc claims about the now-deleted predicate parity.**
`plans/2026-09-25-editor-viewport-and-mechanics.md:1061-1064` said the select-all filter "is the same
predicate `snap-manager/index.ts:38` uses" — false as of C1. Rewritten to state the deliberate
divergence and why (a snap target may be locked; a selection member may not). The third site,
`editor-session.ts`'s comment, is production code and went into the fix brief instead of being patched
by me.

**Cost if wrong.** None — measured, not reasoned. The alternative (leaving the list as `["scene"]`)
ships a filter that excludes nothing while reading as a completed half of the task, and the plan's own
Step 6 browser check is what would eventually have surfaced it as a stray guide.

### Why nothing went red, which is the part worth remembering

The artboard's own synthetic candidate source supplies the same 0/1280/640/360 positions at
`domain-boundary` category, and `MOVEMENT_CANDIDATE_CATEGORY_PRIORITY` ranks `domain-boundary` above
`edge`, so **exact ties are masked**. Green tests were the expected outcome of the defect, not
evidence against it. What is not masked is the ±0.5 stroke edges (nearer than the artboard's exact
0/1280, and distance is compared before category) and the plate's entry into `spacingSources` spanning
the whole artboard. A whole test suite can be green while a filter excludes nothing, whenever two
sources agree on the positions in question.

### Fix round 1 dispatched

Brief `task-1-fix-brief.md`. Three fixes, three teeth checks (empty the list; restore the `selectable`
gate; point the derived fixture at the wrong object), plus the Step 6 browser capture that has still
never been run and is the check that would have caught this. Its fixture becomes **derived** from
`createNewFabricTheme()` rather than a hardcoded string, so the drift cannot recur.

### Correction to my own C1 fix brief, caught before the implementer wrote the test

My Fix 2 snippet was `createNewFabricTheme().scene.objects.find(...)`. **It does not compile**:
`FabricThemeEnvelope.scene` is `Readonly<Record<string, unknown>>` (`fabric-envelope.ts:29`), so
`.objects` is `unknown` and `.find` is a type error. The repo already has the idiom at
`new-fabric-theme.test.ts:61-63` — cast to `readonly Readonly<Record<string, unknown>>[]` — and my
brief told the implementer to follow the repo's patterns in the same breath as showing them a snippet
that does not. Brief corrected and the correction sent to the running implementer.

**This is the fourth instance of the session pattern in a single fix round** (see the C1 root-cause
entry above): the *decision* was right — derive the id from the theme so the two cannot drift — and
the *artifact I handed over* was wrong. Cheap here; it would have cost a failed `npx vitest run` and a
confused round had it not been caught. The check that caught it was reading the type of the thing the
snippet dereferences, which is the same check that would have caught the `"scene"` misreading in the
first place.

## Task 2's brief amended before dispatch — Step 6 could pass while proving nothing, and one unverified rationale

Read C2's brief against the live tree while C1's fix round runs. Step 6 was the same defect class A5
shipped and had to repair: a browser step with no point-derivation rule.

**Its Step 6 said** "Rebuild and check that dragging a two-object marquee selection still snaps to a
neighbour, and that a deliberately scaled text selection does not join a snap gesture."

**Three problems, all verified reads:**

1. **No derivation rule for the points.** A5's brief had the identical hole and the measured
   consequence — Task 2 of the sibling viewport plan made the canvas **host-sized**, so
   `box.x + (sx / 1280) * box.width` is no longer the artboard mapping, and an off-canvas literal
   passes every "nothing moved" assertion. A5 then had to build the correct helper in
   `editor.spec.ts:~1985-2015` (via `artboardScreenRect()` + `boundingBox()` + a rect-derived scale).
   C2 would have re-derived a point from nothing, and it would have been the second copy of that
   maths in the same file.
2. **No vacuity guard.** With a positive test whose expected value can equal the start position, a
   drag that reaches nothing satisfies it.
3. **No named observable.** "Check that it still snaps" is not assertable as written, and the obvious
   probe — looking for guides among `getObjects()` — finds nothing, because guides are **painted onto
   the selection context** (`snap-manager/guide-renderer.ts`), not Fabric objects. That is the same
   defect I corrected in Plan A Task 10 (`guides are not Fabric objects`), recurring in a second plan.

**Amended** to: reuse A5's helper, extracted to one shared function because there are now three
consumers; assert the derived point is inside the canvas; assert **positions read through the bridge**
with expected values computed from the neighbour's real geometry; state the negative test as "the
final position is the unsnapped one"; and require a vacuity guard plus a report of which assertions
would fail if the guard were removed. I deliberately did **not** write a code block — I have not
measured these fixtures' numbers, and a fabricated assertion would be worse than an instruction, which
is the lesson the C1 round just taught me twice.

### Also corrected: the dropped clause's rationale was an unverified claim

C2's brief justified dropping the fork's per-child kind allow-list with "every Vigilia scene object is
text, shape, chart, group or image, all of which support movement snapping." **I read the fork to check
it, and that rationale is wrong as stated.** The fork's list is
`FabricImage || Textbox || isShapeGroup(object)` (`movement-snapping-controller.ts:193-196`), and
`isShapeGroup` is false for a plain group (`specs/.../shape-domain.spec.ts:27`). So the fork's list
would refuse **a plain `Rect`** and **a `VigiliaChart`** — which extends `FabricObject` directly
(`chart-object.ts:48`), outside all three arms.

The clause is still correctly dropped; only the reason was wrong, and it is now recorded as the real
one: the fork needed its allow-list because its *movement/scale* path was type-specific, while
Vigilia's snap path is type-agnostic (`getObjectExactBounds` takes any `FabricObject`). Naming the
wrong reason is what lets a later reader re-litigate a decision — the pattern this ledger has now
recorded four times in one round.

**Cost if wrong.** Both changes are test-and-comment only. The alternative is a browser test that goes
green while rendering nothing, in the plan whose sibling already shipped that exact bug.

## C3's citations all verify; two of its rationale claims did not — corrected in the plan

Read every citation in C3 against source before dispatching it:

| Citation | Verdict |
|---|---|
| `constants.ts:6` `SPACING_CONTEXT_SWITCH_DISTANCE = 5` | exact |
| `constants.ts:7` `SPACING_SNAP_HOLD_MARGIN = 5` | exact |
| `distance.ts:32` `resolveCommonDisplayDistance` | exact |
| resolver `:1302` `spacingRelease` | exact |
| resolver `:886` `switchDistance: previousContext ? +Inf : 0` | exact |
| resolver `:765`, `:875` `previousContext` | exact |
| `spacing.ts:237` `previousContext` | exact |
| `SPACING_CONTEXT_SWITCH_DISTANCE` unused product-wide | confirmed — the only hit is its own declaration |
| `resolveCommonDisplayDistance` unused product-wide | confirmed, and `distance.ts` is imported by four other files but **not** via the barrel, so removing the export is contained |
| `calculateSpacingSnap` unreachable | **confirmed** — one match, its own definition; `spacing.ts` is imported by three product files and a test, none naming it |

The sweep instruction is sound for a subtler reason than the brief gave, and **two rationale claims in
the plan were false**:

1. **"the equal-spacing optimum tracks the pointer"** — it does not. The equal-spacing solution for a
   40-wide object between flankers ending at 160 and starting at 280 is the fixed position 200, and the
   object is 40 wide — not 60 as the fixture comment says. What actually makes a small offset prove
   nothing is that the resolver only *reaches* a candidate while the pointer is within `acquire` of it.
   Rewritten to say that, and the sweep is now explained rather than asserted.
2. **"Under §175 they must not simply be deleted without first establishing whether the behaviour they
   provided exists. The evidence says it does."** — the evidence says *equivalent behaviour* exists, not
   that these constants provide it. The resolver replaces both by construction: the live window is
   `(5 + 5) / zoom` and the live switch distance is `+Infinity` when a context is held — strictly
   stronger than the constant's flat `5`. Added as its own paragraph, because it is the reason Step 2's
   "stop and report, do not wire it in" branch is correct rather than merely cautious: wiring the old
   constant back would weaken the live rule while claiming to restore it.

**Cost if wrong.** The sweep still decides the outcome and the assertions are unchanged, so a wrong
rationale here changes no result — it changes whether the implementer understands *why* the second
branch is not a failure to fix. The alternative is an implementer "completing" the task by reintroducing
a weaker rule.

## C4's test fixture had two real defects — a type from the wrong enum, and arithmetic that does not hold

Pre-verifying C4 (the largest port: 130 + 526 fork lines) against the read-only fork. The fork paths and
line counts check out exactly (`scale-snap-candidates.ts` 130, `scale-projection.ts` 526). Its supplied
test did not.

**Defect 1 — `variables: ["multiplier-x"]` is not a member of the type this API accepts.**
`createScaleProjection` takes `ScaleProjectionVariable = 'scale-x' | 'scale-y' | 'uniform-scale' |
'text-width'` (`scale-projection.ts:11`). `multiplier-x` belongs to a **different** enum,
`RectangularScaleProjectionVariable` (`rectangular-scale-gesture-projection.ts:20`), which
`SNAP_VARIABLE_BY_RECTANGULAR_VARIABLE` *maps to* `scale-x` before the projection API ever sees it
(`:154-158`). So the fixture is a type error against the ported source as written, and the implementer
would have "fixed" it by guessing at a coefficient.

**Defect 2 — the asserted numbers do not follow from the fixture.**
`projectEdgePosition` is `baselinePosition + coefficient * (value - baselineValue)`. With
`baselineValues: [1]`, `values: [1.2]`, coefficient 1 and `bounds.right = 300`, the right edge projects
to `300 + 0.2 = 300.2` — **not the asserted `320`**. The comment's model ("one scene unit per unit of
the variable") is a different convention from the numbers' model (absolute width, baseline 200).

**The authority is the fork's own spec, which I read rather than re-deriving.**
`specs/src/editor/text-manager/scaling/text-width-resize-projection.spec.ts:31-46` builds the projection
through `createScaleProjection`, then asserts
`positions[movingEdge]` ≈ `fixture.bounds[movingEdge] + (25 * coefficient)` with
`values: [gesture.baselineWidth + 25]` and `coefficient: 1`. That is the real convention: the variable
**is** the width, `baselineValues` carries the baseline width, and the coefficient is scene units of edge
movement per scene unit of width. The rotated case (`:47-80`) pins the same convention with
`coefficient = cos(30°) * 1.5`, which is also where Task 6's rotation case should take its shape.

**Rewrote the fixture to that convention** — `variables: ["text-width"]`, `baselineValues: [baselineWidth]`,
`values: [225]`, expectations `325` / `100` / `340` / `null` — and **verified every one arithmetically**
by re-implementing the fork's `projectEdgePosition` and `resolveSingleConstraint` and running them: it
printed `325`, `100`, `240 → 340`, and `null`. Assertions are `toBeCloseTo(..., 9)` rather than `toBe`,
since the solver divides through `variableSceneWeights²` and exact float equality is not what the fork's
own spec uses either.

**Cost if wrong.** Caught by the compiler for defect 1 and by the test for defect 2, so the cost was a
dispatch either way; the alternative was the implementer inventing a coefficient convention and a
later task's rotation case inheriting it. The bigger point: this is the fifth time this session that a
brief's *prose* was sound and its *fixture* was not, and the second time the fix came from reading the
source's own tests instead of the source.

## C6's two empty test bodies had an exact source in the fork that the plan never named — amended

C6 leaves two of its four test bodies as comments ("Take the expected corner positions from the fork's
scaling-controls specs") and points at `e2e/tests/snapping-manager/**/scaling-*-controls.spec.ts`. Verified
against the fork: those e2e specs exist (seven of them), the three source files exist at the stated line
counts (849 / 294 / 83), and the rotation case is correctly deferred here from C4.

**But the plan named the wrong source.** The fork has a purpose-built **unit** fixture for precisely this,
which the brief never mentions:

- `specs/test-utils/snapping/rectangular-scale-gesture-projection.ts` — **546 lines**, exporting
  `createRectangularScaleProjectionFixture({ controlKey, angle, width, height, centered, originalScaleX/Y })`
  (returns a whole gesture: `transform`, `pointerStart`, `control`, `origin`, `fixedAnchor`, `u`, `v`,
  `baselineBounds`, `sourceCorners`), plus `moveFixturePointer`, `projectFixtureBounds`,
  `resolveFixtureFreeMode`, `installRectangularScaleGeometryContract`, `useRectangularScaleGuide`.
- `specs/src/editor/snapping-manager/scaling/rectangular-scale-gesture-projection.spec.ts` — drives **all 24
  control×rotation cases** (`RECTANGULAR_SCALE_CONTROL_KEYS` × `RECTANGULAR_SCALE_TEST_ANGLES` = `[0, 30, 90]`)
  through `it.each`, with expectations from `projectFixtureBounds`.

Two things made this worth amending rather than leaving to the implementer:

1. **`projectFixtureBounds` is an independent re-derivation of the expected bounds**, not a call back into
   the code under test. That is what makes the bounds assertions real rather than circular — an implementer
   hand-building expected corners would almost certainly derive them with the same formula they are testing.
2. **The e2e specs are the browser half.** A unit expectation sourced from a browser spec is exactly the
   mismatch that produced C4's bad fixture, where the numbers were browser-shaped but the API unit-shaped.

Also recorded a third trap the fork's spec exposes but the plan did not: `resolveFixtureFreeMode` maps
`ml`/`mr` → `horizontal`, `mt`/`mb` → `vertical`, corners → `free`, and a mode mismatch surfaces as a
multiplier of `1` on the axis you expected to move rather than as a thrown error — silent, and exactly the
kind of thing a hand-written transform would hide.

**Cost if wrong.** One paragraph. The alternative is the rotation case — the one the plan itself calls
"not optional" — being written from a browser spec's prose, which is how C4's fixture went wrong.

## C4 and C5 must be dispatched as one unit — verified, and it is a genuine constraint not a preference

C4's `scale-snap-candidates.ts` imports `ScaleSnapCandidateCategory` and `ScaleSnapCandidateInput` from
`scale-snapping-resolver.ts`, which C5 creates. Confirmed in the fork: `scale-snap-candidates.ts:2-9`
imports from both `./scale-projection` **and** `./scale-snapping-resolver`. So C4 cannot compile alone and
the brief's instruction to run both and the suite once at the end of C5 is correct as written.

C5 is the largest dispatch in the plan: 2,615 ported lines across three files (1,269 + 65 + 1,281), all
fork counts verified exact. **Ruling: C4+C5 go out as one dispatch on a capable model**, with C4's files
written first per the brief, and the pair reviewed as one unit. Splitting them would require inventing a
home for the two candidate types, which the brief explicitly forbids and which the fork's own import
direction contradicts. **Cost if wrong:** one oversized review seat; the alternative is a fabricated type
owner that diverges from the fork.

## C8's central instruction was wrong — reusing `readMovementModifiers` drops Shift silently

C8's Interfaces block said: reuse `readMovementModifiers` (`snap-manager/index.ts:81-93`) "rather than
writing a second modifier reader." Measured:

- The real function is at **`:79-90`** (brief's `:81-93` is off by two), module-private, signature
  `{ event: { readonly e?: unknown } | undefined } → { readonly ctrlKey: boolean }`.
- **It reads `ctrlKey` only.** There is no `shiftKey` anywhere in it.
- The fork's scale path reads **both** from the raw pointer event:
  `rectangular-scale-interaction.ts:248-251` → `ctrlKey: 'ctrlKey' in pointerEvent && pointerEvent.ctrlKey === true`
  and the same for `shiftKey`.
- `ScaleSnapModifiers` requires both: the resolver **throws** unless both are boolean
  (`scale-snapping-resolver.ts:626`).

So following C8 literally yields a `shiftKey: undefined` in the intent — either a throw at the resolver,
or (if the port is loose) a Shift-constrained resize that silently behaves as though Shift were not held.
The failure mode is the bad kind: the Ctrl half works, so the feature looks implemented.

**Ruling: widen the one reader, do not add a second.** The movement path only needs `ctrlKey` today, so an
extended reader returning `{ ctrlKey, shiftKey }` keeps a single owner and cannot drift from the scale
path — which is what C8's original instruction was *trying* to achieve, stated against the wrong function.
Amended the plan with the measured signature, the fork's two-key read, and the resolver's throw. The
implementer may still choose a second reader, but must say so in the report rather than silently reading
Shift from a function that does not provide it.

**Cost if wrong.** One paragraph and a slightly wider private helper. The alternative is Shift appearing to
work in the mouse handler and being dropped before the resolver — invisible to every unit test that builds
its own `modifiers` object, which is all of them, and reachable only by an author holding Shift during a
resize.

## C9's claim about the fork is accurate; C6's is the mismatch worth naming

C9 says the fork "carried ~65 snapping e2e specs across `shape/`, `text/`, `image/`, `group/` and
`selection/`". Measured: **62** specs under `e2e/tests/snapping-manager/`, in seven directories
(`image/`, `selection/`, `text/`, plus the others) — so "~65" is right in spirit and the directory list is
close enough to be non-misleading. No amendment: C9 reads the matrix from the fork itself in its own Step 1
rather than from a transcription, which is the right shape.

## Tasks verified clean this pass

C7 (fork `scale-snapping-runtime.ts` = **372** lines, as stated; no name collision with the existing
snap-manager barrel). C10 (gate task, docs-only). C4's fork paths and counts (130 / 526 exact), C5's
(1,269 / 65 / 1,281 exact), C6's (849 / 294 / 83 exact). C2's `isDimension`/rollback citations were checked
in the earlier pass.

## Ruling: C4+C5 waits for A7 to commit, despite disjoint file sets

A7 (group entry) edits `grouping-manager/index.ts`, `editor-interaction.ts`, `editor-session.ts`.
C4+C5 create only new files under `snap-manager/scaling/`. No path overlap — so the standing
"queue behind a running implementer whose file set it intersects" rule does not by itself hold C4+C5 back.

**Held anyway**, because C4's brief states in terms that C4 **does not compile on its own** (it imports
types that C5 defines; the two dispatch as one unit). A half-landed C4 turns the tree red for reasons
that have nothing to do with A7, and A7's gate is a full-suite run. Two implementers in one worktree
means the second one's red is indistinguishable from the first one's break.

**Cost if wrong.** Serialising costs wall-clock — C4+C5 sits idle for the length of A7. Running them
together risks A7 chasing a failure it did not cause, or committing on top of a tree that does not
build, which is worse than idle. A7 was dispatched first and is already moving; it keeps the slot.

Once A7 commits, dispatch C4+C5 immediately.

## C4 and C5 briefs corrected: the test sources, and the types C5 only half-declared

Two defects, both found by reading the fork rather than the plan.

**C4's test sources were the wrong files.** It pointed at `e2e/tests/snapping-manager/**/scaling-*-controls.spec.ts`
for its expected numbers. Those are browser specs against a manager that does not exist in Vigilia until
Task 6. The unit fixtures are the real convention authority: `specs/test-utils/snapping/scale-snapping-core.ts`
(167 lines) builds exactly the `ObjectBounds`-with-derived-centre shape C4's `bounds` argument takes, and
its `createScaleBaseline` shows the coefficient convention (`{ edge: "right", coefficients: [width, 0] }` —
the lever arm in scene units, one slot per variable, `0` for a variable that does not move that edge) that
makes C4's hand-written fixture's `left` immovable. Amended to name both files and to read them in full.
Not ported into Vigilia — they live under the fork's `specs/`, and Vigilia's tests build fixtures inline.

**C5's "every type this block references is now written out somewhere" was false.** Measured against the
fork, seven exports the brief *uses* had no body anywhere in the plan: `ScaleGestureBaselineInput` (:93),
`ScaleSnapTransition` (:160), `ScaleDomainAxisVerdict` (:187), `FinalScaleDomainVerdict` (:190),
`ScaleScenePoint` and `ScaleProjectionModeInput` and `ScaleSnapCandidateInput` (which the table claimed
were "written out in Task 5's block" — they are not in it), plus `createScaleProjectionConstraints` (:136),
which the brief omitted entirely. That last one **has a live caller**: `scale-snapping-resolver.spec.ts:4`
imports it and `:28` calls it — and C5's own Step 3 tells the implementer to port from that spec. Handing
an implementer a spec that calls a function the brief never declares is how a port invents a shape a later
task disagrees with. All seven bodies are now written out with their fork line numbers.

**Cost if wrong.** Nothing was changed about the algorithms — these are declarations copied verbatim from
the fork, and the plan already instructs byte-comparability with `9efdd78a`. The alternative was an
implementer guessing at `FinalScaleDomainVerdict`'s member names while the fork's spec asserted against them.

Also amended C5's Step 3 to name `specs/src/editor/snapping-manager/scaling/scale-snapping-resolver.spec.ts`
(1,109 lines, ~34 cases) as the direct source, with `scale-snapping-core.ts` as its fixture module — C5 had
been pointing at a directory listing rather than the file written against this exact API.

## C1 CLOSED — `8be1364` + fix round 1 `69e5121`

Fix-round re-review verdict: **all three findings ADDRESSED, no new Critical or Important breakage.**
The Critical (`IGNORED_IDS` held the wrong string and excluded nothing) is fixed at
`excluded-objects.ts:10` — now `["background"]`, cross-checked against `new-fabric-theme.ts:320-330`,
where `rect()`'s ninth positional argument is `paletteId` and the *eighth* is the id. The Important
(plate fixture sharing the constant's wrong string) is fixed by deriving the id from
`createNewFabricTheme().scene.objects`, guarded by `expect(plateId).toBeTypeOf("string")` ahead of the
`Rect` construction, so fixture and constant can no longer agree by coincidence. The doc comment's false
predicate-parity claim against `snap-manager` is replaced with the real distinction (snapping *does*
align to locked objects; this filter is deliberately stricter).

The re-reviewer verified all three teeth checks are credible by arithmetic rather than by trusting the
report — including the interesting case where the third check's `toBeTypeOf` guard is what fires, which
the implementer had reported honestly instead of dressing up.

**Two out-of-scope observations, neither actioned:**
- `canvas-nudge.dom.test.ts` never calls `endBurst`; the undo/redo seam's guarantee rests on the session
  wiring (`editor-session.ts:281,285`), not on the nudge module's tests. Non-blocking, and Plan A owns it.
- `index.dom.test.ts:212-215` describes the plate as centred at (200, 150) — true of the fixture's
  400×300 bounds, not of the real 1280×720 theme. The comment says it is the fixture's frame, so it is
  clear rather than wrong.

`docs/evidence/screenshots/editor-snap-guides-desktop-chromium.png` remains modified-and-unstaged: it is
evidence the browser check rewrote. It stages with the task that owns `docs/`, not in a fix commit.

## Plan C's Review Focus item 5 pointed at the wrong task, and "one unit" was on its way to meaning "one commit"

Two small corrections to the plan, found while walking the residual Review Focus items.

**Item 5 is Task 5's, not Task 4's.** The list read "A resize that never releases … → Task 4", but release
lives in `ScaleSnapThresholds` (`acquire`, `release`, `spacingRelease`, `verification`) and in the resolver
that reads them — and Task 4 is the projection-only file, which has no hold state to release. Item 5's own
sketch case ("a hold that releases past the release threshold") is already in Task 5's Step 3 list, so the
work was assigned correctly twice; only the pointer was wrong. Amended, with the reason, so an implementer
reading the focus list does not go looking for release state in a file that has none.

**C4+C5's "dispatched as one unit" now says explicitly that it is not one commit.** Step 6 of each task
already commits its own files, and the pair-compiles-together rule is about the dispatch, not the history.
Left implicit it reads as licence to bundle forty ported lines into a single commit, which would make any
Task 5 fix round reconstruct the task boundary by hand.

**Item 3 is Task 4's, and it stays.** A naive reading of "→ Task 6" says the rotated-control case belongs
with the gesture projection, but `projectScaleEdgePositions` is exactly the code that would ignore rotation
if it projected along screen axes, and Task 4's Step 3 already pins the four cases that show it does not.
Task 6's Step 3 keeps the richer 8×3 control×rotation matrix, so the two are additive rather than
duplicated. No change.

**Cost if wrong.** Nothing in the ported code. Both amendments are pointers, and a pointer that sends the
next reader to a file with no release state costs a dispatch.

## C2's brief holds up under re-verification, including a paragraph added earlier against the wrong reading

Re-read the regenerated C2 brief after the plan edits. Three things checked against source rather than
against the note that put them there:

- **The `import type` trap is real and is the best paragraph in the brief.** `index.ts:1` reads
  `import type { Canvas, FabricObject } from "fabric/es";`. Adding `ActiveSelection` to that line and
  using `instanceof` compiles, passes every unit test, and fails only at runtime —
  `TypeError: Right-hand side of 'instanceof' is not an object` thrown inside `guard` (`:278-286`), which
  turns it into a swallowed `errors.error("snapping", …)`. The gesture silently never starts, and no
  test in the repo can see it. Step 4's explicit value-import split and Step 6's browser check are the
  only two things standing between that and a shipped regression.
- **The dropped-clause accounting is correct.** The fork's `_isSupportedActiveSelection` has three
  substantive clauses plus a kind allow-list; Vigilia's comment is right that the allow-list is empty
  here (every object is text, shape, chart, group or image), and wrong to the extent it implies the
  other two clauses are also unnecessary. The brief keeps them and records the drop in the file header,
  which is what §175 requires.
- **The `!` non-null assertion in the parented-child fixture is safe**: `group.getObjects()[0]` under
  `noUncheckedIndexedAccess` needs it, and the group was just built with one child.

No amendment. C2 is dispatch-ready.

## C7 re-verified — the brief's two riskiest claims are the two I checked hardest, and both hold

C7 is the task that binds the whole scaling subsystem to a real gesture, so it is the one where a wrong
brief costs a dispatch rather than a fix round. Re-read it against source:

- **`readMovementMarker` / `readMovementModifiers` are module-private and on the right lines.** Measured:
  `index.ts:63` and `:79` (the brief says `:66-79` and `:82-93`, two to three lines off, both pointing at
  the right functions — and the brief cites them by symbol, so the drift is harmless). `index.ts` exports
  three symbols and neither is one of them. The instruction to export both and import them in the new
  controller is right.
- **The modifier widening C8's ruling produced is already consistent here.** C7 step 4 says "widen that
  helper to return `shiftKey` alongside `ctrlKey` … `index.ts:81-93`". That is the same ruling, reached
  independently from the scale side. Good — it means the widening is required by two tasks, not one, and
  C7 is dispatched before C8.
- **The `object:scaled` paragraph is the most valuable one in the task.** Fabric 7.4.0 has no
  `object:scaled`; the bindings array casts through `as never` (`index.ts:304`), so a typo'd event name
  compiles and silently never fires. Reusing the existing `mouse:up` teardown is correct and the
  idempotence argument (`stopGesture` guards on `gestureActive`, `finishSession` returns
  `didCleanup: false`) is verifiable in source.
- **The zero-delta rule is cited correctly** (`index.ts:218-231`): a zero-delta movement plan still
  verifies its token, with the comment explaining that leaving it pending wedges the gesture. C7's step 6
  applies the same rule to `resolveScalePlan`, which throws on an unverified token.
- **The pointer-plane warning is the one thing C7 cannot verify and says so.** `object:scaling`'s
  `pointer` is `localPointer` — the scene point pushed through `target.group.calcTransformMatrix()` for a
  grouped target — not the canvas scene point, and the fork's controller reads `event.scenePoint`. The
  brief tells the implementer to confirm this against the real pipeline before the capture and names the
  symptom if it is wrong (guides attached to the wrong edge). That is the right shape for an unverifiable
  claim: state it, name the failure, require the check.

No amendment. C7 is dispatch-ready.

## C9 amended once — the brief cited a defect as the convention to copy

C9 is the behaviour matrix, the task whose whole purpose is to replace a verification that could not
fail. A brief that tells the implementer to copy the very bug it is meant to catch is the worst class of
defect this pre-verification pass finds, so it got a close read.

- **Its coordinate-mapping citation was wrong and dangerous.** The brief said to map artboard
  coordinates "through the canvas box, as `editor.spec.ts:1542` does". `:1542` is inside a
  `containsPoint` predicate — not a mapping of any kind. The canvas-box mapping is exactly the defect
  Plan A's Task 10 Step 1 exists to remove: the canvas is host-sized, the artboard is contain-fitted
  inside it, so `box.x + (n / W) * box.width` is off by the `ty` it drops. Copied into a brand-new spec
  file, it would have produced a matrix that tests the wrong pixels and passes. Amended: get artboard
  coordinates through `artboardScreenRect()`, reuse `editor.spec.ts`'s `sceneToClient` / `clientOfScene`
  (which Task 10 Step 1 creates at file scope), and do not write a second mapping.
- **The debug-handle citation is right but weak.** The brief says the handle exposes `canvas.item(i)`,
  cited as `editor.spec.ts:601`. The lookup by `key.startsWith("vigilia-fabric-editor-")` is the real
  convention and the brief states it; but `item(i)` is an index into fixture order, so a case that reads
  "the resized object" by index breaks silently when a scene gains an object. Amended to prefer
  `getObjects().find(o => o.get("id") === …)`.
- **The `~65` spec count measures 62.** `git ls-tree -r --name-only 9efdd78a | grep
  e2e/tests/snapping-manager/` and filtering to `.spec.ts` gives 62 across five directories — `selection/`
  34, `text/` 11, `shape/` 8, `image/` 5, `group/` 4 — not five classes' worth spread evenly as "~65"
  suggests. Left unamended: the number is approximate colour, C9 Step 1 reads the matrix from the fork
  itself, and the directory counts are the informative part. The plan now names the five directories in
  the right order.
- **The README row citation holds.** `docs/evidence/screenshots/README.md:34` is the `Editor mechanics`
  row and it does already list `editor-snap-guides` / `snaps a dragged object`, so "add the resize
  capture to the same row" lands where the brief says.
- **Step 5's git command stages `docs/evidence/screenshots` wholesale.** That is the pattern the other
  plan tasks use and the captures are rebuilt deterministically, but it will also stage the three
  screenshot PNGs already dirty in the worktree from A6's rounds. Noted, not amended — a
  `git status` check before staging is already required repo-wide, and a capture-diff review is the
  point of the directory.

Dropped the stale `editor.spec.ts:1529` line citation for the skip clause in the same edit: the clause is
a three-line `test.skip(testInfo.project.name !== "desktop-chromium", …)` and appears in every test, so
citing one line number for it was noise that rots. C9 is dispatch-ready.

## C10 amended five times — the close-out task was written against a spec and a STATUS.md that do not exist

C10 is prose-only, which makes it the task most likely to be waved through and the one where a wrong
citation costs least to fix and most to discover late: it is the last commit before the gate, and it is
the commit that declares the work verified. So it got the same source read as the code tasks.

- **The fallback path's symbol chain named a function that does not exist.** Step 3 cited
  `_resolveObjectMovementContext` → `_applyMovementObjectSnap` → `_applyMovementVisualGuides`. The
  middle name is invented: `grep` over the fork's `snapping-manager/index.ts` finds `_applyObjectMovementSnap`
  (`:572`) and `_applyMovementGuideSnap` (`:629`), never `_applyMovementObjectSnap`. The cited line range
  `:1098-1146` also lands on `_applyMovementVisualGuides` alone, not on a chain. Amended to name all five
  symbols with their real lines, cited by name rather than by range, with an explicit note that the old
  name does not exist so an implementer does not hunt for it. This matters more than a usual citation bug:
  Step 3's whole deliverable is a recorded decision about this path, and a decision about a path you
  cannot find is a decision about nothing.
- **"the spec's §5" is not a section.** The spec's section 5 is `## Key decisions to make in planning`,
  whose item 3 is the fallback question. "Record it in §5" is ambiguous between that and `## Scope`'s
  item 5, which does not exist (Scope has three items). Amended to name the heading and the item.
- **§175 has no design link to add to.** The step said to "add `2026-09-25-snapping-fidelity.md` to its
  design link", implying one exists. It does not — §172, §173 and §174 each end with a
  `Design: [<name>](../superpowers/specs/<file>.md).` line, and §175 does not. Amended to add the line in
  the neighbours' shape.
- **Step 5's captures have no path to existing.** `captureVisualReview` returns immediately unless
  `VIGILIA_CAPTURE` is set, so a plain `--grep` run writes no file; four of the five gestures the step
  lists also have no name registered in `docs/evidence/screenshots/README.md`. Left as-is, the step is an
  instruction to look at screenshots that will not be there, and the obvious wrong recovery is to invent
  capture names in the last commit. Amended to say so and to route the step through the interactive
  host walkthrough instead, with the note that registering a new name is Task 9's job.
- **Step 6's quoted STATUS.md line is not in STATUS.md.** It said to resolve "Snapping/smart-guide
  fidelity is under review; gap list not yet in hand"; `grep` finds no such line, and the blockers list
  carries three different items. Amended to name the three that are actually there and to let the
  implementer resolve whichever Step 2 settles. This is the same class as the `§5` citation — a plan
  quoting a document it has not re-read since the document moved.

Not amended, deliberately: Step 4's two text edits are specified tightly enough to transcribe, `§64`'s
real heading is `## §64 — Rulers, grid, guides and snapping (review)` and the rewrite lands inside it,
the `Editor mechanics` README row is `:34`, and the behaviour review's `## Promoted to requirements` and
`### Resize-time snapping` sections are where the step says they are.

C10 is dispatch-ready, and it is now the last unverified brief in Plan C. Its self-review's Review Focus
coverage line already points item 5 at Task 5 (correct) and item 3 at Task 6.

## My own C10 correction invented a second nonexistent symbol — caught by reading the chain

Fixing Step 3's `_applyMovementObjectSnap` (which does not exist), I wrote a replacement list that named
`_resolveObjectMovementSnapAxes` at `:550`. Also does not exist. `:550` is `_resolveMovementSnapAxes`.
Both names were plausible transcriptions of the fork's naming style and neither is a method — which is
the whole reason this plan cites fork symbols **by name from a measured read** rather than by pattern.

Measured the chain properly instead of re-deriving it from memory, by reading the call sites:

```
_applyMovementGuideSnap  the entry point for a move step (:629)
  → _resolveObjectMovementContext  (:507, called at :499)
      → _resolveMovementSnapAxes   (:550, called at :522)
  → _applyObjectMovementSnap       (:572, called at :503)
      → _applyMovementGuideSnap    (:629, called at :580)
      → _applyMovementVisualGuides (:1098, called at :618)
```

Note what the read showed and the guessed version had missed: `_applyMovementGuideSnap` is *both* the
entry point and a callee of `_applyObjectMovementSnap`, and `_applyObjectMovementSnap` is reached from
`:503`, not `:507` — `:507` is where `_resolveObjectMovementContext` is *declared*. A linear chain drawn
from memory gets both wrong.

**Ruling: the plan now carries the call-site block, and it names both dead symbols as landmines with the
instruction to conclude the plan is wrong rather than to keep looking.** A reader who cannot find a cited
method has two hypotheses and only one of them is cheap to test; naming the fakes forecloses the wrong
one.

**Cost if wrong.** Task 10's Step 3 is a judgement call about a path nobody has needed so far, and it
reads this chain once. A third invented name would cost one round of "the plan is wrong about the
source" — the failure this pre-verification pass exists to prevent, and one I have now caused twice in
the same paragraph.

## C4's brief was stale, and the reason it was invisible is that the plan edit looked like a C5 edit

C4's brief was superseded by its own plan: the plan was edited at 12:34, the brief last written at 12:14,
and the two differed. C4 was therefore reading text the plan no longer said. The plan has since been edited
inside every task span, so which hunk superseded it is not attributable from here — the brief's content is
the only evidence of what it said, and it is gone.

**The mtime check is not sufficient on its own, and this is the finding worth keeping.** `ls -la
--time-style=+%H:%M` is minute-granular, and this session edited plans and regenerated briefs inside the
same minute — the ui-polish plan and its task-10 brief both read `12:35`, so an mtime comparison called that
pair current when the only thing establishing it was the coincidence of a clock. **The check that actually
holds is regenerate-and-compare:** re-run `task-brief`, hash the brief before and after, and treat a hash
change as the staleness signal. It is idempotent, so it costs one command and no review, and it cannot be
fooled by granularity.

**Ruling: every brief is regenerated immediately before its dispatch, and a brief whose hash changes is
re-read in full before the dispatch goes out.** Cost if wrong: an implementer builds against superseded
requirements and every downstream test agrees with the superseded text, which no amount of reviewing the
diff catches — the plan and the code are both self-consistent, and only the plan's newer text disagrees.

A full sweep of all three plans was run this way: 16 pending briefs regenerated, one changed (C4). The other
fifteen were byte-identical, which is what makes the one change a signal rather than noise.

## Dispatch readiness — Plan C

| Task | Brief | State |
|---|---|---|
| 1 | — | Complete (with one fix round). |
| 2, 3 | — | Verified, dispatch-ready, no amendments outstanding. |
| 4+5 | `task-4-brief.md`, `task-5-brief.md` | Verified. **Dispatch as one unit, two commits.** Held behind A7 by ruling; dispatch immediately when A7 commits. C4's brief was stale and has been regenerated. C4's fork line counts re-verified this session against `9efdd78a` (130 / 526) and C5's (1,269 / 65 / 1,281) — all five exact. |
| 6–10 | — | Verified, dispatch-ready. |

**The dispatch order locked by ruling: A7 → C4+C5 → B8 → the rest.** C4+C5 is next the moment A7's commit
lands.

## Resume recipe for C4+C5 (one dispatch, two commits)

Briefs regenerated and hash-stable as of the A7 close: `task-4-brief.md` `8250135de3cf1b76`,
`task-5-brief.md` `503a81b3efaae990`. Regenerate both immediately before dispatch anyway (standing ruling);
a hash change means re-read before sending.

**Dispatch shape.** One implementer, capable model — C5 is 2,615 ported lines across three files (1,269 +
65 + 1,281). C4 written first (C5 defines the two types C4 imports), one commit per task per the briefs'
own Step commits, and the pair reviewed as **one unit** off a single `review-package BASE HEAD` window —
the brief names one commit per task, so BASE is recorded once before the dispatch and HEAD is the second
commit; do not package them separately, or the reviewer sees a C4 that cannot compile by construction.

**The dispatch prompt must carry the standing `STATUS.md` instruction** (ruling at
`.superpowers/sdd/2026-09-25-snapping-fidelity/progress.md`, "`STATUS.md` is carried in the dispatch
prompt, not patched into nine briefs") — replacement text, not append.

**Known-bad things to name in the prompt rather than let the implementer rediscover:**

- C8's `readMovementModifiers` reuse instruction is wrong and was amended in the plan; if that amendment
  drifts out of the plan, the scale path silently loses Shift. Not C4/C5's problem, but the reason to
  re-read the C8 amendment before Task 8 goes out.
- The plan's Test Sources paragraph was corrected mid-session: the unit fixtures are the convention
  authority, not the fork's `e2e/tests/snapping-manager/**/scaling-*-controls.spec.ts` browser specs
  (those test a manager Vigilia does not have until Task 6).

## C4+C5 dispatch-ready detail (verified against the current briefs, not recalled)

**Step structure.** C4: Step 1 retrieve fork sources → Step 2 adapt → Step 3 write the test → Step 4 run
`npx vitest run packages/editor/src/snap-manager/scaling` → Step 5 teeth → Step 6 commit.
C5: identical shape, same vitest path, its own Step 6 commit.

**The briefs already carry the two rulings, so the dispatch prompt does not need to restate them — it must
only stop the implementer from undoing them:**

- `task-4-brief.md:103` — *"This task therefore does not compile on its own, and it is dispatched together
  with Task 5 as one unit — write Task 4's two files first, then Task 5's, and run the suite once at the end
  of Task 5. Do not invent a new home for any of these types, and do not move `createScaleSnapCandidates`
  into Task 5."*
- `task-4-brief.md:105` — *"That does not mean collapsing the two into one commit. Commit Task 4's files
  when Step 6 says to, *before* writing Task 5's."*

  So: **two commits, one dispatch, and the combined suite run lands in C5 Step 4.** C4 Step 4's vitest run is
  expected to be impossible to satisfy alone — the implementer should report that as expected rather than
  chase it. Say that in the prompt, or a capable implementer will spend its budget inventing a stub.

- `task-4-brief.md:138` onward — the test numbers come from the fork's **unit fixtures**
  (`specs/test-utils/snapping/scale-snapping-core.ts`), *"not from the e2e specs"*, which the brief says
  outright are not the convention authority. It cites the cost of getting this wrong: *"a fixture re-derived
  by hand is how this task's own test came to assert `320` for a projection that yields `300.2`."*

**Vendored-source rules the dispatch must carry** (they are plan Global Constraints, and the reviewer scores
against them): byte-comparability with the fork except for the five permitted edit classes; the provenance
line `// Ported: fork 9efdd78a src/editor/snapping-manager/scaling/<file>` at the top of each; the
800-line stop is an explicit exception to be **named in the commit message** (C5 alone is 1,269 + 1,281
lines across two files); refusals rather than zero-coercion on invalid numerics; `exactOptionalPropertyTypes`
means omit optional properties, never set them to `undefined`.

**Review packaging.** BASE is whatever HEAD is when C4 is dispatched; HEAD is C5's commit. One
`review-package BASE HEAD` window covering both commits, reviewed as one unit — packaging them separately
would hand the reviewer a C4 that cannot compile by construction.

## C4+C5 implemented — `cf5ec0e` (T4) + `d86baac` (T5). Task review dispatched (`aab5b044ec8b3423d`)

Two commits as ruled, vendored-source exception named in both messages, correct order. Test summary: 2 files,
27 tests pass on `packages/editor/src/snap-manager/scaling`; typecheck/lint/format clean. Report at
`task-4-5-report.md`.

**Fork line counts all exact, verified by the implementer: 130 / 526 / 1,269 / 65 / 1,281** — the same five
numbers I re-verified from the fork earlier in this effort. Fixtures 167 and 1,109 also exact. That closes the
line-count check that has been open since C4's brief was corrected.

**Task 4 Step 4 behaved as the brief predicted, with a sharper mechanism than I described.** I told the
implementer that run was "expected to be unsatisfiable by itself, do not chase it". Reality: vitest is
runtime-**green** (10/10), because the missing module is reached only by an `import type` and esbuild erases
it — the failure is type-level and exactly one error, `scale-snap-candidates.ts:8 TS2307 Cannot find module
'./scale-snapping-resolver.js'`. That is a better statement of the same fact: **the unit is invisible to
vitest and visible only to `tsc`**, which is why `npm run typecheck` is load-bearing in this dispatch and why
a green vitest on Task 4 alone must never be read as "Task 4 is done". Worth carrying to C6-C8, which have the
same split. The implementer reported it and added no stubs, as instructed.

**I verified all four of the implementer's concerns before packaging, rather than forwarding them:**

1. **`scaling-step-snap-guards.ts` (1,322 lines) has zero runtime coverage.** Real, and **correctly deferred**.
   I checked the fork's own fixtures: it has **no unit fixture** for `scaling-step-snap-guards.ts` either —
   its coverage was e2e-only. C9 creates `src/web/tests/e2e/snapping.spec.ts` and its brief lists the scaling
   behaviours explicitly (minimum-size, round-trip, modes). So this is not a gap the implementer left; it is
   C9's case list. Close it there and do not re-raise it before then.
2. **The `getObjectDisplaySize` declaration divergence.** Verified against
   `9efdd78a:src/editor/types/fabric-extensions.d.ts:418` — the fork declares it as an optional method
   `getObjectDisplaySize?(): { width: number; height: number }` via a global declaration-merge. The port
   declares the identical shape and optionality on its existing local `SourceDisplaySizeTarget` interface
   (`scaling-step-snap-guards.ts:117`), and the one call site is guarded
   (`:929 if (typeof displayTarget.getObjectDisplaySize !== "function") return false`). **Only the location
   moved, not the contract** — and it had to, because Vigilia has no declaration-merge to put it in. This is
   fork decoupling, which the Global Constraints require ("strip fork coupling"), not a behaviour change. Not
   a finding.
3. **`resolveTwoVariableConstraintPair` returning `null` for missing raw values.** Verified by reading both
   sides. The fork's `const [firstA, firstB] = firstEdge.coefficients` destructures without a guard and would
   carry `undefined` into `Math.hypot`, diverging to `NaN`; the port guards and returns `null`
   (`scale-projection.ts:594-601`) and again at `:640-642`. **This is exactly the
   `noUncheckedIndexedAccess` guard class the briefs name as permitted** — under
   `noUncheckedIndexedAccess` the unguarded destructure does not even compile. Correctly claimed as a
   "behaviour difference in principle"; it is a divergence the project's own compiler forces.
4. No rendered capture and no `npm run build` — both per instruction; nothing in this unit paints.

**Review packaging:** `review-package 3631900 d86baac` → 2 commits, 140,682 bytes. One window for the pair, as
ruled. The reviewer is explicitly authorised to diff the port against the fork (the one crawl this review
needs) and told the five permitted divergence classes, because a port that silently dropped a threshold is
the failure this review exists to catch.

## C4+C5: COMPLETE — `cf5ec0e` + `d86baac`. Review: Spec ✅, quality Approved, no Critical.

Reviewer `aab5b044ec8b3423d`, opus, on `3631900..d86baac`. It did the fork comparison the dispatch authorised,
and did it properly: token-stream diff of all five files against `git show 9efdd78a:<path>`, then
character-level diff with `difflib` opcodes wherever a token differed, plus a line-annotated numeric-literal
audit and an accounting of every brace-count delta. Verdict: **"The port is faithful on all five files"** — no
threshold, tolerance or epsilon changed, every numeric literal accounted for. The only numeral-count delta is
a translated Russian comment ("does not eat 1px" → "does not eat a pixel"), i.e. comment-only.

Two things the reviewer independently confirmed that matter more than the port itself:

- `constants.ts` is byte-equivalent to the fork's, and the three guard constants have exactly one home. That
  closes the "one owner per concept" check for this unit.
- The vendored-source exception is **genuinely applicable** — all five files are ports, nothing new hides
  behind the exception. The only new code in an excepted file is the `getObjectDisplaySize?` interface member,
  a direct transcription of the fork's own declaration.

Fixture provenance was traced case by case: every asserted number in both test files traces to a named fork
case (`scale-snap-candidates.spec.ts:17-19`, the resolver's `:558`/`:593`/`:289`/`:89`/`:152`/`:854`). That is
the check the brief's "an earlier revision asserted 320 for a projection that yields 300.2" warning exists to
force, and it passes.

**Ruling on the two Important findings: neither is a defect in this unit, and no fix round opens.**

1. **`scaling-step-snap-guards.ts`'s source-scaled guard family is inert — verified true.** I checked
   independently: `grep` for `getObjectDisplaySize` across the whole workspace hits only the interface member
   (`:117`) and its one guarded call site (`:929`); Vigilia's `crop-manager` is a single `index.ts` with no
   crop-frame domain object and no display-size concept, and the fork's attach point
   (`src/editor/crop-manager/domain/crop-frame.ts:122`) has no Vigilia counterpart. So
   `usesScaledDisplaySizeForSnapGuards` always returns false and `usesSourceBoundarySnapGuards` always bails.
   **The port is still right**: the alternative is deleting the guard family, which diverges from the fork and
   is exactly what the byte-comparability constraint forbids. But the finding is not "untested", it is
   "unreachable", and that is a materially different claim. **Carried forward as a forward risk, not a defect:**
   at the C6-C8 wiring boundary, confirm a source-scaled scale target can actually exist in Vigilia; if it
   cannot, the guard family needs a scope decision (keep as fork-faithful dead code, or cut) rather than a
   test. Cost if wrong: 1,322 lines that no author can reach either ship as inert weight or get cut late,
   when cutting is cheapest now — but cutting now would be a fork divergence, so keeping it and deciding at
   wiring time is the correct trade.
2. **The report's rationale for one guard is inverted; the code is correct.** `scale-projection.ts:332-339`
   introduces `const coefficient = coefficients[index]; return coefficient !== undefined && Math.abs(...)`.
   The report justified it as fixing a live `NaN` path. The reviewer is right that the runtime path cannot be
   `undefined` there (edges are validated by `createProjectionEdge`) — but the guard is still *required*, to
   satisfy `noUncheckedIndexedAccess`, which is a permitted divergence class. So: a wrong reason in a report,
   not a wrong line in the code. Ruling: no change to the code; **do not carry the report's NaN rationale
   forward** as the reason for that guard.
3. The three Minors (error-message-substring assertions, two tests mixing concerns, a low-risk pure-lookup
   case) are accepted as-is. The first is the only place in the pair whose teeth depend on wording, and the
   fork's own spec does the same.

**The forward risk in (1) is now recorded against C6-C8 and does not block them** — wiring tasks can proceed;
what they must not do is treat the guard family as verified behaviour, or write a test asserting it works,
until a source-scaled target is shown to exist.

## C6 pre-dispatch verification: the step-guard family has no reachable owner at all

I verified C6's brief before dispatching it (the pattern that has found a defect in most of these briefs) and
found something larger than a brief defect — a **scope gap shared by the plan, the spec and C5's file list.**

**The measurement.** Searching every file under the fork's `src` for a caller of `scaling-step-snap-guards.ts`
returns exactly two hits: the file itself, and **`src/editor/snapping-manager/pixel-grid.ts`**. So in the fork,
the sole consumer of the 1,281-line guard module is `pixel-grid.ts`. C5's brief ported the guards; nothing in
the plan ports pixel-grid.

**And the spec says that is intentional** — `docs/superpowers/specs/2026-09-25-snapping-fidelity.md:34`, in the
parity table: *"Legacy fallback path | line/spacing/pixel-grid, second engine | **absent**"*. The plan
reinforces it at `:1475`, where C10's fall-through evaluation names `pixel-grid.ts` only as something to cite,
and at `specs/2026-09-24-editor-behaviour-review.md:86`: *"fork-specific pixel-grid/type heuristics that do not
match Vigilia objects."*

**What the C4+C5 reviewer called "inert until a crop-frame arrives" is therefore inert permanently.** I had
already verified half of this in the C4+C5 entry above — that no Vigilia object attaches `getObjectDisplaySize`.
This closes the other half: `getObjectDisplaySize` is not the only entry condition. Even if some future task
attached it, the guard family's *caller* is a module the spec has ruled out of scope. So the correct statement
is stronger than the reviewer's: **the entire `scaling-step-snap-guards.ts` port (1,322 lines in Vigilia) is
unreachable by design, not pending a dependency.**

**Ruling: keep the port for now, and make the decision where the question already lives.** Three reasons to
keep rather than cut immediately:

1. C5 is committed and reviewed; the port is byte-faithful and cost nothing but size. Cutting it now is a fork
   divergence and would reopen a closed, clean review.
2. The plan already contains the process that answers this: **C10's Step** requires evaluating what falls
   through and recording **port / replace / drop**, with the reason, in the spec's
   `## Key decisions to make in planning` §3 — *"the decision belongs where the question is. Do not leave it
   unstated — that is how the defects this plan fixes survived."* This is exactly that question, and it now has
   a measured answer to record: **drop, because its only caller is pixel-grid, which the spec marks absent.**
3. Cutting during C6-C8 would be a mid-flight divergence in a unit whose briefs were verified against the plan.

**Cost if wrong.** If pixel-grid is out of scope (as written), ~1,322 lines plus its share of C5's file-size
exception ship as unreachable weight, and the file-size exception is being spent on dead code — a real cost,
but a bounded and textually visible one. If pixel-grid were in fact wanted, dropping the guards early would
remove a port that would have to be redone from the fork. Keeping preserves both options; recording the
measurement in C10 preserves the decision. **Do not write a test asserting the guard family works** — that is
the trap the C4+C5 reviewer's framing invites, and a test for unreachable code is green-and-wrong.

**Also verified for C6, so its dispatch does not rediscover it:** fork line counts exact (849 / 294 / 83);
`createRectangularScaleValues` does exist in the fork's gesture-projection module; and all seven types C6
imports across the C4/C5 modules — `ScaleProjectionVariable`, `ScaleSceneAxis`, `ScaleSceneEdge` (from
`scale-projection.ts`) and `ScaleProjectionModeInput`, `FinalScaleGeometry`, `ScaleRawIntent`, `ScaleSnapPlan`
(from `scale-snapping-resolver.ts`) — **are exported by the committed C4+C5 code.** C6's imports will resolve.
Neither C6 source file reads `getObjectDisplaySize` or `getObjectSnappingBounds`, so C6 neither reaches nor
extends the inert family.

**C6's test fixture** (`specs/test-utils/snapping/rectangular-scale-gesture-projection.ts`) is one of the seven
fixtures in the fork and is not yet in this ledger's verified list — verify it before dispatching C6, the way
C4's `scale-snapping-core.ts` was verified.

## C6 pre-dispatch verification: the standard-control guard survives Vigilia's controls manager

C6's brief flags its own biggest risk at Step 2: `standard-scale-control.ts` ports unchanged and refuses any
handle whose handlers or geometry differ from `controlsUtils.createObjectDefaultControls()`, so **"if Vigilia's
`controls-manager` replaces or reconfigures the default controls, `isStandardRectangularScaleControl` will
return false for every handle and snapping will silently never engage."** I checked it before dispatch, because
the failure mode is silent — a green suite with snapping that never fires.

**The comparison, read from the fork verbatim** (the five behaviour handlers by reference, plus `x`, `y`,
`offsetX`, `offsetY` at `1e-9`). Note what it deliberately does *not* check: `render`, `sizeX`, `sizeY`,
`visible`, `cursorStyle`.

**What Vigilia actually does** (`packages/editor/src/controls-manager/index.ts`): `applyOverrides` (:65-80)
`Object.assign`s onto a fresh `createObjectDefaultControls()` instance per control key, and the override objects
`CORNER`/`VERTICAL_EDGE`/`HORIZONTAL_EDGE`/`ROTATION` (:20-51) carry **only** `render`, `sizeX`, `sizeY`,
`offsetX`, `offsetY` — plus `cursorStyle` on the rotate handle. Every one of the four geometry fields the guard
compares is present in the overrides, so each needed checking; every one that differs is a field the guard
ignores.

- `render`, `sizeX`, `sizeY` differ from Fabric's defaults and are **not compared**. Safe by construction.
- `offsetX`/`offsetY` **are** compared, and the overrides set both to `0`. I nearly ruled this a defect on the
  strength of `commonControls.mjs`, where the default `Control` literals set `x`/`y` and no offset at all — an
  absent key against an explicit `0`. It is not a defect: **`Control`'s constructor defines `offsetX: 0` and
  `offsetY: 0`** (`node_modules/fabric/dist/src/controls/Control.mjs:90,101`, `@default 0`), so both sides are
  `0` and `areControlNumbersEqual` returns true.
- The handlers (`actionHandler`, `getActionHandler`, `positionHandler`, `getTransformAnchorPoint`,
  `transformAnchorPoint`) are never touched by the overrides, so both sides hold the same reference.
- `mtr` gains a `mouseDownHandler` (:73-79), which the guard does not compare — and `mtr` is not one of the
  eight keys C6 supports, so `createRectangularScaleGestureProjection` returns null for it anyway.
- `Textbox` hides `mt`/`mb` via `visible = false` (:100-103). The guard does not compare `visible`, and a hidden
  control is not interactive, so no gesture reaches the check. `snapAngle = 1` (:106) is unrelated to scaling.

**Ruling: take the brief's first preference — keep Fabric's defaults, do not edit the ported file, do not relax
the check.** The guard tests something real in Vigilia: it engages for the eight standard scale handles and
would still decline a genuinely customised one. Because the first option holds, the brief's middle option
(extending `STANDARD_RECTANGULAR_SCALE_CONTROLS`, which would require editing a ported file and adding a
`// ported: fork 9efdd78a` change marker) and its last resort (relaxing the check, losing the guard) are both
unnecessary. Cost if wrong: if some later task overrides a handler on a scale control, snapping stops engaging
silently — the guard is silent by design, and C6's tests drive projections directly rather than through a real
gesture, so they would not catch it. Nothing in Plans A, B or C lists such a change.

**Also verified for C6:** the fork's `specs/test-utils/snapping/rectangular-scale-gesture-projection.ts` is
**546 lines** as the brief claims, and every export the brief names is present — `RECTANGULAR_SCALE_CONTROL_KEYS`,
`RECTANGULAR_SCALE_TEST_ANGLES` (`[0, 30, 90]`), `RECTANGULAR_SCALE_CONTROL_ROTATION_CASES`,
`createRectangularScaleProjectionFixture`, `resolveFixtureFreeMode`, `moveFixturePointer`,
`projectFixtureBounds`, plus `installRectangularScaleGeometryContract` and `useRectangularScaleGuide` (which
carry the `jest.Mock`/`ImageEditor` couplings the brief says to drop). `projectFixtureBounds` is indeed an
independent re-derivation, so the bounds assertions are not circular.

**C6's brief is otherwise clean and dispatchable.** Combined with the entry above, C6 needs no plan edit: its
imports resolve against committed C4/C5 code, its fixture is verified, and its one flagged risk resolves to the
brief's own first preference.

## C5's step-guards finding does NOT generalise to C6 — and C6's module has a real consumer

Following the step-guards ruling above (C5's guard family unreachable because its only fork caller is
`pixel-grid.ts`, which the spec marks absent), I checked whether C6's three files have the same problem. They do
not, and the difference is worth recording so a later session does not re-derive it.

**Measured in the fork at `9efdd78a`, importer by importer:**

- `rectangular-scale-gesture-projection.ts` — imported by `rectangular-scale-interaction.ts` and, via the
  fixture, by the unit spec. Ported in C6; consumed in C6.
- `rectangular-scale-interaction.ts` — the fork's importers are
  `selection-manager/scaling/active-selection-scale-interaction-controller.ts` (not ported: it is an
  ActiveSelection controller, and Plan C Task 2 is where ActiveSelection eligibility lives) and
  `snapping-manager/scaling/image-scale-snapping-controller.ts` (explicitly **not ported** —
  `plans/2026-09-25-snapping-fidelity.md:1118`: *"Neither is ported"*).
- `standard-scale-control.ts` — imported by the same two controllers plus the gesture-projection module.

So C6's modules are consumed by controllers the plan deliberately does not port. That is the *same shape* as
the C5 finding, and I checked it because I expected the same conclusion. It is not the same, for one reason:
**the plan writes a fresh replacement.** `:1070` creates Vigilia's own
`snap-manager/scaling/scale-snapping-controller.ts`, and `:1229` requires it to be *"a thin orchestrator over
Tasks 4–6 mirroring `movement-snapping-controller.ts`"*, per `object:scaling` step. `:1239-1240` name C6's
`applyRectangularScalePlan` and `createRectangularScaleValues` from `rectangular-scale-interaction.ts` as the
things that controller must call, with a worked explanation of why hand-rolling them is wrong. So C6's module
**does** get a live caller, in C7.

**And the plan already saw the risk and wrote the mitigation into C7.** `:1236` warns that the fork reads
`event.scenePoint` where Vigilia's pipeline may read `event.pointer`, that jsdom cannot exercise the
difference, and that a mismatch would show up as *"guides attached to the wrong edge"* in the browser capture —
which is precisely the pipeline-level failure the unit tests cannot catch. C7 is where that gets settled, not C6.

**Ruling: dispatch C6 as briefed, no plan edit.** Unlike the C5 guard module, C6's code has a named consumer
two tasks later, its imports all resolve against committed C4/C5 code, and the integration risk is already
documented in the task that owns it. Cost if wrong: if C7's controller turns out unable to use
`applyRectangularScalePlan` as written (e.g. the `scenePoint`/`pointer` plane differs enough to change the
applier's inputs), C6's 1,226 lines need an adapter or a signature change in C7 — visible at that task's review,
not silently dead.

**Also confirmed so C6's dispatch carries it:** `snap-manager/bounds.ts` exports `ObjectBounds` with exactly
the fork's six fields, confirms `getObjectExactBounds` as an arrow const (so a `^export function` grep
misses it), and its `SnappingBoundsSource.getObjectSnappingBounds` note — *"the fork's crop frame did"* — corroborates the
pixel-grid/crop-frame scope exclusion from the entry above.

## Task 6: dispatched

BASE `e66b854` (B8's commit — it is the branch tip). Implementer dispatched on `sonnet` with the brief at
`.superpowers/sdd/2026-09-25-snapping-fidelity/task-6-brief.md`, report to land at `task-6-report.md`.

Brief regenerated immediately before dispatch and hash-compared: `a21055b8e858c1bd` before and after, unchanged,
so the full read I did during pre-verification stands.

The dispatch carries three pre-resolved decisions so the implementer does not rediscover them: take the brief's
first preference on the controls-manager risk (keep Fabric's defaults, port `standard-scale-control.ts`
unchanged); all seven imported types already exist in committed code; the fork's 546-line fixture is verified and
is the test source. It also carries the standing rules that bind porting tasks here — the `// Ported:` line, the
no-restructure constraint, the named file-size exception, and **that a green vitest is not sufficient because an
`import type`-only missing module is erased by esbuild and shows up only under `tsc`.**

**One-writer rule: two agents are now in flight and their file sets are provably disjoint.** B8's task reviewer
is reading `packages/editor/src/artboard-panel.ts`, `editor-shell/controls/**`, `editor-shell.css`, `ui-copy.ts`,
`STATUS.md`. C6's implementer writes `snap-manager/scaling/rectangular-scale-*.ts`,
`snap-manager/scaling/standard-scale-control.ts` and `gesture-projection.test.ts`. No path appears in both, and
the reviewer is read-only by its own contract. Cost if wrong: the reviewer's verdict is invalidated and one
review is re-run — cheap, and it is the same trade this ledger recorded the last time the rule was exercised.

B8's review must close (including any fix round) before B9 can be dispatched, because B9's files are not yet
checked against B8's and a B8 fix round would touch `artboard-panel.ts`.

## Task 2 pre-dispatch verification: clean — and a note on a defect I almost invented

C2 creates `snap-manager/selection-eligibility.ts` (porting the fork's `_isSupportedActiveSelection`) and applies
it in `snap-manager/index.ts`'s `startGesture`.

**Every citation verified:**

- The fork function is real and its span is **exact**: `private _isSupportedActiveSelection` opens at
  `:180` and closes at `:197` in `src/editor/snapping-manager/movement/movement-snapping-controller.ts`. The
  brief's Step 3 provenance line carries that full path, and it matches the plan's own at `:280`. The brief
  quotes the fork's three clauses correctly (member count `< 2` → false; text + non-unit scale → false;
  any child with `object.parent` → false).
- `index.ts:1` is `import type { Canvas, FabricObject } from "fabric/es";` exactly as the brief says, so the
  Step 4 instruction to split it into a value import of `ActiveSelection` plus a type import is precisely right
  — and the brief's warning is the sharpest thing in it: an `instanceof` over a type-erased import does **not**
  fail to compile and does **not** fail any test, because the resulting `TypeError` is thrown inside `guard`
  (`index.ts:275-283`) and swallowed by `errors.error("snapping", …)`, so the gesture silently never starts.
  Verified: `guard` is at `:275-283` and does wrap the step in exactly that try/catch.
- `§175` is real — `docs/product/requirements.md:388`, "Ported behaviour keeps its source's quality" — and it is
  the correct authority for the brief's requirement that the dropped kind allow-list clause be *accounted for in
  the header comment rather than silently missing*.
- `startGesture` is at `index.ts:119-162`. It has **no** eligibility check today, so "the `startGesture` guard"
  in the Files block means the insertion point, which Step 4 states unambiguously ("after
  `const active = canvas.getActiveObject()` and before the bounds read"). Adding, not modifying.

**A defect I nearly recorded and did not.** On first read I believed the brief omitted the `/movement/` path
segment, because the Interfaces block cites the fork as `movement-snapping-controller.ts:180-197` with no
directory — and that bare filename does not resolve under `snapping-manager/`, where the file actually lives at
`snapping-manager/movement/`. I checked before writing it down: the Interfaces block is a bare-filename
reference (a parenthetical naming the function's origin, not a path to open), and Step 3's provenance line —
the one an implementer actually copies into a file header — carries the full correct path. **No defect exists.**
The lesson matches the four false findings already logged in this effort, with the polarity reversed: I was
asserting from two anchors (a bare filename and a directory listing) without reading the block between them.
The pre-verification habit is what caught it, and it is worth keeping for exactly this reason.

**Ruling: no plan edit for C2.** Cost if wrong: none identified.

**Not dispatching C2 before C5's consumer question settles.** C2 is independent of C6, but C6's implementer is
running and C2 would be a second writer in the same package (`snap-manager/`) — not provably disjoint from a C6
fix round, which would touch `snap-manager/scaling/**` and possibly `snap-manager/index.ts`. Same rule as A8:
wait for C6 to report.

## Task 3 pre-dispatch verification: one plan defect found and fixed — the deletion leaves an orphan

C3 is a *deletion* task, so I checked its citations and its deadness claims hardest. All six line citations
are **exact**: `constants.ts:6`/`:7` are the two constants, `movement-snapping-resolver.ts:1302` is
`spacingRelease: (SNAP_THRESHOLD + SPACING_SNAP_HOLD_MARGIN) / zoom`, `:886` is
`switchDistance: previousContext ? Number.POSITIVE_INFINITY : 0`, `:765`/`:875` are the two `previousContext`
parameter declarations, `spacing.ts:237` is the `previousContext` field on the spacing params, `spacing.ts:1312`
is `calculateSpacingSnap`, and `distance.ts:32` is `resolveCommonDisplayDistance`. The deadness claim holds too:
`SPACING_CONTEXT_SWITCH_DISTANCE` and `resolveCommonDisplayDistance` are each declared exactly once and imported
nowhere (the only other mention of the switch distance is `spacing.ts`'s own `switchDistance?: number` field and
`spacing.test.ts:251` passing a literal `5` — neither imports the constant).

**The defect: the plan's Step 3 says "plus any now-unused imports", but the orphan it creates is not an import.**
`CommonDisplayDistance` (`distance.ts:22-27`) is a same-file **type declaration** whose only consumers are
`resolveCommonDisplayDistance`'s parameter and return annotations — both removed with the function. Searching the
whole workspace, every other mention of the name is one of those three lines. So an implementer following "remove
the export plus any now-unused imports" literally deletes the function, leaves the type, and the task whose whole
purpose is *removing dead code* ships having just created some. Biome's unused-export check does not catch it
either, because it is an exported declaration.

**Fixed in the plan at `:455`, not in the brief** — the standing ruling is that corrections go in the plan and
briefs regenerate from it, so the fix survives any future regeneration. The step now names the orphan explicitly
and, because `distance.ts` holds three similarly-shaped declarations that *must not* be swept up in the same
gesture, it names those too with their live call sites: `MAX_DISPLAY_DISTANCE_DIFF` (`:19`) is live via
`spacing.ts:2`/`:561`, and `resolveDisplayDistance` (`:4`) is live via `guide-renderer.ts:5`,
`spacing-chains.ts:1` and `spacing.ts:3`. Without that second half the fix would trade an orphan for an
over-deletion, which is worse — `resolveDisplayDistance` feeds three live modules.

**How this one differs from the four false findings already logged in this effort.** Those were assertions made
from two anchors without reading the code between them. This one came from reading the *whole* of `distance.ts`
and then grepping every name in it, which is what a deletion task requires. The class is the same as the C5
step-guards finding in shape — a plan claim that is true of what it names and false about what it implies — and
it reinforces the ledger's existing rule: verify a deletion target's *blast radius*, not just its deadness.

**Ruling: the plan edit above, no other change to C3.** Cost if wrong: one extra type declaration is deleted or
kept unnecessarily — in either direction a trivial, compiler-visible fix at C3's own Step 4, which runs the full
snapping suite precisely so a deletion that breaks an import shows up.

**Not dispatching C3 yet.** It writes `snap-manager/constants.ts`, `distance.ts`, `spacing.ts` and a new DOM test
— the same package C6's implementer is working in, and not provably disjoint from a C6 fix round. Waits for C6 to
report, alongside A8 and C2.

## Task 6: implementation landed, review dispatched

Commit `abd5713` — "feat(editor): port the rectangular scale gesture projection", 4 files, +2,332 lines:
`rectangular-scale-gesture-projection.ts` (990), `rectangular-scale-interaction.ts` (325),
`standard-scale-control.ts` (88), `gesture-projection.test.ts` (929). Specified fork sizes are 849 / 294 / 83,
so the ports grew by 141 / 31 / 5 lines — the expected shape for `noUncheckedIndexedAccess` guards, English
comments replacing Russian ones and the provenance line; the size is a named exception the commit message
carries, per the brief.

Package `review-e66b854..abd5713.diff` (73,008 bytes, 1 commit). Implementer returned DONE_WITH_CONCERNS; task
reviewer dispatched on `sonnet`, instructed to do a real fork comparison (token-stream diff, char-level opcodes
on residual differences, and a numeric-literal audit) because §175 makes a changed threshold the defining
failure of a port.

**The controls-manager decision was honoured.** The implementer reports `controls-manager` untouched and the
brief's first preference taken, which is what I ruled before dispatch.

Reported: scoped vitest 98/98; full `npm test` 1433/1433 across 400 files; `npm run typecheck` all seven
workspaces clean; format:check and lint clean. **The typecheck result is the one that matters here** — a ported
file whose imports resolve only for types would run green under vitest and fail `tsc`.

**Three implementer concerns, for the reviewer to verify rather than accept:**

1. It claims its departures are exactly one `exactOptionalPropertyTypes` signature widening plus two
   mechanically-forced `noUncheckedIndexedAccess` guards, and that everything else is specifier/comment-only. A
   completeness claim is the optimistic kind, which is why the reviewer was told to check it rather than accept it.
2. Port fidelity has no automated guard; its fork-vs-port diff was ad-hoc. Noted, not a defect — the reviewer's
   comparison is the guard.
3. The tests drive the fixture's hand-rolled `getCoords`, so `isStandardRectangularScaleControl` against
   `controls-manager`'s real overrides is reasoned from source rather than measured. **I verified the reasoning
   is sound in the entry above**; the reviewer can check the fixture is not circular, and C7 makes it observable.

## C2 ordering — held behind B9 (file-set collision)
Verified before dispatch: C2's commit step stages `src/web/tests/e2e/editor.spec.ts`
(brief `:127`), and B9's file list is `editor-shell.css` + that same spec file. B9 is
in flight. A `git add src/web/tests/e2e/editor.spec.ts` run by C2 now would stage B9's
uncommitted edits into C2's commit. Ruling: C2 dispatches only after B9 has committed.
Cost if wrong: none — C2 has no dependency on B9; this is pure serialization.

Also confirmed at the same time: C3 (`constants.ts`, `distance.ts`, `spacing.ts`) and
C2 (`selection-eligibility.ts` new, `index.ts`, `editor.spec.ts`) share no file. C2's
`index.ts` import block does not touch `constants.ts`, so C3's deletion of
`SPACING_CONTEXT_SWITCH_DISTANCE` cannot break C2's compile.

## `src/web/tests/e2e/editor.spec.ts` is a three-way serialization point
Verified: B9 (UI polish T9) stages it, C2 stages it (brief `:127`), C7 stages it
(brief `:222`). Only one implementer may hold that file at a time.
Ordering ruling: B9 (in flight) → then C2 and C7 strictly one at a time, whichever
finishes its review first goes next. Cost if wrong: two implementers both editing
the spec produce a conflicted or interleaved commit and a `git add` that sweeps a
sibling task's test into the wrong commit — recoverable by re-committing, not free.

Concurrency still permitted: A8 (`bridge.ts`, `layer-panel.tsx`,
`layer-panel.dom.test.tsx`) against B9 (`editor-shell.css`, `editor.spec.ts`) —
file sets disjoint. Confirmed by `git status`: bridge.ts + layer-panel test are A8's
in-flight edits, editor-shell.css + editor.spec.ts are B9's. No overlap.

## Standing constraint: do not advance HEAD while an implementer is mid-flight
B9's implementer was dispatched with BASE `22639a3`, and A8's likewise. The plan
correction at `plans/2026-09-25-snapping-fidelity.md:455` (the C3 orphan-type fix)
is still uncommitted for exactly this reason. `review-package BASE HEAD` spans every
commit in between, so a docs commit landed now would be swept into B9's AND A8's
review packages — the same packaging error already made once this session (a
328,245-byte package for a one-commit fix). Commit the plan edit at a point where no
implementer holds an open BASE, or explicitly exclude it and verify the package
contains exactly the implementer's commits before naming the file in a dispatch.

C7 fork verification, re-confirmed at the pinned commit `9efdd78a`:
`src/editor/snapping-manager/scaling/scale-snapping-runtime.ts` is exactly 372 lines
(brief annotates it "fork: 372 lines" — matches). `scale-snapping-controller.ts`
does not exist in the fork, consistent with the brief marking it Create-with-no-fork-source.

## Task 6 review returned — one Important confirmed, one Important refuted, both by reading the source

Reviewer verdict: spec ❌ (one requirement unmet), quality "Needs fixes". Its port-fidelity method was the
right one — it extracted the fork sources read-only with `git show`, formatted fork and port with the *same*
biome call, and diffed token streams, classifying every opcode. Its headline result is the one that matters
for §175: **every numeric literal across all three ported files is an exact multiset match** (`fork-only: {} |
port-only: {}`), including all three epsilons at `0.000000001` and the fixture's `toBeCloseTo(…, 9)`. No
threshold was silently adjusted — the defining port failure did not occur. The reviewer also confirmed the
test's bounds oracle is a genuine independent re-derivation rather than a second copy of the production
decomposition, which is what makes the 45° case non-circular.

**Important 1 — CONFIRMED, independently.** `rectangular-scale-gesture-projection.ts:705-708` hoists four
`RECTANGULAR_SCALE_CONTROL_COORDINATES` bindings and rewrites the four inline reads at `:714-717` to those
names. I read both sides: the fork passes `coordinates: RECTANGULAR_SCALE_CONTROL_COORDINATES.tl` inline
(fork `619-622`), and the declaration is `Readonly<Record<RectangularScaleControlKey, RectangularScalePoint>>`
— a literal-key dot access under `noUncheckedIndexedAccess` is `RectangularScalePoint`, not `| undefined`. So
the hoist is not a typing guard; it is a gratuitous, exactly-invertible deviation that costs the
byte-comparability the commit message itself calls the reason for the 990/325/929-line exception. Fix allowed.

**Important 2 — REFUTED.** The reviewer says the commit message "describes the hoist as one of the two
`noUncheckedIndexedAccess` guards", and calls that claim "false for this file". Reading `abd5713`'s body: the
two guards it names are "a destructured corner and the first effective value" — the tuple destructures at
`:339-341` (`const [topLeft, …] = sourceCorners`) and `:196` (`const [first, second] = effectiveValues`).
Neither is the hoist, which does no destructuring at all. The reviewer's literal claim is wrong. What *is*
true is narrower: the message presents its departures as exhaustive ("The only edits to the fork's text are
…") and the hoist is an edit not in that list — and applying fix 1 makes the list true again, which is why
this needs no plan edit. **Ruling: fix 1 only; no plan edit for finding 2.** Cost if wrong: none — reverting
the hoist is what the finding asked for either way.

**The reviewer's two "Minor" plates were correctly left alone**, and I agree with both calls: the `:341` guard
is an unreachable but behaviour-free early return (an optional-chain revision would be a *worse*, larger
deviation), and `edge.coefficients[0] ?? 0` in the test weakens only the failure message, never the pass.

**Ordering consequence — C6's fix round is held, not dispatched.** The fix is one hunk in one file, but
committing it now would land it between BASE `22639a3` and B9's / A8's commits, and both in-flight
implementers were dispatched at that BASE — their `review-package BASE HEAD` ranges would sweep C6's fix in.
That is the packaging error already made once this session. Ruling: **no commits of any kind until B9 and A8
have committed**; then C6's fix, packaged as `git rev-parse <fix>~1..HEAD` and verified to hold exactly one
commit and one file before any dispatch names it.

## Task 7 pre-dispatch verification (done while A8/B9 were in flight)

Every citation in C7's brief checked against source at the current tree. **All correct**:

- `index.ts:66-79` / `:82-93` — actually `:63-77` and `:79-90`; the brief's own Step 3 preamble says
  "`:66-79` and `:82-93`". Two-three lines stale, and already resolved by the plan amendment recorded above
  (the measured signature is `{ ctrlKey: boolean }`, no `shiftKey`, which the amendment adds). Not a blocker:
  the step names the functions, not the lines, and the amendment carries the measured form.
- `index.ts` exports exactly `SnapManager` (`:21`), `SnapManagerOptions` (`:25`) and `createSnapManager`
  (`:92`) — so the instruction to export `readMovementMarker`/`readMovementModifiers` is real work, confirmed.
- `mouse:up` is bound at `:266` and `object:moving` at `:265`; Step 4's claim that the existing `mouse:up`
  binding already provides the resize teardown is correct.
- `createRectangularScaleGestureProjection({ transform, pointerStart })` returns
  `RectangularScaleGestureProjection | null` and is null for an unsupported corner (`:461-476`) — Step 3.2's
  "if it returns `null`, end the session and do nothing" matches the real signature.
- `object:scaled` genuinely absent: the fork's own controller reads `event.scenePoint ?? event.pointer`, and
  the brief's warning that a wrong event name is a silent no-op (the bindings array casts through `as never`,
  `index.ts:301`) is correct — I re-confirmed the cast at `:301`.
- Fork source `scaling/scale-snapping-runtime.ts` is exactly 372 lines at the pinned commit, matching the
  brief's annotation.

**C7 inherits two open items, both recorded at their owners:** the `scenePoint` vs `pointer` plane question
(brief `:169-171`, to be settled by Step 7's capture — jsdom cannot exercise it) and the `SNAPPING_MULTIPLIER`
re-derivation (brief `:139-141`, numbers are a worked sketch the implementer must re-derive and must show
failing with snapping disabled).

**Ruling: C7 dispatches as briefed, no plan edit.** Cost if wrong: a stale line number in a comment-level
citation, which the implementer resolves by name.

## Cross-plan ordering rulings from the remaining-task scan

Scanned every remaining task's Files block against every other, across all three plans. Three collisions,
one of them already live:

**1. B10 must land before A9, and A8 has already strayed into B10's file.** B10's Step 0 is the held Task 7 cast
fix in `editor-shell/shell-layout.dom.test.tsx`, and A9 (Plan A) modifies both `shell-layout.tsx` and
`editor-shell.css`. B10 is verification-only plus that one fix, so running it first means A9 inherits a clean
file. Ordering: **B10 → A9.** Complication, currently live: `git status` shows A8 has modified
`editor-shell/shell-layout.dom.test.tsx`, which is **not** in A8's brief (its files are `bridge.ts`,
`layer-panel.tsx`, `layer-panel.dom.test.tsx`). Either A8 found a necessary assertion there or it exceeded its
brief. **I will read A8's diff before its review is packaged** and, if the edit is load-bearing for A8, hand the
B10 Step 0 fix to A8's review rather than letting two tasks own the same hunk.

**2. `src/web/tests/e2e/editor.spec.ts` has a fourth contender: A10.** B9 (committed), C2, C7 and A10 all stage
it. The ordering ruling above stands and now reads: **B9 (done) → C2|C7 one at a time → A10.** C7 and A10 both
write guide-assertion cases, so whichever goes second re-reads the file; that is expected churn, not a conflict,
provided they do not run together.

**3. `guide-renderer.ts` is conditionally owned by two tasks.** C7 may modify it "only if the fork's scale-guide
shape needs it"; A10 may modify it "only if Step 2's inspection finds a defect". Both conditions are optional
and independent, but if both fire they are two writers on one file in different plans. Ruling: **the second of
the two to run re-reads the file first and, if the first already changed it, records the interaction in its
report.** Cost if wrong: one re-verify.

**Cost if wrong, ruling 1:** A9 rewrites a file B10 Step 0 was holding a fix in, and the fix is either lost or
re-applied by hand. B10 going first removes the possibility entirely for the price of running a
verification-only task earlier than its plan's order suggests — the task has no dependency on A9, so nothing is
blocked by the swap.

## The plan edit is committed — `12f65a7` — and the freeze is lifted

Committed now rather than deferred because the reasoning that justified freezing it has been superseded: B9's
review package was written to a file at `22639a3..66506e6` before this commit and is unaffected by it, and A8's
BASE is no longer taken from the ledger at all — it will be derived from A8's own commit. HEAD is `12f65a7`.
No agent was dispatched at this BASE, so no review package can be contaminated by it.

## C3 is NOT behind `editor.spec.ts` — the serialization point covers C2 and C7 only

Re-read C3's actual Files block rather than relying on my earlier note: it creates
`snap-manager/spacing-hold.dom.test.ts` and modifies `constants.ts`, `distance.ts`, `spacing.ts`. **No
`tests/e2e/editor.spec.ts` anywhere in the task**, and its commit step stages only
`src/web/packages/editor/src/snap-manager`. So C3 was never gated on B9 — only C2 (brief `:127`) and C7
(brief `:222`) stage the e2e spec. Correcting this now, because the earlier ledger entry grouped all three
together and would have serialized C3 needlessly.

**But C3 and C6's fix round share a different hazard: both stage the whole `snap-manager` directory.** C6's
fix writes `snap-manager/scaling/rectangular-scale-gesture-projection.ts`; C3 writes
`snap-manager/{constants,distance,spacing}.ts` plus a new dom test. The files are disjoint, but a
directory-level `git add src/web/packages/editor/src/snap-manager` by either would sweep the other's
uncommitted work into its commit — the same failure mode as `editor.spec.ts`. Ruling: they run strictly one
at a time, and each stages explicit paths, never the directory. Cost if wrong: a commit carrying a sibling
task's half-finished file, recoverable but noisy.

## Task 6 fix round 1 landed (`dd05235`); scoped re-review dispatched

`dd05235` — "refactor(editor): restore the fork's inline coordinates in the scale projection", **1 file,
+4/−9**, the exact inverse of the review's Important 1. I read the diff body myself rather than the report:
the four hoisted `const` lines are gone, the four `coordinates:` arguments now read
`RECTANGULAR_SCALE_CONTROL_COORDINATES.tl/.tr/.br/.bl` inline, and **the corner-to-parameter mapping is
preserved** — `.tl`→`topLeft`, `.tr`→`topRight`, `.br`→`bottomRight`, `.bl`→`bottomLeft`. Implementer reports
vitest `scaling` 98/98 before and after, and `npm run typecheck` clean across all workspaces; the typecheck is
the result that matters, since this file reaches vitest only because esbuild erases types.

**BASE derived as `git rev-parse dd05235~1` = `da5f0b2`**, per the standing fix-base rule. Package
`review-da5f0b2..dd05235.diff` written (2,271 bytes) and verified to hold exactly 1 commit and 1 file before
the path was named in the dispatch — the check that would have caught the earlier mis-named-base error.

**Trust but verified: the implementer's "found, not fixed" report is correct to leave alone.** It noticed that
the local file is Biome-formatted where the fork is compact single-line, and that the fork's JSDoc is Russian
where the local one is English. Both are *declared* port allowances — the port's rule is that its edits are
Vigilia's equivalents (specifiers, English comments, the typing guards) plus whatever the formatter imposes —
and the original review reached the same conclusion, measuring the residual differences as exactly the
declared set after formatting both sides with the same biome call. So the style delta is expected, not a
finding. Recorded here because "the file is not byte-identical to the fork" reads like a defect and is not one;
byte-comparability means the *diff* stays cheap, not that the bytes match.

**Re-review dispatch carries one thing for the reviewer to adjudicate rather than accept: my own refutation**
of the review's Important 2. I told it the commit message's "a destructured corner and the first effective
value" names the tuple destructures at `:196` and `:340`, not the hoist, and asked it to check that reading
rather than take it. Cost if my refutation is wrong: one documentation sentence, and the finding would then be
about a commit message rather than the code, so it changes nothing about `dd05235`.

One-writer state: this dispatch is the only writer (one file, now committed), and A8's and B9's reviewers are
read-only. C2, C3 and C7 remain held — C2 and C7 on `editor.spec.ts`, C3 on the `snap-manager` directory
staging hazard this fix round shared.

## Task 6 COMPLETE — `dd05235` on `abd5713`. Re-review: all findings addressed, none new.

Re-review verdict: both findings addressed. It confirmed the fix is not merely compliant but **correct** —
`.tl`→`topLeft`, `.tr`→`topRight`, `.br`→`bottomRight`, `.bl`→`bottomLeft` preserved — and it went further
than I asked in a way that matters: it established *why* that check could not have been left to the tests.
`createBoundsFromCorners` (`:398`) is a min/max over corners and therefore **permutation-invariant** — the
reviewer proved it with a direct 6-permutation probe returning identical output — so a corner mix-up is
invisible to every bounds assertion in the file. The only case that would catch a swap is the `angle: 45`
fixture at `gesture-projection.test.ts:658`, where the four corners are distinct; the `:713` case asserts
degenerate edges at `angle: 0` and would miss it. This is worth keeping: **bounds tests structurally cannot
guard corner identity**, so the fork comparison is the real protection and it now holds — both sides match
verbatim modulo formatting.

It also adjudicated my refutation of Important 2 and **agreed with it**: the fork has exactly two destructure
guards (`:196` `const [first, second] = effectiveValues`, `:340` `const [topLeft, …] = sourceCorners`) and the
hoist destructures nothing, so the message never named it. Finding false as stated, and moot once the hoist
was gone. **The reviewer also caught a bad probe of its own and said so** — `npx biome` in this workspace
resolves to an unrelated `biome@0.3.3` and returned empty output, so it re-ran against the local 2.5.14 binary
and proved the formatter is a no-op on the file by appending `const   y=1` and watching it be rewritten. That
is the right instinct: a probe that returns "clean" because it did nothing is not evidence.

Task 6 closed. Commits: `abd5713` (port) + `dd05235` (fix). Counts: 3 files / 98 tests, typecheck clean
across all six workspace projects.

## Task 3 DISPATCHED — BASE `dd05235`

Brief regenerated immediately before dispatch and hash-compared: `fe506801918bf478`, 145 lines — unchanged
from the post-plan-edit read, so my full read of it stands. Base recorded as `git rev-parse HEAD` = `dd05235`,
the branch tip after C6's fix, so C3's package will contain C3's commits and nothing else.

**Why C3 and not C2 or C7:** C2 and C7 both stage `src/web/tests/e2e/editor.spec.ts`; C3 does not touch it.
C3's only hazard was the `snap-manager` directory staging shared with C6's fix round, and C6 has now committed,
so the directory is clean of other writers. C3 writes `constants.ts`, `distance.ts`, `spacing.ts` and a new
`spacing-hold.dom.test.ts` — four files, all free.

The dispatch carries four things the brief cannot know or that are easy to get wrong under pressure: the
orphaned-type deletion the plan now names, the two live neighbours in `distance.ts` that must survive
(`MAX_DISPLAY_DISTANCE_DIFF`, `resolveDisplayDistance`) because over-deletion is worse than under-deletion,
an explicit restatement that Step 2's first branch means **delete nothing and stop** — with the reason, that
the live `switchDistance: previousContext ? Number.POSITIVE_INFINITY : 0` is strictly stronger than the dead
constant's flat `5` — and the instruction to stage the four files **by name** rather than as the directory the
brief shows, since a directory `git add` is what would sweep a sibling's work in.

## Plan amended for C7 — `798cc77` — the C6 finding turned into a rule before C7 can repeat it

C7 is the last port task in this plan, so the C6 review's finding applies to it directly and cheaply: the
commit message claimed its deviation list was exhaustive ("The only edits to the fork's text are …") and the
file contained one more. Added to C7's Step 3 a paragraph naming the actual deviation, why
`noUncheckedIndexedAccess` did not require it, and the rule — **enumerate deviations from a diff against the
fork, not from memory; the two expected classes are the `noUncheckedIndexedAccess` guards and the
`exactOptionalPropertyTypes` widenings, plus specifiers and English comments, and anything outside those needs
a sentence saying why.**

Committed as `798cc77` immediately rather than held, because **C3's dispatch took BASE `dd05235` before this
commit and C3 is the only implementer in flight** — its package is built from a BASE that does not include
this, and this commit touches only a plan file C3 does not write. Verified by `git log`: HEAD `798cc77`, C3's
BASE `dd05235`, one commit apart, no overlap. The earlier freeze reasoning does not apply here because C3's
review package path will be derived from C3's own commit, not from HEAD.

**Cost if wrong:** C3's review package would carry this docs commit if I packaged it as `dd05235..HEAD`
instead of from C3's commits. The dispatch already told C3 to stage by name and the packaging rule is
`git rev-parse <C3 commit>~1`, so this is guarded twice.

## Task 3 implementation landed (`a90bc43`); the brief's fixture was broken and the implementer proved it

`a90bc43` — "test(editor): pin equal-spacing hold, drop the dead spacing ports", 4 files:
`constants.ts` (−1), `distance.ts` (−40), `spacing.ts` (−70), new `spacing-hold.dom.test.ts` (+105).

**Step 2 branch 1: both assertions pass, so the hold exists and the deletions are justified.** Measured
boundary: the object reads 200 at every offset 195–210 and follows the pointer from 211; `HOLD_STEP = 210`,
`RELEASE_STEP = 221`. The implementer's argument for 210 is the one that matters — 205 is the last offset a
*fresh* acquire could reach (`SNAP_THRESHOLD` 5 + `SPACING_SNAP_HOLD_MARGIN` 5), so 206–210 can only be the
hold, and the test asserts 200 at 210.

**The important finding is not the deletion, it is that the brief's Step 1 fixture could not measure anything.**
The implementer ran the brief verbatim, saw *no* holding window, and did not report the false finding its
Step 2 branch 1 would have dictated ("stickiness is missing — stop, delete nothing, leave all five dead
exports in place"). It diagnosed two geometry defects instead:

1. **Fabric 7 `Rect` defaults to a CENTER origin.** A bare `left:` is the shape's *centre*, not its edge, so
   every computed edge shifts by half the width. **I verified this myself** rather than accepting it:
   `node_modules/fabric/dist/src/shapes/Object/defaultValues.mjs` holds `originX: CENTER` in
   `fabricObjectDefaultValues`, which the constructor applies via `Object.assign(this, s.ownDefaults)`.
   I had *assumed* left/top from a memory of older Fabric; the source says otherwise. This is the eighth
   finding in this effort that failed to survive checking, and the second where the implementer was right and
   I was wrong.
2. **The flankers never overlapped the active band.** `top: 40, height: 100` against an active object at
   `top: 180` means no perpendicular-axis overlap, and a spacing chain needs it — so `isBoundsAligned` blocked
   every chain. The fix spans the flankers the full artboard height.

**Plan corrected and committed as `ffe8f40`.** The correction is in the plan, not the brief, per the standing
rule, so a future regeneration cannot reintroduce the broken fixture. It now carries the explicit
`originX: "left", originY: "top"` via a local `rect()` helper, flankers at `top: 0, height: 300`, and a comment
naming the CENTER default and the perpendicular-overlap requirement. **My own pre-dispatch verification of C3
checked every line citation and the deadness claims but never the fixture's geometry** — that is the gap, and
it is worth naming: verifying a test's *references* is not verifying that the test can observe its behaviour.

**The over-deletion the plan warned against was avoided.** The implementer deleted `calculateSpacingSnap` and a
newly orphaned `SpacingContextByAxis` type beyond the literal list — which Step 3 authorises — and I confirmed
by grep that both are now referenced nowhere in the workspace, while `MAX_DISPLAY_DISTANCE_DIFF` and
`resolveDisplayDistance` are untouched. It also reports non-vacuous in both directions: no flankers → fails,
`SPACING_SNAP_HOLD_MARGIN = 0` → fails. The second is the one that proves the test observes the hold rather
than the acquire, and the reviewer is re-running both rather than accepting them.

**BASE derived as `git rev-parse a90bc43~1` = `798cc77`.** Package `review-798cc77..a90bc43.diff` verified to
hold 1 commit and exactly 4 files before the path was named in the dispatch.

### C3 review — PASS/PASS, closed. Commit `982a2f7`

**Verdicts:** spec compliance PASS, task quality PASS. Critical 0, Important 0, Minor 2.

**The reviewer did not accept the implementer's claims; it re-derived them.** It swept three fixture variants
to test whether each half of the fix is independently load-bearing:

| fixture | result |
|---|---|
| fixed origin + the brief's band | no hold at any offset |
| Fabric default origin + covering band | first assertion reads 190, fails |
| fixed origin + spanning band | hold 195–210 |

The first row is the one that matters: with the brief's fixture *verbatim*, the sweep shows nothing, Step 2
branch 2 fires, and all five dead exports survive on a false finding. Neither fix is cosmetic. It re-derived
defect 2 from the source too — `isBoundsAligned` (`spacing.ts:836`) gates on `getAxisOverlap > 0`, and the
brief's flanker band `-10.5..90.5` against the active band `159.5..200.5` is `-69`.

**Both teeth mutations re-run verbatim, not accepted:**

- flankers removed → `expected 210 to be 200`; 1 failed | 1 passed
- `SPACING_SNAP_HOLD_MARGIN = 0` → `expected 210 to be 200`; 1 failed | 1 passed

Both reverted; the working tree returned to the pre-existing unrelated modifications.

**Independent confirmations:** the five deleted symbols have zero hits under `src/web` and each was a lone
declaration at `798cc77`; `MAX_DISPLAY_DISTANCE_DIFF` and `resolveDisplayDistance` both present and still
imported; typecheck clean; 141/141 snapping tests pass.

**Minor 1 (fixed):** plan line 399 still carried the brief's disproved edge-origin arithmetic though the same
block had been updated to 161/280/41. Fixed to `161 + (280 - 161 - 41) / 2` and committed as `982a2f7`. It was
carried in by `ffe8f40`, so the committed test file was always clean — the stale comment existed only in the
plan. **Minor 2** is report-table wording, no action.

**Ruling: the plan now carries the measured boundary and the fixture's geometry, but no step requires an
implementer to re-sweep before setting the constants.** The reviewer's three-variant sweep is the evidence
that the boundary is real; a future reader who regenerates the fixture has no instruction to re-measure. Cost
if wrong: a regenerated fixture could carry `HOLD_STEP = 210` against a different geometry and assert a hold
that is really a fresh acquire — exactly the failure `ffe8f40` fixed. The plan's Step 1 already says "measure
it"; I am not adding a second instruction, because the measurement is Step 1's whole point and duplicating it
in the constants block is the kind of restatement AGENTS.md's brevity rule forbids.

## Plan C staging defect fixed before C7 dispatched — `ea8f3fb`

Regenerating C7's brief (hash `9031ccfed77965ff` → `9ce41eff9a1b79b2` after the `798cc77` amendment) forced a
full re-read, per the standing rule, and the re-read found something the amendment was not about: **Task 7's
commit staged `docs/evidence/screenshots` as a directory.** Task 9's did too. I searched the branch for other
directory-staged screenshot paths and found exactly those two.

That directory holds ~40 PNGs belonging to other tasks and another plan, **and it currently carries a modified
`editor-desktop-chromium.png` that no task in this plan owns** (it was already modified at session start). Either
task staging the directory commits that unrelated capture under its own message — the same packaging error this
ledger has already recorded once, and the one `AGENTS.md`'s "stage explicit paths" rule exists to prevent.

**Ruling: both tasks name their captures instead.** Task 7 stages its one `editor-snap-resize` PNG and the
`README.md` row; Task 9 stages `README.md` plus its own `*snap*.png` captures by the naming convention Task 7's
capture name establishes. `scaling/` stays a directory in Task 7 **deliberately** — that task creates the
directory and every file in it is its own, which is the condition that makes directory staging safe. Cost if
wrong: a capture fails to land if a future task names a capture outside the `*snap*` convention, which the
README row would then reference as a missing file — visible immediately, and cheap to fix by naming it.

**Ruling: the defect goes in the plan, not the brief.** Same standing rule as C3's fixture: a brief regenerates
from the plan, so a correction that lives only in the brief is lost on the next regeneration. Cost if wrong:
none — the plan is the authority and the brief is regenerated from it.

**C2's brief hash is unchanged (`47fa9ea19ec7efb1`), so its verification still holds and it stays checked-and-
ready.** C7's changed and its re-read is now done; it is ready behind `editor.spec.ts`.

**Still queued behind `editor.spec.ts`, in order: A8 fix (in flight) → C2 → C7.** B9's re-review is read-only and
runs alongside.

## Session resumed 2026-09-26 — dispatch state reconstructed

Fresh root session resumed from `STATUS.md` per the plan banner. No `dispatch-*.md` records existed in
this workspace, so nothing was in flight: the viewport plan's gate had closed and Task 2 was simply never
dispatched. Every commit the ledger names is present (`8be1364`, `69e5121`, `a90bc43`, `982a2f7`,
`cf5ec0e`, `d86baac`, `abd5713`, `dd05235`, plus plan edits `12f65a7`, `798cc77`, `ea8f3fb`); HEAD is
`2a6d0ef`.

**Ordering rulings from the prior session that still bind, and why the queue is what it is.** The single
open constraint is that `src/web/tests/e2e/editor.spec.ts` is a serialization point: C2 (brief `:127`),
C7 (brief `:222`) and A10 all stage it. Prior ruling: B9 (long committed) → C2|C7 one at a time → A10.
A10 is the last gate of Plan A and is a dependency for nothing here, so **C2 goes first, then C7**; A10
is not this plan's to schedule and stays behind both. Cost if wrong: two implementers stage the same spec
file and one commit sweeps the other's test — recoverable, not free.

**Task 2 regenerated and hash-stable.** `task-2-brief.md` regenerated from the plan this session; sha256
`47fa9ea19ec7efb1`, **identical** to the hash the prior session's verification recorded, so that
verification (all citations, the `instanceof` swallow path, `§175`) still holds and the brief was not
re-read line by line. Cost if wrong: a stale citation inside a brief whose text I have now proven
unchanged since it was verified.

**Ruling: Task 2 dispatches before Task 7, not after.** Both are dispatch-ready and independent of each
other's files (C2: `selection-eligibility.ts` + `index.ts`'s `startGesture`; C7: `scaling/` + `index.ts`'s
bindings). Dispatching both concurrently would put two writers on `snap-manager/index.ts` and on
`editor.spec.ts` in the same window — the collision this ledger has already recorded twice. C2 first, C7
behind its review. Cost if wrong: a slower serial queue, with no correctness consequence.

**Task 2 dispatched** — agent `a56288c9349e3c980`, model sonnet, BASE `2a6d0ef`, record
`dispatch-a56288c9349e3c980.md`. Brief carried with the standing `STATUS.md` instruction (the ruling at
"`STATUS.md` is carried in the dispatch prompt, not patched into nine briefs") and with the C2 rationale
correction the prior session made, restated in the prompt so the implementer cannot rediscover the
disproved version from an older read.

**All four remaining briefs regenerated, and all four had drifted.** C7–C10's briefs on disk predated the
prior session's own plan-audit corrections, so each differed from the plan it claims to extract: C8's
carried the disproved "citation is off by two lines" claim about `readMovementModifiers` and a
`scale-snapping-resolver.ts:626` citation that is the *fork's* line, not the port's. Regenerated against
the current plan; this is the standing "regenerate immediately before dispatch" rule doing its job rather
than a new defect. Cost if wrong: none — the regenerated brief is by construction the plan's text.

## C7 pre-dispatch verification (read-only, run while Task 2 is in flight)

C7 is the plan's largest remaining task and the one whose failure is silent, so its riskiest claims were
re-read against the working tree before any dispatch. Four results, three of which close a question the
plan leaves open:

**1. The guide path is a real reuse, not a second channel — verified by shape, not by intent.**
`VerifiedScaleGuide` (`scaling/scale-snapping-resolver.ts:211-218`) is
`{ axis: ScaleSceneAxis; edge; position; candidateId; category; snapshotIndex }` with
`ScaleSceneAxis = "x" | "y"` (`scaling/scale-projection.ts:6`). The movement path's
`createMovementGuideLines` (`movement-snapping-resolver.ts:1443`) reads only `axis` and `position` and maps
`axis === "x" ? "vertical" : "horizontal"`. The two are structurally compatible, so C7's guides flow into
the existing `lastGuides` slot (`index.ts:242` → `afterRender` `:255-263`) with no new renderer, no new
guide type and no change to `guide-renderer.ts`. The plan's conditional "modify `guide-renderer.ts` only if
the fork's scale-guide shape needs it" therefore resolves to **do not modify it**.

**2. Do NOT wire `scaling-step-snap-guards.ts` into the controller.** The 1,281-line guard family C5 ported
has exactly one fork caller, `pixel-grid.ts`, which the spec rules absent
(`specs/2026-09-25-snapping-fidelity.md:34`). The prior session measured this and ruled the port
unreachable-by-design, with the port/replace/drop decision belonging to C10 Step 3. C7 must not "use" it to
justify its existence, and must not write a test asserting it works — a test for unreachable code is
green-and-wrong. Carried into C7's dispatch as a named hazard.

**3. `isStandardRectangularScaleControl` engages under Vigilia's controls manager.** `controls-manager/index.ts:93-95`
replaces `InteractiveFabricObject.ownDefaults.controls` with fresh `createObjectDefaultControls()`, which
looks fatal for a guard that compares against exactly that factory. It is not: the overrides touch only
`render`/`sizeX`/`sizeY`/`offsetX`/`offsetY`/`cursorStyle`, and the guard compares only the five behaviour
handlers by reference plus `x`/`y`/`offsetX`/`offsetY`. This was measured in full before C6 and the ruling
there stands; re-read now rather than re-derived.

**4. The marker and modifier readers are where the plan says.** `readMovementMarker` at `index.ts:63`,
`readMovementModifiers` at `:79` (returns `ctrlKey` only — C7 widens it to `shiftKey`), the `bindings` array
at `:265` with `["object:moving", runStep]` and `["mouse:up", stopGesture]` at `:266`, and the `canvas.on`
cast through `as never` at `:301`. Every one matches the brief, so C7's Step 3 and Step 4 line references
need no re-derivation.

**Ruling: C7's dispatch will carry (2) as a prohibition and (1) as the answer to a question the plan leaves
open.** Cost if wrong: (2) exists because a capable implementer looking at 1,322 landed unreachable lines
will reasonably try to connect them; (1) saves the dispatch from re-deriving a mapping that already holds.

## Pending controller action for C10 — carry the fallback-path measurement into the plan, at C10's dispatch

C10 Step 3 asks the implementer to read the fork's fallback chain and record **port / replace / drop** for the
second engine. The prior session already measured half of the answer and ruled on it (the C6 step-guard entry
above): the guard family's only fork caller is `pixel-grid.ts`, which `specs/2026-09-25-snapping-fidelity.md:34`
marks absent, so the answer for at least that branch is **drop**.

**Not editing the plan now, deliberately.** Task 2's implementer holds BASE `2a6d0ef`, and `review-package
BASE HEAD` spans every commit in between — a plan commit landed at this moment is swept into Task 2's review
package, the same packaging error this ledger already recorded once (a 328,245-byte package for a one-commit
fix). The standing constraint "do not advance HEAD while an implementer is mid-flight" applies.

**Action when C10 is regenerated for dispatch:** add the measured conclusion to Step 3 as the answer rather
than the question, so the implementer records a decision instead of re-deriving one from a 1,400-line file of
private methods whose symbol names this ledger has already seen mis-transcribed twice. Then regenerate
`task-10-brief.md` and re-check its hash, per the standing rule.

**Cost if wrong:** the implementer re-derives a measurement that is already in this ledger, and spends a few
minutes on a file the plan itself warns is easy to mis-cite.

## Ruling: Task 2's review base is the commit its work sits on, not its dispatch BASE (2026-09-26)

Task 2's implementer (`a56288c9349e3c980`) was dispatched with BASE `2a6d0ef`. While it was in flight,
Plan B's final-review fix wave committed `2929f87` (`fix(editor): gate arrange per action and pair
inspector geometry`) on the same branch, moving HEAD. This violates the standing constraint below
("do not advance HEAD while an implementer is mid-flight") — it happened because Plan B was closing out
and the two plans' file sets are disjoint, so the collision was judged tolerable at the time.

**Consequence:** Task 2's commit will have parent `2929f87`, so a review package scoped
`2a6d0ef..<task-2 head>` would carry Plan B's 9-file fix commit as well as Task 2's work, and a Task 2
reviewer would be grading another plan's diff.

**Ruling:** the review package for Task 2 is scoped `2929f87..<task-2 head>` — the parent its work
actually sits on. The dispatch BASE is a record of what the implementer started from, not necessarily
the base of its diff. Verify the range contains exactly Task 2's commits (`git log --oneline
2929f87..<head>`) before dispatching the review, and if the implementer's own commit turns out to sit
elsewhere, scope to its real parent. Cost if wrong: a Task 2 reviewer sees one extra commit of a
different plan's work, or misses a commit of its own.

The same rule was applied to Plan B's own re-review this session: a `5b9b386..2929f87` package came back
as 22 commits / 982.7 KB and was discarded in favour of `2a6d0ef..2929f87` (1 commit / 32.6 KB).

## Pre-answered for Task 10 Step 3: the fallback path is DROP, and it is measured (2026-09-26)

Task 10 Step 3 asks the implementer to decide **port / replace / drop** for the fork's second
engine (line/spacing/pixel-grid fallback) and record it in the spec's `## Key decisions` §3. The
brief tells the implementer to read the fork's chain before deciding. That derivation is already
done and the answer is not a judgement call — it is a measurement — so it is settled here and
carried in the Task 10 dispatch. The implementer verifies it rather than re-deriving it.

**Measurement (run against the tree at `2929f87`):**

- All four fallback modules are **absent** from Vigilia:
  `line-snapping.ts`, `anchor-buckets.ts`, `pixel-grid.ts`, `snap-target-resolver.ts` —
  none exists under `snap-manager/`.
- `scaling/scaling-step-snap-guards.ts` (1,322 Vigilia lines, ported in Tasks 4–6) has
  **zero importers**. `grep -rn "scaling-step-snap-guards" packages/` returns only its own
  provenance comment on `:1`. Nothing in `scaling/` imports it, and `scale-snapping-resolver.ts`
  imports only `../constants.js`, `../bounds.js` and `./scale-projection.js`.
- Its sole fork caller was `pixel-grid.ts`, which is absent (spec `:34` already classifies the
  fallback as **absent**; spec `:121-125` names the four modules).

**Ruling: DROP.** The fallback's entry point does not exist in Vigilia, and the ported guard family
that only it consumed is unreachable code. Cost if wrong: a fidelity difference in cases where the
fork's candidate path yields nothing and its second engine caught the move — but Vigilia's broader
candidate filter is precisely why fewer objects are declined, which is the spec's own argument
(`:123-125`) for why the fallback's justification is weaker.

**Consequence the Task 10 implementer must apply, not re-decide.** Step 3's drop-branch note claims
`getObjectBounds` "is live again" because `scaling-step-snap-guards.ts` calls it at
`:5,907,969,1269`. That is true only if the guards module is reachable — it is not. So:
`getObjectBounds` has **no live caller** either; its only references are inside the same unreachable
module. Do not write the note as the plan drafted it.

**Do NOT write a test asserting the guard family works.** A test for unreachable code is
green-and-wrong — it passes while proving nothing about shipped behaviour. This was already ruled
once this session when the guard family was first found unreachable; the ruling stands.

**Open sub-question the implementer owns.** Whether to delete `scaling/scaling-step-snap-guards.ts`
(and `getObjectBounds`, if nothing else reads it) as dead ported code, or keep it. Task 3 set the
precedent by deleting every dead spacing port. Decide it, state the reason, and if the answer is
"keep", say what would make it reachable — a module with no importer and no test is a liability
that AGENTS.md's 800-line stop does not cover, since 1,322 lines of unreachable source is worse than
a long live file.

## C9 pre-dispatch verification: the brief's export list is short by two helpers (2026-09-26)

Read-only pass over the C9 brief while Task 2 is in flight. Measured against the tree at `2929f87`:

| Brief claim | Measured | Verdict |
|---|---|---|
| `captureVisualReview` is file-scope and unexported at `editor.spec.ts:2875` | It is unexported, but at **`:3045`** — `:2875` is stale | citation stale, substance correct |
| Reuse `editor.spec.ts`'s `sceneToClient` / `clientOfScene` "rather than writing a second mapping" (`:26`) | Both exist at **`:47`** and **`:70`** — and both are **also file-scope and unexported** | **real gap: the brief exports one helper, C9 needs three** |
| `editor.spec.ts` has "Task 10 Step 1 adds them at file scope" | They are at file scope already, and still not importable | the brief's premise is wrong in the direction that matters |
| `docs/evidence/screenshots/README.md:34` lists `editor-snap-guides` | Confirmed at `:38` (`Editor mechanics` row) | citation stale, substance correct |
| `editor.spec.ts` is 3,096 lines | Confirmed | — |

**The gap.** C9 creates `src/web/tests/e2e/snapping.spec.ts` — a *new* file — and its `:26` mandates real
pointer gestures routed through `sceneToClient` / `clientOfScene`. Neither is exported. A new spec file
therefore cannot import them, and the brief's own prohibition ("a raw `box.x + …` in this file is the
defect this bullet exists to prevent") rules out the one workaround it would otherwise reach for. So C9
must export **three** helpers from `editor.spec.ts`, not the one its Files list names. The whole file has
**zero** `export` statements today — this is the first export it will ever carry, so the implementer
should expect no existing convention to follow and should add them in one edit.

**Ruling: carried in the C9 dispatch as a controller resolution, and the plan is edited only after Task 2's
review closes.** The plan file is tracked, so correcting it now would commit while Task 2's implementer is
mid-flight — the standing constraint, and the same packaging error this ledger already recorded twice
(982.7 KB for a one-commit fix, earlier 328,245 bytes). The dispatch carries: (1) export all three helpers
from `editor.spec.ts` in one edit; (2) the real line numbers `:47`, `:70`, `:3045`; (3) the README row is
`:38`, not `:34`. Cost if wrong: a plan file that understates its own Files list until the next plan-touching
commit, against a C9 implementer who would otherwise hit a compile error on the first import.

**Also carried into the C9 dispatch:** Plan B's deferred Minor 6 (browser coverage for the layer panel's
bottom action row) — see `plan-queue.md` for the ruling. C9 already owns `editor.spec.ts`, so the case costs
one more test in a file the task is editing anyway, and it closes a spec acceptance item that is otherwise
verified only by a by-hand note in `STATUS.md`.

## Every `editor.spec.ts` line citation in C7/C9 is stale, and the fix is to stop citing lines (2026-09-26)

Measured while Task 2 is in flight. `editor.spec.ts` has moved under the plan three times, and the
three snapshots disagree:

| Symbol | `a5f6ba8` (plan written) | `2929f87` (committed HEAD) | working tree (Task 2 uncommitted) |
|---|---|---|---|
| `snaps a dragged object to a neighbour and shows a guide` | `:2089` (plan + audit) | **`:1983`** | `:2176` |
| `captureVisualReview` | `:2875-2895` (plan + audit) | **`:2760`** | `:3107` |
| `sceneToClient` / `clientOfScene` | — | `:47` / `:70` | `:47` / `:70` (unmoved) |

Task 2's uncommitted edit to that file is **347 added lines**, which is why the working-tree numbers
sit ~190–350 above the committed ones. Neither set is stable: the committed set moves when Task 2
commits, and any later task that edits the file moves it again.

**Ruling: the C7 and C9 dispatches cite `editor.spec.ts` by test title and symbol name, never by line
number.** The brief's `:2089`, `:2875` and the audit's replacements for them are all treated as
historical, and each dispatch tells the implementer to locate the anchor with `grep -n "<test title>"`
before editing. Cost if wrong: an implementer greps instead of jumping to a line — a few seconds,
against a silent mis-edit into the wrong test when the number is stale.

This is the second time this session that the "regenerate the brief immediately before dispatch" rule
has caught something a plan audit had already been through. It is not a defect in the audit: the audit
verified against the tree as it stood, and the tree kept moving. The rule that survives is the
grep-by-title one, because it is the only form that does not go stale.

## C8 pre-dispatch verification: one guardrail defect, and a forward reference that is now satisfied (2026-09-26)

Read-only pass over the C8 brief. Measured at `2929f87`:

| Brief claim | Measured | Verdict |
|---|---|---|
| Ctrl short-circuit in the ported resolver at `scale-snapping-resolver.ts:332` | `if (intent.modifiers.ctrlKey) {` at **`:332`**, returning `createScaleSnapPlan({ …, proposals: { x: null, y: null }, resolved: null })` | **correct** |
| `ScaleSnapModifiers` requires both keys | `ctrlKey: boolean` at `:114`, `shiftKey: boolean` at `:115`; the resolver throws unless both are boolean at `:729-730` | **correct** |
| `readMovementModifiers` is module-private at `index.ts:79-90` | Defined at `:79`, returns `{ readonly ctrlKey: boolean }` — `shiftKey` genuinely absent | **correct** |
| `movement-snapping-resolver.ts:316` short-circuits the same way | To re-check at C8's dispatch; not verified in this pass | open |

**Defect — Step 6 stages a directory.** `git add src/web/packages/editor/src/snap-manager/scaling`
(`brief :70`) is the exact form AGENTS.md forbids ("Stage explicit paths; never `git add -A`"), and it
is the same defect the plan audit already fixed for Task 7 Step 8 (audit correction 13) and Task 9
Step 5 (correction 17). C8's brief was regenerated after that audit and still carries it, so the audit's
fix did not reach this task. It also over-stages: at C8's dispatch the `scaling/` directory holds every
file Tasks 4–7 landed, so a directory add would sweep in already-committed-elsewhere work and any
concurrent edit.

**Ruling: the C8 dispatch names the two files explicitly** (`scaling/scale-snapping-controller.ts` and
`scaling/scaling.dom.test.ts`), plus `snap-manager/index.ts` if and only if Step 3's widening of
`readMovementModifiers` is what lands it. Cost if wrong: an implementer stages two named paths instead of
a glob.

**Forward reference is satisfied, not a defect.** `:54` tells C8 that "Task 7 already widened
`readMovementModifiers` to return both" — stated as done, and C7 has not run. This is correct as written
*provided C8 dispatches after C7*, which the plan's ordering already requires (C8's Interfaces block
consumes "the controller (Task 7)"). No ruling needed; carried as a sequencing assertion in the dispatch.

## C7 pre-dispatch verification, completed: the guide channel needs no new code (2026-09-26)

The prior session verified C7's riskiest claims and left the guide-reuse question open. Closed here.
Measured at `2929f87`:

| Claim | Measured | Verdict |
|---|---|---|
| `createMovementGuideLines` maps a verified guide to a `GuideLine` | `movement-snapping-resolver.ts:1443` — `guides.map(({ axis, position }) => ({ type: axis === "x" ? "vertical" : "horizontal", position }))` | **correct** |
| `VerifiedScaleGuide` structurally satisfies it | `scale-snapping-resolver.ts:211-218`: `axis: ScaleSceneAxis` (`scale-projection.ts:6` = `"x" \| "y"`), `position: number`, plus four fields the mapper ignores | **correct — no adapter needed** |
| The movement guide type's axis union matches | `VerifiedMovementGuide.axis: MovementSceneAxis` (`movement-snapping-resolver.ts:167`) = `"x" \| "y"` (`movement-snap-candidates.ts:5`) | **identical unions** |
| "do not add a second guide channel" | `index.ts:102-103` holds `lastGuides: readonly GuideLine[]`; `:252` fills it from `createMovementGuideLines`; `:264-269` renders it. A scale task assigns the same variable through the same mapper | **the reuse is real** |
| `guide-renderer.ts` "only if needed" | Its `renderSnappingGuides` takes `guides: readonly GuideLine[]` (`:75`); a `GuideLine` is `{ type, position }` (`types.ts:26-29`). Nothing in the scale path produces a shape this renderer cannot draw | **no modification needed** |

**Ruling: the C7 dispatch states that `guide-renderer.ts` needs no change, rather than leaving it
conditional.** The brief's Files list carries it as `- Modify: …guide-renderer.ts (only if the fork's
scale-guide shape needs it)`, which invites an implementer to invent a need. It does not: the ported
scale guide carries `axis` and `position`, the existing mapper reads exactly those two fields, and the
existing renderer draws exactly the `GuideLine` they produce. Cost if wrong: an implementer who finds a
genuine shape mismatch edits the file and says so — the ruling removes a licence, not a capability.

**Also settled for C7:** `readMovementModifiers` is at `index.ts:79` returning `{ ctrlKey }` only (C7
widens it to `shiftKey`); the `bindings` array is at `:264` with `["object:moving", runStep]` at `:265`
and `["mouse:up", stopGesture]` at `:266`; the `canvas.on` cast is at `:301`. Every one matches the
brief, so C7's Step 3 and Step 4 line references need no re-derivation.

## Task 2 landed (`4fcd162`), review dispatched (2026-09-26)

`a56288c9349e3c980` returned **DONE_WITH_CONCERNS**. Commit `4fcd162` — `feat(editor): refuse a snap
gesture for an unsupported selection` — one linear commit on `2929f87`, 5 files, +359/−13. Tree clean,
no probe residue.

**Review scoped `2929f87..4fcd162`** per the ruling above, not the dispatch BASE `2a6d0ef`. Package
`review-2929f87..4fcd162.diff`, 21,963 bytes, 1 commit. Review dispatched as `ac4bd1b3dfc9272c7`
(sonnet), output `task-2-review.md`.

**What landed.** `selection-eligibility.ts` with three kept clauses (≥2 members; no parented child;
unit scale when a `Textbox` is present) and the fork's per-child kind allow-list dropped with the
reason in the file header, which is what §175 requires. `index.ts` gains the value import of
`ActiveSelection` and the refusal in `startGesture` before the bounds work. Five jsdom cases; two
browser cases plus six file-scope e2e helpers.

**Concerns the reviewer is asked to judge, all recorded as observations rather than blockers:**

1. The implementer's **first threshold had no teeth** — `expect(Math.abs(left - raw)).toBeGreaterThan(1)`
   passed with `runStep` disabled, because the raw-landing estimate drifts ~1.2 px. Replaced with
   `<0.5` against the snap line and `<1.5` against a measured raw landing (disabled guard gives 2.75).
   The report says the 4 px offset and both tolerances are zoom- and scene-dependent.
2. The refusal margin is **narrow** — 0.4 px enabled vs 2.75 px disabled — and depends on the refused
   drag landing on its raw position rather than near another candidate. A starter-scene edit putting a
   candidate within ~2 px would make it pass for the wrong reason.
3. The refusal's state (non-unit scale on an `ActiveSelection` with a `Textbox`) is **not reachable
   through the product UI**; the test sets it directly. The guard is defence for a future path, and the
   test documents that.
4. **Step 6's trap, found and documented:** `sceneToClient` quantises to client pixels (zoom ≈ 0.489),
   so a drag leg under ~2 scene px sends no `mousemove`, Fabric never fires `object:moving`, and a test
   built on that leg passes while exercising nothing. All legs are now ≥30 px with an 80 px park.

**Ruling on concern 3: keep the guard, and keep the test.** A state the current UI cannot produce is
not a reason to delete a guard the fork carries and the spec's §4 asks for — the spec says "Adopt the
guard unless the current object set makes a clause meaningless; record which clauses were dropped and
why", and the clause is not meaningless, it is merely unreached today. The test documents the
unreachability in its own text, which is the honest form. Cost if wrong: a small guard and one browser
case maintained against a path that never fires — cheap, and the alternative is re-deriving the fork's
clause from scratch if the UI later grows a scale-then-move gesture.

**Ruling on concern 1: the threshold replacement is accepted, and the fragility is recorded, not
fixed.** Asserting against the snap line rather than against a drifting raw-landing estimate is the
correct discriminator — it is what "did it snap" actually means. The scene-dependence is real but it is
the starter scene's property, not the test's; Task 9's behaviour matrix is where a re-measurement
belongs if the scene moves. Cost if wrong: a browser test that goes red on a starter-scene edit and is
re-measured then, against a test that asserts the wrong thing today.

## Plan corrections committed — `cf508b4` (2026-09-26)

HEAD was safe to advance: both running agents are read-only reviewers, so the "do not advance HEAD
while an implementer is mid-flight" constraint does not bind. Committed the accumulated corrections in
one plan-only commit, then regenerated briefs 7–10 and verified each carries its correction.

| Correction | Where | Why it could not wait for Task 7's dispatch |
|---|---|---|
| Cite `editor.spec.ts` anchors by test title | Tasks 7, 9 | Every line number is stale and cannot be kept fresh — the file moved three times |
| Export three helpers, not one | Task 9 Files + Step 5 | `sceneToClient` / `clientOfScene` are as unexported as `captureVisualReview`; the task's own instruction to reuse them is otherwise impossible |
| Name the two files instead of the `scaling/` directory | Task 8 Step 6 | Same AGENTS.md defect the audit fixed for Tasks 7 and 9; the fix never reached Task 8 |
| `guide-renderer.ts` verified unnecessary | Task 7 Files + Step 8 | The ported scale guide's `axis`/`position` are exactly what `createMovementGuideLines` reads and what `GuideLine` holds |
| Step 3 pre-answered: **drop**, measured | Task 10 Step 3 | All four fallback modules absent; `scaling-step-snap-guards.ts` has zero importers, so "`getObjectBounds` is live again" is false |

**Landed Tasks 4–6 keep their directory-stage lines deliberately.** They are the record of what ran, not
instructions for what will; rewriting a landed task's command block would falsify the history the plan
is also meant to preserve. The audit table gained a row saying so.

**Regenerated briefs** (`task-brief` for 7, 8, 9, 10): 238 / 78 / 66 / 124 lines. Verified by grep that
each brief carries its correction — the "regenerate immediately before dispatch" rule working again.

---

## Brief hygiene pass (controller, 2026-09-26) — commits `cc4cde5`, `d6ae808`

Four defects found by regenerating briefs 7-10 and reading them, none visible in the plan's audit:

1. **Task 9 Step 5 restaged Task 7's capture.** `editor-snap-resize-desktop-chromium.png` is produced
   by Task 7 Step 7 and committed by Task 7 Step 8; Task 9 staged it again while producing no capture.
   Either a no-op or a re-run's byte-different file under a commit that did not produce it. Fixed:
   the line is gone and Step 5 now says so explicitly.
2. **Task 9's export list was one helper short.** `sceneToClient` and `clientOfScene` are as
   unexported as `captureVisualReview`; Task 9's own Step 2 instruction to reuse them is impossible
   without exporting all three. `editor.spec.ts` has **zero** `export` statements, so all three go in
   one edit.
3. **Task 9 cited Task 10 Step 1 as the step that adds those exports.** Task 10 Step 1 is the broad
   gate. The cross-reference would have sent the implementer to a step that cannot satisfy it. Fixed
   to name Task 9's own Step 5.
4. **Task 9 carried a stale-archaeology sentence** ("An earlier revision cited `editor.spec.ts:1542`
   …") that documented a corrected mistake instead of stating the rule. Replaced with the rule: reuse
   the helpers, do not write a second mapping. The ledger is where corrections belong.

**Ruling: a brief is verified by regenerating it and reading it, not by trusting the plan's audit.**
Two of the four defects above were introduced by the audit's own corrections (the export list was
widened in the plan's Files block but not in Step 2's prose), and one — Task 8's directory-stage —
recurred because its brief was regenerated *after* the audit ran. Regenerating immediately before
dispatch is what catches these; the standing rule stands. Cost if wrong: one read of a 69-line file
per dispatch.

**Ruling: Task 9 Step 5 now tells the implementer not to stage the resize PNG.** The matrix's value is
its assertions — it reads geometry and samples rendered pixels — so a case needs a capture only where
a Review Focus item names one. Task 7 owns the resize capture.

**Task 10 Step 2's two phone-chromium cases are real, not phantom — read, not run.** The step names
`keeps repainting as samples arrive` and `is byte-stable at a fixed clock`, and the second is a genuine
prefix match of the case at `display-fabric.spec.ts:671`; the step's own text carries the run output
for both. **An earlier version of this entry claimed I verified they pass. I did not run them** — I read
the plan's recorded output. That is the plan author's evidence, not this session's, and it is recorded
here as such. If Task 10's gate is to rely on it, re-run both at the gate's base commit.

**Corrected same pass.** The claim was written and caught within one tool call. It is left visible
rather than silently edited because the failure mode — reading a plan's recorded evidence and
restating it as one's own verification — is exactly what this queue's "an unticked checkbox proves
nothing" ruling exists to prevent, and the same error class would silently pass a gate.

**Ruling: cite a location by symbol when this plan itself edits the file; keep the line number when the
file is pinned.** Six more stale citations were found in Tasks 7 and 8, all in `snap-manager/index.ts`
— Task 2's commit added lines above `readMovementModifiers`, shifting `:63-76` to `:67-80`, `:79-90` to
`:83-94`, `:123-140` to `:131-142`, `:219-226` to `:221-228`, `:266` to `:268` and `:301` to `:307`.
Every one was accurate when written and is now wrong by 1-6 lines. All six are replaced with symbol
anchors. The citations that **stay** are the ones whose target this plan never edits: the fork at
`9efdd78a` (read-only, so stable by construction), `node_modules/fabric` (pinned by the lockfile), and
the resolver and runtime files Tasks 4-6 already landed. The distinction is not cosmetic — a citation
into a file the plan edits is a citation the plan's own commits invalidate, which is exactly how all
twelve stale citations this session were produced. Cost if wrong: one `grep` per dispatch.

**This is the second time the same defect class was found in the same plan.** The first pass
(`cf508b4`) fixed the `editor.spec.ts` citations and believed it had covered the class; it had not,
because the audit scoped itself to the one file that had visibly moved. The class is "a line citation
into a file this plan edits", and `snap-manager/index.ts` qualifies. Cost of the miss: two dispatch
briefs carried wrong line numbers.

**Measurement: a second ported file is already dead, and Task 10 would have missed it.** Measured at
`e0e1e6f`, from the filesystem rather than from any plan text:

| `scaling/` module | importers | verdict |
|---|---|---|
| `scale-projection.ts` | 5 | live |
| `scale-snapping-resolver.ts` | 4 | live |
| `rectangular-scale-gesture-projection.ts` | 2 (`gesture-projection.test.ts`, `rectangular-scale-interaction.ts`) | live |
| `scale-snap-candidates.ts` | 1 (`scale-projection.test.ts`) | live |
| `scaling-snap-guard.ts` | 1 (`scaling-step-snap-guards.ts`) | transitively dead — its only reader is dead |
| `scaling-step-snap-guards.ts` | **0** | dead; Task 10 Step 3 already rules DROP |
| `rectangular-scale-interaction.ts` | **0** | **unwired — Task 7's Step 3 is what wires it** |
| `standard-scale-control.ts` | **0** | **dead unless Task 7 consumes it** |

`standard-scale-control.ts` exports `isStandardRectangularScaleControl` and `didSideScaleSwitchToSkew`,
and **neither name appears anywhere in `packages/editor/src` outside that file**. Checked against the
fork: its only three consumers are `image-scale-snapping-controller.ts` and the two
`selection-manager/scaling/active-selection-*` files — all three controllers this plan deliberately
does not port. So the file is dead in Vigilia unless Task 7's fresh controller calls it.

**Ruling: Task 7 decides it, and Task 10 disposes of whatever Task 7 leaves.** Added to Task 7 Step 3
as a required decision with the fork's three call sites named, and to Task 10 Step 3 as a re-measure
instruction rather than a note to trust. Task 10's original text asked only about
`scaling-step-snap-guards.ts`, so without this the second dead file would have survived the close-out
that exists to remove dead ports. Cost if wrong: one decision Task 7 was going to make anyway, against
a ported file with no importer shipping as live code.

`rectangular-scale-interaction.ts` is **not** in this class — its zero importers is the expected
pre-Task-7 state, and Task 7 Step 3 item 5 names `applyRectangularScalePlan` from it explicitly. It is
recorded above only so the measurement is not mistaken for a second dead file.

**Corrected same pass.** The `getObjectBounds` reader check was run once with a grep that excluded
`*.test.ts` and reported a false positive: `bounds.ts:138` is its own definition, not a reader. Re-run
without that exclusion, its only readers are inside `scaling-step-snap-guards.ts`, so Task 10's claim
that it has no live caller is **correct** — and `getObjectExactBounds` remains the movement path's
reader, as the step says.

**Measurement: Task 9's skip clause named an idiom that does not exist.** The step told the implementer
to skip non-desktop projects with `test.skip(testInfo.project.name !== "desktop-chromium", "desktop surface")`.
That string appears **zero** times in `editor.spec.ts` and, so far as measured, nowhere in `src/web/tests`.
The real idiom is `test.skip(!isDesktopSurface(testInfo), "the editor is a desktop surface")`, used by
every editor case, backed by `isDesktopSurface` — already exported from `tests/e2e/surface.ts:13`.
An implementer following the step literally would have invented a second skip expression, which is a
second definition of the desktop surface set. Replaced with the real import and the rule against a
project-name comparison. Cost if wrong: one import line.

**Ruling: correct a plan defect by stating the rule, not by narrating the mistake.** The first version
of the fix above added "an earlier revision of this step gave one (`testInfo.project.name !== …`) and it
exists nowhere in the repo." That is the same stale-archaeology shape this ledger already ruled against
in Task 9 Step 2 — it records a corrected error instead of the invariant, and it names a string an
implementer could copy. Rewritten in the same pass to state only what `isDesktopSurface` owns and why a
second expression drifts. The ledger is where the mistake is recorded; the brief carries the rule.

**Also verified for Task 9 (all three held):** `editor.spec.ts` has **zero** export statements
(`grep -c '^export'` = 0, 3,073 lines); `sceneToClient` (`:47`), `clientOfScene` (`:70`) and
`captureVisualReview` (`:3022`) are all `async function` declarations at file scope, so exporting each
is a one-word change; and the debug-handle lookup `key.startsWith("vigilia-fabric-editor-")` has 12 uses,
so Step 2's instruction to read geometry through it matches the file.

**Verified for Task 10 Step 3 (the DROP ruling's own evidence):** all four fork fallback modules
(`line-snapping.ts`, `anchor-buckets.ts`, `pixel-grid.ts`, `snap-target-resolver.ts`) are absent from
`snap-manager/`, and `scaling-step-snap-guards.ts` has zero importers. The step's claim that
`getObjectBounds` has no live caller is **correct**: its only readers are inside that unreachable file,
and `getObjectExactBounds` remains the movement path's reader.

**Measurement: Task 7's citations into `rectangular-scale-interaction.ts` are stale, and one names the
wrong file.** Measured at `bc19796`:

| Step 3 says | Actual |
|---|---|
| `applyRectangularScalePlan` at `:74` | `:85` |
| `readFinalRectangularScaleGeometry` at `:124` | `:137` |
| `setPositionByOrigin` at `:99` | `:110` |
| `createRectangularScaleValues` "in the same file (`:147`)" | **not in that file at all** — it is exported from `rectangular-scale-gesture-projection.ts:174` |

The first three are the same defect class as the `snap-manager/index.ts` citations: Tasks 4–6 landed the
file after the numbers were written, shifting them by 11–13 lines. The fourth is a different and worse
error — an implementer told to find `createRectangularScaleValues` in `rectangular-scale-interaction.ts`
would not find it, and the file does export `readAppliedRectangularScaleMultipliers` at `:119`, close
enough to the `:147` that a reader could mistake one for the other.

The fourth also turned out to be a **non-instruction**: `readFinalRectangularScaleGeometry` already calls
`createRectangularScaleValues` internally at `:160`. So the item is rewritten to say what the work
actually is — pass the multipliers to `readFinalRectangularScaleGeometry` and let it measure — instead of
telling the implementer to call a function the builder already calls. Cost if wrong: one function call
the implementer does not make.

**Ruling: Task 7 Step 3 item 6 now names the file that owns each function, and cites none by line.**
Every remaining citation into `rectangular-scale-interaction.ts` is gone; the file is one this plan
landed, so it is in the class the ruling above covers. Cost if wrong: one `grep` per dispatch.

**Citation sweep complete (controller, 2026-09-26).** Every remaining line citation across briefs 7–10
was read against the source and is **correct**: `types.ts:26-29` is `GuideLine`; `movement-snapping-runtime.ts:115,159`
are `resolveMovementPlan` / `verifyMovementPlan`; `scale-projection.ts:12-16` is `ScaleProjectionVariable`
(`scale-x`, `scale-y`, `uniform-scale`, `text-width`); `scale-snapping-resolver.ts:332` and
`movement-snapping-resolver.ts:316` are the two Ctrl short-circuits the plan claims. The remainder point
at the fork at `9efdd78a` (read-only) or `node_modules/fabric` (lockfile-pinned), which cannot drift.
The class is closed: **fourteen stale citations** were found and fixed this session across `editor.spec.ts`,
`snap-manager/index.ts` and `rectangular-scale-interaction.ts`, plus one attribution that named a file
which does not contain the symbol at all.

---

## Task 2: complete (review returned 2026-09-26)

Commit `4fcd162`. Package `review-2929f87..4fcd162.diff` (1 commit, 21,963 bytes), reviewer
`ac4bd1b3dfc9272c7`. Report: `task-2-review.md`.

**Verdict: spec compliant, quality approved. 0 Critical, 0 Important, 6 Minor.**

Both load-bearing claims were verified by the reviewer against the source rather than the report:
`index.ts:1` is a **value** import of `ActiveSelection` (split from the `import type` on `:2` — an
`import type` would have failed silently), and `selection-eligibility.ts:4-10` names the dropped kind
clause with its reason, checked against the fork at `9efdd78a` where the dropped clause is exactly
`FabricImage || Textbox || isShapeGroup` and the three kept clauses match the fork's other three.
The teeth checks were accepted as real: `|left - line| < 0.5` discriminates 0 (enabled) against 5.24
(`runStep` short-circuited), and `|left - raw| < 1.5` discriminates 0.4 against 2.75.

### Minor findings — dispositioned

| # | Finding | Ruling |
|---|---|---|
| 1 | `selection-eligibility.ts:10` should also record that the **kept parented-child clause is unreachable**, since Fabric's `ActiveSelection.enterGroup` clears a group child's group | **REJECTED — the claim is wrong.** Read against Fabric 7.4.0 source: `Group.enterGroup` sets `parent` (`dist/index.mjs:9328`), and `ActiveSelection.enterGroup` (`:18934-18938`) calls the base `_enterGroup`, which sets `group` and never touches `parent`. So a selection member that came from a group keeps `parent === oldGroup` and the clause is reachable. Only `Group.exitGroup` (`:9352`) clears `parent`. No sentence added; adding the reviewer's version would have written a false invariant into the source. |
| 2 | `worldLeftOf` / `activeGeometry` partially restate existing vocabulary | **Parked, no action.** The scene↔client mapping is *not* duplicated (`dragActiveSelection` calls `sceneToClient`), which was the drift risk the sibling brief named. Batch-into-next-touch. |
| 3 | `editor.spec.ts:2264` margin is narrow (0.4 vs 2.75) | **Parked.** Already disclosed by the implementer; re-measure if the starter scene changes. |
| 4 | `STATUS.md` listed Task 2 as remaining in the same commit that landed it | **Fixed** at `357bda1`, by the controller, after this review. |
| 5 | Plan checkboxes unticked, no `> **Landed**` marker | **Fixed** in this pass — marker added and all seven steps ticked. |
| 6 | No rendered capture for the two new browser tests | **Not engaged, ruled.** The eligible path is already captured by `editor-snap-guides`, and the refusal state is UI-unreachable (the implementer said so and the reviewer agreed). A capture of an unreachable state is not evidence. |

### Out-of-scope observation — carried, not actioned here

The fork's sibling clause `isSupportedTarget` (`movement-snapping-controller.ts:170-172`) refuses
`!target || target.group`; Vigilia has no equivalent, and `grouping-manager/index.ts:54-57` sets
`subTargetCheck`/`interactive` on group entry, so **a group's child is individually selectable and
draggable** where the fork refused it.

**Ruling: real but narrower than "no equivalent" — carry it to Task 7, do not add work to Task 2.**
Measured: `runStep` applies `nextPosition.left - currentLeft` as a **delta** (via `deltaX`/`deltaY`), and
`resolveNextMovementPosition` resolves `intent.position + delta`. For an **unrotated, unscaled** group the
group-local and scene planes share axes, so the delta is correct and no defect exists. The defect appears
only for a group carrying rotation or scale: the snap is computed in scene space from `getBoundingRect()`
(which includes the group's transform) while the delta is applied in the child's group-local plane, so
the child lands off the guide.

Deliberately **not** written as a source comment: the comment would have to state the caveat, and a
comment describing an unfixed wrong-answer case reads as an endorsement of it. Task 7 owns this code
path (it ports the scale controller and reuses the delta application), so the observation goes there as
a decision, not here as a note. Cost if wrong: one group-rotation case snaps incorrectly until Task 7
rules on it.

**Task 2 is complete.** Seven steps ticked and the `> **Landed**` marker added in the same pass.

## Task 7 — review returned, fix round 1 ruled (2026-09-26)

Commit `70b5b36` (parent `efc4aeb`). Review `task-7-review.md`, range `efc4aeb..70b5b36`.
Verdicts: **spec PASS WITH DEFECTS, quality PASS.** 0 Critical, 3 Important, 4 Minor.

What the review established by measurement, not by reading the report:

- Port fidelity holds. Independent token diff leaves 18 token ops in 7 hunks, all inside a
  permitted class; the `noUncheckedIndexedAccess: zero sites` claim is byte-identical-true.
- The marker trap is **not** reintroduced, and Step 6's red is red for the *right* reason:
  under a per-gesture constant the second step is read as a duplicate and never re-planned, so
  the object keeps the harness's raw 200 × 1.53 = 306 and `toBe(310)` fails. Test 1 still passes
  because a single step still plans — the 2-pass/1-fail split is consistent with the break.
- The retarget diagnosis holds and the engine did not mis-acquire: gap 6 scene px against an
  acquire radius of ≈10.2, so 735 was acquired and 748 was never reachable. Not a Critical.
- The commit contains exactly the seven brief-named paths; `editor-snap-guides…png` is not in it.
- Group-child guard: the brief's "say it is unfixed" clause is satisfied.

**Ruling: I1 is accepted and fixed.** The brief required a `ponytail:` comment at the site naming
the skipped-refinement ceiling; it is absent from the whole commit and the report never mentions
the requirement. The comment exists so the next author sees that Fabric's own scale constraints
(`minScaleLimit`, uniform scaling, flipping) can block a constraint the resolver chose, the plan
is reported through `blockedAxes`, and the guide is then silently not published — that is a
decision, not an oversight, and only the comment says so. Cost if wrong: one comment.

**Ruling: I2 is accepted as a documentation defect and is fixed without rewriting history.**
The commit message's class 2 claims the fork's `//**` markers were kept as-is; the fork has zero
`//**` and 25 `/**`, while the port has 5 `//**` and 20 `/**`. Five block comments changed form —
an unlisted class, and a false statement about the fork. `70b5b36` is already pushed to
`origin/claude/superpowers-workflow-cleanup`, so amending it would need a force-push, which is an
external action this session does not take unasked. The corrected enumeration therefore goes into
the plan's Task 7 landed note, which is durable project doc, plus the report. The code is not
wrong: `//**` is an existing Vigilia convention (`movement-snapping-runtime.ts`,
`movement-spacing-correction.ts`, `spacing-chains.ts`, `spacing-patterns.ts`). Cost if wrong: a
fidelity claim that stays slightly wrong in an immutable commit message.

**Ruling: I3 is accepted and fixed, and the fix is an assertion rather than a second capture.**
The commit is titled "verified guides" and Review Focus item 1 — the item Task 7 exists to settle —
is "a guide drawn for a snap that was never applied", yet the e2e asserts geometry only and the
no-guide control exists solely as an uncommitted one-off capture by the implementer. So the
user-visible half has no re-runnable evidence, and a regression that stops applying guides while
still snapping correctly passes the whole suite. The plan's own standing rule for the matrix is
that its value is its assertions, not its screenshots, and a capture needs a registered title — so
the fix asserts the applied guide list (or samples the rendered pixels if the applied list is not
reachable from the debug handle), keeps the existing geometry assertions, and adds no capture. The
assertion must be shown failing with guide publication disabled before it is trusted. Cost if
wrong: one browser case in a file this plan already owns.

**Ruling: M1 fixed, M2 and M3 fixed, M4 parked to Task 10.** M1 is a wrong file count in the
report. M2 (the group-child guard) and M3 (the skew branch of `didSideScaleSwitchToSkew` on
`runStep`) are each one case in a file this round already edits, and both guards are two-clause
booleans whose removal would silently restore a wrong answer — the reviewer supplied the recipe for
each. M4 (an `ActiveSelection` resize, admitted by the guard, untested, silent stop if Fabric fires
a per-child `target`) is not a one-liner: it needs a real multi-selection resize driven in the
browser, which is the flow Task 10 exists to exercise. Parked there with this line as its pointer.

Fix round 1 dispatched to the Task 7 implementer; fix-range base for the re-review is `70b5b36`.

## Task 7 — fix round 1 re-reviewed, task complete (2026-09-26)

Fix round 1 landed in `6c603c9` (see the plan note: that commit's message describes unrelated
`STATUS.md` work, because the controller's `git add STATUS.md` raced the implementer's `git commit`
on one index — the content is exactly the three fix paths and nothing else, verified against
`70b5b36..HEAD`). Re-review: `task-7-rereview.md`, base `70b5b36`.

**Verdicts: I1, I3, M1, M2, M3 ADDRESSED; I2 PARTIAL, on a documentation copy only.** The re-review
resolved the arithmetic I had flagged: the port's `/**` count is 25, not 20 — `grep -c '/\*\*'`
counts *lines containing* `/**` and all five conversions are single-line, so the five are a subset
of the 25 (20 unchanged + 5 converted). My "25 became 30" worry was wrong; the report's sentence was
right and my plan note's "20" was the defective copy. Corrected in the plan.

Independent measurements the re-review made rather than read:

- **I3's control is not vacuous** — this was the finding most able to be a false pass. It confirmed
  the sampled canvas is the right one (`getSelectionContext()` is `elements.upper.ctx`, the same
  `canvas.upper-canvas`, and there is exactly one canvas pair on the page), the column is the
  object's own edge, and the 0 is a *live* 0: handles drawn, same column and colour, 0 hits where
  the snapped case reads 508 in the same session. The `-1` early return fails both assertions
  rather than being silently accepted. The `> 100` margin is ~5× over the worst case (~100 px of
  `mr` handle stroke).
- **M2** — probed `new Group([rect])` in Node: the child carries both `group` and `parent`, so both
  guard clauses fire; the unrotated group means only the guard can hold it at 306.
- **M3** — `altActionKey` is `"shiftKey"` in Fabric's `CanvasOptions`, and `down()` fires with
  `e: {}`, so the abandon comes from the step's modifier, not the pointer event.
- **Commit hygiene** — `70b5b36..HEAD -- src/web` is exactly the three paths; `-- docs/evidence` is
  empty, so no `.png` and no README change rode along.
- Gates re-run: `npm run build` clean (host 155.53 kB), the resize browser case passed after the
  rebuild, typecheck/lint/format clean, snap-manager 10 files / 153 passed.

**New defects the re-review raised, both resolved in this close-out:**

- **N1 (Minor)** — `6efef10`'s plan note said the port has "5 `//**` and 20 `/**`", which reads as
  five comments lost when the fork is given as 25. Corrected above. Same defect class as I2: a
  checkable fidelity claim stated wrongly in durable docs. Cost if wrong: none; the numbers are now
  reconcilable from the note itself.
- **N2 (Low, process)** — the mixed commit `6c603c9`. Not amended: the round's evidence is bound to
  that sha, and rewriting it would invalidate the re-review that just ran against it. Recorded in the
  plan so a reader is not misled by the message. Cost if wrong: a commit message that does not
  describe its content.

**The re-review could not verify** the four red-befores, since each needs a source edit and its scope
was read-only. It substituted independent live measurements of the same properties. The red-befores
themselves are recorded in `task-7-report.md` as the implementer ran them.

**Ruling: Task 7 is complete.** `Task 7: complete` at `6c603c9`. Task 8 was held only because it and
this fix round both edit `snap-manager/`; that constraint is now discharged. The task's own carried
items stand and are not debt this plan owes: an `ActiveSelection` resize is parked to Task 10, and the
browser path that flips Fabric's action to a skew mid-drag is unverified (the unit case covers the
guard, not the real gesture).

## Task 8 — complete (2026-09-26)

`33b24a9` adds the Ctrl raw-vs-snapped regression pair and Shift constrained-corner regression.
The task review found its required Ctrl-resize browser proof missing; no production defect.
Fix round 1 adds `6ee37be` Ctrl-resize and Ctrl-drag browser proof, plus capture evidence and
registration at `6d8d9ac`. Fresh desktop browser verification passed both Ctrl and ordinary resize
cases. Scoped re-review found the Important gap addressed and no new Critical/Important findings.

**Ruling: Task 8 is complete.** `Task 8: complete` at `6ee37be` and `6d8d9ac`. Task 9 owns the
broader behavior matrix; it must retain this Ctrl-resize coverage rather than duplicate it.

## Task 9 review ruling — matrix contract corrected (2026-09-26)

Task review confirmed resize equal-spacing was a false-positive test: raw geometry passed its loose
threshold while scale candidates have no spacing path. Fork parity and binding spec distinguish
movement spacing from scaling behaviors. **Ruling: remove resize equal-spacing from Task 9's contract,
not invent scale-spacing product behavior** — documented in `dc40c49`; cost if wrong is a missing
feature to plan explicitly, not a test fixture to fake.

The review also confirmed three implementation gaps: active target kinds were not cross-product
covered, importing `editor.spec.ts` polluted focused discovery, and the layer-action case checked label
parity but not visible bottom-row placement.

**Ruling: park Task 9's three review gaps as known limitations at user direction (2026-09-26).** Do
not integrate fix-round-2 work. Task 9 remains incomplete: (1) shape/text/group active targets lack the
required movement and resize cross-product; (2) importing `editor.spec.ts` registers unrelated tests in
a focused `snapping.spec.ts` run; (3) layer-action proof lacks selected-object and visible footer-placement
assertions. Task 10 may run gates and document real evidence, but must not claim Task 9 matrix closure.
Cost if wrong: a later close-out can misrepresent incomplete browser coverage as verified behavior.

Resize equal-spacing remains intentionally out of scope, not a known bug: neither the fork nor Vigilia's
scale candidate and guide path supports spacing. Adding it requires separate product scope.

## Task 10 gate ruling — blocked by parked Task 9 and leaked worktrees (2026-09-26)

**Ruling: do not call Task 10 complete or close snapping documentation.** Fresh `npm run test:e2e` stops
at Playwright discovery: `snapping.spec.ts` imports executable `editor.spec.ts`, now a prohibited import
rather than merely an inflated focused count. Fresh `npm run format:check` passes, but `npm run lint` stops
on nested Biome root configs under leaked `.claude/worktrees/agent-*`; remaining quality commands did not
run. The worktrees cannot be removed blindly because prior agents may hold uncommitted work. Cost if wrong:
claiming the full gate passed while both browser testing and lint were blocked.

## Task 10: COMPLETE (2026-09-27) — plan closed

Gate: `format:check`, `lint`, `typecheck`, 136/136 unit test files, `build`, `size` — all clean.
Browser suite: first run 1 failed / 154 passed; re-run **155 passed / 96 skipped / 0 failed**.
Focused `snapping.spec.ts`: **36 passed**, 0 failures, 0 `editor.spec.ts` mentions.

`display-fabric.spec.ts` "is byte-stable at a fixed clock on one platform" failed once on
`Buffer.compare` returning -1 under full-suite parallel load, then passed on the immediate re-run,
in isolation at HEAD, and in isolation at the plan's base sha `a0a44ff` (installed, built and run
in a throwaway worktree outside the repo, since removed). The test's own comment on this branch
records the mechanism: `runFor` advances *simulated* time while first paint waits on *real*-time
asset decode. A base-sha **isolated** run cannot reproduce a parallel-load flake, so this is
recorded as load-induced and NOT as proven pre-existing — the ui-polish spec's own rule ("run it
at a base sha before recording it as pre-existing again") is satisfied as far as it can be by a
single-test run, and the residual is stated in `STATUS.md` rather than papered over.

**Ruling: delete the scale step-guard family rather than keep it as vendored reference** —
`scaling-step-snap-guards.ts` (1,322 lines) had zero importers and `scaling-snap-guard.ts` (72)
was reachable only from it; deleting them orphaned `getObjectBounds`, which went too. Task 3 set
this precedent on the dead spacing ports. Cost if wrong: a future fallback port re-reads
`git show 9efdd78a:…` instead of the repo copy.
**Ruling: §64 states the matrix's real coverage rather than the three limitations Step 4 named** —
all three are closed in the current tree, so carrying them into `requirements.md` would record a
falsehood. Cost if wrong: a requirements sentence is more optimistic than the evidence by one
matrix revision.

Step 5 walkthrough (preview build, desktop width, screenshots outside the evidence registry):
drag guide + `26 / 26` equal-spacing labels; resize guide + `5` / `5` labels; Ctrl-drag and
Ctrl-resize both clean, with Ctrl geometry landing on the raw pointer value (drag left 52, resize
right 1014 vs the neighbour edge 1018). The layer panel's bottom action row is visible in the same
captures, which is the last open acceptance item in `2026-09-25-editor-ui-polish.md`.

Commits: `e248cae` (dead guard removal), then the close-out commit.
