# 0020 — A line gets two endpoints and its own rotation

- **Date:** 2026-10-01
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/controls-manager/renderers.ts`

Discharges rungs 4 and 5 of vg-021, which the plan required before any build.
Rung 3 is corrected here too: it claimed Fabric ships no per-vertex line
controls, and that is **stale** — see below.

## The problem

A selected `Line` shows Fabric's bounding box: eight corners, two edge midpoints,
a rotation handle. For a line that is the wrong shape of control. The diagonal
box makes alignment and snapping useless (the object's own box is a rectangle
around a diagonal), and it crops both ends when the border is thick.

The user corrected the ask on 2026-09-29: **two end handles *and* a rotate
handle**, not end handles alone — end handles alone would leave a line
unrotatable, because the diagonal box is what currently provides rotation. So
this is a complete transform set for `Line`, not a reduction of one.

## Rung 1 — Vigilia

Searched: `controls-manager/renderers.ts` (`ROTATE_DIAMETER`, `ROTATE_BACKGROUND`,
`roundedHandle`), `snap-manager/*`, `canvas-nudge.ts`, `shortcut-manager`.

Found: `renderers.ts` is 83 lines and owns the handle rendering vocabulary
already.

**Two claims the row carried are false, measured on the running editor's own
line rather than read off the docs.** First: this project's `Line` is
`x1, y1, x2, y2` — four scalars, no `points`, no `pathOffset`, no
`setDimensions`. Fabric's `Line` and its `Polyline` are different classes, and
the polyline material below is about the *other* one. Second: nothing in
`snap-manager` reads either representation; snapping works on bounding boxes.
A moved endpoint therefore rewrites four scalars, not a point array — simpler
than the row assumed, and for a different reason.

**Shift, searched the same day:** it is plumbed everywhere and **branched on in
exactly one place** — `canvas-nudge.ts` gives it one job, a larger arrow-key
step. `scale-snapping-resolver.ts` validates it is a boolean without ever
branching. So Shift-to-constrain-the-angle reuses a modifier that is currently
free, and does not change any existing behaviour.

## Rung 2 — dependencies

Found: Fabric 7.4.0 is the only rendering dependency and it already ships the
mechanism (rung 3). No new package.

## Rung 3 — platform

Searched: Fabric.js docs for `Line`, custom controls, polyline controls.

**The earlier rung-3 note is wrong and is corrected here.** Fabric exports
`createPolyPositionHandler(pointIndex)` from `controls/polyControl.ts`, and its
polygon demo does exactly this shape: one control per point, each carrying a
point index, a custom position handler to place it, and a custom action handler
that writes `fabricObject.points[index]` and then holds the object still by
anchoring on a point that is not the one being dragged.

What Fabric does **not** ship is this as a *default transform set* — its poly
controls are an explicit edit mode, entered and left deliberately. The plan's
claim that "Fabric ships no per-vertex line controls" was true of the default
control set and false of the library.

**For this object none of that machinery applies**, and the note that first
proposed it got the class wrong. `Line` stores four scalars, so an endpoint
handle writes `x1/y1` or `x2/y2` directly, and the anchor technique Fabric
documents for polylines is not needed: there is no path offset to re-derive.

What does transfer is the *lesson*, and it is the Konva one rather than
Fabric's: do not configure the bounding box, bind handles to the geometry. Here
that reads as a control set of two endpoints plus rotation, with each endpoint's
fraction read from `x1/x2` and `y1/y2` so a line drawn right-to-left still puts
a handle on each end.

## Rung 4 — ecosystem

Searched: Konva `Transformer` with `enabledAnchors` for lines; the Konva forum
question asking for exactly this (drag, rotate and resize a line); a
from-scratch rebuild of Konva's rotation UX.

Found, and it settles the question:

- **Konva's own community answers "do not use the Transformer for a line."** The
  closest available answer is `enabledAnchors: ['middle-left','middle-right']`,
  and the report on it is that it is not intuitive — *"requires a user to
  separately rotate and resize the line using the rotate, middle-left and
  middle-right anchors"*, when the expectation (from PowerPoint) is that the end
  handles do both.
- **The recommended pattern is two draggable circles bound to the point list**,
  with `dragmove` writing `line.points([...])`. That is the whole answer, and it
  is not a workaround — it is what the library's own users converged on when the
  library declined to do it.
- A third source rebuilds rotation from first principles for the same reason
  and lands on the same shape: eject interaction from the library, keep the
  shapes dumb, hold rotation state in the application.

Nobody solves the bounding-box problem by configuring the bounding box.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Konva `Transformer` + `enabledAnchors` | Partial — still a box, still rotates separately | config only | The author rotates then resizes, which is the complaint | rejected |
| Two draggable endpoints writing `points` | Exactly the ask; the converged pattern | ~30 lines | None — it is the documented approach | **pattern to copy** |
| Fabric poly controls as shipped | Right mechanics, wrong mode: entering and leaving an edit state | reuse | A line author would have to enter a mode to move an end | rejected for the mode, reused for the handler |
| Keep the bounding box | Current | none | The reported defect | rejected |

## Decision

Two endpoint controls plus the rotation handle the editor already renders, as
the default control set for `Line`. Each endpoint reads its own corner from
`x1/x2` and `y1/y2` rather than assuming top-left and bottom-right, because
`width` and `height` are absolute values: a line drawn right-to-left has its
first endpoint at the box's bottom-left. The action handler writes the four
scalars. Shift constrains the angle, on a modifier that currently branches in
one unrelated place.

The Konva outcome is the load-bearing part of the search: two independent
sources reached for the bounding box and were told to build two anchors instead.
That is a solved shape, not a novel one.
