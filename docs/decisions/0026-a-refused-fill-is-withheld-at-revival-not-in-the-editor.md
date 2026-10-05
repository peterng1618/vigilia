# 0026 — A refused fill is withheld at revival, so a display and the editor draw the same thing

- **Date:** 2026-10-06
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/persist.ts`,
  `src/web/packages/scene-fabric/src/object-paint.ts`

## The problem

A circular sweep becomes an arc and a wedge, and **the difference between them is
closure**. Fabric 7.4.0 ships no arc primitive: the whole primitive is
`Circle`, which already owns `startAngle`, `endAngle` and `counterClockwise` and
draws `ctx.arc` between them. So the open sweep needs no geometry.

The closed one is the trap. A fill under `ctx.arc` closes the subpath with a
**straight chord**, so a filled `Circle` from 0° to 90° is a circular *segment*,
not a quarter-disc — measured at 1933 painted pixels against the 5027 a
quarter-disc occupies at radius 80. `Wedge` therefore overrides `_render` to add
the two closing radii.

That produces a shape the product can draw and a shape it cannot, **in the same
document**. An `Arc` may carry a fill in the file and must not be filled on
screen. So something has to refuse it, and the interesting question is **where** —
because there are two surfaces, and a refusal only one of them honours is a
document the editor and the phone disagree about. The plan's own position is that
*the device is a lens on the document*, which presupposes the two agree about what
the document is.

## Rung 1 — Vigilia

Searched: what `reviveScene` already does after `loadFromJSON` (commit `ebe00eae`,
`persist.ts:110-128`); every `applyObjectPalettePaints` call site; whether the
player has any paint path of its own (`grep vigiliaPaint player/src` → nothing);
`adapter.ts` for any paint resolution (zero references); `paintPropertyFor`,
`applyObjectPalettePaints`, `reassignObjectPaletteReferences`, `paintRefs`;
`hasResolvedPaint` in the envelope validator.

Found: **the player resolves no palette paints at all**, and `adapter.ts` resolves
none either. The editor's `applyObjectPalettePaints` is the only paint pass in the
product, and the player never calls it — which is *why* the paint pass could not be
the owner.

The other find is the template for the fix. Before this change `reviveScene`
already restored two things Fabric had clobbered — the artboard clip and
`backgroundColor` — with a comment explaining that Fabric's `loadFromJSON`
*assigns every canvas-level property the document omits*. **A restored `fill` is
the same kind of fact**, and revival is already the function whose job is putting
the canvas back the way the document means.

Also found: `hasResolvedPaint` returns false for an empty fill, so a **retained**
fill reference is validator-clean — which is what makes it safe to refuse the
paint without deleting the author's intent.

## Rung 2 — dependencies

Searched: the installed `fabric@7.4.0` — the full contents of
`dist/src/shapes/` (ActiveSelection, Circle, Ellipse, Group, IText, Image, Line,
Path, Polygon, Polyline, Rect, Text, Textbox, Triangle), `Circle.mjs`'s
`CIRCLE_PROPS`, `Circle._render`, `Circle._toSVG`.
Found: **there is no `Arc`**, and the docs agree independently — the
`FabricObject` class page lists what extends it (Circle, Ellipse, Triangle, Rect,
Path, Polyline, FabricImage) and `Arc` is absent. `grep -rlw Arc` over the whole
`dist/` finds one hit, in `util/path/index.d.ts`, and it is `fromArcToBeziers` — a
utility, not a shape. `CIRCLE_PROPS` already serialises the two angles, so a sweep
round-trips through Fabric's own serializer with no Vigilia-side parsing. **No new
dependency is warranted: the primitive is two properties Fabric already has.**

## Rung 3 — platform

Searched: `CanvasRenderingContext2D.arc()`, the implicit close on `fill()`,
`ctx.clip()`, `Path2D`.
Found: `arc()` leaves the subpath **open**; `fill()` implicitly closes it, and
that closure is a chord. So the platform gives the arc for free and makes the
sector the caller's job — one `moveTo(0,0)` and one `lineTo` are the whole
difference. `clip()` is path-agnostic and inherits the same behaviour, which is
why a wedge's frost had to be given the sector path explicitly (see 0025-era
`sectorPath`). Nothing in the platform expresses the *policy*; it is all geometry.

## Rung 4 — ecosystem

Searched: Context7's Fabric API for an `Arc` class and for `startAngle`/`endAngle`
semantics; the `FabricObject` API page's subclass list; canvas and SVG-editor
recipes for pie slices and sectors in general.
Found: **nobody has this shape of problem, because it is specific to persisting a
document that two surfaces render.** Canvas editors draw a sector and move on —
the path is built per draw and never survives a save. The part that is *not*
solved anywhere in the ecosystem is the one this task hit: what a renderer does
with an authored property it will not honour. The nearest analogue is a
validator refusing a malformed document, which is a different problem with a
different owner — a filled arc is a **well-formed** document that renders
misleadingly.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Refuse in the editor's `applyObjectPalettePaints` | editor correct | smallest | **the display never sees it** — this shipped in `f1491d5a` and was wrong | **rejected** after round 3 |
| Refuse in `validateFabricThemeEnvelope` | would catch a hand-written file | small | puts a *rendering* preference in a trust boundary that names no shape type; and `hasResolvedPaint` already accepts an empty fill, so it would refuse a document the product can open | rejected |
| Refuse in `GLASS_OBJECT_TYPES` | reuses an existing shape policy | tiny | unrelated question: that set answers "is there an interior to sample", not "may this be filled". An arc is refused there already, for the wrong reason | rejected |
| **Refuse in `reviveScene`** | **both surfaces traverse it** | **one call, one predicate** | a product rule sits in Fabric's boundary | **chosen** |
| Rewrite the file at publish time | display never sees it | a second scene model | rewrites the author's document to get the display right | rejected — the document is the document (§134) |

## Rung 6 — probe

**The chord.** A `Circle` of radius 80, filled, `startAngle` 0 / `endAngle` 90,
rendered through `node-canvas` and counted by alpha: **1933 painted pixels**.
The exact area of the chord segment is 1827 and of the quarter-disc 5027. The
figure Fabric draws is the segment, and the gap is not a rounding error — it is
most of the shape.

**The sector.** The same sweep with `moveTo(0,0)` + `lineTo` + `closePath`: **5093
pixels** against 5027 ideal, the excess being antialiased boundary.

**The place the refusal has to live.** With the refusal disabled in
`reviveScene` and the editor's paint pass fully intact, `refused-paint.dom.test.ts`
passed **2/2 green** while the `reviveThemeEnvelope` cases went red. That is the
measurement that settles the question: an editor-side test **cannot** detect this
class of defect, because the editor is not where the defect was.

## Decision

**The fill is refused at revival, in `reviveScene`, and the refusal is one exported
predicate — `refusesFill` — consulted by both surfaces.**

Not because revival is a tidy place for it: because it is the **one function both
surfaces traverse** (`editor-shell.ts` through `reviveScene` and
`reviveThemeEnvelope`; `player/src/main.ts` through `reviveThemeEnvelope`). The
editor's paint pass was tried first and was wrong in a way only a phone could show.

Three things follow, and each was a defect before it was a decision:

1. **The authored reference is kept.** `vigiliaPaint` is in
   `SCENE_PERSISTED_PROPERTIES`, so deleting the key writes into the next save —
   data loss, not a tidy-up. Refusing a fill is not deleting it.
2. **The editor's paint-pass branch stays, and it is load-bearing for the render
   rather than only for the message.** Revival refuses **at the read** — the
   revived arc's own fill is withheld — but the editor runs the paint pass
   *after* `reviveThemeEnvelope` (`editor-shell.ts:474`, then `:488`), and that
   pass reads the **reference**, not the fill revival cleared. Without this
   branch the pass re-resolves the palette colour onto the object and the chord
   is back on the editor canvas while a display stays correct — the very split
   this work closed. Both refusals are therefore load-bearing for the render, and
   every part of the branch is pinned: removing it turns three cases red on
   `back.fill`, and removing the `onRefusedPaint` notification alone turns a
   fourth red on the reported message.
3. **`refusesFill` stays a single `instanceof Arc`.** Two owners would be the defect
   this task spent itself correcting; the new call site restates nothing.

The cost of being wrong: **revival is Fabric's boundary, and a product rule now sits
there.** If a future change needs to distinguish "refused because the kind refuses
a fill" from "no fill was authored", revival is where that has to be added — and
the reference being kept is what makes the distinction recoverable.
