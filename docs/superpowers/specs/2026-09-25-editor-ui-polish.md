# Editor UI Polish — a Figma-grade control surface

## Why

`2026-09-24-author-journey.md` took the bar to "an author can fully make and edit
a theme". Passing tests is not that bar. Authoring is a *visual* activity, and it
is done in a tool that should itself feel considered. Today the layer panel is a
flat list of full-text buttons and the inspector spends one full-width row on
every value.

Observed, driving the running editor (`vite preview`, starter theme):

| Observed | Evidence |
|---|---|
| Every layer row carries six full-text buttons | `Hide Lock Front Forward Backward Back` per row — `layer-panel.ts:132-163` |
| Eight more flat full-text buttons below the list | `layer-panel.ts:183-212` |
| No tree, though the list is called Layers | `entriesFor` flattens group children with no depth — `layer-panel.ts:96-116` |
| Eleven settings each on their own full-width row | `artboard-panel.ts:119-147` appends labels and controls as flat siblings |
| Density is forced by CSS, not by the panels | `label{display:block}`, `input,select{display:block;width:100%}` — `editor-shell.css:311-339` |
| Zero motion | 0 `transition` rules in 435 lines of `editor-shell.css` |
| No focus ring on controls | `focus-visible` on 2 rules, both menu items — `editor-shell.css:223,225` |
| Numeric fields jitter | no `tabular-nums` anywhere in the editor |
| Dock is 32px emoji glyphs | `⧉ 🔒 ↑↑ ▣ ▦ ⫷ ↔ ×` — `canvas-dock.tsx:21-37` |

## Design baseline

**Figma UI3, when in doubt.** Panels, row rhythm, selection treatment, toolbar
placement, icon sizing and spacing follow it. This is a deliberate reference, not
a mandate to copy: Vigilia is a display-theme authoring surface with its own
domain (palette tokens, type presets, value runs) that Figma has no equivalent
for, and those keep their own shape.

## The action registry: one owner, two surfaces

Object actions are currently defined inline by whichever surface renders them,
which is why the layer panel and the canvas dock both spell out
front/forward/backward/back.

A single registry owns what an action **is**:

```ts
interface ObjectAction {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly eligible: (target: ObjectTarget) => boolean;
  readonly run: (target: ObjectTarget) => void;
}
```

Two surfaces **render from** it, each with its own layout and styling and neither
owning behaviour:

- the floating **canvas dock** beside the selection, and
- the layer panel's **bottom action row**.

Because eligibility and behaviour live once, the two cannot drift — one owner per
concept, with two views. A right-click **canvas context menu** (spec A) is a
third consumer of the same registry.

## Layer panel

A tree, not a list:

- Rows indent by group depth and collapse via a disclosure twisty.
- Each row is one dense line: type icon, display name, and the raw id on hover.
- **Each row always shows lock and visibility icons** that reflect that layer's
  effective state and toggle it on click. These are state indicators that happen
  to be clickable, not part of the action row — so they stay on every row where
  the old six buttons were noise.
- **Object actions live in the bottom action row**, bound to the current
  selection, not attached to the selected row. Order, group/ungroup, duplicate
  and delete render from the registry there, matching Figma's bottom toolbar.
- **Arrange (align/distribute) moves out** of the layer panel to the top toolbar,
  where it applies to a multi-selection.

Drag to reorder writes through the registry's reorder path. **v1 reorders within
one parent only** and refuses a cross-group drop: that changes group membership,
a different operation.

Inline rename on double-click.

### State has three homes, one each

| State | Owner | Why not elsewhere |
|---|---|---|
| Collapsed groups | Shell, transient | Viewport state is transient (§67) |
| Display names | `envelope.editorMetadata.layerNames` | Already validated and serialized (`fabric-envelope-validate.ts:63`, `serialize.ts:15`) but **currently dead payload** — no reader or writer. `#snapshot` spreads `#envelope` (`editor-session.ts:675`), so save round-trips with no new field |
| Stack order | Fabric canvas, via `layer-manager.moveTo` | Fabric is the sole order owner; `canvas.moveObjectTo` exists (`StaticCanvas.d.ts:56`) |

### Projection, not mirroring

Fabric is never mirrored in React. The panel renders **serializable values**,
exactly as `snapshot()` already does:

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

The bridge grows a `layers()` projection and commands following the existing
`can`/`run` shape (`bridge.ts:31-38`): `selectLayer`, `setLayerVisible`,
`setLayerLocked`, `reorderLayer`, `renameLayer`, `setCollapsed`.

## Density

The three CSS rules at `editor-shell.css:311-339` are the cause; the panels merely
comply. Replace them with an opt-in field primitive, so a panel opts into density
rather than being forced into it:

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

Group disclosure uses Base UI `Collapsible`; the row context menu uses Base UI
`ContextMenu`. Neither interaction is hand-rolled.

`artboard-panel.ts:119-147` must regroup its eleven flat siblings into field
wrappers; that is the one consequence outside CSS.

## Motion

Restrained, and never decorative. The editor is used for hours at a time; motion
that delights on first use becomes friction on the hundredth.

- Interactive elements transition **120–180 ms** on colour, transform and opacity
  only — never `top`/`left`/`width`/`height`.
- Presses give a 1px translate, so controls feel physical.
- Panels reveal with a short slide/fade on mount.
- Visible focus rings on every interactive control, which is an accessibility
  requirement rather than polish.
- All motion sits behind `prefers-reduced-motion: reduce`, mirroring the shell's
  existing `prefers-reduced-transparency` guard (`editor-shell.css:123`).

Deliberately **not** included: staggered list entry, scroll-driven or parallax
effects, spring physics, and animated zoom. They were considered and left out.

## Dependencies

`lucide-react` 1.48.0, **ISC**. A shipped dependency: add to
`THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md` in the commit
that introduces it.

## Rejected audit findings

Recorded so they are not re-raised:

| Finding | Rejected because |
|---|---|
| Arbitrary z-index like `9999` | False here: the scale is 1/3/50/60 |
| Inline styles mixed with CSS | `cssText` is one file (`button.ts`), deliberately the shared control vocabulary |
| "Double the spacing, let the design breathe" | Marketing-page advice; the instruction is *more* density |
| Staggered entry, parallax, scroll reveals, spring physics, parallax card stacks | Considered and declined — see Motion |
| Placeholder imagery, cookie consent, 404 page, legal footer | Not applicable to an editor application |

## Acceptance

- A group's children are indented and collapsible, and selection still resolves a
  child through its owning group.
- Lock and visibility icons appear on every row and reflect effective state.
- Object actions appear in the layer panel's bottom row, not per row, and render
  from the same registry the canvas dock uses.
- Changing registry eligibility changes both surfaces identically.
- Dragging a row restacks it and the new order survives save/reopen; a
  cross-group drop is refused without changing order.
- Renaming a layer survives save/reopen through `editorMetadata`.
- The inspector shows geometry as paired rows, and document panels no longer
  place one full-width control per row.
- Every interactive control has a visible focus ring, and no motion runs under
  `prefers-reduced-motion: reduce`.
- Full gate: `format:check`, `lint`, `typecheck`, `test`, `build`, `size`, and the
  local browser suite; visible behaviour confirmed by rendered inspection.
