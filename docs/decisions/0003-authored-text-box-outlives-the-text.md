# 0003 — The authored text box is stored beside the text, because Fabric will not hold it

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/renderer-core/src/theme/document.ts`,
  `src/web/packages/renderer-core/src/theme/validate.ts`,
  `src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts`,
  `src/web/packages/scene-fabric/src/persist.ts`

## The problem

A theme author sizes a text object to a card. A sensor reading changes every
frame, and Fabric's `Textbox` widens to its longest unbreakable run
(`fabric/dist/index.mjs:18453`, `if (this.dynamicMinWidth > this.width)
this._set("width", this.dynamicMinWidth)`) and never narrows. The starter's
`ram-value` is authored 180 wide; the editor's authoring token
`@ram.used.percent%` is 566.9 wide, so the first paint widens the box to
566.9 and it stays there, across every save and both mounts.

Two things have to be true and neither is Fabric's to give:

1. **The box is the author's, not a measurement.** A reading that grows a digit
   must not move anything, and the number that survives a save must be the
   number the author typed. §89 already requires this: "Sensor text uses fixed
   boxes by default to avoid jitter."
2. **A resize sticks.** Today it cannot: Fabric's own `changeWidth` control
   writes through `set` (`index.mjs:6737`, `target.set(dimension,
   Math.max(newWidth, 1))`), which re-enters `initDimensions` and undoes the
   drag before the resize event fires.

The shape of the problem is therefore: *where does a box live when the
platform's own text object insists on owning it?*

## Rung 1 — Vigilia

Searched: `scene-fabric/src/{fabric-text,object-type,persist,adapter}.ts`,
`renderer-core/src/theme/{document,validate,fabric-envelope-validate}.ts`,
`editor/src/{live-runtime,run-placeholder,new-fabric-theme-objects}.ts`,
`editor/src/snap-manager/scaling/text-width-resize-controller.ts`,
`editor/src/selection-inspector/runs.ts`, `docs/architecture/ownership.md`,
`docs/product/requirements.md` §89.

Found — the machinery is nearly all there and unwired, which is why the defect
survived several attempts:

- `TextContent` (`document.ts:173-179`) already owns `wrap`, `overflow`,
  `align`, `verticalAlign`. It carries **no width or height**, and
  `vigiliaText` is the only Vigilia-owned field that round-trips the v2 scene
  (`persist.ts:46-55`, `SCENE_PERSISTED_PROPERTIES`).
- `runtimeLayout` (`fabric-text.ts:60-88`) already reads the box back **out of
  the `clipPath`** in preference to measuring the object. `applyClip`
  (`:499-520`) already writes a `clipPath` sized to the box. The box source is
  a wiring gap, not a missing feature.
- The v1 document already has the vocabulary: `Transform`
  (`document.ts:111-120`) carries `x`, `y`, `width`, `height`.
- `applyTextboxWidth` (`text-width-resize-measurer.ts:28-46`) is the editor's
  own width writer and does `textbox.set({ width: nextWidth })` — the same
  self-defeating statement.
- `applyObjectTypePresets` writes no widths; the undo baseline is correct; the
  *saved file* is what carries 566.9.

## Rung 2 — dependencies

Searched: `scene-fabric` and `renderer-core` manifests. `fabric@7.4.0`,
`echarts@6.1.0`. Nothing else ships in either package.

Found: Fabric has no `maxWidth` on `Textbox`. Grepping the installed
`fabric/dist/index.mjs` for `maxWidth` returns 7 hits, all local variables —
`_wrapLine`'s `const maxWidth = Math.max(desiredWidth, largestWordWidth,
this.dynamicMinWidth)` (`:18673`) and the cursor-bounds maths. The `Textbox`
class docstring is explicit about the other axis: "user can only change width.
**Height is adjusted automatically based on the wrapping of lines**"
(`:18410-18413`). So Fabric can hold neither dimension against the text.

## Rung 3 — platform

Searched: `CanvasRenderingContext2D.fillText`, CSS box sizing + `overflow`,
SVG viewports, `TextMetrics`.

Found:

- **Canvas 2D has no text box at all.** `fillText` takes a point; a width is
  always the *result* of a measurement, never a constraint. There is nothing
  native to hold a box, which is why Fabric invented one.
- **CSS** separates them: the box is a block with a fixed `inline-size`, the
  text is content inside it, and `overflow: clip` / `text-overflow: ellipsis`
  says what happens when it does not fit. No CSS property lets content widen
  its own box — that is what `min-content` is *for*, and the author opts into
  it explicitly.
- **SVG** has no `width` on `<text>` either. A fixed box is a nested viewport:
  `<svg x y width height>`, whose bounds come from the element's own
  attributes and whose content the UA stylesheet clips (`overflow: hidden` on
  non-root `svg`, SVG 1.1 §14.3.2). SVG 1.1 §14.3.6 states the separation
  exactly: "A clipping path is conceptually equivalent to a custom viewport for
  the referencing element. Thus, it affects the rendering of an element, **but
  not the element's inherent geometry**."

So on both declarative platforms the box is a **separate stored rectangle**,
and the text is measured *into* it. That is the shape to copy.

## Rung 4 — ecosystem

Searched: Fabric's own issue tracker for a fixed or capped Textbox width
(#2376, #5911, #7981, #3330, discussion #8628); Figma / Penpot / GrapesJS /
InDesign / LibreOffice / Excalidraw text-sizing models.

Found — everyone converges on the same two answers, and the brief's guess is
the right one, with one important refinement.

**The refinement: the mode is separate from the number.** The stored dimension
is a plain number; whether it is a constraint or a measurement is a *mode*.

- **Figma** exposes sizing as a per-axis dropdown: *Fixed* / *Hug contents* /
  *Fill container*. "**Fixed** is always available; typing a number or
  dragging a canvas handle flips that axis to Fixed automatically"
  (`rubychilds/DesignJS` ADR 0006, comparing Figma, Penpot and GrapesJS).
  Penpot's variant: "Sizing is contextual, not stored as a mode … the child
  uses its stored `:width` as an absolute value" — the number is stored, the
  meaning comes from elsewhere.
- **InDesign** `TextFramePreference.autoSizingType` is `OFF` /
  `WIDTH_ONLY` / `HEIGHT_ONLY` / `HEIGHT_AND_WIDTH`, and LibreOffice's
  `TextFrame.FrameIsAutomaticHeight` reads "If 'AutomaticHeight' is set, then
  the object grows if it is required by the frame content". **Growth is
  opt-in; the default frame is a fixed box.**
- **Excalidraw** is the closest analogue — a canvas text editor with sensor-like
  content. `textElement.autoResize` decides which of two things happens in
  `redrawTextBoundingBox`: when it is on, `boundTextUpdates.width =
  metrics.width` (the measurement wins); when it is off, `maxWidth =
  textElement.width` and the text is **wrapped into the stored width**. Its
  bound-text placement then reads the *container's* geometry
  (`getBoundTextMaxWidth` returns `container.width - padding`), never the text's
  — the same arithmetic as `refreshLayout` here.

**Fabric says out loud that it does not do this.**

- Issue #2376 (2015), `inssein` — **not** the issue author, who is `onassar` and
  argues the *opposite* further down the same thread (he wanted the box to
  *grow* to fit the text, and the maintainers landed on breaking words
  instead): "the behaviour that @onassar described originally is what is
  supposed to happen. **The box has a fixed width and should never change.** If
  that doesn't work, it's a bug I haven't seen in my implementation."
- Issue #5911, a maintainer: "**We do not have maxWidth for text.** How that
  would be have when words are too long? clip? stop accepting inputs. It sounds
  a custom implementation for a custom application." The only out-of-the-box
  answer offered is `splitByGrapheme: true` — "this will respect the width.
  But it will break words with any character."
- PR #7981 `feat(Textbox): min/max width` is the attempt to add it: unmerged,
  and abandoned at the v6 port (#8470). 7.4.0 ships without it.
- Issue #3330 shows the community reaching for `dynamicMinWidth` themselves to
  "shrink the textbox width back down" — i.e. treating `width` as a cache, the
  same conclusion this note reaches from the source.

Every workaround on the tracker is a **fork** (`_wrapLine` + `_initDimensions`
patched in place). `AGENTS.md` forbids that, and so does the fact that
`fabric` is a hard dependency rather than a vendored one.

**`splitByGrapheme` was rejected on measurement, not taste.** It does remove
the floor (`dynamicMinWidth` becomes the widest single grapheme), so the resize
would stick — but `_wrapLine` gives up word-preference wrapping entirely
(`infix = ''`, every grapheme its own word), so `"Performance Trends"` in a
420-unit box could break as `"Performance Tr"` / `"ends"`. Trading a card's
titles for a card's readings is not a fix.

**The answer to the brief's question, then:** yes — everyone ends up with a
**stored layout box that the text is measured into**, and the only variation is
whether "measure the box from the text" is offered as a separate *mode*. The
one refinement worth carrying: on CSS and SVG the box is a **separate
rectangle**, never a property of the text object. Fabric is the one platform
that will not allow that, and its own tracker says so.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Author boxes wide enough for the widest token | fixes the symptom, not the contract | 0 | a value is still a measurement; a resize still cannot take effect | rejected |
| `splitByGrapheme: true` | removes the floor, keeps one `set` funnel | ~1 line | destroys word-preference wrapping | rejected |
| Patch/fork `Textbox.initDimensions` | exact | fork | `AGENTS.md` forbids it; `fabric` is a hard dependency | rejected |
| Restore the width after `initDimensions`, in each pass | exact for placement | ~1 line | one `set` (`changeWidth`, `updateText`) still eats a resize; does not survive `loadFromJSON` | partial — kept as the pass-level half |
| **Store the box in `vigiliaText`; re-assert through Fabric's own `set` funnel** | exact; makes resize stick; survives save/reload | ~1 persisted field + 2 validators | older documents fall back to the measured box | **accepted** |

## Rung 6 — probe

Measured on the live editor with a `width` accessor installed on
`FabricText.prototype` before any object was constructed, and again by
replaying the player's call order (both recorded in
`.superpowers/sdd/2026-09-26-reference-theme-fidelity/investigate-width-writer.md`
and `investigate-authored-box.md`):

- 309 recorded width writes. The last is `fabric-text.ts:247` → `Text.set`
  (`index.mjs:16280`) → `Textbox.initDimensions` (`:18447`) → `:18453`.
  **Zero** later writes across ~250 refreshes.
- Editor `ram-value`: authored 180 → 566.9365234375 on the first authoring
  paint. Player, same object: 566.9365. Identical to the last decimal — the
  player inherits the editor's number rather than re-measuring it.
- `object.set('width', 400)` on the live object produced **two** writes in one
  call: 400, then 566.9365234375 from `initDimensions`. `Textbox` includes
  `"width"` in `textLayoutProperties` (`index.mjs:18760`), so a width write is
  itself a reason to re-run `initDimensions`.
- `storage-card-value` rebuilt from its token plus its own per-character
  `styles` measured **391.015625, bit-exact** against the live width. The
  measurement is the authoring token; nothing else reproduces it.

The probe also found the placement: a restore before `fabric-text.ts:254` is
destroyed by that line's `initDimensions()`, and a restore expressed as
`set('width', …)` dies inside its own call. That is why the earlier attempts
saw no change.

## Decision

**`vigiliaText.box: { width, height }` is the owner.** Fabric's `width` and
`height` become caches the box re-asserts, and the box is what
`runtimeLayout` reads — so the clip carries it and nothing consults a
measurement for placement. Both dimensions are required, because Fabric
adjusts height from the line count and a vertical alignment or clip has
nothing to act on without it.

`box` is **optional**. A document saved before this change has no box and
keeps today's measured behaviour; the starter is regenerated on every editor
load, so nothing migrates and no compatibility code is written.

**The `set` funnel, not a patched `initDimensions`.** Every width write that is
an author decision reaches `object.set` — Fabric's `changeWidth`
(`index.mjs:6737`), the editor's `applyTextboxWidth`, `updateText` — and every
one of them is immediately undone by the `initDimensions` it triggers.
Wrapping `set` on the object re-asserts the requested width by direct
assignment on the way out, so the number the author dragged is the number
`object:resizing` reports. Fabric's internal widening goes through `_set`
(`index.mjs:1237`), which is not overridden and so is untouched.

**Not a fork, and not a second scene tree.** The Fabric object stays the
persisted scene; `vigiliaText` is already its authored half, and this adds one
field to it.
