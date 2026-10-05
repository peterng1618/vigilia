# Snapping and guide fidelity

- **Status:** implemented. Plan: [`2026-09-25-snapping-fidelity.md`](../plans/archive/2026-09-25-snapping-fidelity.md).
- **Requirement:** §175 (ported behaviour keeps its source's quality), §64
- **Source of truth:** the retired fork at pinned commit `9efdd78a`
  (`D:\git-repos\fabricjs-image-editor`, branch `codex/fabric-es`), read-only.
- **Supersedes:** the "resize-time snapping" and "rulers, grid, guides and pixel
  snapping" entries in [editor behaviour review](2026-09-24-editor-behaviour-review.md)
  once their scope is decided here.

## Why

§64 claimed movement snapping "shipped" in the fork-parity work. It did not
ship to the fork's quality. Comparing both trees at `9efdd78a` module by module
shows a **faithful geometry core wrapped by a hand-written orchestrator**, and
the orchestrator dropped most of what made the fork's snapping feel correct.
Tolerance maths, spacing chains and the two-phase verify contract are intact;
the behaviour the author experiences is not.

Two defects were corrected before this spec was written and are **no longer in
scope**: the gesture-lifetime marker (snapping evaluated at most once per drag)
and the hardcoded `ctrlKey`/`axes` intent fields. Both landed in `83248dc`.

## Current state after `83248dc`

| Area | Fork | Vigilia |
|---|---|---|
| Marker | browser event (`movement-snapping-controller.ts:127`) | browser event ✓ |
| Ctrl escape hatch | `modifiers.ctrlKey` from the event | from the event ✓ |
| Axis locks | `!target.lockMovementX/Y` | from the target ✓ |
| Guide extent | montage bounds via `_cacheAnchors` | artboard `bounds()` ✓ |
| Geometry core | — | byte-comparable ✓ |
| Resize/scale snapping | 11 modules, ~7,000 lines | **absent** |
| Legacy fallback path | line/spacing/pixel-grid, second engine | **absent** |
| Candidate filter | visible, not excluded, id-ignored | **narrower** |
| Spacing context stickiness | `SPACING_CONTEXT_SWITCH_DISTANCE = 5` | **dead constant** |

## Scope

### 1. Resize-time snapping (the headline gap)

Alt: no guides and no snap while resizing. This is the single most-used
alignment gesture in a layout tool and the fork implemented it as a complete
second resolver — `scaling/scale-snapping-resolver.ts` (1269), `scale-projection.ts`
(526), `rectangular-scale-gesture-projection.ts` (849, all eight controls
including rotated), `image-scale-snapping-controller.ts` (568),
`scaling-step-snap-guards.ts` (1281). Guides publish only after exact-bound
verification, with independent X/Y hold, fixed-point restoration and Ctrl/Shift
handling.

Not previously deferred for cost alone: the review doc records it as "large and
coupled to object types Vigilia does not have". Re-check that claim against the
current object set (text, shape, chart, group, image) before porting, and record
which couplings genuinely do not apply.

Decide and record: **port the projection/resolver modules**, or implement a
narrower Vigilia-native resize snap over the existing candidate/guide model. §32
permits the second when the first needs disproportionate custom integration, but
§175 requires the resulting behaviour to match the source in practice — a
narrower port that guides worse does not satisfy it.

### 2. Candidate-filter parity

The fork's `shouldIgnoreObject` (`utils/object-filter.ts:28-45`) excludes only
the active object and its selection children, `visible === false`, and
`IGNORED_IDS`. It has **no** `selectable` and **no** `locked` check: locking a
logo prevents *moving* it, not *aligning to* it.

Vigilia required `selectable === true` and `locked !== true`. Two consequences,
both of which this change closes:

- A locked object cannot be aligned against. This is a behaviour regression
  against the fork and contradicts the user's expectation that lock is a
  move-guard, not an invisibility flag.
- The starter theme's decorative objects use `selectable: false`
  (`new-fabric-theme.ts:15-18`, `backgroundOnly`). Whether these *should*
  contribute alignment lines is the real question: the artboard's own gradient
  plate almost certainly should not, while a decorative header rule probably
  should.

Resolve by intent, not by object class: extend `IGNORED_IDS` to the specific
non-alignable scene objects (the artboard plate is the clear case), then relax
the filter to the fork's rule.

The artboard plate's id is **`"background"`**, not `"scene"`. The call is
`rect("background", 0, 0, 1280, 720, twilightGradient, 0, backgroundOnly, "scene")`
(`new-fabric-theme.ts:320-330`): `"background"` is the `id` parameter, and
`"scene"` is the ninth argument, `paletteId`, which becomes
`vigiliaPaint: { fill: "palette.scene" }`. `new-fabric-theme.test.ts:64` asserts
the plate's `id` is `"background"`, and no object in the product carries
`id: "scene"` — an ignored-ids list of `["scene"]` therefore excludes nothing.
This mirrors the fork, whose own list is
`['montage-area', 'background', 'interaction-blocker']`.

### 3. Spacing context stickiness

`SPACING_CONTEXT_SWITCH_DISTANCE = 5` (`constants.ts:6`) and
`resolveCommonDisplayDistance` (`distance.ts:32`) are ported but unreferenced,
as is `calculateSpacingSnap` (`spacing.ts:1312`, zero call sites). In the fork
the former supplies hysteresis: while the pointer stays within 5 units of the
chosen gap, the snap does not jump to a different equal-spacing candidate. Its
absence is felt as flicker between competing spacing guides.

Determine whether the migrated resolver already provides equivalent stickiness
through its hold state. If it does, delete the dead port rather than reviving a
second mechanism; if it does not, wire the constant in.

### 4. ActiveSelection eligibility

`movement-snapping-controller.ts:180-197 _isSupportedActiveSelection` requires
≥2 children, none parented, each an image/textbox/shape-group, and unit
selection scale when text is present. Vigilia accepts any `selectable` object,
including any `ActiveSelection`. Adopt the guard unless the current object set
makes a clause meaningless; record which clauses were dropped and why.

### 5. Fallback path — decide, do not port blindly

The fork tried the migrated controller, then fell back to
`_resolveObjectMovementContext` → `_applyMovementObjectSnap` →
`_applyMovementVisualGuides` (`index.ts:1098-1146`), a second engine over
`line-snapping.ts`, `anchor-buckets.ts`, `pixel-grid.ts` and
`snap-target-resolver.ts`. Vigilia has no fallback.

Vigilia's broader candidate filter means fewer objects are declined, so the
fallback's main justification is weaker. Decide explicitly: **port**,
**replace** with a stated native outcome, or **drop** with the reason recorded.
Do not leave it unstated — that is how the P0 defects above survived.

## Non-goals

- Pixel rulers, configurable grids and additional snapping modes: no active
  requirement; evaluate separately.
- `snapAngle = 1` whole-degree rotation: equivalent on both sides and native
  Fabric; no angle guides in either.
- The size-indicator `mouse:move` refresh pass: text-pipeline specific.
- The 1,450-line fork orchestrator itself: rewritten for Vigilia, not ported.

## Key decisions to make in planning

1. Resize snapping: port the scaling subsystem, or build a narrower native one
   and accept a documented fidelity difference? — **Ported.** Tasks 4–8.
2. Candidate filter: which `IGNORED_IDS` entries, and is `selectable` retained
   for any object class? — **`selectable` dropped; `IGNORED_IDS = ["background"]`**,
   the plate's real id. Task 1.
3. Fallback path: port, replace or drop. — **Drop.** All four of the fork's
   fallback modules (`line-snapping`, `anchor-buckets`, `pixel-grid`,
   `snap-target-resolver`) are absent from Vigilia and nothing references them.
   In the fork the legacy path is reached from `_applyObjectMovementSnap` when
   the migrated controller declines, and Vigilia's broader candidate filter
   declines fewer objects, so the gap that justified the second engine is
   narrower here. The fallback was also the only consumer of the ported guard
   family — `pixel-grid.ts` imported `scaling-step-snap-guards`, not the other
   way round — so with the fallback absent, `scaling/scaling-step-snap-guards.ts`
   and `scaling/scaling-snap-guard.ts` were unreachable and are deleted.

## Verification

The gap shipped green because the only verification was one Playwright capture
whose sole assertion is `screenshot.byteLength > 1000`
(`tests/e2e/editor.spec.ts`, `captureVisualReview`). It cannot fail on wrong
snapping.

Any task here needs behaviour-level proof:

- A unit test that **fails when the fix is disabled**, per AGENTS.md, asserting
  the resolved position and the guide set — not object counts.
- A browser-visible capture registered in
  `docs/evidence/screenshots/README.md` showing guides during a real drag and a
  real resize.
- A multi-step drag, since a single-step drag cannot distinguish re-planning
  from a cached plan — the exact blind spot that hid the P0.

## Risks

- The scaling subsystem is the largest remaining fork dependency; porting it
  wholesale would put ~7,000 lines of vendored geometry into the editor. The
  §32 escape hatch exists for this, but only if the simpler outcome is genuinely
  good enough.
- Relaxing the candidate filter may make dense themes noisy. Pair the change
  with the `IGNORED_IDS` work in the same task, and inspect the starter theme.
