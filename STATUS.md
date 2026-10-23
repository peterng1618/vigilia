# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

Close the **R2 store backend** plan ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)) locally: the Worker, D1 and R2 code is merged and gated, and only the owner's Cloudflare deploy and live proof remain.

## Active work

- **The R2 store backend is merged to `main`**; its plan stays in `docs/superpowers/plans/` pending the owner's acceptance.
- **Task 5.2 is owner-run and pending**: Cloudflare resources, secrets, deploy, `/migrate`, health check, both OAuth callbacks and CPU measurement.
- **Task 5.1's import is unrun**: the smoke item `6041df49-9c61-4d51-a184-716890560bdb` exists only in the old catalogue; the script is ready.
- **The asset finder landed before this merge**; its spec and archived plan are unchanged, and Lineicons stays dev-only (`lineicons@1.3.2`, MIT).
- **Queued:** `2026-10-21-wallpaper-engine-import.md`; it does not start until the owner accepts this plan and names it active.
- **Open register findings:** `vg-699` stale `vite preview` reuse on a shared port, `vg-701` biome never reads `.mjs`, `vg-695` a pre-existing `server.test.ts` flake.

## Last completed change

- **The asset finder review's nine Minor findings, merged over the R2 tip**; **M1–M5**: a surviving failure outlives Load more, a cursor-bearing page is not "no results", an unreachable host says so, the bytes refusal names the item, and the storage write is guarded.
- **M6–M7**: `credentials.json` is written `0600` (its test skips on win32); a row renders the result's subtitle, only an image is credited an author, and the dead `AssetSource.creditsOf` is removed.
- **M8**: a finder import refreshes the Document pane's asset list, sharing the Add pane's path.
- **M9**: the finder opens on `Ctrl+Shift+F`; `Ctrl+Shift+A` is Chromium's tab search and is now refused as reserved in a capture.

## Next

1. The owner runs Task 5.2: create D1 and R2, set the secrets, deploy, `/migrate`, health check, register both OAuth callbacks.
2. Replace the placeholder `CATALOGUE_ORIGIN` with the deployed URL, rebuild, and measure CPU for `GET /index.json` and one auth callback.
3. Run the Task 5.1 import against the deployed origin, then the real OAuth round trip in the built editor.
4. After the owner accepts, archive the plan and name the Wallpaper Engine plan active.
5. Drain `vg-699` in the next register pass.

## Blockers / unverified

- **The store Worker is not deployed**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate` or health check has run.
- **No live store path has run**: the real OAuth round trip, live CPU against the 10 ms Free tier, deployed cache behaviour and the import are unverified.
- **`CATALOGUE_ORIGIN` is still the placeholder** `https://yunari-store.workers.dev`, and no normalized video has been played in a browser.
- **A theme's `credits.json` does not survive the host library** (`vg-698`): a library-saved theme reopens with an empty credits collection.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
