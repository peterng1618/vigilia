# 0012 — The glass samples the media the element shows, not a 1:1 crop of its bytes

- **Date:** 2026-09-28
- **Status:** accepted
- **Paths:** `src/web/packages/scene-fabric/src/background-media.ts`,
  `src/web/packages/scene-fabric/src/background-media.dom.test.ts`

## The problem

`mediaDrawArgs` was written to "reproduce the element's `object-fit`", and it
does not. It computes a cover scale, derives a source window of exactly
`sourceWidth * scale × sourceHeight * scale`, centres that window in the
source, and then **draws it 1:1**. The window's size is the *device* size, not
the source's size, so the picture the panel blurs is a **pixel-for-pixel crop of
the middle of the file** rather than the whole file scaled to cover. The
element next to it is `width:100%; height:100%; object-fit:cover` and shows the
whole photograph.

The two agree only when the artboard's device rect happens to be the source's
own pixel size. They never do in general:

| mount | artboard device rect | photo seen by the element | photo seen by the sampler |
|---|---|---|---|
| player, 1672×941 @ DPR 1 | 1672 × 941 | 100 % of 2330×1311 | the middle **71.8 %** |
| editor, 0.3744 camera | 626 × 352 | 100 % of 2330×1311 | the middle **26.9 %** |

Measured, not derived — the two mounts' *own* reads of the photograph agree to
3 % (see Rung 6), so the bytes are the same and the divergence is the crop.

**A panel therefore blurs a different part of the photograph from the one
visible behind it, at every mount whose device scale is not 1.** Task 12e's
open question — the editor reading a frosted band's contrast at 4.46 where the
player reads 1.38 — is this, and the editor is the mount that is wrong: at its
0.3744 camera the band addresses source columns 1036–1089 where the element
shows 686–881.

The defect is not new with the photograph. It was invisible before 12e because
every fixture backdrop was authored as scene geometry (a gradient, stripes) or
was square in a square box, and a 1:1 crop of a *uniform* field looks identical
to a scaled one. The `e2e-media` unit fixture still shows it: a 200×100 source
cover-cropped into a 400×400 device box asks for source rect
`(-300, -150, 800, 400)` — **entirely outside a 200×100 source**, so the
sampler draws nothing at all where the element draws the whole image.

## Rung 1 — Vigilia

Searched every `object-fit` / `objectFit` / `"cover"` / `"contain"` occurrence
outside `node_modules` and `dist`.

Found: **three, and none of them does this.**

- `background-media.ts:107` — the element this function exists to match.
- `background-media.dom.test.ts` — four assertions that the *element* carries
  the right `object-fit`, and two that pin the wrong `drawImage` arguments
  (below).
- `renderer-core/src/scene/mount.ts:249` — a **DOM** `<img>` with
  `objectFit = content.fit === "stretch" ? "fill" : content.fit`. The browser
  fits it. Not reusable: it is a document element, it paints nothing into a
  context, and it is the *node* content path, not the artboard media path.

No helper anywhere in the workspace turns an `object-fit` into `drawImage`
arguments, so the arithmetic has exactly one owner and this file is it.

## Rung 2 — dependencies

Searched the workspace manifests and `node_modules` for anything that computes
an `object-fit` crop.

Found: **nothing installed, and nothing worth adding.** `fabric` owns
`FabricImage` crop/scale for images *it* holds on a canvas; the media here is a
DOM sibling that Fabric never sees, and the consumer is a 2D context scratch
surface, so that machinery does not apply. `canvas-object-fit` and
`iki-inc/fitting` exist on npm and would add a shipped dependency for six
arithmetic lines that this file already owns and already tests.

## Rung 3 — platform

Searched how a browser decides what `object-fit: cover` shows, and what
`drawImage` can be asked for.

Found: the two halves are both platform, and they compose.

- CSS Images 3: `cover` scales the replaced content preserving its ratio until
  it covers the box in both axes, then **crops the overflow**. The crop is a
  *source* operation; the box is a *destination* operation.
- `CanvasRenderingContext2D.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)`
  scales the source sub-rect into the destination rect. So the destination can
  be the whole device rect and the crop expressed in source pixels — which is
  what the 9-argument form is for.

The current code uses the 9-argument form with `dw === sw` and `dh === sh`,
i.e. it asks the platform for **no scaling at all**, which is the one thing it
did not need to ask for.

## Rung 4 — ecosystem

Searched, for *how a canvas renderer reproduces `object-fit` when it is painting
an image into a context rather than into a document*.

