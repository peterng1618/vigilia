# Editor UI Polish — a layer tree and a dense inspector

## Why

`2026-09-24-author-journey.md` took the bar to "an author can fully make and edit
a theme". Passing tests is not that bar. Authoring is a *visual* activity, and
the editor's control surfaces are not yet good enough to use: the layer panel is
a flat list of full-text buttons, and the inspector spends one full-width row on
every value.

Observed, driving the running editor (`vite preview`, starter theme):

| Observed | Evidence |
|---|---|
| Every layer row carries six full-text buttons | `Hide Lock Front Forward Backward Back`, appended per row — `layer-panel.ts:132-163` |
| Eight more flat full-text buttons below the list | `layer-panel.ts:183-212` |
| No tree, though the list is called Layers | `entriesFor` flattens group children with no depth — `layer-panel.ts:96-116` |
| Eleven settings each on their own full-width row | `artboard-panel.ts:119-147` appends labels and controls as flat siblings |
| Density is forced by CSS, not by the panels | `label{display:block}` and `input,select{display:block;width:100%}` — `editor-shell.css:311-339` |
| Zero motion | 0 `transition` rules in all 435 lines of `editor-shell.css` |
| No focus ring on controls | `focus-visible` exists on 2 rules, both menu items — `editor-shell.css:223,225` |
| Numeric fields jitter | no `tabular-nums` anywhere in the editor |

## What already exists

Checked against the actual code, because the fix must reuse owners rather than
add them:

- **`editorMetadata`** is validated and serialized (`fabric-envelope-validate.ts:63`,
  `serialize.ts:15`) but has **no reader or writer in the editor**. It is the
  declared home for editor-only data and is currently dead payload.
- **`canvas.moveObjectTo(object, index)`** exists
  (`node_modules/fabric/dist/src/canvas/StaticCanvas.d.ts:56`); `layer-manager`
  exposes only the four relative operations.
- **React shell + bridge + `SelectionStore`** already render live canvas state
  without holding Fabric objects (`shell-layout.tsx:78-118`, `bridge.ts:50-138`).
- **Base UI** (`@base-ui/react:^1.8.0`) already ships `Popover`, `ContextMenu`
  and `Collapsible`, so the swatch popover, the row context menu and group
  disclosure need no hand-rolled interaction. Only `Tooltip` is used today
  (`canvas-dock.tsx:66`); the rest are unused.
- Two control-token systems coexist: `--shell-*` (shell CSS) and `--vigilia-*`
  (inline, `button.ts:42-61`).

So the gap is **control-surface architecture and layout**, not the document model.

## Design

### One owner for presentation, Fabric stays the model

The layer tree and inspector field surfaces become React, matching the shell.
The guardrail that "Fabric is never mirrored in React" holds by projecting
**serializable values**, exactly as `snapshot()` already does — never by handing
React a `FabricObject`.

```ts
interface LayerRow {
  readonly id: string;
  readonly name: string;        // display name, else id
  readonly kind: LayerKind;     // text | shape | chart | group | image
  readonly depth: number;
  readonly parentId: string | undefined;
  readonly hasChildren: boolean;
  readonly visible: boolean;    // effective down the ancestor path
  readonly locked: boolean;     // effective down the ancestor path
  readonly selected: boolean;
}
```

`editor-shell/layer-tree.ts` owns the projection: pure, Fabric-in → rows-out,
unit-testable with no DOM and no React. Effective visible/locked, reverse paint
order, depth and ancestor paths move there from `layer-panel.ts`.

### State has three homes, one each

| State | Owner | Why not elsewhere |
|---|---|---|
| Collapsed groups | Shell, transient | Viewport state is transient (§67) |
| Display names | `envelope.editorMetadata.layerNames` | Already validated and serialized; `#snapshot` spreads `#envelope` (`editor-session.ts:675`), so save round-trips with no new field |
| Stack order | Fabric canvas, via `layerManager.moveTo` | Fabric is the sole geometry and order owner |

### The bridge grows, it does not fork

