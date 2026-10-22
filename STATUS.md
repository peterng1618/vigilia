# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

Execute the **R2 store backend plan** ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)): replace the GitHub catalogue with one Cloudflare Worker, D1 and private R2, with server-side counters, author unpublish and a Worker-computed version. The spec is [approved](docs/superpowers/specs/2026-10-22-r2-store-backend-design.md).

## Active work

- **Subagent-driven execution**: Phase 1 and Tasks 2.2–2.4 complete; Task 2.5 is dispatched (host store client, submission rework, GitHub path deletion). Phases 3–5 follow in plan order.
- **Task 5.2 is the owner's**: creating the Cloudflare resources and deploying is prepared by the agent, run by the owner.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts while this plan runs.
- **The catalogue is live with one real item**: `6041df49-9c61-4d51-a184-716890560bdb` (`Yunari smoke theme`, 1.0.0); Task 5.1 imports it.
- **Decision `0093`** records the backend's reuse gate and claims the four watched paths the plan writes.
- **Decisions `0088`–`0092`** carry the superseded GitHub store's measured choices; the plan keeps their wire shape and client rules.

## Last completed change

- **Submissions go to the Worker**: `themes/store-client.ts` sends the session as a bearer token on every authenticated call and none on the presigned PUT; a non-2xx throws the Worker's sentence.
- **The ladder reads `/baseline`**: `submissionFiles` bumps against the authenticated baseline envelope and returns the package, thumbnail and Worker-computed version, not an item file.
- **One submit route**: `/api/themes/submit` delegates to `catalogue/submit.ts`, answers `{ ok, status, version }`, 401 without a session, 400 for a refusal, 502 when the store is unreachable.
- **The GitHub path is gone**: the fork/PR client, device flow, CI validator, published-item reader and `github-token.json` store are deleted with their tests and options.
- **The orphaned `readBody` grew a second catalogue edge**: `catalogue/submit.ts` imports the same `server.ts` helpers `catalogue/routes.ts` already does, the same cycle class.

## Next

1. Execute the plan's phases in order; each task is reviewed before the next.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. After this plan closes, the user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
