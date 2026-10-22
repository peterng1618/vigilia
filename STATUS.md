# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

Execute the **R2 store backend plan** ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)): replace the GitHub catalogue with one Cloudflare Worker, D1 and private R2, with server-side counters, author unpublish and a Worker-computed version. The spec is [approved](docs/superpowers/specs/2026-10-22-r2-store-backend-design.md).

## Active work

- **Subagent-driven execution**: Phase 1, Phase 2 and Tasks 3.1–3.3 complete; Task 3.4 is dispatched (Mine listing and host proxies). Phase 4–5 follow in plan order.
- **Task 5.2 is the owner's**: creating the Cloudflare resources and deploying is prepared by the agent, run by the owner.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts while this plan runs.
- **The catalogue is live with one real item**: `6041df49-9c61-4d51-a184-716890560bdb` (`Yunari smoke theme`, 1.0.0); Task 5.1 imports it.
- **Decision `0093`** records the backend's reuse gate and claims the four watched paths the plan writes.
- **Decisions `0088`–`0092`** carry the superseded GitHub store's measured choices; the plan keeps their wire shape and client rules.

## Last completed change

- **The Mine listing exists**: `GET /api/me/items` answers the session author's items that hold a version, newest first by `updated_at` then id, each an `entryOf` row from its latest version plus `status` and `statusReason`.
- **The host proxies it**: `GET /api/store/mine` and `POST /api/store/items/:id/unpublish|publish` reuse the sign-in module's loopback guard, send the stored bearer token, pass the Worker's status through, and answer 401/502 as `{ ok, message }`; a non-UUID path id is a 400 before any call.
- **`store-client.ts` types the transitions**: `unpublish`/`publish` answer `Transitioned` (with `status`), so the proxy hands back the state the Worker landed in.
- **Proven by** `tests/mine.spec.ts` (states, ordering including a real unpublish that must advance `updated_at`, entry shape, 401) and `packages/host/src/catalogue/routes.test.ts` (bearer, pass-through, 400/401/403/502 bodies).

## Next

1. Execute the plan's phases in order; each task is reviewed before the next.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. After this plan closes, the user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
