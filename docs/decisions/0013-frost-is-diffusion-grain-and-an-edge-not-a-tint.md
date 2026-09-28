# 0013 — Frost is diffusion, grain and an edge, not a tint

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/glass.ts`,
  `src/web/packages/editor/src/new-fabric-theme-globals.ts`,
  `src/web/packages/editor/src/new-fabric-theme-cards.ts`

## The problem

The frosted CPU card was rejected on sight: *"that looks like just tinted,
semi-transparent fill and nothing like frosted glass."* Mapped against the four
behaviours the material is supposed to have — **diffusion** (a strong blur),
**tint** (a very low-opacity tint that supports contrast without blocking
light), **texture** (a faint grain, as on sandblasted glass), **edge** (a subtle
semi-transparent light border) — the shipped card had two, had one of those
inverted, and was missing one entirely:

| | shipped | verdict |
|---|---|---|
| diffusion | `blur(16px)` in artboard units | weak — the sunset's structure was still legible through the card |
| tint | `palette.frost` = `#081523b8`, **72 %** opaque | inverted: heavy, not "very low opacity" |
| texture | none anywhere in the renderer | absent |
| edge | `palette.panelStroke` = `#9fc7e52b`, 1 px | already inside the ecosystem's 0.14–0.2 band |

## What the measurement says about the tint

The obvious reading — lower the tint until it is "very low opacity" — does not
survive the photograph. The backdrop under the card is the packaged sunset, and
its mean luma under the card's own rect is **110.2**, sharp and blurred alike:
a Gaussian preserves the mean, so no radius changes it. The tint's colour
`#081523` has luma 19.2, so a card at tint `α` reads

```
L(α) = 110.2 − 91α
```

and `#ecf5ff` (luma 242.6) clears WCAG AA at 4.5:1 only while `L ≤ 50.0`, i.e.
**α ≥ 0.66**; the `dim` caption `#a8bed0` (luma 186.6) needs `L ≤ 37.8`, i.e.
**α ≥ 0.80**. The 72 % already shipped is the floor, not a preference — the
ecosystem's own canvas implementation ([html-in-canvas](https://html-in-canvas.dev/demos/frosted-glass-backdrop/),
`rgba(16,16,40,0.35)`) is legible only because its backdrop is a dark room.

The tint is therefore **held**, and the material is fixed in the three places
where it is actually missing. The price is named rather than hidden: this card
is a dark frosted panel, not a milky one, and the reference target's own card
is dark too — mean luma **34.7** inside it, against **56.6** in ours.

## Rung 1 — Vigilia

Searched `packages/*/src` for `noise|grain|dither|createPattern`.

Found: **nothing that generates a texture.** The two hits are prose — a
`required-devices.ts` comment about "noise" and a `fonts.test.ts` comment —
and no `createPattern` call exists in the product at all. The tint, the stroke
and the radius are the only surface properties a card carries, and two of them
live in the starter's palette rather than in the renderer.

## Rung 2 — dependencies

Searched the workspace manifests. The root has no runtime dependencies, and the
packages carry no noise, texture or filter library.

Found: **nothing installed, and nothing worth adding.** `pixlated` (npm) does
exactly this in ~40 lines of `ImageData` writes; `FxFilterJS` does it with SVG
filters. Both are wrappers over the two platform calls below, and one of them
is DOM-only.

## Rung 3 — platform

Searched what the browser already offers for a texture on a 2D context.

Found: **the two calls, and a reason the obvious answer is unavailable.**

- `CanvasRenderingContext2D.createPattern(image, "repeat")` (MDN) with an
  offscreen canvas as the image is the documented way to tile a generated
  texture into a context, and `ImageData` writes the tile directly rather than
  through the shape pipeline.
- Grain reads as grain at any pixel density — the canvas idiom sources size the
  tile at ~35 % of the area and scale it — and must **not** be regenerated per
  frame: 60 Hz reads as flicker, and a settled texture is what a surface is.
- **CSS `backdrop-filter` cannot be used.** It applies to DOM elements; the
  panel is a Fabric `Rect` painted into a `CanvasRenderingContext2D`, and it
  has to stay there because the same path produces `toCanvasElement` exports
  and the player's own surface. The reference implementation found in rung 4
  reaches for a WebGL blur for the same reason.
