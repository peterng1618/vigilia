# Snap manager protocol design

- **Status:** backlog

Unapproved; awaiting the owner's review. This document proposes a design for `vg-240`, not permission to re-shape product code. `vg-240` stays open until the approved re-shape is implemented and verified. Nothing in backlog-drain Phase 6 implements this design.

## Ruling and scope

The finding's ruling, quoted verbatim (the row repeats its date prefix):

> RULED 2026-10-12: RULED 2026-10-12 by the user: SPEC IT NOW. The one acquire-hold-plan-verify protocol implemented twice along the movement-versus-scale axis is specified before any re-shape, so the axis that duplicated is settled on paper -- spacing and projection preserved -- rather than discovered while moving 30 non-test files, four of them past the 800-line stop. The spec names which sub-domains are genuinely separate and which protocol is shared, and the re-shape lands from it.

Scope: describe the shared protocol, its variation points, separate spacing and projection domains, preservation proof and re-shape cost. No product changes, tests, new dependency or implementation plan in this task. Source evidence and corrected historical cites will be completed below before linking the document from the register.

## One acquire-hold-plan-verify protocol

Proposed name: **verified snap session**. One lifecycle owns an immutable gesture baseline, per-axis committed hold, marker cache, issued/consumed token identities and at most one pending step. It does not own Fabric mutation. Movement and scale supply typed decisions, not a second lifecycle.

Session states and transitions:

| State | Input | Result |
|---|---|---|
| Inactive | Start with validated baseline | Active/ready; both axes free; empty marker cache |
| Active/ready | New native pointer marker and raw intent | Resolve held-or-acquired constraints; issue pending plan and identity token |
| Active/pending | Same marker | Cached pending result; no second application |
| Active/pending | Scale refinement with current token | Replace pending plan; retain token, raw-intent snapshot and uncommitted hold |
| Active/pending | Actual geometry after host application | Verify; consume token; cache result; commit only verified holds/guides; return ready |
| Active/ready | Previously verified marker | Cached verified result; no second application or hold transition |
| Any active state | Finish | Consume pending token if present, discard session; scale returns guides to hide |
| Inactive | Finish again | No-op cleanup |

Start while active, work without a session, a new marker while pending, foreign/spent/non-current tokens and reuse of a marker with different raw intent fail loudly. Duplicate lookup intentionally precedes re-reading a mutated target. A token authenticates object identity, not just equal numeric fields. Refinement checks usability but does not consume the token; verification or teardown does. A throwing verifier does not commit a hold or consume the token. The host must apply a fresh plan at most once; the runtime enforces ordering and identity, not an application call it cannot observe.

Per-axis decision states are **free**, **proposed acquired**, **proposed held**, then **verified hold** or **free/blocked**. A valid previous hold inside its release region wins over new acquisition. Outside it, search fresh candidates; Ctrl bypasses snapping. Planning never commits a new hold. Verification cannot substitute a different candidate: it either confirms the planned constraint against actual geometry or drops it. An axis with no constraint stays free without being reported blocked. Movement stores line or spacing holds; scale stores a candidate hold. These payloads remain domain-owned.

Runtime correspondence (paths relative to `src/web/packages/editor/src/snap-manager/`):

| Protocol operation | Movement source | Scale source |
|---|---|---|
| Start | `movement-snapping-runtime.ts:83` `startSession` | `scaling/scale-snapping-runtime.ts:90` `startSession` |
| Cached marker lookup | movement runtime `:102` `getDuplicateStep` | scale runtime `:108` `getDuplicateStep` |
| Plan | movement runtime `:115` `resolveMovementPlan` | scale runtime `:119` `resolveScalePlan` |
| Refine pending plan | No movement method | scale runtime `:173` `refineScalePlan` |
| Verify and commit | movement runtime `:159` `verifyMovementPlan` | scale runtime `:198` `verifyScalePlan` |
| Finish | movement runtime `:190` `finishSession` | scale runtime `:227` `finishSession` |

There are **five movement methods and six scale methods**, not identical five-method sets. Proposed common lifecycle provides pending-plan replacement internally; scale's typed facade retains refinement. Do not invent a movement refinement API or a no-op callback to make the counts match.

## Movement versus scale: the axis question

**Answer proposed for approval: share lifecycle and the held-before-acquire/verify-before-commit contract, parameterised by gesture domain; do not merge geometry solvers merely by an `axis` switch.** Movement-versus-scale is a gesture family, not the scene's x/y axis. Both families already resolve x/y, and their two-axis compatibility is not interchangeable.