`EditorShellBridge` gains a `layers(): readonly LayerRow[]` projection and layer
commands, following the existing `can`/`run` shape (`bridge.ts:31-38`):
`selectLayer`, `setLayerVisible`, `setLayerLocked`, `reorderLayer`,
`renameLayer`, `setCollapsed`.

### Layer tree

Indented rows with a twisty per group, a type icon, the display name, and the raw
id on hover. **Only the selected row shows its actions**; the other five rows stay
one dense line. The eight order/visibility verbs move to the context menu, the
keyboard, and the canvas dock, which already owns them for the selection
(`canvas-dock.tsx:21-37`).

Arrange stays a section of eight **icon** buttons.

Drag to reorder is a pointer gesture writing `reorderLayer`. **v1 reorders within
one parent only** and refuses cross-group drops: that changes group membership,
which is a different operation from ordering.

### Density

The three CSS rules at `editor-shell.css:311-339` are the cause; the panels merely
comply. Replace them with an opt-in field primitive, so a panel opts into density
instead of being forced into it:

```css
.vigilia-field     { display: grid; grid-template-columns: 72px 1fr; align-items: center; }
.vigilia-field-row { display: flex; gap: 6px; }
.vigilia-numeric   { font-variant-numeric: tabular-nums; }
```

Field surfaces become React components under `editor-shell/controls/`:

- `NumberField` — label left, control right, tabular figures.
- `LinkedPair` — X/Y and W/H in one row with a chain toggle.
- `ColorSwatch` — inline swatch opening a Base UI `Popover` of palette tokens.
- `Slider` — opacity, paired with a numeric readout.

Group disclosure uses Base UI `Collapsible` and the row context menu uses Base UI
`ContextMenu`, so neither interaction is hand-rolled.

`artboard-panel.ts:119-147` must regroup its eleven flat siblings into field
wrappers; that is the one consequence outside CSS.

### Shell pass

Rail glyphs (`▤ ▣ ⚙`), the canvas dock and the tabs move to Lucide icons with
accessible names. Section rhythm, hover and press states, and empty states are
made consistent, and the `--vigilia-*` inline vocabulary is reconciled with
`--shell-*`.

### Motion, with the guard the shell already practices

Transitions on interactive elements (150–200 ms `transform`/`opacity`/colour
only, never `top`/`left`/`width`/`height`), plus visible focus rings on every
interactive control. All motion sits behind `prefers-reduced-motion: reduce`, the
same way the shell already guards `prefers-reduced-transparency`
(`editor-shell.css:123`).

## Dependencies

`lucide-react` 1.48.0, **ISC**. Shipped dependency: add to
`THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` in the commit
that introduces it.

## Rejected audit findings

Findings from the redesign audit that do **not** apply here, recorded so they are
not re-raised:

| Finding | Rejected because |
|---|---|
| Arbitrary z-index like `9999` | False here: the scale is 1/3/50/60 |
| Inline styles mixed with CSS | `cssText` is one file (`button.ts`), deliberately the shared control vocabulary |
| "Double the spacing, let the design breathe" | Marketing-page advice; the instruction is *more* density |
| Parallax, scroll reveals, split-screen, spring physics | Authoring tools should feel fast and quiet; cinematic motion would be a regression |
| Placeholder imagery, cookie consent, 404 page, legal footer | Not applicable to an editor application |

## Acceptance

- A group's children are visibly indented and collapsible, and selection still
  resolves a child through its owning group.
- The layer panel shows no per-row action buttons except on the selected row.
- Dragging a row restacks it and the new order survives save/reopen; a
  cross-group drop is refused without changing order.
- Renaming a layer survives save/reopen through `editorMetadata`.
- The inspector shows geometry as paired rows and the document panels no longer
  place one full-width control per row.
- Every interactive control has a visible focus ring.
- The full gate passes: `format:check`, `lint`, `typecheck`, `test`, `build`,
  `size`, and the local browser suite.
- Visible behaviour is confirmed by rendered inspection, not object counts.
