# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

The theme store spec (phases A–G) and the theme-versioning spec are **landed**, their plans archived: semver computed from the published package, UUID theme ids and a remix credit are in the product. **No plan is running**; the user picks the next one from the queue. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **The R2 store backend plan** ([`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md)) is written and **awaits the owner's execution choice**; the spec was approved 2026-10-23 and no task has run.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue is live with one real item**: `6041df49-9c61-4d51-a184-716890560bdb` (`Yunari smoke theme`, 1.0.0), and `ci/catalogue-workflows` is merged so the `682379fc` pin and UUID regex are live.
- **Decisions `0088`–`0092`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, a bundled GPL `ffmpeg-static`, and the token ratchet's scope.
- **Captures `store-submit-version` and `store-remix-credit`** are the newest registered actions, beside the install and submission ones.

## Last completed change

- **Orca is documented as an execution venue**: a worktree runs inside the plan `STATUS.md` names, its `.superpowers/` ledger is local to it, and liveness comes from `orca worktree show` or `terminal wait`.
- **The register stays `docs/product/backlog.jsonl`**: Orca links issues and PRs to a worktree, it does not own a register, so no row moves into GitHub issues.
- **Fixed Playwright port ranges are recorded** so two worktrees never run the same project at once, and `docs/product/probes/cdp.mjs` now resolves Playwright from the checkout instead of `D:/git-repos/yunari`.

## Next

1. The owner reviews the plan and chooses subagent-driven or native execution.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
