# Task 7 review — port `ScaleSnappingRuntime`, bind the resize controller to `object:scaling`

Range: `efc4aeb..70b5b36` (one commit, `70b5b36`)
Inputs read: `task-7-brief.md`, `task-7-report.md`, `review-efc4aeb..70b5b36.diff`, the commit itself.
Review is read-only. No source was modified. Two scratch files created during probing were deleted;
`git status --porcelain` is empty as of this review.

## Verdicts

**Spec compliance: PASS WITH DEFECTS.** The diff does what the brief's Steps 1–8 require and adds
nothing outside them. Two brief clauses are unmet: the Step 3 `ponytail:` comment marking the skipped
refinement does not exist anywhere in the commit, and the Step 3 deviation enumeration in the commit
message is inaccurate about one class.

**Code quality: PASS.** The port is faithful; the marker trap is not reintroduced; guides publish only
from `verification.guides`; ownership and repo rules hold. No Critical finding. The defects are a
missing required comment, an inaccurate deviation list, and three coverage gaps.

## Findings

### Important

**I1 — The brief-required `ponytail:` comment is absent.**
File: `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts` (whole file).
Brief `task-7-brief.md:53`: "Skip refinement in the first port. Pass no `refinement`, so
`refineScalePlan` goes unused … mark the omission with a `ponytail:` comment naming that ceiling."
The controller contains no `refine` token at all, and `grep -rn ponytail` over
`src/web/packages/editor/src/snap-manager/` returns nothing. The report does not mention the
requirement either.
Why it is a defect: this is an explicit, checkable brief clause, skipped silently.
Concrete failure it causes: a future author reading the resize path sees no note that Fabric's own
scale constraints (`minScaleLimit`, uniform scaling, flipping) can block a constraint the resolver
picked, so `verifyScalePlan` reports it through `blockedAxes` and the guide is simply not published.
That is the exact ceiling the brief wanted named at the site where refinement would be added; without
it the omission reads as an oversight rather than a decision. `ponytail:` is an established repo
convention (two existing uses: `artboard-panel.ts`, `viewport-manager/navigation.ts`), so the marker
was available.
Verified: grep for `ponytail`, `refine` in the controller, in the commit, and in the report.

**I2 — The deviation enumeration mis-states one class and omits the deviation behind it.**
File: commit message `70b5b36` (repeated in `task-7-report.md:90`).
Report/commit class 2 reads: "Russian comments translated to English; the fork's `//**` comment
markers kept as-is." The fork has **zero** `//**` markers. At `9efdd78a`, the fork's runtime carries
25 `/**` block comments and 0 `//**`; the port carries 20 `/**` plus **5 `//**`**. So five fork block
comments were *converted in form* to `//**` line comments (at port lines 120, 268, 333, 348, 367),
which is a deviation class the enumeration does not list, and the phrase describing it is false about
the fork.
Why it is a defect: brief `task-7-brief.md:165` makes the enumeration a requirement and states it is
checkable — "a completeness claim in the commit message is checkable and will be checked, so
enumerate from a diff against the fork rather than from memory" — and it is the same defect class
Task 6's review raised (an unlisted deviation found only by a token diff). The functional impact is
nil: `//**` is a pre-existing Vigilia-side convention (`movement-snapping-runtime.ts`,
`movement-spacing-correction.ts`, `spacing-chains.ts`, `spacing-patterns.ts` all use it), so the port
is consistent with the repo. The defect is the accuracy of the fidelity claim, not the code.
Concrete failure it causes: the commit's fidelity evidence is wrong on its own terms, and the next
person to re-derive the port from the fork will see a diff class the message says does not exist.
Verified: `grep -cF '//**'` and `grep -c '/\*\*'` on both files; the 20/25/5 split is exact.

