# 0013 — Frost is diffusion, grain, saturation and an edge, over a low tint

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/glass.ts`,
  `src/web/packages/editor/src/new-fabric-theme-globals.ts`,
  `src/web/packages/editor/src/new-fabric-theme-objects.ts`,
  `src/web/packages/editor/src/new-fabric-theme-cards.ts`

## The problem

The frosted CPU card was rejected on sight: *"that looks like just tinted,
semi-transparent fill and nothing like frosted glass."* Mapped against the four
behaviours a glassmorphic surface has — **diffusion**, **tint**, **texture**,
**edge** — plus the one the research calls *"the secret ingredient most
tutorials skip"*, the shipped card had two of the five:

| | shipped | verdict |
|---|---|---|
| diffusion | `blur(16px)` in artboard units | weak — the sunset's band stayed legible through the card |
| tint | `palette.frost` = `#081523b8`, **72 %** opaque | inverted: the converging range for dark glass is 0.06–0.30, and *"past 0.25 the glass effect dies"* — and note where the answer below lands, at the very top of that range |
| texture | none anywhere in the renderer | absent |
| saturation | none | absent — and a Gaussian averages towards grey, so the blur was *removing* colour |
| edge | `palette.panelStroke` = `#9fc7e52b`, 1 px | already inside the ecosystem's 0.14–0.2 band, and left alone |

The tint was the dominant one, and the failure it produces is measurable rather
than a matter of taste: at 72 % the authored card carries **0.81/255** of the
backdrop's structure. The blur is computed and then covered — the same failure
mode as *"an opaque background hides the blurred pixels you just spent effort
producing."*

## What the tint cannot be asked to fix

The backdrop under the card is luma **110.2**, sharp and blurred alike, because
a Gaussian preserves the mean. An earlier draft of this note argued from that
that 72 % was the floor any legible card had to sit on, and held the tint there.
**That was the wrong question**: it optimised the card's *text* and spent the
card's *material* to pay for it. The cost of a low tint is real, and it is paid
back — partly in the card's **contents**, in ink that has to clear a
photographic field, and partly in the **tint itself**, which lands at 30 %
rather than the 18 % the transmission wanted. Both are measured below.

## What a low tint costs, and what it buys

At 18 % the card's own fill is `#0815232e`, and everything below follows from
the panel now transmitting:

| | before (72 %) | after (18 %) |
|---|---|---|
| backdrop range under the panel, sharp | 7.48 | 7.51 |
| the same, diffused | 5.68 (76 % kept) | 1.75 (23 % kept) |
| authored panel contrast | 0.81 | 1.46 |
| card field luma | 44.7 | 90.2 |

**Bought:** a 4.2x drop from the radius alone on the same authored panel, and a
photograph visibly behind the card rather than a hint of one.

**Paid:** a mid-luma *photographic* field under ink that was chosen against a
near-black one. Measured across the frosted row the field averages 55, but the
CPU card sits on the photograph's bright horizon at 114, and every ink is
re-priced against that rather than against an average.

### The tint is floored by the caption's contrast, and 18 % is under it

The ink table below is in **0–255 luma distance**, and a luma distance is not a
contrast ratio: WCAG linearises each channel and weights them, so the two do
not agree. The first version of this note read the distance as a ratio and
called `text` "AA at 5.4:1". The browser read **4.02:1** on the same field —
below AA — which is how the mistake surfaced rather than shipping.

Measured properly, as WCAG relative luminance of the real field with the caption
hidden, and `#ecf5ff` at 0.904 against it:

| tint | field luminance | caption contrast |
|---|---|---|
| 18 % `#0815232e` | 0.1874 | **4.02:1 — fails** |
| 24 % `#0815233d` | 0.1623 | 4.49 — passes by a hair |
| **30 % `#0815234d`** | **0.135** | **5.1:1** |

24 % is not a floor worth having: it clears AA by 0.007 on a number that moves
with the photograph and the viewport. **30 % is the tint**, and it is set by the
contrast requirement rather than by a look. The panel still transmits — its
carried backdrop structure falls from 1.27 to about 1.08 against a 0.6 floor
that an even fill cannot reach at any radius — so what 30 % costs is
transmission, and what it buys is a caption that is actually a reading.

### The ink table, and what it is good for

| ink | luma | distance from the CPU card's field |
|---|---|---|
| `text` `#ecf5ff` | 243.8 | 130 — the caption, at 5.1:1 against the 30 % field |
| `dim` `#a8bed0` | 186.6 | 73 — well under AA on a transmitting field |
| `cpu` `#4da3ff` | 151.4 | **37 — under the one-pixel edge floor** |
| `frostInk` `#dbeafe` | 232.3 | 118 |

Luma distance answers a different question than contrast, and this one is the
right one for it: a stroke's *visibility* against its field, which is about how
far apart the two are and not about a ratio. So `dim` is retired on the frosted
cards (the hierarchy comes from 20 px against 24 px instead), and the two
sparklines take a new light ink, because a mid-luma blue is 37 away from a
mid-luma field and reads as a soft grey line. The gauges keep their own colours
— 76 and 131 away, and thick enough to read.

## Rung 1 — Vigilia

Searched `packages/*/src` for `noise|grain|dither|createPattern|saturate`.

Found: **nothing that generates a texture and nothing that grades colour.** The
two `noise` hits are prose in a comment about hardware and a comment in a font
test. No `createPattern` and no `saturate` existed in the product at all. The
tint, the stroke and the radius were the only surface properties a card carried.

## Rung 2 — dependencies

Searched the workspace manifests. The root has no runtime dependencies, and the
packages carry no noise, texture or colour-grade library.

Found: **nothing installed, and nothing worth adding.** `pixlated` (npm) does the
grain in ~40 lines of `ImageData` writes; `FxFilterJS` does both in SVG filters.
Both are wrappers over the platform calls below, and one of them is DOM-only.