Unchanged protocol decisions: start/free initialization, one plan per marker, pending-step exclusion, identity tokens, duplicate phases, hold commit after verification, idempotent teardown. Both threshold factories compute acquisition/release as `SNAP_THRESHOLD / zoom`, spacing release as `(SNAP_THRESHOLD + SPACING_SNAP_HOLD_MARGIN) / zoom`, and verification epsilon as `0.1`. The shared threshold policy may move once; retain numeric validation at each existing trust boundary. This does not claim ordinary release has a larger hysteresis region: only spacing adds a margin.

Domain variation that remains explicit:

- **Movement:** raw bounds must be a translation of the baseline. It chooses active box anchors, compares line correction against spacing correction (ties prefer line), rechecks spacing after joint correction, rounds a free movable axis and respects locked axes. Verification checks preserved dimensions, actual position/predicted bounds and selected spacing intervals. See `movement-snapping-resolver.ts:303`, `:365`, `:423`, `:548`, `:574`, `:950`, `:1015`, `:1221`.
- **Scale:** canonical values and a projection mode determine moving-edge positions. Held candidates must remain projectable; joint constraints can conflict and fall back to a preferred one. Exact per-step geometry may refine the plan. Verification requires fixed anchor, protected-state verdict, measured canonical values and reached edges. See `scaling/scale-snapping-resolver.ts:306`, `:431`, `:483`, `:866`, `:1038`.
- **Candidate identity/ranking:** stable baseline order and category priorities are a shared contract, not proof that candidate schemas or distance metrics are identical. Movement spacing has contextual interval identity rather than scale's held edge candidate. Keep acquisition, compatibility, intent equality and verified-guide payloads in typed adapters until their equivalence is proven.
- **Effects:** host application and guide drawing remain outside the shared lifecycle. Scale retains its visible-guide cleanup payload; movement retains its separate regular/spacing verification output. No scene, telemetry or authored-document state is added.

This shares actual repeated orchestration, not all lines in two resolvers. The historical estimate of roughly 4,900 duplicated lines is not an extraction-size measurement and is not used to promise savings.

## Sub-domain boundary

Census re-measured for this document at `17891681`, from
`src/web/packages/editor/src/snap-manager/`:

```
find . -name '*.ts' ! -name '*.test.ts'                          # 30 files
find . -name '*.ts' ! -name '*.test.ts' -exec cat {} + | wc -l   # 10,655 lines
```

`movement-snapping-core.test-utils.ts` (111 lines) is test furniture, so the shipped
production set is **29 files / 10,544 lines** — which corrects the row's "~8,300
non-test lines across eight files". The files fall into three groups, and only the
middle one is the duplicated axis.

### Separate sub-domains that stay separate

**Spacing** — equal-gap intervals, chains and patterns. Its own algebra, with no scale
counterpart:

| File | Lines |
|---|---|
| `spacing.ts` | 1,301 |
| `spacing-chains.ts` | 342 |
| `movement-spacing-correction.ts` | 311 |
| `movement-spacing-verification.ts` | 150 |
| `spacing-patterns.ts` | 145 |
| **total** | **2,249** |

**Projection** — pointer-to-multiplier and value-to-edge geometry. Also its own:

| File | Lines |
|---|---|
| `scaling/rectangular-scale-gesture-projection.ts` | 985 |
| `scale-projection.ts` | 726 |
| **total** | **1,711** |

Neither imports either runtime; only the family resolver and controllers import them.
The shared protocol never needs to enter them. Spacing's interval identity and
projection's canonical values stay domain-owned payloads (section 3).

### The duplicated halves — the movement-versus-scale axis

| Protocol half | Movement | Lines | Scale | Lines |
|---|---|---|---|---|
| Resolver (geometry plus orchestration) | `movement-snapping-resolver.ts` | 1,452 | `scaling/scale-snapping-resolver.ts` | 1,509 |
| Runtime (lifecycle facade) | `movement-snapping-runtime.ts` | 308 | `scaling/scale-snapping-runtime.ts` | 378 |
| Candidate builder | `movement-snap-candidates.ts` | 195 | `scaling/scale-snap-candidates.ts` | 153 |
| **total** | | **1,955** | | **2,040** |

3,995 lines split down one axis. The resolvers carry both the shared orchestration and
each family's own geometry, so folding the protocol removes the first and leaves the
second.

### Neither half — shared or one-sided

**Shared, nothing to fold into a family:** `bounds.ts` 114, `constants.ts` 5,
`distance.ts` 19, `excluded-objects.ts` 52, `guide-painting.ts` 114,
`guide-renderer.ts` 168, `index.ts` 398, `selection-eligibility.ts` 27, `types.ts` 34
— 931 lines.