**I3 — No assertion covers guide rendering, and the no-guide control capture is not committed.**
File: `src/web/tests/e2e/editor.spec.ts`, `snaps a resized object to a neighbour and shows a guide`
(and `resizeRightHandleTo`, `clearSceneX`).
The test asserts geometry only: `expect(Math.abs(snapped.right - line)).toBeLessThan(1.5)`, plus the
no-snap control `expect(Math.abs(raw.right - raw.raw)).toBeLessThan(3)`. Nothing reads the guide.
The report acknowledges this (`task-7-report.md:107-109`) and says the guide was confirmed by pixel
scan and a 4x crop, with the no-guide control confirmed on a *temporary, uncommitted* second capture
(`editor-snap-resize-clear-*`).
Why it is a defect: the commit title is "resize-time snapping with **verified guides**"; the snap
behaviour is genuinely covered, but the guide — the user-visible half — has no re-runnable evidence.
The no-guide control, which is the brief's Review Focus item 1 ("a guide with no snap"), exists only
as a one-off manual observation by the implementer, so neither a reviewer nor a future CI run can
re-check it.
Concrete failure it causes: a regression that stops painting resize guides while still snapping
correctly passes the whole suite, and the committed capture cannot catch it because captures are only
regenerated under `VIGILIA_CAPTURE=1`. Mitigating and verified: the geometry assertion is not
vacuous — the control's `clear.distance > 5` guard makes the no-snap assertion meaningful, and the
snap case is 2 scene units from the line with the active object excluded as a source.
Scope note: this is a coverage gap, not a wrong answer. The brief's Step 7 asked for capture plus
visual inspection, which was done; it did not demand an assertion.
Read (not run): the pixel-scan and crop claims; I inspected the committed capture visually and the
dashed vertical guide is present at the status card's left edge, but I did not reproduce the scan.

### Minor

**M1 — The report's gate table reports the wrong test-file count.**
`task-7-report.md:41` says `npx vitest run packages/editor/src/snap-manager` gives "20 files, **151
tests, 151 passed**". The test count is right; the file count is wrong. Re-run by me: **10 test files,
151 passed, 0 failed** (`packages/editor` as a whole: 64 files, 474 tests). Documentation-only.

**M2 — The group-child guard is untested.**
File: `scale-snapping-controller.ts`, `isSupportedScaleTarget`.
The guard refuses a target with `group` or `parent` set, and the comment correctly states it is
"guarded, not merely documented" (brief `:172`: a comment on the wrong-answer case must say it is
unfixed — satisfied). No test drives a resize of a grouped child, and the report declares it
(`task-7-report.md:110-112`). Acceptable as a decision, weak as coverage: the guard is a two-clause
boolean whose removal would silently restore on-guide-drift for grouped children, and a one-line
jsdom case (a `Rect` with a `parent` set, asserting no session starts) would pin it. The failure it
would allow is a child that snaps to a guide drawn for the group's rotated/scaled plane.

**M3 — `didSideScaleSwitchToSkew`'s skew branch is untested on the path that consumes it.**
File: `scale-snapping-controller.ts` `runStep`; `standard-scale-control.ts` `didSideScaleSwitchToSkew`.
The branch is reachable, not theoretical: at `mouse:down` Fabric's `transform.action` for a side
handle is `scaleX`/`scaleY`, and pressing Shift during the drag flips it to a skew inside the action
handler — which is exactly why the check has to live in `runStep` and not only in `beginGesture`.
Without it a scale plan would be applied over a live skew. No test covers it. A unit case with
`controlKey: "mr"` and `pointerEvent.shiftKey === true` would settle it (`canvas.altActionKey`
defaults to `"shiftKey"`, verified in `fabric/dist/src/canvas/CanvasOptions.mjs`).
Note: the comment says "Fabric's alt action", which matches the property name `altActionKey` but not
the key it holds; a reader may expect Alt. Cosmetic.

**M4 — Multi-object resize is admitted by the guard but untested, and its failure mode is silent.**
File: `scale-snapping-controller.ts`, `isSupportedScaleTarget` (admits an `ActiveSelection`),
`runStep` (`if (!target || !transform || transform.target !== target) { finishGesture(); return []; }`).
The guard deliberately lets an `ActiveSelection` through via `isSupportedActiveSelection`. Nothing
tests resizing a multi-selection; the existing `snaps a two-object selection as a unit` case is a
drag, not a resize. If Fabric ever fires `object:scaling` with a per-child `target` for a
multi-selection, `runStep` would end the session on that event and the resize would silently stop
snapping. Unverified — I did not drive a multi-selection resize in a browser, and the flow the
ActiveSelection code exists to serve may be Task 10's.

