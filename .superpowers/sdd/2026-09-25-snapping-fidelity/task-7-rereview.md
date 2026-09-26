# Task 7 re-review — fix round 1

Scope: only whether I1, I2, I3, M1, M2, M3 were addressed, and whether the fix introduced new
breakage. Read-only. No source was modified. Scratch probes were written outside the repo
(`%TEMP%\vigilia-rereview\`); `git status --porcelain` is empty as of this re-review.

Range: `70b5b36..0a4cd3b`, i.e. `70b5b36..HEAD` on `claude/superpowers-workflow-cleanup`.
Inputs: `task-7-review.md`, `review-fix1-70b5b36..0a4cd3b.diff`, `task-7-report.md` "Fix round 1".

## Verdicts

| Finding | Verdict |
|---|---|
| I1 — `ponytail:` comment | **ADDRESSED** |
| I2 — corrected deviation enumeration | **PARTIAL** — the report is right, the plan copy is not (N1) |
| I3 — re-runnable guide evidence | **ADDRESSED** |
| M1 — gate row corrected | **ADDRESSED** |
| M2 — group-child guard test | **ADDRESSED** |
| M3 — skew branch test + comment | **ADDRESSED** |

Two new defects, both documentation, neither functional: **N1 (Minor)**, **N2 (Low/process)**.

## Commit hygiene (asked explicitly)

- `git diff --name-status 70b5b36..HEAD -- src/web` is exactly the three paths in the diff file:
  `scale-snapping-controller.ts`, `scaling.dom.test.ts`, `tests/e2e/editor.spec.ts`
  (134 insertions, 11 deletions). Nothing else in `src/web`.
- `git diff --name-status 70b5b36..HEAD -- docs/evidence` is **empty**: no `*.png`, no
  `docs/evidence/screenshots/README.md`. Confirmed independently of the diff file.
- **N2 (Low).** All three source/test changes are committed inside `6c603c9`, whose subject is
  `docs(status): record the spec status pass` — a message that does not describe them. The commit
  is a mixed commit: `STATUS.md` (whose new "Last completed change" matches the subject) plus the
  three fix paths. The fix's red-before evidence exists only in the report, not in any commit body.
  This is a record/hygiene defect, not a code one — the *content* of the commit is exactly the fix
  and nothing else, which is what the staging rule guards.

## I1 — ADDRESSED

`scale-snapping-controller.ts`, in `runStep` immediately above `applyRectangularScalePlan` (the site
where refinement would go). The comment names the real ceiling, not a generic one: `refineScalePlan`
is never called; Fabric's own scale constraints (`minScaleLimit`, uniform scaling, flipping) can
leave a plan blocked; `verifyScalePlan` reports it through `blockedAxes`; no guide is published. It
reads as a decision — "Fails closed, which is the right first behaviour" — and names the upgrade
path (re-solve from the geometry Fabric actually applied, as the fork's selection-scale path does).
Every symbol it names exists: `refineScalePlan` on `ScaleSnappingRuntime`, `blockedAxes` on the
movement verification result, `minScaleLimit` in Fabric's object defaults. `ponytail:` is used the
way the repo's two precedents use it (`artboard-panel.ts`, `viewport-manager/navigation.ts`).
Nit only: at six lines it is longer than the repo's "normally 1–3 lines", where both precedents are
four.

## I2 — PARTIAL, and the arithmetic resolves cleanly

Numbers re-measured on both files, byte-multiplicity (`grep -o`) which cannot be confused by `//**`:

| | `//**` | `/**` | file lines |
|---|---|---|---|
| fork `9efdd78a:src/editor/snapping-manager/scaling/scale-snapping-runtime.ts` | **0** | **25** | 372 |
| port `scale-snapping-runtime.ts` | **5** | **25** | 380 |

The parent's arithmetic worry ("the fork's 25 became 30") dissolves: `/**` counts **25 on both
sides**. The `grep -c '/\*\*'` numbers are *lines containing* `/**`, and every one of the 5
converted comments is single-line in both files, so `grep -cF '//**'` (5) is a subset of
`grep -c '/\*\*'` (25) on the port. 25 = 20 unchanged + 5 converted, and `grep -o` returns 25 on the
port because it counts both members of the `/`+`/**` pair on those 5 lines. The report's own
sentence is exactly right: "the port carries 20 true block comments plus 5 rewritten ones" out of a
measured 25. The five conversions are the fork `/**` blocks for `resolveScalePlan`,
`_createPlanToken`, `assertSameScaleProjectionMode`, `assertSameScaleValues`,
`assertSameScaleModifiers` — verified comment-for-comment against the fork. The corrected class is
now its own listed class, the false "kept as-is" phrase is gone, and the repo-convention
justification (`movement-snapping-runtime.ts`, `movement-spacing-correction.ts`, `spacing-chains.ts`,
`spacing-patterns.ts`) holds.

**N1 (Minor) — the plan's copy of the corrected enumeration carries a wrong number.** Commit
`6efef10`'s landed note in `docs/superpowers/plans/2026-09-25-snapping-fidelity.md` says: "this port
has 5 `//**` and 20 `/**`, so five block comments changed form". The port's `grep -cF '/**'` is
**25**, and the note's own preceding clause gives the fork as 25 — so the pair of numbers reads as
if the port lost five block comments, and a reader who runs the command (which this brief says will
be run) gets 25. The note means "20 unchanged", which is true; `20` is the unchanged count, not the
port's `/**` count. This is the same defect class as I2 — a checkable fidelity claim stated wrongly
in durable documentation — left in the `docs/` copy after the report copy was fixed. The commit
message's class 2 is no longer claimed anywhere, so the original I2 defect is closed; this is a
fresh, smaller inaccuracy introduced by the correction itself. Documentation-only. The report's own
line is correct, so the fix is one word in the plan (or `20 true` in place of `20`).

## I3 — ADDRESSED, and the control is not vacuous

I checked the three ways a pixel count of 0 can be vacuous, and the sampling is not one of them.

- **Right canvas.** `guidePixelsAtSceneX` reads `#vigilia-fabric-editor canvas.upper-canvas`.
  `renderSnappingGuides` paints into `canvas.getSelectionContext()`, which is Fabric's
  `this.elements.upper.ctx` — the same element. The page has exactly one paired set
  (`lower-canvas` + `upper-canvas`) plus one offscreen `_createCacheCanvas` element with no class,
  so the selector cannot pick the wrong one. Probed live: the canvas is 626x593, class
  `upper-canvas`.
- **Right column.** The sample is anchored to the object's own right edge, read from Fabric's
  `getCoords()`, then mapped scene→canvas through `artboardScreenRect()` and the element's own
  `width / getBoundingClientRect().width` ratio. Probed live at a scene x whose column is exactly
  where a guide was painted: **508 guide-coloured pixels found in a ±4px band over the artboard's
  352 device px** (artboard rect `top 120.4`, `height 352.1`, `ratio 1`). Colour matches
  `GUIDE_COLOR "#3D8BF4"` = `rgb(61,139,244)`; the dominant pixels were `61,138,244` / `61,139,244`.
  So the sampler finds a guide that *is* there, at the column the helper computes — it is not a
  read of an empty column.
- **A canvas that has rendered.** The wait is two `requestAnimationFrame` ticks, and
  `renderSnappingGuides` is the canvas's `after:render` handler, i.e. inside `renderCanvas`, which
  `requestRenderAll` schedules on a frame. Two ticks is enough for the scheduled frame plus one
  paint.
- **The control's 0 is a live 0, not a no-op.** The control runs `resizeRightHandleTo` with the
  object selected and its handles drawn, so the same canvas, column and colour are live; a guide
  painted unconditionally would land in the sampled band. Probed live in the control's own shape
  (drag to a scene x 22.5 from every candidate line, mirroring `clearSceneX`'s computation): **0
  guide pixels at the object's edge, and 0 at 1240 and at 200**, while the snapped case in the same
  session reads 508. Both assertions are therefore meaningful.
- **`> 100` is not passing for an unrelated reason.** The control proves nothing else in this
  selection state is guide-coloured, so an unrelated source is excluded by construction. The one
  bound worth recording: the selected object's handles are white fills with a 1px `#3D8BF4` stroke
  (`controls-manager/renderers.ts`), and the sampled column passes through the `mr` handle. A
  handle-stroke-only worst case is ~100 pixels, so the margin between the wrong-reason ceiling and
  the threshold is about 5x, not orders of magnitude; the measured 508 is well clear of it.
  Scenario-fitted for a 720-tall artboard (352 device px of sampled height, 2 columns wide, dashed),
  508 is consistent.
- **The `-1` path is not silently accepted.** `element === null || context === null || context ===
  undefined` returns `-1`, and `-1` fails both `toBe(0)` and `toBeGreaterThan(100)`. A missing canvas
  or context fails the test rather than masquerading as "no guide". The repo's
  `noUncheckedIndexedAccess` rule is respected at the `?? 0` sites in the pixel loop.

The two assertions are kept pair-wise on one object in one test, which is the right shape: the
control pins "no applied plan ⇒ no paint" and the snap pins "verified plan ⇒ paint", so a guide
drawn for the wrong reason fails the control. Nit: the comment says "the whole row is sampled"
where the function samples every row in one narrow column band.

**Not verified (read-only re-review):** I did not reproduce either red-before. Reproducing them
requires editing source (disabling publication, or publishing optimistically), which is outside
this re-review's read-only scope. I substituted an independent live measurement of the same
property — a guide painted during the drag is detected at the object's edge (508) and the control's
same-state column reads 0 — which is what makes the assertions non-vacuous. The claim that the
optimistic-guide break turns the *control* red at 508 follows from the control and the snap sharing
one code path and one sampler, and I could not falsify it.

## M1 — ADDRESSED

`task-7-report.md`'s gate row now reads **10 test files / 153 tests**, with the "20 was the suite
count, not the file count" explanation. Re-run by me: **10 files, 153 passed, 0 failed**. The count
moved 151 → 153 because this round added the two jsdom cases, so the row is consistent with the
tree.

## M2 — ADDRESSED

`scaling.dom.test.ts` gains `refuses a group child, whose bounds plane is the group's`, and `setup`
gains a `grouped` option. The test is not vacuous:

- The child really is grouped: probed in plain Node against `fabric/es` — after
  `new Group([rect], { subTargetCheck: true, interactive: true })` the child carries **both**
  `group` and `parent` (undefined before), which is what `isSupportedScaleTarget` reads. So both
  clauses of the guard are exercised, and no `canvas.setActiveObject` is needed because
  `beginGesture` reads `event.target` and `collectSnapSources` takes `activeObject` explicitly.
- The geometry is identical to the passing snap case ("the step that snaps above must leave the raw
  width here"), and the anchor stays a top-level source while the child's own group is excluded, so
  the only thing that can stop the 310 is the guard. The comment states exactly that ("the group is
  unrotated, so only the guard can stop this child from snapping").
- The red-before (`expected 310 to be 306`) is consistent with the same 1.53 multiplier that gives
  310 in the un-grouped test. I did not re-run the break (needs a source edit).

## M3 — ADDRESSED

- `abandons the plan when the side handle becomes a skew` drives `runStep` with `controlKey: "mr"`
  and a pointer event carrying `shiftKey: true`. `altActionKey` is verified `"shiftKey"` in
  `fabric/dist/src/canvas/CanvasOptions.mjs`, so `didSideScaleSwitchToSkew` reads the key the test
  sets. Earlier in the same file, `down()` fires with `e: {}`, so the abandon is caused by the step's
  modifier and not by the gesture start.
- The assertion (raw 306 survives) is the right one: `shiftKey` does not by itself suppress snapping
  on this path — only `ctrlKey` does (`scale-snapping-resolver.ts`) — so with the refusal neutered
  the step would plan and land on 310. The reported red-before is consistent. I did not re-run it.
- The `runStep` comment is corrected to "Fabric's alt-action key is Shift (its value, not its name)"
  and now says why the check lives at the step (a mid-drag switch to skew) rather than only at the
  gesture start. M3's "alt action" ambiguity is closed.

## What I could not verify

- The four red-befores (publication disabled; optimistic guide; group guard removed; skew refusal
  neutered) — each needs a source edit, out of scope for a read-only re-review. Reported above by
  what substitutes for each.
- `npm run build` was run by me: **clean, exit 0** (`vite build`, editor `index-CpFC6YAF.js`
  1,475.01 kB, host `main.js` 155.53 kB — matching the report's 155.53 kB). The browser claim below
  is therefore against the rebuilt bundle.
- Focused browser case after the rebuild: `--project=desktop-chromium --grep "snaps a resized
  object" --workers=1` → **1 passed**.
- `npm run typecheck` clean; `npm run lint` clean (342 files); `npm run format:check` clean (342
  files); `npx vitest run packages/editor/src/snap-manager` 10 files / 153 passed.