- `globalCompositeOperation = "overlay"` is the canvas equivalent of
  `mix-blend-mode: overlay`, and the difference it makes is the one that
  matters: a flat translucent grey haze reads as a layer *over* the content,
  while overlay blends each grain value against what is beneath it.

## Rung 4 — ecosystem

Searched how canvas renderers produce a grain surface rather than a
`backdrop-filter` panel.

- **html-in-canvas, "Frosted Glass Backdrop"** — clips the panel, draws a
  two-pass separable WebGL blur, composites a `rgba(16,16,40,0.35)` tint, a
  vertical white gradient at 6 %, and a `rgba(255,255,255,0.14)` 1 px border.
  The blur is WebGL *because* the panel is inside a canvas, which is rung 3's
  finding reached independently.
- **CodeFronts, "Grain Noise Frosted Glass"** — the sharpest statement of the
  mechanism: *"two otherwise identical frosted panels … one over a clean
  gradient, one over the same gradient plus a fine noise layer — the grainy one
  reads as physical etched glass while the clean one looks like a smudge
  filter."* Its recipe is **fine noise over the glass at 8 % with
  `mix-blend-mode: overlay`**, and its edge is 1 px at 14–20 % white.
- **fwdtools, "Canvas Noise Texture Background"** — writes grayscale into an
  `ImageData` buffer instead of per-pixel `fillRect` calls, at a fraction of
  the display resolution, and throttles regeneration because unthrottled noise
  reads as static.

Two independent sources put the surface grain at **8 %** and the edge at
**14–20 %**; the palette's 17 % edge is already there, which is why the edge
row above is the one that passes.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a) a seeded noise tile, `createPattern`, filled over the sampled region inside the panel clip, composited `overlay`** | the ecosystem's recipe, on the platform's two calls | one lazily built 128 px tile per glass instance; one `fillRect` per panel per frame | the tile must be deterministic or it crawls between frames and the two mounts disagree | **accepted** |
| (b) a `fabric.Pattern` fill authored as the panel's paint | authorable, persisted | a new fill kind, a schema value, a published pattern payload, an inspector control | a *fixed* material property would have to be opted into by every author to exist at all, and it would then be a second owner of "what a glass panel looks like" | rejected |
| (c) ship a grain PNG as a packaged asset | no generation cost | an asset, a licence entry, a load, and a 1× tile stretched to 4 K | a decorative texture becomes a shipped dependency of every glass theme | rejected |
| (d) skip the grain | free | — | the one principle that is entirely absent, and the one the ecosystem names as *the* difference between glass and a smudge | rejected |

## Rung 6 — probe

Both mounts, the same card, before and after, read off real captures rather
than off the model:

| | before | after `blurRadius: 40` + grain |
|---|---|---|
| backdrop structure visible through the card | the sunset's band, legible | dissolved into a smooth wash |
| card mean luma (player capture, card rect) | 56.6 | held — the tint is unchanged |
| reference target's card, same rect | 34.7 | the target, for comparison |

The model's floor and the render agree on the tint, which is the claim the
decision rests on; the grain's contribution is visible only as texture, so it is
asserted as a measured variance rather than as a luma.

## Decision

**Frost is diffusion, grain and an edge, and the tint is held at the floor
contrast forces.** `blurRadius` for the card moves 16 → 40, inside both the
published bound of 48 and Task 1's measured-flat 0–64 px band. The grain is a
deterministic 128 px grayscale tile, generated once per glass instance from a
fixed seed, tiled by `createPattern` over the sampled region inside the panel
clip and composited `overlay` at 8 % — the strength both ecosystem sources name.
It rides with the panel rather than the viewport, so panning the camera does not
swim the surface.

The treatment stays `{ blurRadius }`. Grain is a property of the material, not
a dial: authoring it would give every theme a second way to describe the same
surface and put the material's look in two owners.

## Revisit when

A theme can author a frosted panel with no backdrop, or over a video. Then the
grain is the only thing that distinguishes the panel from a fill, and its
strength may want to be authored after all. Also revisit if a mount's DPR
exceeds 2, where a 128 px tile is stretched far enough to read as a grid.
