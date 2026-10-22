# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

**The asset finder plan** ([`2026-10-21-asset-finder.md`](docs/superpowers/plans/2026-10-21-asset-finder.md)) is **active**, executing inline in the `asset-finder-hub` worktree: 19 tasks across seven phases. The theme store and theme-versioning specs are landed and archived. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Asset finder, Tasks 1–15, 17, 18 and 19 complete**: the wire contract, `AssetSource` port, credential store and routes, Connections tab, all four providers, the client, the modal, its three entry points, the font picker's move, the mixed grid, import-with-credits and the browser boundary are landed; Task 16 waits on the Wallpaper Engine host module. Ledger: `.superpowers/sdd/2026-10-21-asset-finder/progress.md`.
- **Providers, in this order: Lucide, Lineicons, Font Awesome Free, Unsplash.** Free results only; Flaticon is skipped because its official API exposes no free/premium flag.
- **Lineicons is a dev-only dependency** (`lineicons@1.3.2`, MIT), read by a generator; no shipped dependency is added.
- **Task 15 builds the Wallpaper Engine credits types here** (user ruling, 2026-10-23); the WE plan drops its Task 8. Task 16 stays blocked on the WE host module.
- **Queued:** `2026-10-21-wallpaper-engine-import.md`, then the R2 backend [`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md).

## Last completed change

- **The finder's browser boundary** (Task 17): `tests/e2e/asset-finder.spec.ts` asserts the mixed grid with no shared id, the chip that drops a source and its requests, a failure beside a survivor, Load more's per-source cursors, the host notice appearing once, the stale answer's discard, and the font field opening Fonts.
- **Four captures, registered first**: Fonts, mixed icons, a failed source, and Connections showing the key guide and its link.
- **Three red-proofs** (source badge, disabled chip, stale answer) each failed when its code was broken and passed when restored from `cmp`-verified copies outside the repo.
- **The stale test now really races**: it waits for the first request before issuing the second, so the ticket guard is what it exercises.
- **A result card is its content's height**: one grid class ends the stretch to the footer, asserted by a bounding-box check in the mixed-grid test.

## Next

1. The final whole-branch review, then finishing the branch.
2. Task 16 waits on the Wallpaper Engine host module (queued plan).
3. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.

## Blockers / unverified

- **A theme's `credits.json` does not survive the host library** (`vg-698`): the editor writes and seeds it, but the host's library import re-writes only envelope, assets and thumbnail, so a library-saved theme reopens with an empty credits collection.
- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
