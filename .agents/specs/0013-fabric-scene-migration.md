# 0013 — Rendering the scene through Fabric

- **Status:** accepted. Stage 1 implemented and reviewed; stages 2–8 outstanding
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
| **Rotation at 37°** | **pass, no hack.** Bounding box 481.3×445.8 vs 479.9×444.4 analytic; hit-testing follows the rotated rect, not the AABB. The 1.4 px discrepancy was **not** noise — see below |
| Live redraw while rotated | pass — **requires** `zr.on('rendered')` → `dirty = true` → `requestRenderAll()`. Without it: 0 fabric renders, chart frozen on screen |
| Proportional resize by re-layout | pass, 9.66 ms mean / 12.8 ms p95 |
| Disposal | pass — `canvas.remove()` does **not** dispose ECharts |
| Serialisation round-trip | pass, whole-canvas pixel hash identical either side |
| 4 live charts at 1 Hz + 10 static objects | `renderAll` 0.28 ms mean (DPR 1), 0.86 (DPR 2.75), 0.19 (Pixel 3 emulated) |

Four settings are not preferences, they are load-bearing:

- **`objectCaching: false` on charts and text.** At DPR 2.75 caching costs
  7.99 ms mean / 36.5 ms p95 and 6.66 MB against 0.12 / 0.2 ms uncached. It is
  also how canvas text *becomes* the bitmap label §91 forbids: past viewport
  zoom ~8 at DPR 2.75 the glyph raster caps at 14.07× and is upscaled from
  there.
- **`animation: false` on chart options.** ECharts' animation loop does not
  drive Fabric, so an animated update repaints the whole canvas ~31 times per
  push through the invalidation hook, for one visible change.