## Verified clean

- **Port fidelity.** An independent token-stream diff (imports removed, comments stripped, quotes
  normalised, whitespace/semicolons/trailing commas collapsed) leaves **18 token ops in 7 hunks**
  between fork and port: the `ScaleRuntimeStep` union split with a leading `|`, five trailing commas
  (Biome), and one widening. Every divergence falls inside a permitted class (imports, English
  comments, `exactOptionalPropertyTypes`, Biome formatting). The runtime's `//**` comment *form* is an
  eighth class — see I2 — but no code token differs.
- **`noUncheckedIndexedAccess: zero sites`** — confirmed. `first.length === second.length &&
  first.every((value, index) => value === second[index])` is byte-identical to the fork's. The claim
  holds.
- **The marker trap is not reintroduced.** `runStep` reads `readMovementMarker({ event })` per step.
  The teeth check is red for the **right** reason: with a per-gesture constant, the second step in
  test 2 is read as a duplicate and never re-planned, so the object keeps the raw value the harness
  pre-set — 200 × 1.53 = 306 — and line 122 (`expect(resized.getScaledWidth()).toBe(310)`) fails with
  `expected 306 to be 310`, exactly as reported. Test 1 passes under the break because a single step
  still plans; the observed "2 pass, 1 fail" split is consistent. Restored ⇒ green.
- **The retarget diagnosis holds; the engine did not mis-acquire.** From the fixture
  (`new-fabric-theme.ts`: `weather-location`/`weather-details` at 634 width 100 ⇒ right edge 735;
  `thermal-card` at 332 width 396 ⇒ right edge 729 with the card's stroke), the gap is 6 scene px, and
  at zoom ≈ 0.489 the `acquire` radius is `5 / 0.489 ≈ 10.2` scene px. The nearest candidate was 735,
  inside the radius, so 748 was never reachable and the edge landing at 735 is the resolver holding
  its acquired line. The test's target geometry was wrong, not the engine. Not a Critical.
- **The capture is clean.** `git diff-tree` on `70b5b36` lists exactly the seven brief-named paths and
  no eighth. `editor-snap-guides-desktop-chromium.png` is not in the commit. Its working-tree mtime
  (09:38) shows the final two-test grep run regenerated it *before* the 09:39:08 commit, and
  `git status --porcelain` is empty, so the regenerated bytes are identical to `HEAD` — no
  uncommitted change and nothing unrelated swept into the commit.
- **Staging.** Every path staged by name, one capture, no directory-wide `git add`.
- **No line-number citations** in `snap-manager/index.ts` or any file under `snap-manager/scaling/`
  (the plan's standing ruling). Cites in the e2e and the report are per-symbol / title-based.
- **Gates re-run by me:** `npm run typecheck` clean; `npm run lint` clean (342 files);
  `npm run format:check` clean (342 files); `npx vitest run packages/editor/src/snap-manager` 10 files
  / 151 passed; the resize e2e (`--project=desktop-chromium --grep "snaps a resized object"
  --workers=1`) 1 passed against the built bundle (dist mtimes 09:35:51, after the last source edit at
  09:35:41). I did not run `npm run build` myself, so the build-clean row and the reported host bundle
  size are read, not verified; the passing preview e2e does confirm the served bundle is current.
- **Brief clauses met:** no `guide-renderer.ts` edit; no end-of-resize binding added; the existing
  `stopGesture` (and `destroy`) route through the scale controller's idempotent `finishGesture`;
  `readMovementMarker`/`readMovementModifiers` exported with `shiftKey` added; `collectSnapSources`
  extracted and shared; both `standard-scale-control.ts` exports' fates decided and stated.
- **`scale-snapping-runtime.ts` is 380 lines** (fork 372). No vendored-source size exception is
  actually needed: 380 is under the repo's 500-line signal, so the file stays inside the normal limit.
