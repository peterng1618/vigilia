# Snapping Fidelity Implementation Plan

> **Queued plan. Do not execute until `STATUS.md` promotes it to active.**
> When active, use Superpowers' subagent-driven execution or executing-plans
> workflow and parallelize only independent tasks inside the current phase.

**Goal:** Bring movement and resize snapping to the retired fork's practical
quality while keeping Vigilia's current ownership model and a testable,
maintainable integration.

**Spec:** `docs/superpowers/specs/2026-09-25-snapping-fidelity.md`

**Reference:** fork `9efdd78a` in
`D:\git-repos\fabricjs-image-editor`, branch `codex/fabric-es`. Treat it as
read-only reference. Port behavior and algorithms, not the fork's API surface.

## Constraints

- The existing movement geometry core remains the movement owner.
- Resize/scale snapping belongs under `snap-manager/scaling/` and reuses the
  existing bounds, candidate and guide concepts rather than cloning them.
- Strip fork-specific `ImageEditor` / crop-frame coupling.
- Hidden/decorative objects must not become snap targets accidentally; locking
  affects editing, not whether a visible object can be an alignment reference.
- Guides, hold state and gesture context are runtime/derived state, never
  persisted or authored history.
- Ctrl remains the temporary snap bypass for both movement and resize.
- Acquire/release behavior must avoid both flicker and a snap that never lets go.
- A guide is evidence of an applied snap, not a speculative candidate.
- Keep `renderer-core` Fabric/DOM-free. No new dependency is expected.
- Preserve byte-comparable vendored geometry where practical; document the
  specific reason wherever integration requires a divergence.

## Phase 1 — Movement parity and evidence

- [ ] **Candidate parity.** Make locked visible content alignable while keeping
  hidden objects, the active selection and decorative/artboard objects out of
  the candidate set. Pin the behavior with focused tests.
- [ ] **Selection eligibility.** Restore the fork's meaningful ActiveSelection
  guards that still apply to Vigilia, especially parented children and scaled
  text. Verify normal multi-object movement still snaps.
- [ ] **Spacing hold proof.** Measure equal-spacing acquire/hold/release behavior
  before deleting or reviving old ports. Remove dead exports only when the live
  resolver demonstrably owns that behavior; report a missing/non-releasing hold
  instead of weakening the test.

**Failure modes to reject:** locked objects cannot be alignment references;
invisible/artboard decoration attracts guides; a composite selection silently
enters an unsupported gesture; spacing either has no useful hold or never
releases.

## Phase 2 — Resize/scale snapping

- [ ] **Projection and candidates.** Port the scale candidate/projection
  behavior for all resize controls, including rotated objects, using Vigilia's
  existing bounds/candidate ownership.
- [ ] **Resolver and hold state.** Port acquire, release, spacing-release and
  exact-verification behavior so a resize snaps predictably and can disengage.
  Keep thresholds centralized and test the relationship between acquire and
  release rather than duplicating magic values.
- [ ] **Gesture integration.** Wire scale snapping into the snap-manager
  lifecycle, including cleanup and Ctrl bypass, without creating a second
  editor/canvas facade.
- [ ] **Guide truthfulness.** Publish resize guides only after the corresponding
  snap is actually applied and exact-bound verification succeeds.

**Failure modes to reject:** wrong handle/edge on rotation; scale drift after
snap; resize remains welded after the pointer leaves; Ctrl bypass differs from
movement; guides appear for unapplied snaps.

## Phase 3 — Behavior matrix and closeout

- [ ] **Browser matrix.** Replace byte-length-only screenshot confidence with
  behavior checks that cover move and resize snapping across representative
  zoom, rotation, lock/visibility, multi-selection and Ctrl-bypass cases.
- [ ] **Rendered and full verification.** Inspect guides while exercising the
  matrix, then run format, lint, typecheck, unit, build, size and the full
  browser suite.
- [ ] **Handoff.** Update the spec/ownership map only where current truth
  changed, replace `STATUS.md`'s last-change summary, record unresolved
  findings, and archive the plan when complete.

## Acceptance

Movement and resize snapping share one candidate/bounds model, behave
consistently across zoom and rotation, release cleanly, honor Ctrl bypass, and
never show a guide for a snap that was not applied.
