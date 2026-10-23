# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

**The asset finder spec is landed** ([spec](docs/superpowers/specs/2026-10-21-asset-finder-design.md)); its plan is [archived](docs/superpowers/plans/archive/2026-10-21-asset-finder.md). No implementation plan is active: the [Wallpaper Engine plan](docs/superpowers/plans/2026-10-21-wallpaper-engine-import.md) is queued and must be named active here before its Task 1 starts. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Nothing is active.** The asset finder merged to `main` at `3bd1de87`; this close-out (spec status, plan archive) is the last commit.
- **Providers shipped: Lucide, Lineicons, Font Awesome Free, Unsplash.** Free results only; Flaticon is skipped because its official API exposes no free/premium flag.
- **Lineicons is a dev-only dependency** (`lineicons@1.3.2`, MIT), read by a generator; no shipped dependency was added.
- **Queued:** `2026-10-21-wallpaper-engine-import.md` — it now owns the finder's local tab (this spec's Task 16) — then the R2 backend [`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md).

## Last completed change

- **The asset finder spec closes**: its acceptance in §12 is landed, the plan is archived with Task 16 moved to the Wallpaper Engine plan, and the spec's status records that.
- **Publication carries attribution**: a submitted package holding `credits.json` validates, asserted in `validate-item.test.ts`.
- The whole-branch review's Critical and Important findings were fixed before this close-out: the import path, the Fonts/Connections entry points, the cross-origin route guard, the credits cap, and the gate's own red steps.

## Next

1. Start the Wallpaper Engine plan (name it active in this file first).
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before that plan opens.

## Blockers / unverified

- **The finder has no Wallpaper Engine tab until that plan lands** (Task 16 moved there); no WE module exists in this tree.
- **A theme's `credits.json` does not survive the host library** (`vg-698`): the editor writes and seeds it, but the host's library import re-writes only envelope, assets and thumbnail, so a library-saved theme reopens with an empty credits collection.
- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
