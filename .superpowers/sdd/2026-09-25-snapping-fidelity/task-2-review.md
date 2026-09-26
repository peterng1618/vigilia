# Task 2 review — ActiveSelection eligibility

Review package: `review-2929f87..4fcd162.diff` (one commit, 5 files, +359/-13).
Line numbers below are new-file lines from that package. (Note: the checkout's
worktree is dirty with another task's uncommitted edits and HEAD has moved past
`4fcd162`; the package, not the worktree, is the view used here.)

## Spec Compliance

- ✅ **Spec compliant.** Every path in the brief's Files list has its hunk:
  `selection-eligibility.ts` (create, `:1-27`), `selection-eligibility.test.ts`
  (create, `:1-49`), `index.ts` (`:1-2` and `:119-130`), `editor.spec.ts`
  (`:104-292` helpers, `:2199-2265` tests). `STATUS.md` is the controller's
  separate requirement and only its "Last completed change" block was rewritten
  (11 lines replacing 13), as AGENTS.md requires.
- ✅ **Step 3 port, verbatim-accurate.** `selection-eligibility.ts:4-10` carries
  the fork marker (`// Ported: fork 9efdd78a src/editor/snapping-manager/movement/movement-snapping-controller.ts:180-197`),
  names the dropped clause, and gives the reason. I read the fork at `9efdd78a`
  (read-only `git show` in `D:\git-repos\fabricjs-image-editor`): the dropped
  clause is exactly `object instanceof FabricImage || object instanceof Textbox || isShapeGroup(object)`,
  and `isShapeGroup` is `ShapeGroupObject || (Group && shapeComposite === true)`.
  The header's transcription is faithful. Kept clauses are exactly the fork's
  other three: `objects.length < 2`, `hasText && (scaleX !== 1 || scaleY !== 1)`,
  `objects.every((object) => object.parent === undefined)`.
- ✅ **Load-bearing claim 1 — `ActiveSelection` is a value import.**
  `index.ts:1` is `import { ActiveSelection } from "fabric/es";`, split from the
  `import type { Canvas, FabricObject }` on `:2` exactly as the brief prescribed.
  The brief's trap (a `TypeError` swallowed by the `guard` wrapper, gesture
  silently never starting) is not present. `excluded-objects.ts:1` already uses
  the same value-import form, so this is idiomatic in the directory.
- ✅ **Load-bearing claim 2 — dropped clause accounted for.** See above; the file
  satisfies §175 for the clause it dropped.
- ✅ **`exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`.** No optional
  property is assigned `undefined`; the only index access (`getObjects()[0]!` in
  the test, `:23`) is the brief's own snippet.
- ✅ **Refuse invalid input, no coercion.** `isSupportedActiveSelection` returns
  `false` for every refused shape rather than defaulting a scale to 1 or a count
  to 0. `getObjectExactBounds` already throws on non-finite/unanchored bounds
  (`bounds.ts:56-77`).
- ✅ **One owner per concept.** `selection-eligibility.ts` is the only owner of
  the eligibility decision; `index.ts` only calls it. No new type, key, default,
  route or schema value. File sizes are fine (27 and 49 lines).
- ✅ **AGENTS.md staging.** The commit's stat is five explicit paths; no directory
  add, no `git add -A`.
- ⚠️ **Cannot verify from this diff:** the report's run numbers (1455 unit tests,
  48 browser tests, format/lint/typecheck clean, `status:check` 59 lines) are not
  reproducible from the package. The `--grep 'snap'` → 3 passed claim is at least
  self-consistent (two new tests plus the existing `snaps a dragged object to a
  neighbour and shows a guide`). Per the review instructions these were not re-run.
- ⚠️ **Out of scope but unaccounted for:** the fork's *sibling* clause in the same
  function family, `isSupportedTarget` (`movement-snapping-controller.ts:170-172`)
  refuses `!target || target.group`, and Vigilia has no equivalent — `grouping-manager/index.ts:154-166`
  makes a group's *child* the active object, so a child can be the snap target
  where the fork refused one. That is not this task's clause and no Vigilia task
  appears to own it. The controller should decide whether it needs an owner, not
  this task.

