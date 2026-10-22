# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/background-media-becomes-a-layer`

## Current objective

The background is becoming a layer: [`spec`](docs/superpowers/specs/2026-10-23-background-layer-design.md), [`plan`](docs/superpowers/plans/2026-10-23-background-layer.md). It is the active plan; the R2 store plan is queued.

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-23-background-layer.md`
- **`2026-10-23-background-layer.md` runs subagent-driven in five phases**: envelope and schema, placement and the media handle, scene/editor/player wiring and glass, the layer row and selection, then the inspector and close-out.
- **The R2 store backend plan** ([`2026-10-22-r2-store-backend-design.md`](docs/superpowers/specs/2026-10-22-r2-store-backend-design.md)) was written and awaits the owner's execution choice; it is queued behind this plan.
- **Queued after it:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`.
- **Decisions `0088`–`0092`** carry the store's measured choices; decision `0093` records the background as a virtual layer.
- **Captures `store-submit-version` and `store-remix-credit`** are the newest registered actions.

## Last completed change

- **The background-layer spec and plan are committed**: a top-level `background { color, media }` envelope section with bounds, object-fit, scale and offsets.
- **The background stays a virtual layer**, so video and glass sampling keep working and no Fabric scene object is added.
- **`schemaVersion` stays 2 at the owner's call**, so an old document with the removed artboard keys is refused rather than migrated.

## Next

1. Execute the background-layer plan, phase 1 (decision note, envelope, validator, sweep).
2. Continue phases 2–5, running the focused suites after each task.
3. Run the full gate and the browser evidence, then close the plan.

## Blockers / unverified

- **The live catalogue's smoke theme carries the old shape** and must be reseeded after the new format lands; this is an owner action.
- **Version 2 now identifies two shapes**: a stored or catalogued document with `artboard.background` is refused by the unknown-key check.
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **No browser run has exercised the transform yet**; the player evidence is Task 8 of the plan.
