# 0013 — Rendering the scene through Fabric

- **Status:** accepted, not yet implemented
- **Design document sections:** §31, §47, §51, §53, §55, §57, §61, §64, §67, §83, §85, §89, §91, §105, §116, §134, §137
- **Specs superseded:** none. Amends [0003](0003-scene-rendering.md) (the mount
  layer) and retires most of [0004](0004-editor-selection-and-gestures.md)'s
  implementation while keeping its behaviour

## Problem

Vigilia has built its own graphics editor. `geometry.ts`, `hit-test.ts`,
`transform-gesture.ts`, `overlay.ts`, `snapping/resolver.ts`,
`arrange/commands.ts` and `resize-children.ts` are ~2,500 lines implementing hit
testing, transform handles, marquee selection, rotation maths, snapping guides,
alignment, distribution and group resize — none of it specific to hardware
monitoring, all of it a re-implementation of what a canvas library donates, and
all of it carrying ~25 confirmed open defects that are generic-editor defects:
an entered group is never left by clicking outside it, a multi-selection cannot
be rotated, a locked node can be moved through its group.

That work has been disproportionately expensive and it is not the product. The
monitoring experience — providers, semantic keys, telemetry history, the theme
format, typed chart settings — is.

## What changed since Fabric was rejected

The prior rejection (2026-09-12) was sound on its own premise and that premise
no longer holds. Recorded so the reversal is legible:

| Then | Now |
|---|---|
| Two prebuilt Fabric **editors** were evaluated (`vue-fabric-editor`, `yft-design`). Adopting one meant its canvas renderer beside `mount.ts`'s DOM renderer — **two renderers, which §31 forbids** | Fabric is adopted as **the** renderer, for the editor *and* the player. There is one renderer, so §31 is satisfied rather than violated |
| The editor would render the scene differently from the display | Both build Fabric objects from the same `ScenePlan`, through one shared adapter |
| Fabric's text model was doubted against §89 | Measured: per-run family, size, weight, style, solid and gradient fill, outline and baseline offset all work in one text object, on one shared baseline |

**§31's invariant is kept. Only its verdict about canvas foundations changes.**

## Evidence

Measured 2026-09-15 with `fabric@7.4.0` and `echarts@6.1.0` in headless
Chromium. Prototypes were scratch work outside the repo; **nothing below ran on
a physical device**, and every mobile figure is Chromium emulation at 393×786 /
DPR 2.75, which models neither CPU speed nor thermal behaviour.

### Charts render through Fabric, rotation included

A `VigiliaChart extends FabricObject` owning a **detached** canvas, with ECharts
initialised on it and `_render(ctx)` blitting it, works:

| Capability | Result |
|---|---|
| Static render, line+area and radial gauge | pass; composite cost 0.05 ms mean |
| Selection, move | pass, stock controls |
| **Rotation at 37°** | **pass, no hack.** Bounding box 481.3×445.8 vs 479.9×444.4 analytic; hit-testing follows the rotated rect, not the AABB |
| Live redraw while rotated | pass — **requires** `zr.on('rendered')` → `dirty = true` → `requestRenderAll()`. Without it: 0 fabric renders, chart frozen on screen |
| Proportional resize by re-layout | pass, 9.66 ms mean / 12.8 ms p95 |
| Disposal | pass — `canvas.remove()` does **not** dispose ECharts |
| Serialisation round-trip | pass, whole-canvas pixel hash identical either side |
| 4 live charts at 1 Hz + 10 static objects | `renderAll` 0.28 ms mean (DPR 1), 0.86 (DPR 2.75), 0.19 (Pixel 3 emulated) |

Three settings are not preferences, they are load-bearing:

- **`objectCaching: false` on charts and text.** At DPR 2.75 caching costs
  7.99 ms mean / 36.5 ms p95 and 6.66 MB against 0.12 / 0.2 ms uncached. It is
  also how canvas text *becomes* the bitmap label §91 forbids: past viewport
  zoom ~8 at DPR 2.75 the glyph raster caps at 14.07× and is upscaled from
  there.
- **`animation: false` on chart options.** ECharts' animation loop does not
  drive Fabric, so an animated update repaints the whole canvas ~31 times per
  push through the invalidation hook, for one visible change.
- **`originX: 'left'`, `originY: 'top'` on every object.** Fabric 7 changed the
  default origin to `center`, so `left`/`top` mean the object's centre.
  `PlanBox` is top-left; the default silently offsets an entire artboard.

`chart.resize()` repaints asynchronously — `zr.flush()` is required afterwards
or Fabric blits a half-cleared canvas. Chart ink measured 598 → 586 immediately
after `resize()`, → 1151 after the flush.