## Strengths

- The guard is placed exactly where the brief said, before the bounds read
  (`index.ts:122-129`), so a refused selection costs nothing downstream.
- **Both directions of the predicate are pinned by the browser tests.** The
  eligible test (`editor.spec.ts:2227`) asserts `|left - line| < 0.5`; if the
  guard ever wrongly refused the two-label selection, `startGesture` would return
  early and the landing would sit ~4.2 px off the line, failing. That same
  assertion is also the regression guard for the value-vs-type import trap the
  brief warned about — a type-only import would throw inside `guard`, be
  swallowed, and leave the selection unsnapped. The eligible test catches it with
  no explicit assertion about imports.
- The refusal test carries a **positive control** on the same objects with the
  same gesture (`:2249-2250`) before scaling, so the refusal is a measured
  difference, not a drag that missed.
- `dragActiveSelection` (`:226-272`) reads `travelled` through the canvas's own
  `getScenePoint` at the two client points actually sent, which is the right way
  to make `startLeft + travelled` the true raw landing. It reuses the existing
  `sceneToClient` (`:47`) rather than re-deriving the scene↔client mapping.
- The unit test's jsdom pragma (`selection-eligibility.test.ts:1`) is a genuine
  requirement, not padding: the workspace default is `environment: "node"`
  (`vitest.config.ts:8`) and `Textbox` construction needs `document`. Four other
  pragma'd files in the package are also not `.dom.`-named, so the naming is fine.

## Issues

### Critical (Must Fix)

None.

### Important (Should Fix)

None. The teeth-check replacements do fix the reported no-teeth threshold rather
than merely moving it — see the judgement below.

### Minor (Nice to Have)

1. **`selection-eligibility.ts:10` records one vacuous clause but not the other.**
   The spec's own hedge (`docs/superpowers/specs/2026-09-25-snapping-fidelity.md:111-114`)
   is "adopt the guard unless the current object set makes a clause meaningless;
   record which clauses were dropped and why". Under Fabric 7.4.0 the kept
   parented-child clause is *also* unreachable in the product: `ActiveSelection.enterGroup`
   (`fabric/dist/src/shapes/ActiveSelection.mjs:79-92`) removes a group child from
   its group and `Group._enterGroup` sets `group`, never `parent`
   (`Group.mjs:236-245`), so every real `ActiveSelection` member has
   `parent === undefined`. The clause is worth keeping as cheap defence and the
   brief mandated keeping it, but the header presents it as live while it
   accounts for the kind clause. One sentence alongside the existing note.
2. **`editor.spec.ts:157-185` (`worldLeftOf`) and `:116-152` (`activeGeometry`)
   partially restate vocabulary the file already has.** `clientOfScene` (`:70-102`)
   already does `getObjects().find(id)` plus geometry, and the inline `read()` at
   `:2546-2586` already computes the same selection-member count
   (`active?.getObjects?.().length ?? (active === undefined ? 0 : 1)`) that
   `activeGeometry` returns as `members`. The scene↔client mapping itself is *not*
   duplicated — `dragActiveSelection` correctly calls `sceneToClient` — so the
   sibling brief's "second mapping that can drift" risk is avoided; only the
   member count now has two expressions. Fold the count into one helper when a
   third caller appears.
3. **`editor.spec.ts:2264` (`|refused.left - refused.raw| < 1.5`) is a narrow
   margin**, as the report itself flags (Concern 2): 0.4 enabled vs 2.75 disabled.
   It discriminates today. The measured-raw-landing form is strictly better than
   the original `>1`, but any starter-scene edit that puts a candidate line within
   ~2 px of the raw landing turns this green for the wrong reason. The comment at
   `:2259-2263` says this; adding the assertion that the *eligible* control's
   landing is on the line (already at `:2250`) is what keeps it honest.
