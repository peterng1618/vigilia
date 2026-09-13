# 0001 — Artboard transform

- **Status:** accepted
- **Design document sections:** §51, §53, §55, §57
- **Specs superseded:** none

## Problem

A theme declares a logical artboard size. Every viewport that renders it — a
phone in portrait, a phone in landscape, an editor canvas — differs from that
size. §51 requires **one uniform transform applied to all content**, including
UI-bearing backgrounds, strokes, typography and shadows, and §57 forbids
automatic element reflow.

Nothing currently computes that transform, so nothing can render a theme at a
size other than 1:1.

## Behaviour

```ts
computeArtboardTransform({ artboard, viewport, fitMode }): ArtboardTransform
```

**One scalar scale.** The result carries a single `scale`, never separate x and y
factors. Non-uniform scaling would distort strokes, glyphs and shadows, which is
exactly what §51 forbids.

**`contain` (fit entire design).** `scale = min(vw/aw, vh/ah)`. The whole design
is visible. Leftover space is split evenly into two bars, reported in `bars` so
the player can paint them in the theme's configured colour (§53).

**`cover` (fill screen).** `scale = max(vw/aw, vh/ah)`. The design fills the
viewport and overflows on one axis. The overflow is reported in `crop` as the
document-space inset hidden on each edge, so the editor can preview exactly what
is cut (§55).

**Centring is always exact**, in both modes. Offsets may be fractional and must
not be rounded: rounding re-introduces per-frame drift and visible jitter when a
viewport changes by one pixel.

**Editor zoom is not part of this.** §57 states zoom is not document geometry.
Zoom composes *on top* of this transform in the editor and never changes it.

### Edge cases — the part worth writing down

| Input | Result |
|---|---|
| Viewport exactly matches artboard aspect | Both modes agree; no bars, no crop |
| Viewport width or height is `0` | `scale = 0`, degenerate flag set, no NaN |
| Viewport is negative | Treated as `0` |
| Artboard width or height is `0` or negative | **Throws.** An invalid document is a programming error, not a render state |
| Any input non-finite (`NaN`, `Infinity`) | **Throws** |
| Extreme aspect ratio (e.g. 1:1000) | Correct scale; the bar or crop on the dominant axis is large but finite |
| `contain` where the design is larger than the viewport | `scale < 1`; still centred, still no crop |
| `cover` where the design is smaller than the viewport | `scale > 1`; crop on exactly one axis |

Bars appear only in `contain`; crop appears only in `cover`. In either mode at
most **one** axis has a non-zero bar or crop — if both were non-zero the scale
would be wrong.

**Point mapping.** `documentToViewport` and `viewportToDocument` are exact
inverses for finite input, so the editor can hit-test a pointer position back to
document coordinates.

## Out of scope

- Editor zoom and pan — composes separately (§57).
- Device-pixel-ratio and backing-resolution choices — §124 future scope.
- Per-element transforms and group-local coordinates — a separate concern that
  composes beneath this one.
- Decorative background media containing/covering within its own bounds (§55);
  that is a per-element rule, not the artboard transform.

## Acceptance

- [x] `contain` and `cover` scales computed from the correct min/max ratio
- [x] Exact centring in both modes, fractional offsets preserved
- [x] Bars reported in `contain` only; crop in `cover` only; never both axes
- [x] Degenerate viewport yields `scale = 0` and never `NaN`
- [x] Invalid artboard and non-finite input throw
- [x] `documentToViewport` / `viewportToDocument` round-trip exactly
- [x] Aspect-match case agrees between modes

Covered by `src/web/packages/renderer-core/src/artboard.test.ts`.
