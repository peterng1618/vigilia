# 0013 — Rendering the scene through Fabric

- **Status:** accepted. Stage 1 implemented and reviewed; stages 2–8
  outstanding. **Stage 3 is gated** on [Settle before stage
  3](#settle-before-stage-3) — three format questions this spec had deferred
  into the stage that freezes the format
- **Design document sections:** §31, §47, §51, §53, §55, §57, §61, §64, §67, §83, §85, §89, §91, §105, §116, §126, §134, §137, §141
- **Specs superseded:** none. Amends [0003](0003-scene-rendering.md) (the mount
  layer) and retires most of [0004](0004-editor-selection-and-gestures.md)'s
  implementation while keeping its behaviour
- **Independently reviewed 2026-09-15**, against the vendored Fabric source and
  by running the suite. What that changed is marked *(review 2026-09-15)*
  throughout; the largest findings were that Fabric donates more than the
  migration map credited it with, and that node identity was not in the
  persisted format at all

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

**The prototypes no longer exist, so no figure here can be re-checked without
re-measuring.** The review of 2026-09-15 re-verified what is decidable without
them — every Fabric source citation, and the serialisation behaviour, in
jsdom — and those results are marked *(review 2026-09-15)* where they change a
conclusion. Which performance figures are load-bearing enough to re-measure, and
when, is in [Risks](#risks).

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
values that never look like a default, and which **generalises badly to Fabric's
own built-in classes**: see [Whether defaults are
stripped](#whether-defaults-are-stripped-is-a-format-decision-not-a-default).

**A centre origin also puts half-units in the persisted format, and §57 asks for
integers** *(review 2026-09-15)*. `left = x + width / 2`, so an odd-width box
persists a half. Nothing breaks today — neither the schema nor `validate.ts`
enforces integer geometry; transform `x`/`y`/`width`/`height` are plain
`"type": "number"`, and §57's whole-units rule lives only in the inspector's
arrow-key step. But once the format freezes on centre coordinates, the rule can
never be enforced on the persisted values afterwards. Decide now that §57 means
"integer in the adapter's top-left space" and say so in §57, or accept halves
deliberately.

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

**"The 400 KB gate" is not §47's number** *(review 2026-09-15)*. §47 states the
rule — a display-only bundle that downloads no editor controls, and "find the
leaked dependency rather than raising the budget" — and no figure. The 400 KB
lives in `player/scripts/check-size.mjs:21`, whose own header calls it a
**placeholder** pending §157's Gate 0 reference hardware. So the slack argued
about below is slack in a placeholder, which is the reason the import-boundary
test exists rather than a reason to relax.

Two facts worth keeping:

- **Import from `fabric/es`, never bare `fabric`.** The default entry is one
  pre-bundled file no tree-shaker can see into: 95.0 KB versus 49.3 KB for the
  identical imports. `./es` ships the same type declarations, so nothing is
  given up.
- **`mount.ts` is 766 lines and deleting it saves 4.6 KB.** The case for this
  migration is maintenance, not bytes. Anyone arguing it on bundle size has the
  wrong argument.

`StaticCanvas` genuinely excludes the interaction layer, verified by module
manifest, string grep and a 31 KB difference against `Canvas`. Built-in shapes
still drag in ~6.4 KB of control definitions through `InteractiveFabricObject`;
that is the accepted price of not hand-rolling `Rect`, `FabricText` and `Group`.

### What Fabric already donates that this plan had scheduled as work

*Added by the review 2026-09-15, read out of the vendored source at
`src/web/node_modules/fabric/`. The migration map below is corrected against
it.* The premise of this whole spec is that a canvas library donates generic
editor behaviour — so the expensive mistake available here is writing something
7.4.0 already ships. It ships more than the first draft credited it with, and
most of it is behind one subpath nobody had opened.

**`fabric/extensions` exists and is browser editor code.** `extensions/index.ts`
exports:

| Export | Replaces |
|---|---|
| `AligningGuidelines` | Object-to-object snapping **with guide rendering**. `margin` *is* the snap tolerance; `getObjectsByTarget` scopes it; per-move coordinate caching and `dispose()` included. This is most of `editor/src/snapping/` |
| `installOriginWrapperUpdater`, `originUpdaterWrapper` | Fabric's own origin migration, for exactly the 6→7 default change this spec cites as proof no migration story exists |
| `createImageCroppingControls`, `changeCropX/Y/Width/Height`, `changeWidthAndScaleToCover`, `enterCropMode`, `withFlip` | The position-and-scale-within-a-crop model [Blockers](#video-cannot-be-a-fabric-object) adopts for media, and `ImageContent.fit`'s replacement |
| `createLinearGradientControls` | §83's "editable stops", on canvas |
| `addGestures`, `pinchEventHandler`, `rotateEventHandler` | Touch pinch/rotate. Not needed — phones are display-only — recorded so it is not rediscovered |

**Unmeasured, and it is the gate on using any of them:** every file under
`extensions/` imports from **bare `'fabric'`**, and `fabric/extensions` resolves
to `dist-extensions/index.mjs`. Whether that double-bundles Fabric beside
`fabric/es` is a build experiment, not a reading exercise, and it must run
before stage 4 commits to `AligningGuidelines`. The editor bundle has no size
gate, so nothing else would notice.

**And in core, already imported:**

- **`snapAngle` / `snapThreshold`** (`InteractiveObject.ts:56-57`, consumed at
  `controls/rotate.ts:56-66`) — rotation snapping, per object.
- **Z-order** — `sendObjectToBack`, `bringObjectToFront`, `sendObjectBackwards`,
  `bringObjectForward`, `moveObjectTo` (`Collection.ts:178-262`), on `Canvas`
  *and* `Group`. That is `editor/src/commands.ts`'s `reorderNode`.
- **Locking** — `lockMovementX/Y`, `lockRotation`, `lockScalingX/Y`,
  `lockSkewingX/Y`, `selectable`, `evented` (`LockInteractionProps.ts`). §61's
  locked node, including the defect where a locked child moves with its group.
- **Group entry and exit** — `Group.subTargetCheck` and `Group.interactive`
  (`Group.ts:56-57`, both defaulting false at `:72-73`), with
  `SelectableCanvas._searchPossibleTargets:945` descending into a collection
  when the first is set. That is the "*an entered group is never left by
  clicking outside it*" defect in [Problem](#problem) — do not write a state
  machine for it.
- **`controlsUtils.changeWidth` / `changeHeight`** (`controls/index.ts:1-6`),
  already cited at stage 4 and confirmed present, wrapped in
  `wrapWithFireEvent` and `wrapWithFixedAnchor`.

**What is genuinely not donated**, so the REPLACE work is narrower than the
migration map said: **grid** snapping and **guide** snapping (§64 requires all
three independently), the §51/§53 artboard fit maths, the text layout options
[Text](#text-satisfies-89-with-bounded-work) lists, and the typed chart object.

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

`plan.ts` keeps its job and its tests. That is the whole reason this migration is
tractable: it already resolves style, formatted text segments, chart options and
per-frame issues into a flat `ScenePlan`, and it is unit-tested in Node.
**`mount.ts` is what Fabric replaces** — the 766-line DOM applier, not the
renderer's decisions.

### After stage 3, Fabric owns geometry and the plan owns everything else

*Settled by the review 2026-09-15, because the spec asserted three things that
cannot all hold.* It said `plan.ts` survives **untouched** (above), that the
persisted node tree becomes **Fabric's object format** (stage 3), and that **no
write-back layer** exists ([Acceptance](#acceptance)). Pick any two:

`plan.ts` is a `ThemeNode` → `PlanNode` translator. `buildScenePlan` takes a
`PlanContext` holding a `ThemeDocument` (`plan.ts:178-180`), `planNode` recurses
over `ThemeNode`, and `planBox(node: ThemeNode): PlanBox` derives
`{x, y, width, height, rotation, scaleX, scaleY}` from `node.transform`
(`plan.ts:242-256`). If the persisted tree is Fabric JSON then either plan.ts
reads Fabric JSON, or something converts Fabric JSON into `ThemeNode` on load —
and that converter is the translation engine [the format
decision](#the-scene-is-stored-in-fabrics-format-inside-vigilias-envelope)
rejects, just moved.

**The resolution, which the round-trip wording already implied:** the scene is
revived first and the plan is applied **onto** live Fabric objects.

```text
load:   envelope.scene ──loadFromJSON──▶ Fabric objects (geometry, order, group,
                                         visibility, lock — no conversion)
frame:  ThemeDocument (envelope) ──plan.ts──▶ ScenePlan ──adapter──▶ set() onto
                                         those objects (style, text segments,
                                         chart options, issues)
save:   canvas.toObject() ──▶ envelope.scene        (no read-back of geometry)
```

So, precisely, and each of these is a change to the earlier draft:

- **`PlanBox` stops being the source of geometry** for an existing scene and
  becomes the geometry of a *newly created* node only — the one direction that
  still needs the top-left→centre conversion. `planBox` is not deleted; it is
  narrowed, and that is a change to `plan.ts`, not an absence of one.
- **`PlanNode.children` stops carrying structure.** Fabric's `_objects` is the
  tree. The plan's nesting becomes a lookup, not a hierarchy to build.
- **The adapter's signature is a patch, not a scene**: it reconciles a
  `ScenePlan` against an existing `StaticCanvas`, and creates objects only for
  ids it does not find. Building it the other way — plan in, canvas out — is
  what forces either a converter or a write-back layer, and it is the mistake
  this subsection exists to prevent, because the adapter is the one module both
  ends import.
- **Matching a plan node to a Fabric object requires an id in the format.** See
  [Node identity](#node-identity-is-part-of-the-format).

§105 still holds and still gets truer: one adapter, imported by both ends.

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
   and builds chart options — 692 pure, tested lines that are the most valuable
   thing in the repo. It reads a `ThemeDocument`. Make raw Fabric JSON the
   whole format and either it is rewritten, or Fabric JSON is converted into
   what it reads on load — and that converter *is* the translation engine, just
   moved to a worse place. The `ThemeDocument`→render direction is not work to
   be avoided; it already exists and passes.
2. **Fabric's format carries a library version but no product semantics and no
   refusal.** *Corrected by the review 2026-09-15 — the earlier draft said
   Fabric's format "has no version and no migration story", and both halves are
   false.* Measured: `toObject()` emits `"version": "7.4.0"` on **every object
   and on the canvas**, and `fabric/extensions` ships
   `installOriginWrapperUpdater` specifically to carry old `originX`/`originY`
   data across the 6→7 default change — the very change cited as proof no
   migration existed.

   The argument that survives is narrower and still decides it. §141 requires an
   unsupported version to **fail cleanly, naming both versions, never
   half-loading, leaving the library unchanged**. Fabric's `version` is a
   *library* stamp: nothing reads it, nothing refuses on it, and it says nothing
   about Vigilia's own semantics — bindings, tokens, typed settings — which
   change on their own schedule. So the envelope keeps `schemaVersion` and keeps
   the refusal. What changes is that **the Fabric version is not written
   twice**: see the mechanism below.

**The mechanism that makes this safe**, because a comment would not: the
envelope records the **Fabric major version** the scene was written with (§134),
every object is written with an explicit origin (`center` — see
[Origin](#origin)), and a Fabric major upgrade is treated as a **schema
migration** — `schemaVersion` bumps, and a scene from an older Fabric major is
refused rather than guessed at (§141). The version is pinned exactly (`7.4.0`),
not by range.

**The recorded version is checked against the one Fabric wrote, not stated
independently** *(review 2026-09-15)*. §134 asks the envelope to record it;
AGENTS.md forbids declaring the same fact twice. Both hold if the envelope's
field is asserted equal to the `version` string Fabric itself put in the scene
JSON, by a test. Without that assertion the two drift — a scene edited by a
build whose envelope was written by another leaves the envelope claiming 7 while
the objects say 8, and the refusal above then fires on the wrong evidence or not
at all.

**Origin explicitness is also what makes Fabric's own updater usable.**
`originUpdaterWrapper` reads `originX`/`originY` off the serialised object,
deletes them, constructs, then `setPositionByOrigin`. Its README warns that if
you exported with defaults stripped you must tell it what your defaults were —
i.e. it has to guess. Because Vigilia always writes the origin, it never guesses:
on a Vigilia scene the wrapper is an exact no-op today and an exact migration at
a Fabric 8 default change. That is a stronger reason for the `toObject` override
than "§134 says explicit", and it is the reason it must not be removed as
redundant.

So §134 keeps its rule and narrows its scope: **the format is ours, and the
renderer's object serialisation is a sanctioned part of it** — cited by version,
inside an envelope that can refuse it. What stays forbidden is the thing §134
was written against: a bare editor-library dump as the whole document, with no
version, no semantics and no way to refuse it.

### Settle before stage 3

*Added by the review 2026-09-15.* Three questions were left inside the stage
that **freezes the format**. Each is a sentence to decide now and a migration of
every saved theme to decide later, so stage 3 does not start until all three are
written down here.

#### Node identity is part of the format

**Fabric persists no id, and stage 1 does not add one.** Measured: `Rect`'s
`toObject()` emits 33 keys and none is `id`; `new Rect({ id: 'node-7' })` drops
it entirely, because `toObject` picks from a fixed list plus
`customProperties`. `CHART_SERIALISED_KEYS` is `['family', 'settings']`.

Everything Vigilia has keys on `ThemeNode.id`: `Binding` lives on the node,
`PlanIssue.nodeId`, `buildLayerTree`, `describeSelection`, `findNode`,
`collectIds`, and the E2E suite's `data-node-id` hooks. The envelope keeps "the
semantic layer (bindings, palette and typography references, typed chart
settings)" — a per-node structure that must be keyed by *something*, beside a
tree that carries no key. And [the plan applied onto live
objects](#after-stage-3-fabric-owns-geometry-and-the-plan-owns-everything-else)
needs the same key to match a plan node to the object it configures.

Matching by position in `_objects` fails on the first insert: save a scene with
a bound chart, insert a rectangle at index 0, reload, and every binding is one
node out — silently, with no issue raised, because each id still resolves to
*some* node.

**So: `id` is a custom property on every persisted class, required, and a
round-trip test asserts it survives.** Note it does not fit the
authored-values rule below — an id is neither authored nor derivable — so that
rule has three categories, not two: authored configuration (persisted),
derived state (never persisted), and **identity** (persisted, generated once,
never edited).

#### Whether defaults are stripped is a format decision, not a default

`includeDefaultValues` defaults to **`true`** — `StaticCanvasOptions.ts:167` and
`shapes/Object/defaultValues.ts:86`. Measured on one chart:

| | keys emitted |
|---|---|
| defaults stripped | 10 — `family, height, left, originX, originY, settings, top, type, version, width` |
| **defaults on (today's behaviour)** | 33 — adds `angle, backgroundColor, fill, fillRule, flipX, flipY, globalCompositeOperation, opacity, paintFirst, scaleX, scaleY, shadow, skewX, skewY, stroke, strokeDashArray, strokeDashOffset, strokeLineCap, strokeLineJoin, strokeMiterLimit, strokeUniform, strokeWidth, visible` |

Neither is free:

- **On** — the document is ~3× larger and every object bakes in 7.4.0's default
  *values*. [Origin](#origin)'s `toObject` override is then dead on the real
  save path, which is how it gets deleted as redundant by someone who then turns
  stripping on.
- **Off** — `_removeDefaultValues` exempts only `left`, `top` and `type`
  (`Object.ts:1868`), so **every** built-in class loses any property equal to a
  Fabric default. A `Rect`, `FabricText` or `Group` authored at
  `originX: 'center'` loses its origin and §134's condition stops holding for
  everything except the chart. The only fixes are subclassing three built-ins or
  patching `classRegistry` — both of which contradict [Acceptance](#acceptance)'s
  "nothing is hand-written that Fabric donates".

Whichever is chosen, it is chosen **here, once**, and a test asserts the exact
emitted key set for one object of each persisted class — not a subset match. A
`toMatchObject` cannot see a key that should not be there.

#### Fabric's own properties need the same rule as Vigilia's

[Only authored values](#the-scene-is-stored-in-fabrics-format-inside-vigilias-envelope)
governs `customProperties`. Nothing governs the properties **Fabric** writes,
and two of them are exactly what `renderScale` was excluded for. `Group.toObject`
(`Group.ts:578-596`):

```ts
return {
  ...super.toObject(['subTargetCheck', 'interactive', ...propertiesToInclude]),
  ...(layoutManager.strategy !== 'fit-content' || this.includeDefaultValues
    ? { layoutManager } : {}),
  objects: this.__serializeObjects('toObject', propertiesToInclude),
};
```

`subTargetCheck` and `interactive` are **editor interaction state**, forced into
the output unconditionally. And with defaults on, **every group carries a
`layoutManager`**, pinning Fabric's layout-strategy names into a portable
document.

**So: the persisted surface is an allow-list over Fabric's own keys too**, and
the same per-class key-set test asserts it. "The renderer's object serialisation
is a sanctioned part of the format" sanctions geometry, order, grouping,
visibility and lock — not engine internals and not which objects the editor
lets you click into.

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

**A second door into the same defect, and it is open** *(review 2026-09-15)*.
Fabric's `toObject` copies custom properties **by reference**, measured:
`chart.toObject().settings === the live settings object`. So a snapshot taken at
T1 shares `settings` with the object, an in-place settings edit at T2 rewrites
the T1 snapshot, and undo restores the *new* value — the same stale-reading
failure this section is about, arriving through aliasing rather than through
derivation. Latent today (the settings type is `readonly` and history is an
immutable document), live from stage 4, where canvas snapshots and chart-settings
editing coexist. **Either clone in `toObject`, or assert that the settings path
is replace-only and never mutates in place.** Anything with object-valued custom
properties inherits this, so the decision belongs beside the rule above rather
than in the chart.

### Groups: §137's no-geometry clause is rescinded, and Fabric's group is the group

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
stacking" — and the no-z-index consequence the schema draws from it
(`theme-document.schema.json:41`) — is cited 30-odd times across specs, schema,
renderer and editor, and none of it changes: Fabric renders `_objects` in order.
Only the sentence about a group having no geometry goes.

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

**It also retires `arrange/commands.ts`'s shear refusal, which the earlier draft
missed** *(review 2026-09-15)*. That file's module comment (`:23-45`) derives,
at length, that composing `R(a)·S(g) · R(b)·S(c)` collapses back into
`{rotation, scaleX, scaleY}` only when the outer scale is uniform or the inner
rotation is zero — "otherwise the product is a **shear**, and no
`{rotation, scaleX, scaleY}` expresses it, so `ungroupNodes` refuses and says
why". That derivation exists because *Vigilia's* transform cannot hold a shear.
Fabric's can: it composes matrices, carries `skewX`/`skewY`, and
`Group._exitGroup` already performs the general write-back through
`applyTransformToObject` (`Group.ts:426-437`).

So `groupNodes`, `ungroupNodes`, `ArrangeRefusal` and `describeRefusal` are
**superseded, not adapted** — see the corrected migration map. Two more passing
tests invert with them, named here rather than discovered:
`editor/src/arrange/commands.test.ts` and `editor/src/arrange/index.test.ts`,
wherever they assert a refusal. Neither is a regression when it flips; a refusal
that no longer has a cause is a defect.

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
| `editor/src/selection/` multi-select | **DELETE** | Fabric's `ActiveSelection`, which is transient and bakes its transform onto children on deselect. Group **entry and exit** comes with `Group.subTargetCheck` + `interactive` — do not write a state machine |
| `editor/src/arrange/commands.ts` — `groupNodes`, `ungroupNodes`, `ArrangeRefusal` | **DELETE** *(was ADAPT)* | Fabric's `Group`, `LayoutManager` and `applyTransformToObject`. The shear refusal has no cause once a group has geometry — see [Groups](#groups-137s-no-geometry-clause-is-rescinded-and-fabrics-group-is-the-group) |
| `renderer-core/src/scene/mount.ts` (766) | **REPLACE** | → `scene/fabric-adapter`, shared by both ends. Reconciles a `ScenePlan` **onto** a canvas; see [ownership](#after-stage-3-fabric-owns-geometry-and-the-plan-owns-everything-else) |
| `editor/src/snapping/` (347) — object snapping | **DELETE** *(was REPLACE)* | `AligningGuidelines` from `fabric/extensions`, subject to the bundle experiment. Rotation snapping is `snapAngle`/`snapThreshold` |
| `editor/src/snapping/` — **grid and guides** | **REPLACE** | §64 wants all three independently and Fabric donates only object snapping. This is the part that is genuinely ours |
| `editor/src/commands.ts` (362) — `reorderNode` | **DELETE** *(no row before)* | `Collection.bringObjectForward` and friends (`Collection.ts:178-262`), on `Canvas` and `Group` |
| `editor/src/commands.ts` — `setNodeFlags` | **ADAPT** *(no row before)* | `visible` plus `lockMovementX/Y`, `lockRotation`, `lockScalingX/Y`, `selectable`, `evented` |
| `editor/src/commands.ts` — the rest | **ADAPT** *(no row before)* | `updateTransforms`, `updateStyle`, `renameNode`, `deleteNodes`, `insertNodes`, `findNode`, `collectIds` retarget onto Fabric objects. **The map omitted this file entirely**; it is most of what stage 4 touches |
| `editor/src/arrange/commands.ts` — align, distribute | **ADAPT** | Stay ours; they operate on Fabric bounds instead of `placeNodes` |
| `editor/src/document/history.ts` (223) | **KEEP** | Immutable document + structural sharing. Explicitly **not** replaced by canvas-snapshot diffing |
| `editor/src/actions.ts`, `keyboard.ts` | **KEEP** | Declare-then-generate already works |
| `editor/src/inspector/`, `layers/`, `globals/` | **KEEP** | Declarative descriptors over `capabilities.ts` and `settings-fields.ts`. See below |
| `renderer-core/src/scene/plan.ts` (692) | **ADAPT** *(was KEEP, untouched)* | Keeps its job, its purity and its tests. `planBox` narrows to newly created nodes and `PlanNode.children` stops carrying structure — see [ownership](#after-stage-3-fabric-owns-geometry-and-the-plan-owns-everything-else) |
| `renderer-core/src/charts/*` (1,612) | **KEEP** | `buildLineOption` and friends already emit engine options from typed settings |
| `renderer-core/src/artboard.ts` (236) | **ADAPT** | Feeds Fabric's `viewportTransform` instead of a CSS transform. §51/§53 fit maths is not something Fabric has |
| `renderer-core/src/theme/*`, `data/*`, host, providers | **KEEP** | The domain |

**The property panel is not donated and there was never anything to port.** The
reference editor's property UI is 4,217 lines of hand-wired DOM against fixed
element IDs, demo-only, and excluded from its own published package. Vigilia's
`settings-fields.ts` + `capabilities.ts` + `inspector/model.ts` are a
*declarative* descriptor model that already satisfies AGENTS.md's "nothing is
declared twice". They are kept and re-skinned, not replaced — the panel's chrome
changes, the descriptors do not. *(The earlier draft cited "§2" here; plan.md
has no §2, and the AGENTS.md section numbering it referred to was retired on
purpose — `status.md` records that citations by number are what drifted.)*

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
  family plus §89's fixed boxes. These are §85 gaps and **are not yet listed
  there** — the earlier draft said they were, and §85 still lists only two open
  gaps, gauge ring gradients and line thresholds *(review 2026-09-15)*. Adding
  the four is stage 5 work, and §85 also requires **human agreement on each
  alternative before committing**, which has not been sought. Note the scope
  stretch while doing it: §85 is written about the *chart engine*, and these are
  canvas-text limits.
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

**This is a regression against §116, which the earlier draft did not connect**
*(review 2026-09-15)*. §116's division of labour assigns "GIF/video decoding"
to the phone display, and `AssetReference.kind` already admits `'gif'`. So the
deferral is not a feature that has not arrived; it is a declared capability that
stops holding, on a node type the schema accepts. Say so where a theme author
reads it, or the first animated GIF import is a silent freeze rather than a
stated limit.

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

   **Reviewed a second time 2026-09-15, independently.** The object itself held
   up: the `toObject` origin override was confirmed load-bearing by falsifying
   it (`FabricObject.prototype.toObject.call(chart)` with
   `includeDefaultValues = false` emits no origin), `fromObject` is genuinely
   not overridden, `getDefaults()` composes correctly up the
   `FabricObject → InteractiveFabricObject → FabricObject` chain, and every
   Fabric source citation in this spec resolves. Four defects around it carry
   into stage 2, listed there. One narrow hole worth a comment rather than a
   change: `ChartContent` is a discriminated union, so
   `keyof ChartContent` yields only the keys common to all four families — the
   `AssertNever` guard cannot see a key added to **one** family, which would be
   dropped from the persisted object in silence.
2. **Player.** `scene/fabric-adapter` + `StaticCanvas`; artboard transform to
   `viewportTransform`; size gate re-measured. The adapter converts `PlanBox`
   top-left to Fabric's centre origin — the only place that conversion exists —
   and wires `canvas.on('object:removed')` to `dispose()`, because
   `canvas.remove()` does **not** call it (`Collection.ts:68`) while
   `destroy()` does (`StaticCanvas.ts:1473`). `mount.ts`'s `chartRenderer`
   option and the player's `?renderer=svg` go with `mount.ts`.

   **Also in this stage, found by the review and all cheap** — none of them is
   worth its own stage and all four are in stage-1 code:

   - **`grid.containLabel` has been inert app-wide, and two unit tests assert
     it.** Mounting a real line chart prints `[ECharts] Specified
     grid.containLabel but no use(LegacyGridContainLabel); use grid.outerBounds
     instead`. `line.ts:221` and `bar.ts:203` set it; **none** of
     `chart-engine.ts:35`, `player/src/main.ts:58` or `editor/src/main.ts:80`
     registers it, so axis labels reserve no space anywhere. `line.test.ts:201`
     and `bar.test.ts:144` pass regardless — a test asserting a key rather than
     a behaviour. Either `echarts.use([LegacyGridContainLabel])` (exported from
     `echarts/features`, verified present) or move the builders to
     `grid.outerBounds`. Do it while `chart-engine.ts` is still the only
     consumer.
   - **`StaticCanvas.loadFromJSON` has no test**, only `VigiliaChart.fromObject`
     does — yet the canvas path is what stage 3 depends on, and it is the one
     that needs `classRegistry.setClass` to have run and the `sideEffects`
     declaration to have survived bundling. `package.json`'s comment names
     `chart-object.dom.test.ts` as the thing that would catch a regression; it
     would not. Confirmed working during review; add the ~7-line test.
   - **CI does not typecheck `scene-fabric`.** `ci.yml:39-44` enumerates five
     projects by hand while `npm run typecheck` runs six. AGENTS.md says why
     that shape is wrong, and the step's own comment ("Five projects, not four")
     shows it has failed this way before. A type error in `chart-object.ts`
     passes CI today. Use the npm script.
   - **`jsdom` and `canvas` are undeclared.** Both are **optional** dependencies
     of `fabric@7.4.0`, and `chart-object.dom.test.ts` — the only test that
     mounts a chart or exercises the origin override — needs both. `canvas` is
     native; if its prebuild is unavailable npm continues silently and the test
     environment quietly loses its 2D context. Declare both as devDependencies,
     which also puts them through the licence job.
3. **Document bridge.** `ScenePlan` → Fabric for every `PlanContent` kind, and
   the persisted scene moves to Fabric's object format inside the envelope:
   `toObject`/`loadFromJSON` round-trip, the Fabric major version recorded,
   `schemaVersion` bumped, an older scene refused. A Fabric `Group` is
   persisted with its geometry, per the §137 reversal above. **No write-back
   layer** — that is what adopting the format removes.

   **Preconditions, not deliverables.** [Settle before stage
   3](#settle-before-stage-3) must be written down first: node identity,
   whether defaults are stripped, and the allow-list over Fabric's own keys.
   Also settled before the adapter is written, at stage 2: [who owns
   geometry](#after-stage-3-fabric-owns-geometry-and-the-plan-owns-everything-else),
   because it decides the adapter's signature.

   **And one propagation this stage owns.** §134 and §137 were rewritten on this
   branch — §134's "editor-library JSON … is not the theme format" clause was
   deleted, not narrowed. **18 in-code citations of §134 and 15 of §137** now
   resolve to changed or inverted text, in `schema/theme-document.schema.json`,
   `renderer-core/src/theme/document.ts`, `theme/serialize.ts`,
   `editor/src/commands.ts`, `layers/tree.ts`,
   `selection/domain/hit-test.ts` and others. Re-read them against the new
   wording; most §137 citations mean the surviving stacking clause and are fine,
   which is exactly why the few that are not will not be noticed otherwise.
4. **Editor.** Interaction moves to Fabric; the `DELETE` rows go; snapping
   reimplemented; panels re-skinned onto the existing descriptors. Resize uses
   Fabric's own `controlsUtils.changeWidth`/`changeHeight` rather than a
   hand-rolled handler — that is how `Textbox` re-lays out instead of scaling,
   which is what a chart needs. This stage also carries the §137 reversal into
   the editor: `capabilities.ts` gives a group its transform rows back, spec
   0011's D2 is rewritten, and `resize-children.ts` and its import go.

   **Start with the bundle experiment**, because it decides how much of this
   stage exists: build the editor importing `AligningGuidelines` from
   `fabric/extensions` and measure whether it double-bundles Fabric. If it does
   not, object snapping and the group entry/exit machinery are adoptions rather
   than rewrites, and `arrange/commands.ts`'s group half and
   `commands.ts`'s `reorderNode` delete rather than port — see the corrected
   migration map.

   **Four passing tests assert the old rules and will invert here**, so they are
   named rather than discovered: `renderer-core/src/theme/capabilities.test.ts`
   ("presents no geometry at all"), `editor/src/inspector/model.test.ts`
   ("No geometry: a group's transform is its children's values"), and
   `editor/src/arrange/commands.test.ts` plus `editor/src/arrange/index.test.ts`
   wherever they assert the shear refusal. None is a regression when it flips.
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
- **The E2E suite keys on `data-node-id` and `data-vigilia-*` in 233 lines and
  71 `expect()` calls** — `display.spec.ts` 67 lines, `editor.spec.ts` 166
  *(counted 2026-09-15; the earlier figure of "57 structural assertions" was
  low)*. A Fabric canvas has no per-node DOM, so a large part of the safety net
  for stages 3–4 stops applying exactly when it is most needed. Pixel-level
  assertions are not an option here (CI is Linux, development is Windows).
  Replacing those hooks with canvas-level probes is stage 3 work and must not be
  deferred past it.
- **That replacement lands on a suite that is already unreliable.**
  `status.md` records the browser suite needing three attempts, with the flakes
  unexplained — "a suite that needs three attempts is a suite that can hide a
  real failure". Canvas-level probes are harder to trust than DOM assertions,
  not easier, so **diagnose the flakes before stage 3 rewrites the assertions**,
  or the two failure modes become indistinguishable.
- **`renderScale` needs a hard cap, and the cap must be on *area*.** One
  300×180 chart re-rasterised at viewport zoom 4 cost 13.18 MB. A cap on the
  *factor* does not bound memory, because cost is `width × height × scale²` —
  at a factor ceiling of 3 a 1200×800 chart reaches 8.6 M px. So there are two
  ceilings, whichever is lower: the factor, and the backing store's pixel area.
  The area ceiling never returns less than 1: below that it buys memory with
  resolution the author asked for, and a chart too large to afford at 1× is a
  layout problem that should be visible rather than quietly blurred.
- **A Pixel 3 dashboard's total canvas memory measured 11.59 MB** at
  `renderScale` 2, and that is a number §126 would want a budget for. Two
  corrections to how the earlier draft put it *(review 2026-09-15)*: §126 is
  **in force**, not "dropped" — its own words are "a deliberate deferral, not a
  dismissal", which is the framing "dropped" was written to pre-empt; and §126
  requires budgets on **named reference hardware**, while 11.59 MB is Chromium
  emulation. So this is a reason to reopen §126, not a budget ready to adopt.
- The `fabric/es` subpath is the only tree-shakeable entry, and writing bare
  `fabric` costs 45 KB gzip silently. The boundary test in stage 1 exists
  because the size gate has ~199 KB of slack and would not notice.
- **The boundary test has three holes, one of them in an assertion**
  *(review 2026-09-15)*. `namedBindings('* as fabric')` returns `[]` and the
  test asserts that as intended, so `import * as fabric from 'fabric/es'` then
  `new fabric.Canvas(el)` passes the `Canvas` rule. Its regex also requires
  `from`, so `import 'fabric'` and `await import('fabric')` are invisible — and
  a dynamic import is the plausible one, since lazy-loading the interactive
  canvas is a natural editor optimisation. Reject namespace imports of `fabric*`
  outright and widen the regex to `import(`. Also: the test's own comment claims
  `fabric/extensions` "would drag in code a browser bundle cannot use", which is
  **false** — it is browser editor code. The rule is still right for the display
  packages; the reason is not, and that comment is what stage 4 reads before
  deciding whether it may use `AligningGuidelines`.
- **Every performance figure here came from prototypes that no longer exist.**
  Two are load-bearing enough to re-measure before the stage that depends on
  them, rather than at the end: `renderAll` at **0.28 ms mean / 0.86 at DPR
  2.75**, because it is the entire reason "no dirty-rectangle path" is
  acceptable and it was taken with 4 live charts and 10 static objects rather
  than a real dashboard (stage 2); and the video **22.9–28.2 ms p50 at 4× CPU
  throttle**, because it is the sole basis for a DOM layer and therefore for a
  schema change that deletes the `video` node type (stage 7). The
  `objectCaching` and `fabric/es`-versus-`fabric` figures need no re-measuring:
  both decisions hold at any plausible number.

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

  **And, added by the review**: object snapping through `AligningGuidelines`
  rather than a reimplementation, rotation snapping through `snapAngle`, z-order
  through `Collection`'s own methods, locking through `lockMovement*` /
  `lockScaling*` / `lockRotation`, group entry and exit through
  `subTargetCheck` + `interactive`, and group/ungroup through `Group` +
  `applyTransformToObject` rather than through a shear-refusal that no longer
  has a cause. Each of these had a row in the migration map scheduling it as
  work. **The check is a grep, not a judgement**: for every `DELETE` and
  `REPLACE` row, name the Fabric API that replaced it, or say why none exists.

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
  at. Asserted by a test that feeds it a scene claiming another major. **A
  second test asserts the recorded version equals the `version` Fabric itself
  wrote into the scene JSON** — otherwise the same fact is declared twice and
  drifts.
- **No write-back layer exists.** If stage 3 ends with code copying
  `left`/`top`/`angle` off Fabric objects into a parallel node tree, adopting
  the scene format bought nothing and the decision should be re-argued rather
  than worked around.

Added by the review 2026-09-15:

- **Every node's identity survives a round-trip**, and a plan node is matched to
  its Fabric object by that id and never by position. Asserted by inserting an
  object at index 0 between save and load and checking that bindings still land
  on the right node — the failure that matching by position produces silently.
- **The persisted key set is asserted exactly, per persisted class**, not as a
  subset. `toMatchObject` cannot see a key that should not be there, and the
  keys that should not be there are `subTargetCheck`, `interactive`,
  `layoutManager` and whatever the next Fabric minor adds to `toObject`.
- **No editor or device state is in the format.** `renderScale` already passes
  this; `subTargetCheck` and `interactive` currently would not.
- **A whole-canvas `loadFromJSON` revives every persisted class**, not just
  `VigiliaChart.fromObject`. That is the path a saved theme actually takes.
- **A chart's axis labels reserve space**, asserted by a rendered measurement
  rather than by reading `option.grid.containLabel` back. The key has been set
  and ignored app-wide, under two green unit tests.
- **Mutating a chart's settings does not change a snapshot taken earlier.**
  Custom properties serialise by reference today.

## Open, and not this spec's to close

**Refuse or migrate, on a Fabric major bump?** §134's second condition and
`decisions.md` both say **refuse** — a user decision on 2026-09-15, taken on the
premise that Fabric has no migration story. That premise is false: Fabric emits
`version` on every object and ships `installOriginWrapperUpdater` for exactly
the 6→7 origin change, documented as "run the install once in that session" when
the version tag shows data needs updating.

With `SUPPORTED_SCHEMA_VERSION = 1` and `validate.ts:354` refusing anything
unequal, a Fabric 8 bump makes **every saved theme unopenable** — and Vigilia
writes origins explicitly, which is precisely the condition under which Fabric's
wrapper needs no guess and is exact.

Refusing rather than *guessing* remains right. Refusing rather than running the
library's own versioned, documented migrator is a different choice, and it costs
every saved theme. **Not changed here** — it reverses a user decision, and
§157 puts that outside an agent's call. Raised with the evidence so it is
decided before stage 3 bumps `schemaVersion` for the first time and sets the
precedent.