4. **`STATUS.md:14-16` and `:53` still list Task 2 as remaining** in the same
   commit that lands it ("Tasks 2, 7, 8, 9 and 10 remain"; "Execute snapping
   fidelity Tasks 2, 7, 8, 9 and 10"). Those lines are outside the hunk this
   commit touched. AGENTS.md makes STATUS the handoff a fresh session reads, so
   it is now stale-on-arrival by one task.
5. **Plan checkboxes for Task 2 are still unticked** (`docs/superpowers/plans/2026-09-25-snapping-fidelity.md:258, 273, 278, 290`), and Task 2 has no
   `> **Landed** - \`sha\`` marker where Tasks 1 and 3 do. The report claims
   "DONE_WITH_CONCERNS", so this may be deliberate controller bookkeeping — noting
   it because the artifact a later task reads does not say the work landed.
6. **No rendered capture for the two new browser tests.** The plan's global
   constraint (line 65) requires a rendered capture for a task that changes what
   an author sees. Arguably not engaged here: the eligible path is unchanged
   (already captured by `editor-snap-guides` at `:2195`), and the report's own
   Unverified note says the refusal state is unreachable through the UI. Worth the
   controller's ruling rather than a change.

## Checks run outside the diff (one per named risk)

| Named risk | Check |
|---|---|
| The `import type` trap that compiles and silently swallows | Read `src/web/packages/editor/src/snap-manager/index.ts:1-2` — value import confirmed |
| §175 clause accuracy against the fork | Read-only `git show 9efdd78a:src/editor/snapping-manager/movement/movement-snapping-controller.ts` lines 168-197 — dropped clause and its transcription verified |
| Whether the kept parented-child clause is reachable, which bears on the header's §175 account | `fabric/dist/src/shapes/ActiveSelection.mjs:79-92`, `Group.mjs:236-250` — it is not reachable via the product path |
| Whether "4 px past the line" is inside the acquire threshold | `snap-manager/constants.ts:1` `SNAP_THRESHOLD = 5` → acquire `5 / zoom` ≈ 10.2 scene px at zoom 0.489; the implementer's "4 px, not 1 px" floor is honest but thin |
| Helper duplication in `editor.spec.ts` | Grepped the existing vocabulary: `sceneToClient:47`, `clientOfScene:70`, inline active/rect readers at `:2546-2586`, `leftFor:3066` |

## Teeth judgement (both directions read, not trusted)

- **Unit teeth are real.** Making `isSupportedActiveSelection` return `true` early
  fails three of the five cases (the three `toBe(false)` cases at `:19`, `:28`,
  `:39`), so each refusal case discriminates. The two `toBe(true)` cases are the
  false-negative side.
- **Browser teeth are real, and the replacement fixed the reported defect.**
  The reported `>1` threshold was vacuous because the raw-landing estimate drifts
  ~1.2 px. `|left - line| < 0.5` (`:2227`) is not a moved threshold: it asserts
  against the *snap line*, whose deviation is 0 when the guard admits the
  selection and ~4.2 px when `runStep` is short-circuited (measured 5.24). The
  refusal's `|left - raw| < 1.5` (`:2264`) asserts against a *measured* landing,
  0.4 enabled vs 2.75 disabled. Both discriminate the fixed behaviour from the
  broken one in the direction each is meant to.
- The `>30` displacement assertion at `:2223` is a drag-ran control, not the
  discriminating assertion; the implementer's disabled run failed at `:2227`,
  consistent with `>30` passing. That is the correct division of labour.

## Assessment

**Task quality:** Approved

**Reasoning:** The port is faithful and complete — the three kept clauses match the
fork's other three exactly, the dropped clause is named with a reason, and the
`ActiveSelection` value import is present, so neither of the brief's two traps is
live. The browser tests pin both directions of the predicate, and the replacement
thresholds genuinely discriminate (0 vs 5.24 px, 0.4 vs 2.75 px) rather than moving
the bar. Remaining findings are documentation and housekeeping: one vacuous clause
not noted in the header, a partially duplicated member count in a 3,073-line spec
file, STATUS/plan text that still says Task 2 is outstanding, and one narrow test
margin the report already discloses.
