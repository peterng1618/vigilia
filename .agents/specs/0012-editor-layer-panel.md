# 0012 — Editor layer panel and tree navigation

- **Status:** accepted
- **Design document sections:** §31, §61, §137
- **Specs superseded:** none

## Problem

A hidden canvas node is skipped by `hitTest` (§61, spec 0004). This is correct for pointer interaction because an invisible element must not intercept clicks or block selection of visible elements behind it. However, because the canvas was the only way to select a node, setting `visible: false` on an element and clicking away made it unreachable; only undo could recover it, provided the edit was still in history.

Furthermore, `ungroupNodes` in `arrange.ts` previously dropped a group's `visible: false` on its children when dissolving the group, which caused hidden children to unexpectedly become visible on screen.

## Behaviour

### Pure layer tree projection

Tree calculation is decoupled from the DOM. A pure function (`buildLayerTree`) in `layers-model.ts` maps the document node hierarchy into flat row descriptors:

- **Order:** Root and child siblings are listed top-to-bottom in reverse paint order (topmost element painted is first in the list), matching standard graphic design tool layer conventions.
- **Hierarchy:** Each row has a `depth` (0-indexed indentation) and `parentId`.
- **Visibility and lock states:** Rows obtain effective visibility and node-local lock state from `geometry.placeNodes`, the owner used by hit-testing and canvas interaction. A row separately indicates whether invisibility comes from the node or an ancestor.
- **Selection state:** Reflects whether the node is currently in the active selection.

### Non-visual selection and editing

- Clicking a row in the layer panel selects the node via `applyClick(selection, id, mode)` supporting `replace`, `toggle` (Ctrl/Cmd), and `add` (Shift).
- Selecting a hidden node exposes its properties in the inspector, allowing the author to toggle visibility back to true or edit values.
- Double-clicking a group row enters the group (`enterGroup`).

### Visibility and lock toggles

Each row provides discrete toggle buttons:
- **Visibility toggle:** Commits `setNodeFlags(doc, id, { visible: !currentVisible })`.
- **Lock toggle:** Commits `setNodeFlags(doc, id, { locked: !currentLocked })`.

### Reordering

Layer reordering operates via the `ACTIONS` registry and `reorderNode` pure commands:
- `layer.reorder-forward` ('Bring forward')
- `layer.reorder-backward` ('Send backward')
- `layer.reorder-front` ('Bring to front')
- `layer.reorder-back` ('Send to back')
Reordering modifies the node's position among its siblings in the document tree. Drag-and-drop tree reordering is out of scope.

### Preserving hidden state when ungrouping

When `ungroupNodes` ungroups a group with `visible === false`, every promoted child receives `visible: false`, including a child that explicitly held `visible: true`: a child's true value cannot override a hidden ancestor before ungrouping, so preserving appearance requires it to stay hidden afterwards. Ungrouping a hidden group never reveals its subtree.

### Layout

Per product design:
- **Left Panel:** Theme (globals) panel is moved to a dedicated, always-visible left sidebar panel.
- **Right Panel (300px):** Eliminates previous `Element`/`Theme` tabs. Contains:
  - **Inspector:** Top section, scrollable.
  - **Layer Panel:** Bottom section, scrollable, displaying the hierarchy of all artboard nodes.

## Acceptance criteria

- An element hidden via canvas or inspector remains listed and clickable in the layer panel.
- Clicking a hidden element in the layer panel updates the selection and status line to show that element.
- The inspector displays the properties of a hidden element selected via the layer panel and can restore its visibility.
- Toggling the visibility eye icon on a row toggles `node.visible` in the document with an undo history entry.
- Toggling the lock icon on a row toggles `node.locked` in the document with an undo history entry.
- Ungrouping a hidden group leaves its children hidden.
- Unit tests verify `buildLayerTree`, action enablement, and ungroup visibility preservation.
- Playwright E2E tests verify selecting a hidden element from the layer panel and toggling its visibility.
