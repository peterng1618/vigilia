# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/background-media-becomes-a-layer`

## Current objective

The background is a layer: [`spec`](docs/superpowers/specs/2026-10-23-background-layer-design.md), [`plan`](docs/superpowers/plans/archive/2026-10-23-background-layer.md). Its plan is implemented and archived; the R2 store plan is next and queued.

## Active work

- **No plan is in flight**: the background-layer plan is archived, and the next plan is claimed when work starts.
- **Background media is translate-and-mirror**: `fit`/`scale`/`fill` are gone, the media always covers, offsets pan within the cover overhang, and `flipX`/`flipY` mirror at paint time.
- **Evidence closed**: the player's cover/clip/edge/flip browser cases and the touched editor specs ran at `--workers=1`; the full gate exits 0.

## Last completed change

- **Model**: `background.media` is `{ assetId, bounds, offsetX?, offsetY?, flipX?, flipY? }`; `fit`/`scale` are refused as unknown keys.
- **Placement**: one owner, cover always, offsets bounded by the overhang; the load window ignores offsets.
- **Flip**: a paint-time mirror on the DOM child and in the glass sampler; never geometry.
- **Inspector**: Position is bounds, offsets and two flip switches; the fit/scale fields and their ids are gone.
- **Docs**: decision 0094, spec corrected, `STATUS.md`'s R2 plan link fixed.

## Next

1. Execute the R2 store backend plan ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)).
2. Then `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`.

## Blockers / unverified

- **The live catalogue's smoke theme carries the old shape** and must be reseeded after the new format lands; this is an owner action.
- **Version 2 now identifies two shapes**: a stored or catalogued document carrying `artboard.background`/`backgroundMedia`, or `fit`/`scale` on its media, is refused by the unknown-key check.
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **Three browser specs are red or order-dependent, and none is this branch's behaviour**: `host-media`'s frame-repaint case (the host's local display answers 1 fps), `publish-header`'s 390 px containment (0.27 px overflow), and `publish-loop`'s clear-on-close (passes alone, fails after its first test).
