# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

**The asset finder plan** ([`2026-10-21-asset-finder.md`](docs/superpowers/plans/2026-10-21-asset-finder.md)) is **active**, executing inline in the `asset-finder-hub` worktree: 19 tasks across seven phases. The theme store and theme-versioning specs are landed and archived. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Asset finder, Tasks 1–11, 13, 18 and 19 complete**: the wire contract, `AssetSource` port, credential store and routes, Connections tab, all four providers, the client, the modal and its three entry points are landed; fonts, the mixed grid and import (Tasks 12, 14–17) are next. Ledger: `.superpowers/sdd/2026-10-21-asset-finder/progress.md`.
- **Providers, in this order: Lucide, Lineicons, Font Awesome Free, Unsplash.** Free results only; Flaticon is skipped because its official API exposes no free/premium flag.
- **Lineicons is a dev-only dependency** (`lineicons@1.3.2`, MIT), read by a generator; no shipped dependency is added.
- **Task 15 builds the Wallpaper Engine credits types here** (user ruling, 2026-10-23); the WE plan drops its Task 8. Task 16 stays blocked on the WE host module.
- **Queued:** `2026-10-21-wallpaper-engine-import.md`, then the R2 backend [`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md).

## Last completed change

- **The finder opens three ways** (Task 11): the Add pane's own control, a File row above *Import package*, and Ctrl+Shift+A, which defers to a focused text field and reaches the shell's modal through the session's dispatcher.
- **The finder's modal** (Task 10): tabs derived from the registry's categories, per-source chips, a debounced search that discards a stale answer, failure/needs-key/empty states, and a footer action named by the category.
- **The finder's client and window** (Task 9): three fetch-only calls answer an empty listing or failed pages instead of throwing, and `Dialog` takes an optional popup class the finder sizes to the viewport.
- **Unsplash is the first image source** (Task 19): the key stays on the host, every Unsplash+ sign is dropped, `links.download_location` fires before bytes, and Verify spends one real search.
- **Connections rows explain how to get a key**: one sentence from the host registry plus a "Where to get a key" link; a credential with no guide renders nothing extra.

## Next

1. The owner reviews the plan and chooses subagent-driven or native execution.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