## Rung 3 — platform

- `CanvasRenderingContext2D.createPattern(image, "repeat")` with an offscreen
  canvas is the documented way to tile a generated texture into a context, and
  `ImageData` writes the tile directly rather than through the shape pipeline.
- `ctx.filter` is a **filter list**, so `blur(40px) saturate(1.6)` is one pass
  over the backdrop, not two — which is the only reason both are affordable
  inside a per-frame budget.
- **CSS `backdrop-filter` cannot be used.** It applies to DOM elements; the
  panel is a Fabric `Rect` painted into a `CanvasRenderingContext2D`, and it
  has to stay there because the same path produces `toCanvasElement` exports
  and the player's own surface. The reference implementation found in rung 4
  reaches for a WebGL blur for the same reason.
- `globalCompositeOperation = "overlay"` is the canvas equivalent of
  `mix-blend-mode: overlay`, and the difference matters: a flat translucent
  grey reads as a layer *over* the content, while overlay blends each grain
  value against what is beneath it.

## Rung 4 — ecosystem

- **CodeFronts, "Grain Noise Frosted Glass"** — the sharpest statement of the
  mechanism: *"two otherwise identical frosted panels … one over a clean
  gradient, one over the same gradient plus a fine noise layer — the grainy one
  reads as physical etched glass while the clean one looks like a smudge
  filter."* Recipe: fine noise over the glass at 8 % with
  `mix-blend-mode: overlay`, edge 1 px at 14–20 % white.
- **html-in-canvas, "Frosted Glass Backdrop"** — clips the panel, composites a
  `rgba(16,16,40,0.35)` tint, a white gradient at 6 %, and a
  `rgba(255,255,255,0.14)` border. Note the tint: **0.35**, which is the
  ecosystem's own answer and not 0.72.
- **fwdtools, "Canvas Noise Texture Background"** — writes grayscale into an
  `ImageData` buffer at a fraction of the display resolution, and throttles
  regeneration because unthrottled noise reads as static.

Two independent sources put the surface grain at 8 % and the edge at 14–20 %;
the palette's 17 % edge is already there, which is why that row is the one that
passes untouched.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a) seeded noise tile + `createPattern`, filled inside the panel clip, composited `overlay`; `saturate()` composed into the blur's own filter list** | the ecosystem's recipe on the platform's calls | one lazily built 128 px tile per glass instance; one `fillRect` and one extra function per panel per frame | the tile must be seeded or the surface crawls between frames and the two mounts disagree | **accepted** |
| (b) a `fabric.Pattern` fill authored as the panel's paint | authorable, persisted | a new fill kind, a schema value, a published pattern payload, an inspector control | a *fixed* material property would have to be opted into by every author to exist at all, and would put the material's look in a second owner | rejected |
| (c) ship a grain PNG as a packaged asset | no generation cost | an asset, a licence entry, a load, a 1× tile stretched to 4 K | a decorative texture becomes a shipped dependency of every glass theme | rejected |
| (d) skip the grain | free | — | the one principle entirely absent, and the one the ecosystem names as *the* difference between glass and a smudge | rejected |

## Rung 6 — probe

Both mounts, the same card, measured off real captures:

| | radius 16, tint 72 % | radius 40, tint 30 %, saturate 1.6 |
|---|---|---|
| backdrop range, sharp → diffused (display) | 7.48 → 5.68 | 7.51 → 1.75 |
| authored panel contrast (display) | 1.64 | 1.28 |
| authored panel contrast (editor) | 1.62 | 1.08 |
| marginal frame cost, **all five** frosted panels | — | 0.96 ms at radius 16, 1.03 at 0 |

The blur's own step drop, with the grain **off**, is 5.9x in the editor and
3.4x on the display. With the grain at 8 % that same figure reads 1.6x — the
noise was swamping the blur it sits on, which is how the level came to be set
from the panel-scale reading rather than from the CSS recipe.

## Decision

**Frost is diffusion, grain, saturation and an edge over a low tint, and the
tint is 30 %** — low enough that the photograph reads through the panel, and no
lower, because at 18 % the CPU card's caption falls to 4.02:1 against the field
it sits on. The card row's radius moves 16 → 40, inside both the published
bound of 48 and Task 1's measured-flat 0–64 px band. `saturate(1.6)` rides in
the same filter list as the blur, because it exists to undo what the blur did;
a radius of zero therefore gets **no filter at all**, which is what keeps the
blur-off control a control for the photograph rather than a graded version of
it. The grain is a seeded 128 px tile at **1.5 %** — not the ecosystem's 8 %,
measured down — composited `overlay` inside the panel clip, anchored to the
panel rather than the viewport, and released with the handle.

**All five top-row cards are frosted, not one.** One glass card among four dark
ones reads as a mistake; five read as a material. The frame cost of that is
1.0 ms, measured, and the scene the budget fixture builds now removes every
panel the scene carries rather than a single one.

The treatment stays `{ blurRadius }`. Diffusion, grain and saturation are
properties of the material, not dials: authoring them would give every theme a
second way to describe the same surface and put the material's look in two
owners. What *did* change per card is the **ink**, because a transmitting panel
is a different field to write on — and that is authored data, which is where
authored data belongs.

## Revisit when

A theme can author a frosted panel with no backdrop, or over a video. Then the
grain is the only thing distinguishing the panel from a fill, and its strength
may want to be authored after all. Also revisit if a mount's DPR exceeds 2,
where a 128 px tile is stretched far enough to read as a grid; and if the
backdrop photograph is replaced by one whose bright band does not sit behind the
card row, at which point `dim` and the mid-luma chart inks may be affordable on
glass again and the two extra tokens can go.
