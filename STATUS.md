# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

Close the **R2 store backend** plan ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)) locally: the Worker, D1 and R2 code is complete and gated, and only the owner's deploy and live proof remain.

## Active work

- **The R2 store backend plan is complete locally**; Task 5.4 closed it and the plan stays in `docs/superpowers/plans/` pending the owner's acceptance.
- **Task 5.2 is owner-run and pending**: Cloudflare resources, secrets, deploy, `/migrate`, health check, both OAuth callbacks and CPU measurement.
- **Task 5.1's import is unrun**: the smoke item `6041df49-9c61-4d51-a184-716890560bdb` exists only in the old catalogue; the script is ready.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts until this plan is accepted.
- **One open finding from this close-out**: `vg-699` stale `vite preview` reuse on a shared port; `vg-700`'s `scratch-gate` self-test is fixed and the gate is green.
- **Decision `0093`** records the backend's reuse gate; `0088`–`0092` carry the superseded GitHub store's choices.

## Last completed change

- **Finalize replays no longer clobber later transitions**: only a retry whose item has not moved since the version row landed (`item.updated_at < existing.created_at`) applies the status transition, so `unpublished`, `rejected` and an unverified author's demotion survive a replayed presign.
- **The submit route clears the session only on an authenticated call's 401**, so an expired presigned PUT signature no longer signs the author out.
- **The route contract is asserted directly**: a takedown answer is 409 with its stored reason, and a differing-bytes loser is 409.
- **Red-proofs**: the settle guard and the 401 gate were removed; the three replay tests and the PUT-401 case failed, restored `cmp`-clean from `C:\tmp\r2-redproof`.

## Next

1. The owner runs Task 5.2: create D1 and R2, set the secrets, deploy, `/migrate`, health check, register both OAuth callbacks.
2. Replace the placeholder `CATALOGUE_ORIGIN` with the deployed URL, rebuild, and measure CPU for `GET /index.json` and one auth callback.
3. Run the Task 5.1 import against the deployed origin, then the real OAuth round trip in the built editor.
4. After the owner accepts, archive the plan and start the next queued plan.
5. Drain `vg-699` in the next register pass.

## Blockers / unverified

- **The store Worker is not deployed**: no D1 database, R2 bucket, secret, real `database_id`, deploy, `/migrate` or health check has run.
- **No live store path has run**: the real OAuth round trip, live CPU against the 10 ms Free tier, deployed cache behaviour and the import are unverified.
- **`CATALOGUE_ORIGIN` is still the placeholder** `https://yunari-store.workers.dev`, and no normalized video has been played in a browser.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
