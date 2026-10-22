# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

**The asset finder plan** ([`2026-10-21-asset-finder.md`](docs/superpowers/plans/2026-10-21-asset-finder.md)) is **active**, executing inline in the `asset-finder-hub` worktree: 17 tasks across six phases. The theme store and theme-versioning specs are landed and archived. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Asset finder, Phase 1 complete**: credential store, four host routes and the Connections tab are landed (Tasks 1–4). Ledger: `.superpowers/sdd/2026-10-21-asset-finder/progress.md`.
- **Providers, in this order after the registry (Tasks 5–8): Lucide, Lineicons, Font Awesome Free, Unsplash.** Free results only; Flaticon is skipped because its official API exposes no free/premium flag.
- **Lineicons is a dev-only dependency** (`lineicons@1.3.2`, MIT), read by a generator; no shipped dependency is added.
- **Task 15 builds the Wallpaper Engine credits types here** (user ruling, 2026-10-23); the WE plan drops its Task 8. Task 16 stays blocked on the WE host module.
- **Queued:** `2026-10-21-wallpaper-engine-import.md`, then the R2 backend [`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md).

## Last completed change

- **The Connections tab (Task 4)** lists known credentials, shows `Saved ····<hint>` or `Not set`, and saves/clears/verifies through the host; no value is ever rendered.
- **Credential rows report `verify`**, so Verify is disabled where the host has no check.
- **The host answers four credential routes** (Task 3), write-only to the browser, loopback-only, with cookie writes refused naming R10.

## Next

1. The owner reviews the plan and chooses subagent-driven or native execution.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