### Text satisfies §89, with bounded work

Fabric's per-character `styles` map carries everything a §89 run needs, and lays
mixed-size runs out on one shared baseline. The real objection is narrower than
"the text model": **a naive `set('text', …)` shears the style ranges**, so a live
value going `9.8` → `10.2` leaves the unit wearing the suffix's style. There is
a correct API — `removeChars`/`insertChars` — and rebuilding the whole map from
`PlanTextSegment[]` costs **1.4 µs**, so the map is re-derived per update rather
than patched. 40 live styled-run elements cost 8.87 ms per frame.

Fabric has **no** `verticalAlign`, ellipsis, `maxLines` or honoured `height` on
`Textbox` (the strings do not occur in its bundle at all). Those are Vigilia's
to write, ~60 lines total, and `PlanTextLayout` already specifies them.

### The player fits the budget; the size argument is not the case for this

| | gzip |
|---|---|
| Player today | **201.1 KB** of a 400 KB gate — of which ECharts + zrender are **179 KB (89%)** |
| Fabric via `fabric/es`, the classes `PlanContent` needs | **+61.0 KB** |
| Deleting `mount.ts` + `artboard.ts` + `fonts.ts` | **−4.6 KB** |
| Projected | **~257 KB of 400 KB — passes** |

Two facts worth keeping:

- **Import from `fabric/es`, never bare `fabric`.** The default entry is one
  pre-bundled file no tree-shaker can see into: 95.0 KB versus 49.3 KB for the
  identical imports. `./es` ships the same type declarations, so nothing is
  given up.
- **`mount.ts` is 767 lines and deleting it saves 4.6 KB.** The case for this
  migration is maintenance, not bytes. Anyone arguing it on bundle size has the
  wrong argument.

`StaticCanvas` genuinely excludes the interaction layer, verified by module
manifest, string grep and a 31 KB difference against `Canvas`. Built-in shapes
still drag in ~6.4 KB of control definitions through `InteractiveFabricObject`;
that is the accepted price of not hand-rolling `Rect`, `FabricText` and `Group`.

## Target architecture

```text
              ThemeDocument  (ours — §134, schema-versioned)
                     │
              scene/plan.ts   (pure, unchanged — decides everything)
                     │
                 ScenePlan
                     │
            scene/fabric-adapter   ← ONE owner, shared
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Canvas (editor)          StaticCanvas (player)
   + interaction            + nothing else
```

`plan.ts` survives untouched. That is the whole reason this migration is
tractable: it already resolves geometry, style, formatted text segments, chart
options and per-frame issues into a flat `ScenePlan`, and it is unit-tested in
Node. **`mount.ts` is what Fabric replaces** — the 767-line DOM applier, not the
renderer's decisions.

§105's "the editor and display share render components and adapters" therefore
becomes *more* true than it is today, because the adapter is one module both
ends import rather than a mount layer plus an overlay.

### The document stays ours

Fabric JSON is **not** the theme format (§134). The direction is one-way at
load: `ThemeDocument` → `ScenePlan` → Fabric objects. During an editing session
the Fabric scene is the live model and the editor writes geometry back to the
document on commit, rounded to whole units (§57). Vigilia keeps ownership of
ids, semantic bindings, palette and typography references, assets, chart
configuration and schema version.

### Telemetry must never touch a serialised Fabric property

The strict rule (§67): live samples are held in **non-serialised instance
fields** and drawn by the object's own `_render`. Never express a sample by
mutating `width`, `scaleX`, `angle`, `fill`, `opacity`, path data — or a custom
property listed in `toObject`.

This is not a style preference. Any snapshot-based history — including the one
the reference editor uses — serialises the whole canvas, so a telemetry value
sitting on a serialised property gets baked into the next undo entry taken for
an unrelated reason, and undo then restores a stale reading. A guard test is
required, because nothing in Fabric enforces it.

### Groups

Fabric groups carry their own geometry; §137 says a group is structural with no
geometry of its own, and child order alone determines stacking. The adapter
resolves this by treating a Fabric group as **transient**: grouping is a
selection-and-gesture mechanism whose transform is written back onto the
children on commit, which is what §137 already describes a group gesture as
doing. Nothing group-shaped is persisted that is not persisted today.

## Migration map

`DELETE` — gone, Fabric supplies it · `REPLACE` — reimplemented on Fabric ·
`ADAPT` — kept, retargeted · `KEEP` — ours, untouched.

