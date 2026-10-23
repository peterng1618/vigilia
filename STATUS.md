# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/Wallpaper-Engine-as-background-media`

## Current objective

The **Wallpaper Engine import** ([`spec`](docs/superpowers/specs/2026-10-21-wallpaper-engine-import-design.md), [`plan`](docs/superpowers/plans/archive/2026-10-21-wallpaper-engine-import.md)) is landed on this branch and awaits the integration decision: the host reads the local Steam library and serves the item list, and the asset finder imports images and videos and guides a scene's PNG/MP4 export.

## Active work

- **The plan is complete** — Tasks 1–9, the whole-branch review and its single fix pass all closed clean; the branch awaits merge, PR or abandonment.
- **The R2 store backend stays merged**; its owner-run Task 5.2 deploy and live proof remain pending and are not part of this plan.
- **Task 5.1's import is unrun**: the smoke item `6041df49-9c61-4d51-a184-716890560bdb` exists only in the old catalogue; the script is ready.
- **Open register findings:** `vg-699` stale `vite preview` reuse on a shared port, `vg-701` biome never reads `.mjs`, `vg-695` a pre-existing `server.test.ts` flake, `vg-708` a theme's credits are written but never drawn.

## Last completed change

- **A scene's exported MP4 now crosses the normalizer** (`editor-session.ts`): the final re-review found §8 step 6 met for video items only; one test proves the export path posts, one proves a PNG does not.
- **The finder's library gained a kind filter and title search**, and an image/video import states once that a baked-in clock cannot be removed (`wallpaper-engine-body.tsx`).
- **Video items import through `POST /api/themes/normalize-video`** with `changes` following `reencoded`; a refusal writes no credit and no background.
- **Final gate:** `npm run gate` exit 0 — 341 files / 4728 tests, worker 12 files / 72 tests.
- **Plan archived, spec marked implemented**; the decision is `0097`.

## Next

1. The integration decision for this branch — merge, open a PR, or leave it for the owner.
2. The owner's R2 Task 5.2 deploy, live proof and import still wait, and so does `vg-699`.

## Blockers / unverified

- **The store Worker is not deployed and no live store path has run**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate`, health check, OAuth round trip, live CPU measurement or import; `CATALOGUE_ORIGIN` is still the placeholder `https://yunari-store.workers.dev`, and no normalized video has played in a browser.
- **Version 2 now identifies two shapes**: a stored or catalogued document carrying `artboard.background`/`backgroundMedia`, or `fit`/`scale` on its media, is refused by the unknown-key check; the live catalogue's smoke theme carries the old shape and needs reseeding (owner action).
- **No live Wallpaper Engine export has been offered by the sheet**: the scene flow's last step is owner-run, and the export dialog's default location is unverified.
- **The listing re-reads and reclassifies every scene package on each mount** (no facts cache), and a video import posts the file as base64 to the host.
- **Background and artboard edits are not undoable**, and the compact editor header stays wider than a phone — `vg-707` waits on a ruling.
