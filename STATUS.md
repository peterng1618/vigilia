# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/Wallpaper-Engine-as-background-media`

## Current objective

Land the **Wallpaper Engine import** ([`spec`](docs/superpowers/specs/2026-10-21-wallpaper-engine-import-design.md), [`plan`](docs/superpowers/plans/2026-10-21-wallpaper-engine-import.md)): the host reads the local Steam library and serves the item list, and the asset finder imports images and videos and guides a scene's PNG/MP4 export.

## Active work

- **The Wallpaper Engine import plan is active**; the owner named it, and tasks run one at a time from Task 1.
- **The R2 store backend stays merged**; its owner-run Task 5.2 deploy and live proof remain pending and are not part of this plan.
- **Task 5.1's import is unrun**: the smoke item `6041df49-9c61-4d51-a184-716890560bdb` exists only in the old catalogue; the script is ready.
- **Open register findings:** `vg-699` stale `vite preview` reuse on a shared port, `vg-701` biome never reads `.mjs`, `vg-695` a pre-existing `server.test.ts` flake, `vg-708` a theme's credits are written but never drawn.

## Last completed change

- **A subscribed scene's payload is its `scene.pkg`** (`wallpaper-engine/library.ts`): today's descriptors name `scene.json`, which is not on disk, so `resolvePayload` dropped all 227 real scenes; a scene with no package keeps its named file and stays unclassified.
- **Measured on this machine**: scenes resolved `0 → 226` (227 scene directories, 226 packaged), dropped items `228 → 2` — one video and one scene whose named payload is absent.
- **Red proof**: with the selection disabled `library.test.ts` fails 2 of 4; restored, 8 files / 61 tests pass, `tsc` and `biome check packages/host/src` exit 0.

## Next

1. Task 9: the browser boundary spec, three registered captures, the three red proofs, and the real-install run.
2. The owner's R2 Task 5.2 deploy, live proof and import still wait; so does `vg-699`.

## Blockers / unverified

- **The store Worker is not deployed and no live store path has run**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate`, health check, OAuth round trip, live CPU measurement or import; `CATALOGUE_ORIGIN` is still the placeholder `https://yunari-store.workers.dev`, and no normalized video has played in a browser.
- **Version 2 now identifies two shapes**: a stored or catalogued document carrying `artboard.background`/`backgroundMedia`, or `fit`/`scale` on its media, is refused by the unknown-key check; the live catalogue's smoke theme carries the old shape and needs reseeding (owner action).
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **The compact editor header is still wider than a phone**: clipping it stops the document widening, but the menubar and publish control stay unreachable below the breakpoint — `vg-707` waits on a ruling.
