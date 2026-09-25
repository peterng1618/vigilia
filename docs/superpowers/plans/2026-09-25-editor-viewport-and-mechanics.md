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

#### Task 1: The canvas context menu surface

**Outcome.** Right-clicking the canvas opens a menu whose object entries are
exactly those the dock would enable for the object under the pointer, dispatching
through the same owners; right-clicking empty canvas offers the creation actions.

**Owning symbols/landmarks.** New `editor-shell/canvas-context-menu.tsx`. The
`contextmenu` listener binds to `canvas.upperCanvasEl` — the element Fabric
itself binds; `editor-shell.ts` creates the `Canvas`. Entries come from
`OBJECT_ACTIONS`, `actionEnabled` and `ObjectTarget` in `object-actions.ts`.
Dispatch and gating go through `EditorShellBridge.target()`, `.can()`, `.run()`
and `.session` in `bridge.ts`. Creation copy is `uiCopy.panels.text` and
`uiCopy.chartFamilies` in `ui-copy.ts`, dispatched through
`EditorActionFacade.addText()` / `.addChart(family)` in `session-facade.ts`.

**Mechanism (measured 2026-09-25 — do not re-derive):**

- **No `ContextMenu.Trigger`.** Fabric binds its own `contextmenu` listener on
  `upperCanvasEl` and calls `preventDefault` + `stopPropagation`. A Trigger
  wrapping the canvas is a parent listener, so Fabric's `stopPropagation` stops
  the menu opening: measured, zero `menuitem`s. A listener registered **on
  `upperCanvasEl` itself** is a same-element listener and is *not* blocked by
  the earlier one's `stopPropagation` — measured, both fire in order.
- Open the menu from that listener with a **controlled** `ContextMenu.Root`
  (`open` / `onOpenChange`) plus `Portal` and a `Positioner` given a **virtual
  anchor** (`{ getBoundingClientRect: () => point }`) at the pointer. Measured:
  the popup renders at the anchor. `ContextMenu.Positioner` requires a `Portal`
  ancestor — rendering it without one throws.
- The menu kind follows the object **under the pointer**, not the current
  selection: Fabric's `__onMouseDown` returns early for `button !== 0`, so a
  right-click never clears or changes the selection. Use the canvas's own
  `findTarget(event)`; on a hit, select the object before opening so
  `actionEnabled` reads the right target.
- In jsdom, the portal lands in `document.body`, not the render host, and
  wrapping an **anchored** positioner's render in `act()` times out (floating-ui
  measurement never settles). Query `document.body` and flush without `act`.

**Constraints.**
- No `ContextMenu.Trigger`; controlled root + `Portal` + virtual-anchor
  `Positioner`, opened from an `upperCanvasEl` listener — see the mechanism block
  above, which is measured, not suggested.
- The menu kind follows `findTarget(event)`, and a hit is selected before the
  menu opens, because right-click does not change the selection.
- Entries are `OBJECT_ACTIONS.filter((action) => actionEnabled(gate, action.id))`.
  Do not re-derive eligibility and do not consult `arrangeActions()`.
- Suppress the native menu **only** on the canvas: `preventDefault` in the
  canvas listener, never a document-wide handler.
- Creation entries route through `bridge.session` and never enter
  `OBJECT_ACTIONS`.
- Copy stays in `ui-copy.ts`; the menu is keyboard-reachable and labelled.
- New source files stay under the 500-line signal.

**Acceptance.**
- A DOM test proves the rendered entry set equals the registry's eligible set for
  a fixed target, derived from `action.eligible(target)` — **not** from
  `actionEnabled`, which is the function the menu itself calls.
- A DOM test proves clicking an entry dispatches that action's id through
  `bridge.run`, and that empty canvas renders creation entries and no object
  entries.
- A browser test right-clicks a selected starter chart and asserts one known
  entry is visible; a registered capture is inspected by eye.

**Failure modes to reject.** Menu and dock disagree for the same selection;
arrange actions leak into the menu; empty-canvas actions enter the object
registry; native context-menu suppression becomes document-wide; the capture can
pass without an opened menu; an assertion that would still pass if the menu
rendered nothing (assert the expected set's length); a capture taken before the
visible-entry assertion.

#### Task 2: Close the plan

**Outcome.** The plan's gates run and the handoff is written.

**Acceptance.** Focused tests for the affected paths, then `format:check`,
`lint`, `typecheck`, `test`, `build`, `size`; the local browser suite with true
counts reported; rendered inspection of the visible acceptance set (centred
artboard/pasteboard, zoom/readout, marquee, group context, non-1x
guides/indicators, the context menu); `STATUS.md`'s last-change summary replaced;
anything unverified recorded rather than inferred.

**Known-red premise.** Five `display-fabric.spec.ts` cases are slow
(30.2–47.7s against a 30s cap) and pass at a raised timeout — measured in two
ledgers this session. Report true counts, change no timeout, and do not label a
red test pre-existing without base-commit evidence.

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
