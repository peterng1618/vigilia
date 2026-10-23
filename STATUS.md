# Yunari status

Updated: 2026-10-23
Branch: `peterng1618/background-media-becomes-a-layer`

## Current objective

Land the **background layer** ([`spec`](docs/superpowers/specs/2026-10-23-background-layer-design.md), [`archived plan`](docs/superpowers/plans/archive/2026-10-23-background-layer.md)) on `main`, then close the **R2 store backend** plan locally: its Worker, D1 and R2 code is merged and gated, and only the owner's Cloudflare deploy and live proof remain.

## Active work

- **No plan is in flight**: the background-layer plan is archived, and the next plan is claimed when work starts.
- **The R2 store backend is merged to `main`**; its plan stays in `docs/superpowers/plans/` pending the owner's acceptance.
- **Task 5.2 is owner-run and pending**: Cloudflare resources, secrets, deploy, `/migrate`, health check, both OAuth callbacks and CPU measurement.
- **Task 5.1's import is unrun**: the smoke item `6041df49-9c61-4d51-a184-716890560bdb` exists only in the old catalogue; the script is ready.
- **Queued:** `2026-10-21-wallpaper-engine-import.md`; it does not start until the owner accepts the R2 plan and names it active.
- **Open register findings:** `vg-699` stale `vite preview` reuse on a shared port, `vg-701` biome never reads `.mjs`, `vg-695` a pre-existing `server.test.ts` flake.

## Last completed change

- **Tailwind's preflight was capping the media layer**: `img, video { max-width: 100%; height: auto }` pinned the placed rect's width to the layer while the inline height grew, so the picture stretched and an x offset could not widen it (user's report; the player has no preflight, which is why only the editor showed it).
- **The child now sets `max-width:none;max-height:none` inline** in `mountBackgroundMedia`, which outranks any stylesheet reset on the placed element.
- **Proof**: a new editor e2e reads the placed rect against the source's aspect and fails on the un-fixed bundle (711.6 × 800.8), passes after it (1423 × 800.8); the editor's three background tests pass, `background-layer.spec.ts` 3/3, 677 unit tests in scene-fabric and the inspector.
- **A background video is sized from its metadata**: `intrinsic()` gated a video on a decoded frame, so it stayed the bare box while the glass sampled the placed rect; `drawable()` now keeps `drawImage`'s frame precondition apart from sizing.

## Next

1. The owner runs Task 5.2: create D1 and R2, set the secrets, deploy, `/migrate`, health check, register both OAuth callbacks.
2. Replace the placeholder `CATALOGUE_ORIGIN` with the deployed URL, rebuild, and measure CPU for `GET /index.json` and one auth callback.
3. Run the Task 5.1 import against the deployed origin, then the real OAuth round trip in the built editor.
4. After the owner accepts, archive the R2 plan and name the Wallpaper Engine plan active.
5. Drain `vg-699` in the next register pass.

## Blockers / unverified

- **The store Worker is not deployed and no live store path has run**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate`, health check, OAuth round trip, live CPU measurement or import.
- **`CATALOGUE_ORIGIN` is still the placeholder** `https://yunari-store.workers.dev`, and no normalized video has been played in a browser.
- **Version 2 now identifies two shapes**: a stored or catalogued document carrying `artboard.background`/`backgroundMedia`, or `fit`/`scale` on its media, is refused by the unknown-key check; the live catalogue's smoke theme carries the old shape and needs reseeding (owner action).
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **Three browser specs are red or order-dependent, and none is this branch's behaviour**: `host-media`'s frame-repaint case (the host's local display answers 1 fps), `publish-header`'s 390 px containment (0.27 px overflow), and `publish-loop`'s clear-on-close (passes alone, fails after its first test).