**Scale-only and real, with no movement counterpart:** `scaling/rectangular-scale-interaction.ts`
323, `scaling/text-width-resize-controller.ts` 439, `scaling/text-width-resize-projection.ts`
295, `scaling/scale-snapping-controller.ts` 285, `scaling/text-width-resize-step.ts` 119,
`scaling/text-width-resize-measurer.ts` 109, `scaling/standard-scale-control.ts` 88
— 1,658 lines.

2,249 + 1,711 + 3,995 + 931 + 1,658 = 10,544, the production census.

## Preservation constraints and evidence

**The constraint.** A re-shape may move orchestration, never geometry. Spacing and
projection must produce identical decisions afterwards: the same positions, the same
guides, the same interval and context selections, the same projections. A behaviour
change in any of those is a different design, not this one.

**How the re-shape's result is checked.** The suites named below run unchanged after the
move; a re-shape is acceptable only while they pass with no edit to their expected
values. A move that forces an assertion to change has changed behaviour and stops. Per
the repo's red-proof rule, any new guard added during the move must fail when the moved
behaviour is disabled before it is trusted. The evidence is these unchanged suites, not
a review of the diff.

### Spacing

| Proof | File | Reaches |
|---|---|---|
| Direct unit | `spacing.test.ts` | `calculateHorizontalSpacing` — exact position under a fractional shift, gap equal to the displayed distance, central guides from real bounds, primary/secondary intervals, reference-context switch |
| Integration | `movement-snapping-resolver.test.ts` | `resolveMovementPlan` over `useForSpacing` fixtures — spacing hold, re-plan per pointer step, release |
| jsdom driver | `spacing-hold.dom.test.ts` | `createSnapManager` reaching an equal-spacing hold |
| Browser | `tests/e2e/snapping.spec.ts` — `moving spacing reaches equal gaps` | the real editor host and canvas |

**Missing.** No test imports `movement-spacing-correction.ts`,
`movement-spacing-verification.ts`, `spacing-chains.ts` or `spacing-patterns.ts`
directly. Their exported functions have no contract test of their own; they are pinned
only through the movement resolver and the browser spec. A move that changes behaviour
*inside* one of those four files is caught by a suite one level up, not at its own
boundary.

### Projection

| Proof | File | Reaches |
|---|---|---|
| Direct unit | `scaling/scale-projection.test.ts` | `createScaleProjection`, `projectScaleEdgePositions`, `resolveScaleProjection`, `getScaleProjectionEdge`, `getScaleProjectionCorrectionMagnitude`, `resolveScaleSceneEdgeAxis`; plus the `scale snap candidates` cases |
| Direct unit | `scaling/gesture-projection.test.ts` | `rectangular-scale-gesture-projection.ts` — the handle and rotation cases over mode multipliers, moving-edge resolution and pointer projection |
| Browser | `tests/e2e/snapping.spec.ts` — `resizing geometry snaps to a guide` (shape, text, group) and the `text side handle` cases | real host resize gestures |

**Missing.** No suite pins the numeric output of `text-width-resize-projection.ts`
independently; it is reached only through `text-width-resize.dom.test.ts`'s
`createSnapManager` driver. There is no golden or visual comparison for either family,
and screenshots are evidence, not cross-platform goldens.

**Both browser proofs are `isDesktopSurface`-gated**, so the real-host evidence does not
run on non-desktop surfaces.

## Re-shape and cost

Pending verified boundaries and file sizes. This section describes a proposed migration, not executable tasks.

## Open questions for owner review

1. Approve one shared protocol with movement and scale adapters, or retain separate implementations behind one documented contract?
2. Should scale refinement remain a scale-only operation, or become an optional protocol hook? The historical claim of equal method sets needs checking.
3. Which candidate ranking, hold transitions and verification decisions can share implementation without changing spacing or projection semantics?
4. Which rendered/browser equivalence evidence must exist before moving either family, beyond today's focused unit suites?
5. What extraction order and temporary file-size ceilings can the owner accept for the four reported files beyond 800 lines?

## Current-source cites and historical corrections

Pending re-derived symbols, census and suite evidence. Historical numbers in `vg-240` are not adopted as verified facts.

## Acceptance

- The reviewed design names states, transitions, guarantees and every runtime operation, including any asymmetry.
- It settles which decisions share a protocol and which remain separate sub-domains without claiming interchangeable movement and scale mathematics.
- Spacing and projection have explicit preservation constraints, existing proof and missing proof.
- Proposed re-shape identifies its cost and the current files beyond the 800-line stop.
- Every source citation is re-derived; corrected historical claims and unresolved owner decisions are explicit.
- Owner approval precedes any implementation; this draft does not close `vg-240`.
