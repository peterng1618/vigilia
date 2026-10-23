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

- **CI's 22 browser failures are repaired at their causes, not their numbers**: the retired device-flow store stubs, the finder's font catalogue moving into the asset-finder body, the drawings' 240 off-scale literals, the role/name rule that overflowed under wider glyphs, and the popup/header overflow at 390px.
- **Two suites measured a product that changed under them**: glass and host-media assumed a 30 Hz idle repaint, and `38cbfe3e` made the loop render only when a pass painted; the frame-determinism case now waits for the connection strip, not just ink.
- **The runner gets a display**: `host-pwa` and `host-secure-origin` launch headed browsers on purpose, so CI runs Playwright under `xvfb-run` instead of reading "Missing X server" as a product failure.
- **Proof**: `npm run gate` exit 0 (4,612 tests), targeted rebuilt-bundle browser runs pass, the glyph-overflow and role-yield fixes A/B red-proven, the 6-run clock stress is 6/6.
- **A GPU-less host and an off-screen anchor**: the player proofs read the gap when the host reports no GPU reading, and the publish popover shifts into the window (`sticky` drops `limitShift`) instead of parking at the trigger's off-screen edge.

## Next

1. The owner runs Task 5.2: create D1 and R2, set the secrets, deploy, `/migrate`, health check, register both OAuth callbacks.
2. Replace the placeholder `CATALOGUE_ORIGIN` with the deployed URL, rebuild, and measure CPU for `GET /index.json` and one auth callback.
3. Run the Task 5.1 import against the deployed origin, then the real OAuth round trip in the built editor.
4. After the owner accepts, archive the R2 plan and name the Wallpaper Engine plan active.
5. Drain `vg-699` in the next register pass.

## Blockers / unverified

- **The store Worker is not deployed and no live store path has run**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate`, health check, OAuth round trip, live CPU measurement or import; `CATALOGUE_ORIGIN` is still the placeholder `https://yunari-store.workers.dev`, and no normalized video has played in a browser.
- **Version 2 now identifies two shapes**: a stored or catalogued document carrying `artboard.background`/`backgroundMedia`, or `fit`/`scale` on its media, is refused by the unknown-key check; the live catalogue's smoke theme carries the old shape and needs reseeding (owner action).
- **Background and artboard edits are not undoable**: Fabric history serialises the scene only. Recorded, not a regression.
- **The CI run for these fixes has not been observed yet**; the browser evidence is local, and `publish-loop`'s clear-on-close remains order-dependent (passes alone, fails after its first test).
- **The compact editor header is still wider than a phone**: clipping it stops the document widening, but the menubar and publish control stay unreachable below the breakpoint — `vg-707` waits on a ruling.
