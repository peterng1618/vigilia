# Editor Viewport & Mechanics Implementation Plan

> **Active plan.** Execute only this plan until it closes. Use Superpowers'
> subagent-driven execution or executing-plans workflow; parallelize only
> independent tasks inside the current phase.

**Goal:** Give the editor a zoomable/pannable camera and restore the interaction
layer lost in the native-Fabric migration without creating parallel owners.

**Spec:** `docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md`

**State:** Camera/viewport, navigation gestures, zoom readout, marquee, keyboard
nudge/z-order, group entry, group-aware layer tree, and non-1x snapping/indicator
work are landed. The UI-polish prerequisite is also landed. Remaining work is
the canvas context menu and plan-level verification.

## Constraints

- Camera state is runtime state, never persisted scene geometry or authored
  history (§57, §67).
- Fabric stays imperative behind the editor boundary; React does not mirror
  Fabric objects.
- Keep one owner per concept: viewport manager for camera state,
  grouping-manager for group membership, shortcut manager for keys, and the
  shared object-action registry for object commands.
- The context menu must reuse `OBJECT_ACTIONS` / `actionEnabled`; do not
  recreate eligibility or add arrange actions there.
- Empty-canvas creation goes through the existing session facade.
- Visible copy stays in `ui-copy.ts`; controls remain accessible.
- No new dependency is expected.
- Regression tests need a meaningful counterfactual. Visible behavior also
  needs rendered/browser inspection.

## Phase 1 — Canvas context menu

- [ ] **Selected-object contract.** Add the canvas context-menu surface and wire
  it to the existing object-action registry. For a selected object, the menu
  must expose exactly the actions eligible for that target and dispatch through
  the existing owners. Suppress the browser menu on the canvas only.
- [ ] **Empty-canvas path.** Right-clicking empty canvas offers the existing
  creation actions through the session facade. Keep object actions and creation
  actions as separate contracts.
- [ ] **Proof.** Add focused DOM coverage for registry-derived entries and
  dispatch, plus a browser check that right-clicking a selected starter object
  opens the menu and exposes a known action. Register and inspect one rendered
  capture for this surface.

**Failure modes to reject:** menu and dock disagree for the same selection;
arrange actions leak into the menu; empty-canvas actions enter the object
registry; native context-menu suppression becomes document-wide; the capture
can pass without an opened menu.

## Phase 2 — Close the plan

- [ ] **Focused and broad gates.** Run the tests affected by Phase 1, then
  format, lint, typecheck, unit tests, build and player-size checks.
- [ ] **System proof.** Run the full browser suite and inspect the visible
  acceptance set: centred artboard/pasteboard, zoom/readout, marquee, group
  context, non-1x guides/indicators, and the context menu. Do not label a red
  test pre-existing without base-commit evidence.
- [ ] **Handoff.** Update current specs/ownership only if implementation changed
  those truths, replace `STATUS.md`'s last-change summary, record anything
  genuinely unverified, then archive this plan when no queued work depends on
  it.

## Acceptance

The editor has a recoverable camera, reachable selection mechanics and one
consistent command model across dock and context menu. No camera/runtime state
enters persistence, no duplicate action owner is introduced, and the player
remains independent of editor UI/camera code.
