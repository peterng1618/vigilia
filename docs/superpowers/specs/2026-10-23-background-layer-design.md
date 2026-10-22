# The background layer — design

- **Date:** 2026-10-23
- **Status:** draft
- **Related:** [`2026-10-22-theme-versioning-design.md`](2026-10-22-theme-versioning-design.md),
  [`docs/architecture/ownership.md`](../../architecture/ownership.md),
  `schema/theme-document.schema.json`.

## Purpose

The background media stops being a field in the Document pane and becomes a
layer: the bottom-most row of the composition tree, selected like any other
layer, whose properties are the background colour, the media, the fit, and the
media's size and position.

The size and position exist for one authoring case: a video whose subject sits
in the centre of the frame, moved and scaled so the subject occupies one side of
the artboard and the other side is free for elements. The layer's bounds —
the artboard or the display — are the clip.

Transform handles are out of scope. The inspector is the only way to change the
media's geometry, and a canvas drag must never select the background.

## Current state

- `renderer-core/src/theme/document.ts` defines `Artboard { width, height,
  background?, contentFit?, backgroundMedia? }`; `BackgroundMedia` is
  `{ assetId, fit: "theme" | "display" }`.
- `scene-fabric/src/background-media.ts` mounts the media as a DOM `<div>` below
  the caller's canvas, with `object-fit: cover`, centred. It reports
  `BackdropMedia` so a glass panel can sample it. Fabric can hold a video
  element through `FabricImage`, but it never repaints it per frame; the DOM
  layer already owns that frame pump, and the layer is also the surface glass
  samples. That is why it stays a DOM sibling.
- `scene-fabric/src/scene.ts` (`SceneArtboard`, `mountFabricScene`,
  `updateArtboard`) and `editor-shell.ts` (`mountMedia`, `placeMedia`,
  `applyArtboardPaint`) mount that layer from artboard state and re-place it
  whenever the camera moves.
- `renderer-core/src/scene/plan.ts` (`planArtboard`) resolves `artboard.background`
  through the palette and carries it as `ScenePlan.artboard.background`.
  `scene-fabric/src/artboard-backdrop.ts` composes the media over that paint for
  glass.
- `editor/src/editor-shell/layer-tree.ts` projects Fabric objects only, and
  `editor-shell/bridge.ts` selection is a list of Fabric objects.
  `selection-inspector/per-kind-column.ts` takes a `FabricObject`.
- `editor/src/panes/document/artboard-fields.tsx` owns the colour, media and fit
  selects beside the board size.
- `editor/src/editor-document.ts` owns the envelope and `holdsAsset`; the
  artboard plate and host paint are decided in `editor-shell.ts`.
- The schema is decided twice: `renderer-core/src/theme/envelope-keys.ts` is the
  decider, `schema/theme-document.schema.json` the hand-written contract, and
  `fabric-envelope-validate.ts` / `envelope-semantics.ts` enforce it.
  `SUPPORTED_SCHEMA_VERSION` is 2.

## The persisted model

The background becomes a top-level envelope section. It is a layer in the
format, not a node in the Fabric scene:

```ts
{
  artboard: { width: number; height: number; contentFit?: "contain" | "cover" },
  background?: {
    color?: StyleValue,
    media?: {
      assetId: string,
      bounds: "theme" | "display",
      fit?: "cover" | "contain" | "fill",
      scale?: number,
      offsetX?: number,
      offsetY?: number,
    },
  },
}
```

- `artboard.background` and `artboard.backgroundMedia` are removed.
- `background` absent means no colour and no media. The layer row still exists;
  the renderer keeps today's black fallback behind the board.
- `schemaVersion` stays **2**. This is a deliberate exception to the version's
  usual meaning: version 2 no longer identifies a single shape, and an old
  document carrying the removed keys is refused by the unknown-key check rather
  than migrated. The decision note records the consequence.

### Semantics

Evaluated in this order:

1. **Bounds** chooses the box: `theme` is the artboard rect, `display` is the
   display rect the renderer already computes — the display screen in the
   editor, the host rect in the player. The box is the clip.
2. **Fit** produces the base media rect inside the box:
   - `cover`: `s = max(box.width / source.width, box.height / source.height)`
   - `contain`: `s = min(box.width / source.width, box.height / source.height)`
   - `fill`: two scales, `x = box.width / source.width`, `y = box.height / source.height`
3. The base rect is centred in the box.
4. **Scale** multiplies its width and height, keeping the centre: `1` is the fit
   result, `1.4` is 40% larger.
5. **Offset** moves the centre by a fraction of the box's own dimensions, so
   `offsetX: 0.25` moves the media a quarter-box right on any screen.

Defaults — `fit: "cover"`, `scale: 1`, offsets `0` — reproduce today's rendering
exactly.

