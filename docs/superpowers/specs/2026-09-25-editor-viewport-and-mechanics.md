# Editor Viewport & Mechanics — navigating the canvas

- **Status:** implemented — plan archived on its full Task 11 gate.
- **Requirement:** §174

## Why

An authoring tool is a camera plus a document. Vigilia's editor has the document
and no camera: the canvas is a fixed, exactly-artboard-sized element with a single
`setViewportTransform` call (`editor-shell.ts:132`) and no zoom or pan input at
all. Precise placement, and seeing anything at other than fit-to-window, is
impossible.

Auditing the canvas against Figma turned up more than the missing camera. The
interaction layer was never restored after the native-Fabric migration.

| Observed | Evidence |
|---|---|
| No zoom, no pan | no wheel or pointer handlers; one `setViewportTransform` |
| No way to enter a group | `grouping-manager` exposes only `group()` and an `ungroup()` that destroys the group; nothing calls `enterGroup`/`exitGroup` |
| Marquee effectively unreachable | Fabric's marquee is on by default (`SelectableCanvas.d.ts:126`), but the canvas is sized to the artboard and a full-bleed `background` rect covers it. Verified live: a corner drag selected and **moved** `header-wash` rather than marqueing |
| No keyboard nudge, z-order or select-all | `PRODUCT_SHORTCUTS` is 12 file/edit bindings — `shortcut-manager/index.ts:22-35` |
| No canvas context menu | none; Base UI ships an unused `ContextMenu` |

The archived `2026-09-21-editor-fork-parity.md` restored fork Tasks 1–15
(error, crop, deletion, controls, clipboard, grouping, toolbar, snapping,
indicators) and stopped. The fork's `zoom-manager`, `pan-constraint-manager` and
`listeners` were never ported.

## What already exists

- **Fork reference source** at `D:\git-repos\fabricjs-image-editor`, pinned
  `9efdd78a`. Read-only, per that plan's rule: never `checkout`/`switch`/`restore`
  there. `src/editor/zoom-manager/index.ts` (561 lines) and
  `src/editor/pan-constraint-manager/index.ts` hold the proven algorithms for
  `zoomToPoint`, clamped pan bounds, fit-zoom and space+drag panning.
- **Fabric already provides** `zoomToPoint`, `setViewportTransform`,
  `getZoom`, `moveObjectTo` and the marquee. This is wiring, not invention.
- **`snap-manager` and `guide-renderer` already read zoom** (`snap-manager/index.ts:155`,
  `snap-manager/guide-renderer.ts:30`) and divide guide width by it, so they are
  zoom-aware already and need no change.
- **Base UI** ships `ContextMenu` unused.

Port the fork's *algorithms*, not its API: ADR-0005 rules out recreating a fork
abstraction layer. Russian comments become English or none.

## Design

### The canvas becomes a camera

The foundational change, and the reason marquee is unreachable today: the canvas
element stops being sized to the artboard and becomes a **viewport onto an
infinite workspace**, with the artboard as a bounded region inside it.

`fitCanvasViewport` (`editor-shell.ts:120-140`) is replaced by a viewport module
that owns the camera: zoom level, pan offset, and the transform mapping workspace
coordinates to screen. The stage element fills its host; the artboard is drawn as
a region with the pasteboard around it. Objects outside the artboard stay visible
while authoring, as in every comparable tool.

This one change is what makes zoom, pan, marquee and precision placement
possible at all — and it must land before the rest.

### Navigation, following Figma

| Input | Behaviour |
|---|---|
| Scroll | Pan vertically; shift+scroll pans horizontally |
| ⌘/ctrl + scroll, pinch | Zoom about the pointer (`zoomToPoint`) |
| Space + drag | Pan |
| Middle-drag | Pan |
| Zoom keys | Zoom in/out about the viewport centre |
| Zoom to fit / to selection | Bound to a shortcut and a control |

Zoom is clamped to sane limits, and pan is **constrained** so the artboard cannot
be lost off-screen — the clamped-bounds algorithm the fork's
`pan-constraint-manager` already proves.

A zoom readout replaces or joins the existing view controls, showing the current
percentage with fit-to-view and 100 % resets.

### Group entry

Double-click enters a group and selects the child under the pointer; Escape steps
back out; the layer tree reflects the current context. `grouping-manager` grows
`enterGroup`/`exitGroup` beside the existing `group`/`ungroup`, so group
membership keeps its single owner.

Without this, a child inside a group is **unreachable from the canvas** — which
also removes the reason the layer tree currently has to resolve selection through
the owning group.

### Keyboard

Nudge with the arrow keys (shift for a larger step), z-order and select-all
alongside the existing twelve bindings, and Escape to clear context. Bindings are
added to `PRODUCT_SHORTCUTS` so there stays one dispatcher; unmodified keys keep
deferring to a focused text field (`TEXT_ENTRY_DEFERRED_ACTIONS`).

### Canvas context menu

A right-click menu built on Base UI `ContextMenu`, offering the same object
actions as the dock and the layer panel, from the shared action registry defined
in the UI-polish spec. It adds a surface; it does not add an owner.

## Acceptance

- The artboard can be zoomed about the pointer and panned by space+drag and by
  scroll, and the artboard cannot be panned entirely out of view.
- Zoom to fit and to selection both land correctly, and the readout matches.
- A marquee drag started on the pasteboard selects the enclosed objects and does
  not move any of them.
- Double-clicking a group selects the child under the pointer, Escape returns to
  the group, and group/ungroup still round-trip through save/reopen.
- Arrow-key nudge moves the selection by the expected amount and records exactly
  one history entry per gesture.
- Right-clicking a selection opens a menu whose entries match the dock's
  eligibility for the same selection.
- Snapping guides and indicators stay correct at non-1 zoom.
- Full gate: `format:check`, `lint`, `typecheck`, `test`, `build`, `size`, and the
  local browser suite; visible behaviour confirmed by rendered inspection.

## Rejected

| Considered | Rejected because |
|---|---|
| Porting `zoom-manager` wholesale | Coupled to fork classes (`ImageEditor`, `montageArea`) and Russian comments; ADR-0005 forbids recreating a fork API. Adapt the algorithms, own the module |
| Recreating an intermediate fork abstraction | ADR-0005 |
| Unconstrained pan | An author can lose the artboard with no way back |
