# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/background-media-becomes-a-layer`

## Current objective

The background is a layer: [`spec`](docs/superpowers/specs/2026-10-23-background-layer-design.md), [`plan`](docs/superpowers/plans/archive/2026-10-23-background-layer.md). Its plan is implemented and archived; the R2 store plan is next and queued.

## Active work

- **No plan is in flight**: the background-layer plan is archived, and the next plan is claimed when work starts.
- **Background layer landed**: the top-level `background` envelope section, one placement function, the DOM media handle, glass sampling, the bottom row and the inspector column.
- **Evidence closed**: the player's glass-panel pixel probe and the 14 edited browser specs ran at `--workers=1`.

## Last completed change

- **Final review fixes**: Undo/Redo no longer greyed for a background selection, the dead `currentBackground` field is gone, and the kind mark reads `KIND_GLYPHS.background`.
- **New unit cases**: the removed `artboard.background`/`backgroundMedia` keys, media with no `bounds`, the no-port background write, and the `setArtboard` teardown.
- **Close-out**: the spec is `implemented`, its plan is archived, and three review findings are register rows.

## Next

1. Execute the R2 store backend plan ([`2026-10-22-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)).
2. Then `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`.

## Blockers / unverified

- **The live catalogue's smoke theme carries the old shape** and must be reseeded after the new format lands; this is an owner action.
- **Version 2 now identifies two shapes**: a stored or catalogued document with `artboard.background` is refused by the unknown-key check.
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **Three browser specs are red or order-dependent, and none is this branch's behaviour**: `host-media`'s frame-repaint case (the host's local display answers 1 fps), `publish-header`'s 390 px containment (0.27 px overflow), and `publish-loop`'s clear-on-close (passes alone, fails after its first test).