Before the source has an intrinsic size (an image that has not decoded, a video
without metadata) placement falls back to the box. The first `load` or
`loadedmetadata` re-runs placement, because the intrinsic size is what the fit
needs.

### Validation

- `scale` finite and `0.1 ≤ scale ≤ 10`.
- `offsetX`, `offsetY` finite and `-1 ≤ offset ≤ 1`.
- Out-of-range values are refused, never clamped.
- `color` keeps the existing `StyleValue` rules: a reference must resolve to a
  declared palette token, a literal is accepted.
- `media.assetId` must resolve to a declared `image`, `svg` or `video`.
- `fit` and `bounds` are closed enums; an unknown member is refused.

## Editor surfaces

### The row

`projectLayers` remains a pure Fabric projection. `bridge.layers()` appends one
synthetic row after it, so the background is structurally last and no restack
path can move it:

```ts
BACKGROUND_LAYER_ID = "$background"   // "$" is outside STABLE_ID_PATTERN
```

- `LayerKind`, `LayerMark` and `LayerRole` gain a `background` arm; `uiCopy`
  gains the kind and role words; `icons.ts` gains one glyph.
- Name "Background", depth 0, no parent, no children, `visible: true`,
  `locked: false`, `selected` from the bridge's flag.
- The row has no twisty, no rename, `draggable={false}`, is never a drop anchor,
  and carries no enter, visibility or lock control.
- It is not dimmed when a group is entered: it is always reachable.
- It is not a scene object. `objectCount` in the shell snapshot is unchanged.

### Selection

The bridge holds `backgroundSelected`, mutually exclusive with a Fabric
selection:

- `selectLayer("$background")` discards the active Fabric object and sets it.
- Any `selectLayers` call and any canvas `selection:*` event clears it.
- Shift and Ctrl never mix it into a set; a gesture that would include it
  selects the background alone.
- Canvas drags cannot reach it, because it is not a Fabric object.
- `snapshot().activeKind` gains `"background"` so object actions and tabs are
  ineligible by construction.

### The inspector

`index.ts` branches before `perKindColumn`, which stays Fabric-only:

- The background publishes `subject.kind: "background"`, name "Background", no
  key, `locked: false`.
- `backgroundColumn(background, assets, palette)` returns the same
  `ColumnSectionView` value shape as `perKindColumn`, so `column.tsx` renders it
  unchanged:
  - **Content** — colour (a swatch over palette tokens; the blank reading
    clears) and media (none, or an `image`/`svg`/`video` asset).
  - **Position** — bounds, fit, scale, offset X/Y.
  - No Layer or Paint sections.
- Field ids are `background.color`, `background.media`, `background.bounds`,
  `background.fit`, `background.scale`, `background.offsetX`,
  `background.offsetY`. They route to the document setter, never to a Fabric
  write.
- The blank colour reading removes `color` unless the document holds a literal,
  which survives, exactly as the Document pane's control does today. The blank
  media reading removes `media`. Choosing a media writes `bounds: "theme"` when
  none was stored.
- Fractions are stored; scale and offsets display as percentages.
  `FieldView`'s number arm and `PairHalfView` gain `percent?: boolean`; the
  control shows `value × 100` and commits `entered ÷ 100`.

### The Document pane

Ratio, orientation, resolution, custom W/H and the size note stay. The colour,
media and fit selects and their commit functions leave `artboard-fields.tsx`;
`DocumentPane` and `ArtboardPanel` lose their `globals` and `assets` props, and
`ArtboardPanel.setGlobals`, `ArtboardPanel.setAssets` and the two callers in
`editor-document.ts` and `editor-session.ts` go with them.

### Session wiring

`EditorDocument` gains `setBackground`, which updates the envelope, marks the
document dirty and calls a new shell `setBackground`. The shell re-paints the
host and plate, updates the media handle and requests a render. `holdsAsset`
and the starter theme read `background.media.assetId`.

## Rendering

### One placement owner

A pure function in `background-media.ts`, used by the DOM layer and by the glass
sampler:

```ts
placement({ box, source, fit, scale, offsetX, offsetY })
  => { left, top, width, height }        // box pixels; may extend outside the box
```

The DOM layer and what a glass panel samples therefore cannot drift.

### DOM layer

The layer div is the box: `bounds: theme` is the artboard screen rect,
`bounds: display` is the display screen rect. Its existing `overflow: hidden` is
the clip. The child `<img>`/`<video>` is absolutely positioned from
`placement`; the `object-fit: cover` declaration goes away.

`update()` currently tears down and rebuilds the element on every call, which
would restart a video on every scale-slider tick. The handle gains
`setBackground(background)`:

- remount only when `media.assetId` changes;
- otherwise re-place the same element.
- Fit, bounds, scale and offsets are placement changes, not reloads.

### Colour and plate

`planArtboard` resolves `background.color` through the existing
`resolveStyleValue` path and carries it as `ScenePlan.artboard.background`. The
host style and the artboard plate read that. The plate continues to exist only
when there is no media: the plate is on the canvas above the media layer, while
the host colour shows through wherever the media does not cover — which is what
`contain` or a scaled-down media needs.

### Glass

`backdrop()` keeps reporting the layer box in artboard units. Its paint switches
from the cover-only crop math to the placement rect: the full source is drawn
into the placed destination, offset by `region`. `artboardBackdrop`'s
composition — media first, colour underneath — already handles gaps and does not
change.

### Editor and player

- `SceneArtboard` loses `backgroundMedia`; `mountFabricScene` gains a
  `background` option and `updateBackground()` on its handle.
- The player passes `theme.background` and the editor passes the live document's.
- The editor's camera-driven `setBounds` stays the only re-placement path on
  zoom and pan.

## Verification

Focused proof during implementation; the broad gate at the plan boundary.

| Layer | Proof |
|---|---|
| Placement | A table over `cover`/`contain`/`fill` × scales × offsets; the default row reproduces the old centred-cover result exactly. Pure, no DOM. |
| Handle lifecycle | DOM test: a scale-only `setBackground` keeps the same `<video>` node; an `assetId` change replaces it. |
| Validator | Accepts the new bag; refuses `scale: 0`, `scale: 11`, `offsetX: 2`, unknown key, wrong asset kind, unresolved colour reference. |
| Schema drift | The existing sync tests are updated for the new root and `$defs`. |
| Row and selection | Row is last and `$background`; selecting it clears the Fabric selection; `selectLayers` and canvas selection clear it; a shift-range cannot include it. |
| Inspector | `backgroundColumn` enumerates Content and Position; `1.4 ↔ 140` percent mapping; field ids reach `setBackground` and no Fabric write. |
| Visible behaviour | Editor DOM: clicking the row shows the fields, clicking the canvas does not select the background, and the Document pane no longer offers colour/media/fit. Player browser test: transformed video with a glass panel, inspected in the rendered output. |

Every new regression test is checked red with the behaviour disabled before it
is trusted.

## Acceptance

- Clicking the Background row selects it; the inspector shows colour, media,
  bounds, fit, scale and offsets.
- Dragging on the canvas never selects the background.
- Changing scale, offsets or fit visibly moves and scales the media in the
  editor; the artboard clips it under `bounds: theme`, the display under
  `bounds: display`.
- A theme with none of the new fields renders exactly as before.
- The player renders the same transform, and a glass panel samples the
  transformed media.
- A document carrying the old `artboard.background`/`backgroundMedia` keys is
  refused with an unknown-key issue.
- The Document pane no longer offers the background colour, media or fit.

## Non-goals and recorded limitations

- No transform handles or canvas selection for the background.
- No free-colour picker; palette tokens only.
- No multi-selection with scene layers, no rename, visibility, lock, drag or
  delete for the background row.
- No undo for background edits. Fabric history serialises the scene, and this is
  the same limitation artboard edits already have.
- No converter for the old shape.
- No second layer type and no generic layer model.

## Risks

1. **Glass parity** — one placement owner plus a test that reads both paths.
2. **Undo** — not covered, as recorded above.
3. **Version 2 identifies two shapes** — deliberate; the decision note records
   it.
4. **Video restart** — guarded by `setBackground`'s asset comparison.
5. **Display-bounds offsets** — media may extend outside the display box; the
   display is the clip. Unit tests cover negative and oversized rects.
6. **Stored documents and the catalogue** — the live catalogue's smoke theme
   carries the old shape and must be reseeded by the owner. This is an external
   follow-up, not a code task.

## Process

- A decision note is required before the first write:
  `renderer-core/src/theme/`, `scene-fabric/background-media.ts`,
  `scene-fabric/scene.ts`, `editor-shell/bridge.ts`,
  `editor-shell/layer-tree.ts` and `selection-inspector/view.ts` are on the
  reuse-gate watchlist. The note carries all seven rungs, including what the
  ecosystem does for DOM `object-fit`/transform versus canvas `drawImage`.
- Implementation phases, each 3–5 tasks:
  1. Envelope, schema, validator and the fixture sweep.
  2. Placement and the media handle.
  3. Glass and the player.
  4. The layer row and selection.
  5. The inspector, the Document pane and session wiring; evidence and the
     catalogue reseed note close the plan.
- `STATUS.md` currently names no active plan. Selecting this work means the R2
  store plan becomes queued; that is the owner's call at plan time.