- **An explicit origin on every object**, because Fabric 7 changed the default
  and `PlanBox` is top-left. The value is **`center`** — see [Origin](#origin)
  for why it is not `'left'`.
- **`strokeWidth: 0` on charts.** Fabric adds `strokeWidth` into
  `_getTransformedDimensions`, so the default of 1 inflates the bounding box,
  the hit area and every control position. **It is the entire 1.4 px bounding-box
  discrepancy in the table above**: `1 × (cos 37° + sin 37°)` is 1.4004 against a
  measured 1.4 on both axes. `_render` blits and never calls
  `_renderPaintInOrder`, so no stroke was ever drawn — only measured. With it at
  0 the box is exact, and what looked like acceptable noise was a fixable
  defect. Read it as a warning about the rest of this table: a small
  unexplained residue is worth explaining.

### Origin

`PlanBox` is top-left and Fabric's `left`/`top` mean the object's centre, so
something must convert. Fabric 7 **deprecates every origin except `center`**
("please use 'center' as value in new projects", `ObjectGeometry.ts:581-587`),
and §134 requires the origin to be *explicit* rather than inherited — which
`center` satisfies exactly as well as `'left'` does.

So objects are written with **`originX`/`originY` of `center`**, and the
top-left→centre conversion is two additions in the adapter, in one place.
Pinning `'left'` would have satisfied §134 while putting the **persisted
format** on an API Fabric intends to remove, turning its removal into a
migration of every saved theme. `_render` works in centred local space
regardless, so nothing else changes.

**Adopting the default costs one thing, and it is easy to miss.** Fabric strips
any property equal to its default: `_removeDefaultValues` exempts only `left`,
`top` and `type`, and the object cannot opt out, because
`StaticCanvas._toObject` forces `includeDefaultValues` off onto every instance
when the canvas has it off. `originX: 'left'` survived that **by accident** —
it could never equal the default. `center` does, so it is dropped the moment
defaults are stripped, and §134's condition silently stops holding.

A `toObject` override therefore re-adds the two origin keys, and it is the only
sanctioned override on the object. The test asserts it with
`includeDefaultValues = false`, because the easy case passes either way.
Anything else persisted whose value could equal a Fabric default needs the same
treatment — which is a reason to keep the custom-property surface to authored
values that never look like a default.

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

### The scene is stored in Fabric's format, inside Vigilia's envelope

Decided 2026-09-15 by the user, on the condition that it removes translation
work rather than relocating it. It does — but only in one of the two readings,
and the difference is large enough to state.

**What is adopted.** The node tree is persisted as Fabric's own object
serialisation, with Vigilia's semantics as declared custom properties on each
object — through Fabric's **`static customProperties`**, which its own
`toObject` concatenates into the keys it picks (`Object.ts:1748`). So the
declared surface *is* the emitted one, and there is no `toObject` override to
keep in step with it. `canvas.toObject()` saves and `canvas.loadFromJSON(…)`
revives, including custom classes through `classRegistry`. Measured on the
prototype: a chart round-tripped to JSON and back **pixel-identical**,
whole-canvas hash equal on both sides. So geometry, grouping, stacking order,
visibility and lock cost **no conversion code at all**, and the write-back layer
stage 3 would otherwise have needed — read `left`/`top`/`angle` off every object
on every commit and round it into a parallel tree — is deleted before it is
written.

**`fromObject` is never overridden.** `FabricObject.fromObject` routes through
`_fromObject`, which runs `enlivenObjectEnlivables` before construction — the
step that turns a serialised `clipPath`, gradient or pattern back into an
instance. An override that calls `new Thing(object)` directly skips it and
revives a clip path as a plain object, which breaks at the first render rather
than at load. Stage 2 clips content to the artboard, so this is not theoretical.

**Only authored values are custom properties.** Anything the renderer can
recompute is left out, because a persisted copy of derived state is a second
declaration that drifts. For a chart that means `family` and `settings` — which
are exactly `ChartContent`'s keys — and **not** the built engine option, which
`plan.ts` rebuilds from those settings, the theme's tokens and the current
samples on every frame. The consequence is stated in
[Telemetry](#telemetry-cannot-reach-a-serialised-property) because it is the
mechanism that makes §67 true, and it costs one thing worth naming: a
round-trip is pixel-identical **after the plan is re-applied**, which is the
normal render path, rather than immediately on load from the JSON alone.

**What is not adopted, and why this is not hair-splitting.** Vigilia keeps the
**envelope**: `schemaVersion`, document id and metadata, artboard, globals,
assets, and the semantic layer (bindings, palette and typography references,
typed chart settings). Two concrete reasons, not purity:

1. **Replacing the envelope would *add* translation, not remove it.**
   `scene/plan.ts` resolves tokens, formats text, applies binding scale/offset
   and builds chart options — 687 pure, tested lines that are the most valuable
   thing in the repo. It reads a `ThemeDocument`. Make raw Fabric JSON the
   whole format and either it is rewritten, or Fabric JSON is converted into
   what it reads on load — and that converter *is* the translation engine, just
   moved to a worse place. The `ThemeDocument`→render direction is not work to
   be avoided; it already exists and passes.
2. **Fabric's format has no version and no migration story**, and §141 requires
   a persisted format to refuse what it cannot read. Fabric 7 has *already*
   made a breaking semantic change: `originX`/`originY` now default to
   `center`, so `left`/`top` mean an object's centre rather than its corner.
   Had the scene been bare Fabric JSON across that upgrade, every saved theme
   would have silently shifted by half its size. That is precisely the defect
   class this project has spent the most on.

**The mechanism that makes this safe**, because a comment would not: the
envelope records the **Fabric major version** the scene was written with, every
object is written with an explicit origin (`center` — see
[Origin](#origin)), and a Fabric major upgrade is treated as a **schema
migration** — `schemaVersion` bumps, and a scene from an older Fabric major is
refused rather than guessed at (§141). The version is pinned exactly (`7.4.0`),
not by range.

So §134 keeps its rule and narrows its scope: **the format is ours, and the
renderer's object serialisation is a sanctioned part of it** — cited by version,
inside an envelope that can refuse it. What stays forbidden is the thing §134
was written against: a bare editor-library dump as the whole document, with no
version, no semantics and no way to refuse it.

### Telemetry cannot reach a serialised property

The strict rule (§67): live samples are held in **non-serialised instance
fields** and drawn by the object's own `_render`. Never express a sample by
mutating `width`, `scaleX`, `angle`, `fill`, `opacity`, path data — or a custom
property.

This is not a style preference. Any snapshot-based history — including the one
the reference editor uses — serialises the whole canvas, so a telemetry value
sitting on a serialised property gets baked into the next undo entry taken for
an unrelated reason, and undo then restores a stale reading.

**A guard test on key *names* is not enough, and the first attempt at one
proved it.** Stage 1 shipped `['family', 'option', 'renderScale']` as the
chart's serialised surface with a test asserting that no key name looked like
telemetry. Every name passed — and the samples were inside `option`, as
`series[].data`. A name check cannot see one level down, so it reported green
over exactly the defect it was written to catch.

The rule is therefore structural rather than inspected: **a custom property
holds authored configuration only, and anything the renderer can recompute is
not a custom property.** Derived state cannot leak a sample because it is not
written at all. A test still asserts the surface, but what it asserts is that
the built option is absent — a property of the design, not a property of a
name.

### Groups: §137 is rescinded, and Fabric's group is the group

Fabric's `Group` carries its own geometry. §137 said a group is a structural
entity with no geometry of its own. That conflict had to be resolved in the
persisted format at stage 3, so it was resolved rather than deferred:
**§137's no-geometry rule is dropped and a Fabric `Group` is persisted as-is**,
nested transforms included.

Decided 2026-09-15 by the user, on the standing offer that a Vigilia rule gives
way when keeping it means writing a translation layer. Keeping it meant exactly
that — flatten every group's matrix onto its children on save, rebuild the
groups from a non-geometric tag on load — which is a write-back layer in a
different place, and the thing this migration's own acceptance criteria forbid.

What arrives free, rather than being written: nested transforms, group resize
through Fabric's `LayoutManager`, group rotation, and group clipping.

**§137's other clause is unaffected and stays.** "Child order alone determines
stacking, and there is no z-index" is cited 30-odd times across specs, schema,
renderer and editor, and none of it changes — Fabric renders `_objects` in
order. Only the sentence about a group having no geometry goes.

**Transient multi-selection is also already donated**, which removes the
adapter work the earlier draft of this section described. `ActiveSelection` is
Fabric's transient group: it never enters `canvas._objects`, so it is never
serialised, and `exitGroup` bakes the selection's transform into each child via
`applyTransformToObject` on deselect (`Group.ts:426-437`). That *is* "a gesture
whose transform is written back onto the children on commit", implemented.

**This resolves a contradiction that predates the migration.** The schema
already says the opposite of §137 — `theme-document.schema.json:127`:
*"Group-local coordinates (§57). Grouping and ungrouping must preserve world
appearance, so transforms compose rather than being baked"* — and `NodeBase`
has always allowed `transform` on a `group` node. §57 says the same. The
no-geometry rule was a §137/spec-0011 position that the format never adopted.

**The editor still implements the old rule, and that is stage 4 work.**
`capabilities.ts` presents a group with no transform rows, spec 0011's D2
argues for it, and `resize-children.ts` is still imported by
`editor/src/main.ts`. None of that is touched by this stage; the migration map
below carries the rows, and `status.md` records it as outstanding rather than
done.

## Migration map

`DELETE` — gone, Fabric supplies it · `REPLACE` — reimplemented on Fabric ·
`ADAPT` — kept, retargeted · `KEEP` — ours, untouched.

| System | Verdict | Note |
|---|---|---|
| `editor/src/geometry.ts` (336) | **DELETE** | Fabric's matrices and bounds |
| `editor/src/selection/domain/hit-test.ts` (222) | **DELETE** | Fabric hit-tests rotated shapes correctly; measured |
| `editor/src/transform-gesture.ts` (596) | **DELETE** | Fabric controls, with per-object lockable axes |
| `editor/src/overlay.ts` (324) | **DELETE** | Fabric draws its own controls |
| `editor/src/resize-children.ts` (126) | **DELETE** | Group resize is Fabric's `LayoutManager` now that a group has geometry. Still imported by `editor/src/main.ts`; the import goes with it at stage 4 |
| `editor/src/selection/` multi-select | **DELETE** | Fabric's `ActiveSelection`, which is transient and bakes its transform onto children on deselect |
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
- **The ECharts SVG renderer becomes unreachable.** A Fabric object draws by
  blitting a canvas, so `renderer: 'svg'` cannot be used through one at all —
  `mount.ts`'s `chartRenderer` option and the player's `?renderer=svg` both die
  with `mount.ts` at stage 2. Two things were resting on it, and neither is
  lost: the canvas-versus-SVG comparison `player/src/main.ts` wanted measured is
  moot once only one is reachable, and the *deterministic capture* claim beside
  it was already false — `gate-evidence`, `screenshots/README.md` and
  `display.spec.ts:748` all record that a chart frame is **not** byte-reproducible
  **on either renderer**, measured. So the comment goes, the registration goes,
  and the three places citing "both the canvas and SVG renderers" get corrected
  to say there is one.
- **`renderScale` is not persisted.** It is device state — device pixel ratio
  times viewport zoom — and a portable document should not carry the authoring
  machine's display. The display supplies it on mount.

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
   `fabric/es` import-boundary test, and `VigiliaChart` with the four families
   over the existing `buildXOption` builders.

   Reviewed 2026-09-15 after the first attempt, which **did not work**: `option`
   was declared as a getter with no setter, and Fabric's only way in
   (`_setOptions` → `set` → `this[key] = value`) therefore threw a `TypeError`
   on every construction that supplied one. No unit test instantiated the class
   and the browser tests were deferred to stage 2, so the suite was green over
   an object that could not be built. The lesson generalised into
   `lessons.md`; the guard is a prototype-shape test that needs no DOM.

   Four things Fabric already donates were also being hand-written, and each
   was handed back: `customProperties` instead of a `toObject` override,
   inherited `fromObject` instead of one that skipped enlivening, `ownDefaults`
   instead of defaults declared twice, and `set('dirty', true)` instead of a
   field assignment — the last because `_set` is what propagates dirtiness to
   an enclosing `Group`, so the direct assignment would have frozen any grouped
   live chart.
2. **Player.** `scene/fabric-adapter` + `StaticCanvas`; artboard transform to
   `viewportTransform`; size gate re-measured. The adapter converts `PlanBox`
   top-left to Fabric's centre origin — the only place that conversion exists —
   and wires `canvas.on('object:removed')` to `dispose()`, because
   `canvas.remove()` does **not** call it (`Collection.ts:68`) while
   `destroy()` does (`StaticCanvas.ts:1473`). `mount.ts`'s `chartRenderer`
   option and the player's `?renderer=svg` go with `mount.ts`.
3. **Document bridge.** `ScenePlan` → Fabric for every `PlanContent` kind, and
   the persisted scene moves to Fabric's object format inside the envelope:
   `toObject`/`loadFromJSON` round-trip, the Fabric major version recorded,
   `schemaVersion` bumped, an older scene refused. A Fabric `Group` is
   persisted with its geometry, per the §137 reversal above. **No write-back
   layer** — that is what adopting the format removes.
4. **Editor.** Interaction moves to Fabric; the `DELETE` rows go; snapping
   reimplemented; panels re-skinned onto the existing descriptors. Resize uses
   Fabric's own `controlsUtils.changeWidth`/`changeHeight` rather than a
   hand-rolled handler — that is how `Textbox` re-lays out instead of scaling,
   which is what a chart needs. This stage also carries the §137 reversal into
   the editor: `capabilities.ts` gives a group its transform rows back, spec
   0011's D2 is rewritten, and `resize-children.ts` and its import go. **Two
   passing tests assert the old rule and will invert here**, so they are named
   rather than discovered: `renderer-core/src/theme/capabilities.test.ts`
   ("presents no geometry at all") and `editor/src/inspector/model.test.ts`
   ("No geometry: a group's transform is its children's values"). Neither is a
   regression when it flips.
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
- **`renderScale` needs a hard cap, and the cap must be on *area*.** One
  300×180 chart re-rasterised at viewport zoom 4 cost 13.18 MB. A cap on the
  *factor* does not bound memory, because cost is `width × height × scale²` —
  at a factor ceiling of 3 a 1200×800 chart reaches 8.6 M px. So there are two
  ceilings, whichever is lower: the factor, and the backing store's pixel area.
  The area ceiling never returns less than 1: below that it buys memory with
  resolution the author asked for, and a chart too large to afford at 1× is a
  layout problem that should be visible rather than quietly blurred.
- **A Pixel 3 dashboard's total canvas memory measured 11.59 MB** at
  `renderScale` 2. That is a budget worth reinstating under §126, which is
  currently dropped.
- The `fabric/es` subpath is the only tree-shakeable entry, and writing bare
  `fabric` costs 45 KB gzip silently. The boundary test in stage 1 exists
  because the §47 gate has ~199 KB of slack and would not notice.

## Acceptance

- A chart object renders all four families, and survives move, proportional
  resize, **rotation at arbitrary angles**, rotated live redraw, hide/show,
  lock, reorder, delete, duplicate and a save/load round-trip. The round-trip
  is pixel-identical **once the plan has been re-applied**: the built option is
  derived and is not persisted, so the JSON alone revives configuration, not
  pixels.
- **Nothing is hand-written that Fabric donates.** Specifically: custom
  properties through `customProperties` rather than a hand-listed `toObject`,
  no `fromObject` override at all, defaults declared once through `ownDefaults`,
  dirtiness set through `set` so it reaches an enclosing group, and resize
  through `controlsUtils`. Each was hand-rolled once in stage 1 and each was
  wrong in a way the suite could not see.

  **One override is sanctioned and must stay**: `toObject` re-adds `originX`
  and `originY`, because the origin now equals Fabric's default and
  `_removeDefaultValues` therefore strips it. See
  [Origin](#origin) — this is a requirement, not a convenience, and the test
  asserts it against a `toObject` with defaults stripped rather than the easy
  case.
- Every setting in `CHART_SETTINGS_FIELDS` is editable through the editor's
  property panel and visibly changes the chart.
- A missing sample renders as a gap, never a zero (§83), in a Fabric chart.
- A telemetry update produces **no** undo entry and no change to any serialised
  property. Asserted **structurally**: the test shows the built option is not a
  custom property, so no sample can be written at all. A test that only checks
  key names does not satisfy this — it was tried, and it passed while the
  samples sat inside `option.series[].data`.
- **Every custom property is assignable through Fabric's options path.** A
  getter with no setter makes `new Thing({ key })`, `clone()` and
  `loadFromJSON` all throw, and no rendering test is needed to catch it — a
  prototype-shape test does, in Node.
- The player's §47 gate passes, with the measured number recorded in
  `status.md`.
- An import-boundary test fails on bare `fabric`, on `Canvas` in the player, and
  on any `packages/editor` specifier reaching `renderer-core` or `player`.
- Editor and player render the same document identically, through one adapter.
- A saved document **records the Fabric major version**, and one written by a
  different major is **refused with a clear message**, not loaded and guessed
  at. Asserted by a test that feeds it a scene claiming another major.
- **No write-back layer exists.** If stage 3 ends with code copying
  `left`/`top`/`angle` off Fabric objects into a parallel node tree, adopting
  the scene format bought nothing and the decision should be re-argued rather
  than worked around.
