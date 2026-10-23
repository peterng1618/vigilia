# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

Execute the **R2 store backend plan** ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)): replace the GitHub catalogue with one Cloudflare Worker, D1 and private R2, with server-side counters, author unpublish and a Worker-computed version. The spec is [approved](docs/superpowers/specs/2026-10-22-r2-store-backend-design.md).

## Active work

- **Subagent-driven execution**: Phases 1–4, Task 5.1, Task 5.2's preparation and Task 5.3 are complete; the owner-run deployment and Task 5.4's close-out are pending.
- **Task 5.2 is the owner's**: creating the Cloudflare resources and deploying is prepared by the agent, run by the owner.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts while this plan runs.
- **The catalogue is live with one real item**: `6041df49-9c61-4d51-a184-716890560bdb` (`Yunari smoke theme`, 1.0.0); Task 5.1 imports it.
- **Decision `0093`** records the backend's reuse gate and claims the four watched paths the plan writes.
- **Decisions `0088`–`0092`** carry the superseded GitHub store's measured choices; the plan keeps their wire shape and client rules.

## Last completed change

- **`store-mine.spec.ts` proves Mine, Unpublish and Republish in the built editor bundle**, with the session probe, the author's listing and both command POSTs answered by `page.route`.
- **Three captures are registered and inspected**: `store-mine-listing`, `store-mine-unpublish` and `store-mine-republish`, all `-desktop-chromium`.
- **A refused unpublish prints the Worker's own sentence in the store's live region** and leaves the row and its offered command unchanged.

## Next

1. Execute the plan's phases in order; each task is reviewed before the next.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. After this plan closes, the user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The store Worker is not deployed**: no D1, R2 bucket, secret, `database_id`, deploy, `/migrate`, D1 migration or health check has run, and the owner must register both OAuth callbacks.
- **No live store path has run**: OAuth round trip, live CPU (10 ms Free threshold), live cache behaviour and the Task 5.1 import are unverified; `CATALOGUE_ORIGIN` still points at the placeholder, the catalogue holds only the smoke item and no normalized video has been played in a browser.
- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