| System | Verdict | Note |
|---|---|---|
| `editor/src/geometry.ts` (336) | **DELETE** | Fabric's matrices and bounds |
| `editor/src/selection/domain/hit-test.ts` (222) | **DELETE** | Fabric hit-tests rotated shapes correctly; measured |
| `editor/src/transform-gesture.ts` (596) | **DELETE** | Fabric controls, with per-object lockable axes |
| `editor/src/overlay.ts` (324) | **DELETE** | Fabric draws its own controls |
| `editor/src/resize-children.ts` (126) | **DELETE** | Group resize is Fabric's; already dead code after schema v2 |
| `renderer-core/src/scene/mount.ts` (767) | **REPLACE** | → `scene/fabric-adapter`, shared by both ends |
| `editor/src/snapping/` (347) | **REPLACE** | Fabric has no snapping; reimplement against its coordinate API. The reference editor's is the model |
| `editor/src/arrange/commands.ts` (542) | **ADAPT** | Align and distribute stay ours; they operate on Fabric bounds instead of `placeNodes` |
| `editor/src/document/history.ts` (223) | **KEEP** | Immutable document + structural sharing. Explicitly **not** replaced by canvas-snapshot diffing |
| `editor/src/actions.ts`, `keyboard.ts` | **KEEP** | Declare-then-generate already works |
| `editor/src/inspector/`, `layers/`, `globals/` | **KEEP** | Declarative descriptors over `capabilities.ts` and `settings-fields.ts`. See below |
| `renderer-core/src/scene/plan.ts` (687) | **KEEP** | The seam. Untouched |
| `renderer-core/src/charts/*` (1,612) | **KEEP** | `buildLineOption` and friends already emit engine options from typed settings |
| `renderer-core/src/artboard.ts` (236) | **ADAPT** | Feeds Fabric's `viewportTransform` instead of a CSS transform. §51/§53 fit maths is not something Fabric has |
| `renderer-core/src/theme/*`, `data/*`, host, providers | **KEEP** | The domain |

**The property panel is not donated and there was never anything to port.** The
reference editor's property UI is 4,217 lines of hand-wired DOM against fixed
element IDs, demo-only, and excluded from its own published package. Vigilia's
`settings-fields.ts` + `capabilities.ts` + `inspector/model.ts` are a
*declarative* descriptor model that already satisfies §2's one-owner rule. They
are kept and re-skinned, not replaced — the panel's chrome changes, the
descriptors do not.

## Accepted compromises

- Chart family is **immutable after creation**. No cross-family conversion
  engine.
- Charts resize **proportionally** only, and are **not skewed**.
- During a resize gesture the chart scales naively and re-lays out on commit;
  live re-layout at 9.66 ms per frame is not affordable per-drag.
- **Chart configuration changes are committed immediately and are not covered
  by editor undo/redo.** Move, resize, rotate and delete are. No history bridge
  is built for chart settings.
- ECharts' own interactivity (tooltips, hover) is unavailable — a detached
  canvas receives no DOM events. Phones are display-only and the editor uses
  Fabric's selection, so nothing depended on it.
- **Per-run letter spacing, per-run shadow, per-run opacity and tabular
  numerals are not expressible** on canvas. The first three fold into
  object-level properties or `rgba()`; tabular numerals need a tabular-by-default
  family plus §89's fixed boxes. These are §85 gaps and are listed there.
- **Canvas text has no subpixel antialiasing** — 0% colour-fringed pixels
  against DOM's 88.2% at DPR 1. The gap narrows substantially at DPR 2.75 (151
  vs 179 luminance levels), so it matters more in the desktop editor than on the
  target phone.
- **Accessibility, text selection and find-in-page are lost** with the `<span>`
  tree, as is the `span[data-status]` hook that let a theme style a stale
  reading without the renderer deciding. Something must now own that decision.

## Blockers found

Two, both real, both scoped to media rather than to the migration.

### Video cannot be a Fabric object

Fabric's `renderCanvas` does `clearContext` then redraws every object; there is
**no dirty-rectangle path anywhere in its pipeline**. A 30 fps video therefore
costs a full clear, a full object redraw and a full backing-store upload per
frame. Measured at a 4× CPU throttle: `renderAll` alone is **22.9–28.2 ms p50
against a 33.3 ms budget**, before anything else on the frame.

**Resolution: video is a DOM layer beneath a transparent Fabric canvas**, which
measured 60 fps at every throttle and object count because the compositor owns
it. `StaticCanvas` is transparent by default, so this needs no configuration.

**Scope, decided by the user on 2026-09-15: at most one video, and it is the
background.** It can be positioned and scaled, and **the artboard is its
cropping region** — content is clipped to the artboard exactly as the design is.
Nothing else: no rotation, no per-node video, no playback controls, no timeline,
no video inside a group.

