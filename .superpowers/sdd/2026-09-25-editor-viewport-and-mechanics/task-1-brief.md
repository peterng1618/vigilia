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

