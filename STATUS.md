# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/background-media-becomes-a-layer`

## Current objective

The background is a layer: [`spec`](docs/superpowers/specs/2026-10-23-background-layer-design.md), [`plan`](docs/superpowers/plans/2026-10-23-background-layer.md). Its plan is complete; the R2 store plan is queued behind it.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-23-background-layer.md`
- **Phases 1–2 complete**: decision 0093, the top-level `background` envelope with its validator and consumer sweep, then the placement function and the media handle.
- **Phase 3 complete**: scene/editor/player wiring, the backdrop paint, and glass sampling the placed rect.
- **Phase 4 complete**: the virtual bottom row, its selection, and the Edit-menu and readout gates.
- **Phase 5 complete**: the inspector's background column, the Document-pane removal, and this close-out.

## Last completed change

- **The background-layer plan is closed**: ownership, architecture and DESIGN now name `selection-inspector/background-column.ts` for authoring and `scene-fabric/src/background-media.ts` for the DOM media; no behaviour changed.
- **Verification**: `npm run gate` exits 0 (306 files, 4425 tests) after `0d08fd0` fixed the drive-dependent `scratch-gate` self-test that made the earlier run exit 1; the background and player browser suites pass at `--workers=1`.

## Next

1. Execute the R2 store backend plan ([`2026-10-22-r2-store-backend-design.md`](docs/superpowers/specs/2026-10-22-r2-store-backend-design.md)), which is queued.
2. Then `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`.

## Blockers / unverified

- **The live catalogue's smoke theme carries the old shape** and must be reseeded after the new format lands; this is an owner action.
- **Version 2 now identifies two shapes**: a stored or catalogued document with `artboard.background` is refused by the unknown-key check.
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