- **Konva** `getCrop` (konvajs.org/docs/sandbox/Scale_Image_To_Fit.html), whose
  own description is that its `crop` property *"allows you to use only
  specified area of source image to draw into the canvas … to emulate
  `object-fit: cover`"*. It reduces the source to the destination's aspect
  ratio, centred — `newHeight = image.width / aspectRatio` when the destination
  is wider than the image, `newWidth = image.height * aspectRatio` when it is
  narrower — then draws `cropX, cropY, cropWidth, cropHeight` into the full
  destination.
- **`iki-inc/fitting`**, self-described as a *"library to calculate with JS when
  `background-size` or `object-fit` is not available"*, returning
  `{width, height, x, y}` per axis.
- **`canvas-object-fit`** (npm), a `drawImage(context, image, x, y, width,
  height, {objectFit})` wrapper, with `cover` and `contain` and EXIF
  orientation.
- The long-standing StackOverflow answer to "simulate `background-size: cover`
  in canvas" computes `cw = iw / (nw / w)`, `ch = ih / (nh / h)` — the source
  window — and draws it into `(x, y, w, h)`.

**Every one of them crops the source to the destination's aspect and scales it
into the full destination box.** None of them takes a 1:1 window sized by the
destination. That is the whole consensus, and it is what the fix does.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| **(a) crop the source to the destination's aspect, scale into the whole device rect** | reproduces `object-fit` exactly; the platform does the scaling | ~10 lines in the existing owner | the blur radius is unchanged, so a downscaled mount blurs a smaller band of the picture — which is what the artboard-unit radius means | **accepted** |
| (b) sample the element's rendered box with `html2canvas` / a foreign-object SVG | pixel-exact by construction | a new dependency and a DOM-serialising render per panel per frame | enormous; a backdrop sampler that serialises the DOM to blur one panel is the wrong shape entirely | rejected |
| (c) keep the 1:1 crop and align the *element* to it | no code change | none | the media layer would have to render the same 1:1 crop in CSS, which `object-fit` cannot express and which would make the backdrop resolution depend on the artboard's pixel size | rejected — it makes the product wrong to fit the test |
| (d) read the element back with `createImageBitmap` + `resizeWidth` | reuse the platform's scaler | one extra async decode per panel | `createImageBitmap` on an element is a snapshot, so a *video* backdrop would be frozen to the moment of the call | rejected — it breaks the video case this file exists for |
| (e) add `canvas-object-fit` | the ecosystem's answer | a shipped dependency, licence + notice + bundle | ~40 lines of arithmetic it would own, in a file that already owns the arithmetic | rejected |

## Rung 6 — probe

Both mounts, the same 2330×1311 photograph, the same band (scene x 492–632,
y 258–425), reading the **file itself** with no product code in the path and
reading the **panel** with its contents hidden, its fill cleared and
`blurRadius: 0`:

| | photo, read directly | panel, `blurRadius: 0`, clear fill |
|---|---|---|
| editor, 52 columns | contrast **4.94**, mean luma 125.0 | contrast **16.54**, mean luma ≈ 140.5 |
| player, 140 columns | contrast **5.04**, mean luma 124.8 | contrast **5.08**, mean luma ≈ 126 |

The two mounts' direct reads of the file agree to 3 % (four combinations of
{editor mount, player mount} × {52, 140} columns all land at contrast
4.90–5.04, mean luma 124.6–125.2), so the bytes, the decode and the band are
the same. The player's panel matches its own mount's direct read almost exactly.
The editor's panel reads **3.3× the contrast of the photograph and 15 luma
units too bright**, which is a tighter crop of a busier part of the same file —
and the arithmetic names which part: source columns 1036–1089 where the element
shows 686–881.

## Decision

**`mediaDrawArgs` reproduces `object-fit`, so the panel blurs the picture the
element is showing.** `cover` takes the source rect whose aspect matches the
device rect, centred, and draws it into the whole device rect; `contain` takes
the whole source and draws it at its fitted size, centred — which is what the
element already does, and what the letterboxed bars have to sit over.

The device rect stays in **device pixels** and the media rect stays in
**artboard units**, exactly as
[0007](0007-unresolvable-chart-paint-is-a-gap-not-a-default.md) recorded when
this path was first taken. What changes is that the destination is now the
device rect and the *source* carries the crop, so the whole file is in the
picture at every scale instead of a window of it sized by the viewport.

## Revisit when

A theme can author `object-position` or a media `fit` other than `cover` and
`contain`. Then the centring offset stops being `0.5` in both axes and this
function grows a parameter it currently has no reason to have.
