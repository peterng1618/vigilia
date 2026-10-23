# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/Wallpaper-Engine-as-background-media`

## Current objective

Land the **Wallpaper Engine import** ([`spec`](docs/superpowers/specs/2026-10-21-wallpaper-engine-import-design.md), [`plan`](docs/superpowers/plans/2026-10-21-wallpaper-engine-import.md)): the host reads the local Steam library and serves the item list, and the asset finder imports images and videos and guides a scene's PNG/MP4 export.

## Active work

- **The Wallpaper Engine import plan is active**; the owner named it, and tasks run one at a time from Task 1.
- **The R2 store backend stays merged**; its owner-run Task 5.2 deploy and live proof remain pending and are not part of this plan.
- **Task 5.1's import is unrun**: the smoke item `6041df49-9c61-4d51-a184-716890560bdb` exists only in the old catalogue; the script is ready.
- **Open register findings:** `vg-699` stale `vite preview` reuse on a shared port, `vg-701` biome never reads `.mjs`, `vg-695` a pre-existing `server.test.ts` flake.

## Last completed change

- **The install is located and its libraries listed** (`wallpaper-engine/locate.ts`): the `YUNARI_WALLPAPER_ENGINE` hook, `reg query … SteamPath`, then the two Program Files roots; a library counts only when `steamapps/workshop/content/431960` exists, and off Windows the answer is `undefined` before anything is read.
- **The scan lists wallpapers and never presets** (`library.ts`): `project.json` type lowercased, a `preset` with no type and an unreadable descriptor skipped and counted, `bin/workshopcache.json` joined by `workshopid` with attribution absent when there is no row.
- **An item resolves by §4's order** (`resolve.ts`): an image extension before any type check, then video/web/scene, and a payload absent from disk is no outcome at all.
- **`StoredItem` omits what was not measured** (`wire.ts`): attribution only when present, `stillAtRest`/`hasText` only when classified, and the preview at the item's own route.

## Next

1. Tasks 3–5: the install locator, the library scan, the read routes and the unpack/export routes.
2. Tasks 6–7: register the finder's local source, then the scene's unpack/launch/export sheet.
3. Task 8: the Wallpaper Engine credits entry and its display; Task 9: the boundary run and red proofs.
4. The owner's R2 Task 5.2 deploy, live proof and import still wait; so does `vg-699`.

## Blockers / unverified

- **The store Worker is not deployed and no live store path has run**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate`, health check, OAuth round trip, live CPU measurement or import; `CATALOGUE_ORIGIN` is still the placeholder `https://yunari-store.workers.dev`, and no normalized video has played in a browser.
- **Version 2 now identifies two shapes**: a stored or catalogued document carrying `artboard.background`/`backgroundMedia`, or `fit`/`scale` on its media, is refused by the unknown-key check; the live catalogue's smoke theme carries the old shape and needs reseeding (owner action).
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **The compact editor header is still wider than a phone**: clipping it stops the document widening, but the menubar and publish control stay unreachable below the breakpoint — `vg-707` waits on a ruling.
