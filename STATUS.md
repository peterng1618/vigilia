# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

Execute the **R2 store backend plan** ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)): replace the GitHub catalogue with one Cloudflare Worker, D1 and private R2, with server-side counters, author unpublish and a Worker-computed version. The spec is [approved](docs/superpowers/specs/2026-10-22-r2-store-backend-design.md).

## Active work

- **Subagent-driven execution**: Phases 1–3 and Tasks 4.1–4.2 complete; Task 4.3 is next (status badges and unpublish). Tasks 4.4–4.5 and Phase 5 follow in plan order.
- **Task 5.2 is the owner's**: creating the Cloudflare resources and deploying is prepared by the agent, run by the owner.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts while this plan runs.
- **The catalogue is live with one real item**: `6041df49-9c61-4d51-a184-716890560bdb` (`Yunari smoke theme`, 1.0.0); Task 5.1 imports it.
- **Decision `0093`** records the backend's reuse gate and claims the four watched paths the plan writes.
- **Decisions `0088`–`0092`** carry the superseded GitHub store's measured choices; the plan keeps their wire shape and client rules.

## Last completed change

- **The author's own listing**: `mine-source.ts` reads `GET /api/store/mine`, reuses the public parser and `catalogueItemOf`, and carries `status`/`statusReason` on each `StoreItem`, dropping a state it cannot name.
- **The Mine toggle**: `mine-listing.ts` probes `/api/store/session` once and owns the toggle and the source choice; signed out draws no control, and turning it on moves the region to the online half.
- **The public filters still apply** to Mine rows, and the empty sentence is the source's own (`uiCopy.store.mine.empty`).
- **Proven by** 8 new `mine-source` cases and 3 region DOM cases; `region.tsx` stays at 799 lines and `ui-copy.ts` gains `mine` and `status`.

## Next

1. Execute the plan's phases in order; each task is reviewed before the next.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. After this plan closes, the user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