That scope is what makes the DOM layer safe rather than merely acceptable. The
architectural objection to a DOM layer is that today a `video` node sits inside
the one transformed artboard, so alignment with foreground content **cannot
drift** because it is structural — and a layer outside the canvas replaces that
invariant with a synchronisation contract. Confined to a single background with
position and scale, that contract is four values (the artboard scale, its two
offsets, and the clip), all produced by **one owner**,
`computeArtboardTransform`, which also produces the Fabric `viewportTransform`.
A test asserting the two agree is the mechanism; there is no per-node
flattening, no ancestor chain, no rotation composition and no z-order question,
because nothing is ever behind the video.

That is a schema change: `video` stops being a node type and becomes background
media on the artboard, which is §55's own framing (*"Background media"*).
Nothing is lost — video has no editor support, no fixture and no test today, and
`videoContent` carries no `fit` key even though `capabilities.ts` documents one.
Position-and-scale-within-a-crop replaces `fit` outright, so that drift is
resolved by deletion rather than by adding the missing key.

### GIF cannot animate through Fabric

Fabric loads images into an `<img>` and draws them with `drawImage`, and
`drawImage` of an animated image yields **frame 0 forever**. Measured against a
verified 2-frame GIF: the same live `<img>` produced 2 distinct element
screenshots over 660 ms while 6 `drawImage` samples of it all returned
`255,0,0`; a `FabricImage` of it was frozen both with and without a
`requestAnimationFrame` render loop. This is the canvas-2D contract, not a
Fabric defect.

**Classification: DEFERRED.** Not dropped — the DOM-layer mechanism video needs
would also carry a GIF — but no GIF work happens during this migration, and a
free-floating animated GIF element is out of scope. A `.gif` on an `image` node
will render its first frame.

## Stages

Each stage ends green and committed.

1. **Foundation.** This spec, the superseding decision, `fabric` added, the
   `fabric/es` import-boundary test, and `VigiliaChartObject` with the four
   families over the existing `buildXOption` builders.
2. **Player.** `scene/fabric-adapter` + `StaticCanvas`; artboard transform to
   `viewportTransform`; size gate re-measured.
3. **Document bridge.** `ScenePlan` → Fabric for every `PlanContent` kind;
   geometry written back rounded (§57); save/load round-trip.
4. **Editor.** Interaction moves to Fabric; the `DELETE` rows go; snapping
   reimplemented; panels re-skinned onto the existing descriptors.
5. **Text and tokens.** Styled runs, the layout options Fabric lacks, the
   font-load re-measure hook, palette and typography tokens as Fabric fills.
6. **Live telemetry.** Bindings into chart objects and text runs, with the
   no-serialised-property rule under test.
7. **Media.** Video as background media on a DOM layer; decide GIF.
8. **Cleanup.** Delete the superseded renderer and any temporary adapter.

## Risks

- **No physical device has ever run any of this**, and none of the existing
  player either. Every performance figure is desktop Chromium, with mobile
  numbers emulated. A real Pixel 3 CPU is far slower; treat the emulated
  numbers as an upper bound on quality and a lower bound on cost.
- **The E2E suite's 57 structural assertions key on `data-node-id` and
  `data-vigilia-*`.** A Fabric canvas has no per-node DOM, so a large part of
  the safety net for stages 3–4 stops applying exactly when it is most needed.
  Pixel-level assertions are not an option here (CI is Linux, development is
  Windows). Replacing those hooks with canvas-level probes is stage 3 work and
  must not be deferred past it.
- **`renderScale` needs a hard cap.** One 300×180 chart re-rasterised at
  viewport zoom 4 cost 13.18 MB.
- **A Pixel 3 dashboard's total canvas memory measured 11.59 MB** at
  `renderScale` 2. That is a budget worth reinstating under §126, which is
  currently dropped.
- The `fabric/es` subpath is the only tree-shakeable entry, and writing bare
  `fabric` costs 45 KB gzip silently. The boundary test in stage 1 exists
  because the §47 gate has ~199 KB of slack and would not notice.

## Acceptance

- A chart object renders all four families, and survives move, proportional
  resize, **rotation at arbitrary angles**, rotated live redraw, hide/show,
  lock, reorder, delete, duplicate and a save/load round-trip.
- Every setting in `CHART_SETTINGS_FIELDS` is editable through the editor's
  property panel and visibly changes the chart.
- A missing sample renders as a gap, never a zero (§83), in a Fabric chart.
- A telemetry update produces **no** undo entry and no change to any serialised
  property — asserted by a test, not by review.
- The player's §47 gate passes, with the measured number recorded in
  `status.md`.
- An import-boundary test fails on bare `fabric`, on `Canvas` in the player, and
  on any `packages/editor` specifier reaching `renderer-core` or `player`.
- Editor and player render the same document identically, through one adapter.
