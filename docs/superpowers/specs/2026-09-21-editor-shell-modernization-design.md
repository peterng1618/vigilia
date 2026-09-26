# Editor Shell Modernization Design

- **Status:** implemented — a design doc, not a spec; its product shipped through the
  UI-polish and viewport plans, and no plan pairs with it.

## Goal

Replace the editor's vertical panel stack with a responsive authoring shell
while preserving the imperative Fabric editor and all existing Vigilia actions.

## Scope

- React mounts the editor shell; Fabric remains behind `mountForkShell`.
- Base UI supplies accessible primitive behavior. Local, shadcn-style components
  supply editor-specific presentation.
- The default shell palette is dark. A shell-only palette menu selects Graphite,
  Ember, Moss, Plum, or Light; it never changes authored theme globals.
- The layout has a narrow global rail, a layers or creation pane, a central
  canvas, a tabbed properties inspector, and an icon dock anchored to the
  canvas bottom.

## Layout

The global rail selects Layers, Assets, Theme, Global, and Settings. The
adjacent pane owns the selected area and scrolls independently. Layers retain
the existing semantic projection and fork-owned ordering, grouping, and locks.

The central area owns the Fabric host. Zoom and fit remain available through
keyboard actions and a compact canvas control, not a persistent top bar. The
selection dock sits at the bottom of the canvas and exposes duplicate, lock,
order, align, distribute, and delete as icon buttons with tooltips and keyboard
equivalents.

The inspector has Design, Data, and Style tabs. It renders only controls valid
for the active selection. Its fields call existing artboard, palette, type,
chart, binding, asset, layer, and arrange owners; it does not duplicate their
validation or persist state independently.

## Boundary

`fork-main.ts` owns startup and creates a shell bridge. The bridge exposes
intent-level callbacks and current selection state to React, then delegates to
existing `ForkExtensions`, `ShortcutManager`, and adopted-fork APIs.

`fork-shell.ts` remains the only owner of the Fabric mount, viewport fitting,
canvas disposal, artboard paint, and canvas lifecycle. React does not create,
serialize, or mirror Fabric objects.

The shell may observe selection and document changes through an explicit bridge
subscription. It must unsubscribe before fork destruction and must not add
window-level keyboard listeners outside `ShortcutManager`.

## Components

Use Base UI primitives only where browser interaction semantics are complex:

- `Tabs` for inspector sections and pane areas.
- `Tooltip` for icon-only controls.
- `Menu` for file and palette menus.
- `Select` for compact choices.
- `Popover` for contextual compact controls.
- `Dialog` for destructive or replacement confirmation.

Create local visual wrappers only for `IconButton`, `CanvasDock`,
`EditorPanel`, `InspectorField`, and `ShellPaletteMenu`. Do not add a general
component library or a second editor-state model.

## Accessibility And Failure Handling

- Every icon control has an accessible name and tooltip; focus remains visible.
- Tabs use Base UI keyboard behavior and announce the active panel.
- The dock is disabled or omitted when no applicable selection exists.
- Invalid numeric input remains rejected by the existing owner and returns the
  field to its last valid value.
- Shell mounting failures retain the existing editor error path; the shell must
  not leave a half-mounted Fabric canvas.

## Acceptance

- New, Open, Save, asset, chart, binding, artboard, palette, type, layer, and
  arrange flows retain their current owner and observable behavior.
- A selected object exposes the applicable bottom-canvas actions, each with
  tooltip, focus behavior, and keyboard equivalence where already registered.
- The shell palette changes only shell variables and survives a browser reload;
  it never changes a saved theme envelope.
- Canvas containment and artboard aspect ratio remain correct while panes open,
  close, or resize.
- Desktop and narrow layouts keep the canvas reachable; narrow layout collapses
  the inspector before obscuring the canvas.
- Browser coverage proves mounted shell actions and inspects selected visual
  captures. Existing full E2E instability remains a separate verification
  blocker until its preview-server failure is fixed.

## Out Of Scope

- A new graphics editor foundation, declarative Fabric rendering, document
  persistence changes, i18n, new authored dashboard globals, autosave, and
  unreviewed spec-0014 behaviors.
