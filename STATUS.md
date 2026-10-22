# Yunari status

Updated: 2026-10-23
Branch: `main`

## Current objective

**The asset finder plan** ([`2026-10-21-asset-finder.md`](docs/superpowers/plans/2026-10-21-asset-finder.md)) is **active**, executing inline in the `asset-finder-hub` worktree: 19 tasks across seven phases. The theme store and theme-versioning specs are landed and archived. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Asset finder, Tasks 1–15, 18 and 19 complete**: the wire contract, `AssetSource` port, credential store and routes, Connections tab, all four providers, the client, the modal, its three entry points, the font picker's move, the mixed grid and import-with-credits are landed; the browser boundary (Task 17) is next. Ledger: `.superpowers/sdd/2026-10-21-asset-finder/progress.md`.
- **Providers, in this order: Lucide, Lineicons, Font Awesome Free, Unsplash.** Free results only; Flaticon is skipped because its official API exposes no free/premium flag.
- **Lineicons is a dev-only dependency** (`lineicons@1.3.2`, MIT), read by a generator; no shipped dependency is added.
- **Task 15 builds the Wallpaper Engine credits types here** (user ruling, 2026-10-23); the WE plan drops its Task 8. Task 16 stays blocked on the WE host module.
- **Queued:** `2026-10-21-wallpaper-engine-import.md`, then the R2 backend [`2026-10-23-r2-store-backend.md`](docs/superpowers/plans/2026-10-23-r2-store-backend.md).

## Last completed change

- **An imported asset carries its attribution** (Task 15): the finder's action fetches the bytes, declares them through the asset manager, writes the source's credit, then runs the kind's own consequence (place an icon, set an image as the background); the package's `credits.json` is written at save and seeded when a document opens with one.
- **One mixed grid** (Task 14): two sources' pages alternate row by row, Load more appends each page's new rows after the ones shown and asks only sources that still hold a cursor, and the first answer names the host the term reaches, once.
- **The font picker lives in the finder** (Task 12): the inspector's face field is a button that opens Fonts, the Fonts body is the catalogue's own `FontPicker` in a `FontsBodyHost` that owns the specimen cache and favourites, and the session's façade builds that body and applies a picked face to the selected text's preset.
- **The finder opens three ways** (Task 11): the Add pane's own control, a File row above *Import package*, and Ctrl+Shift+A, which defers to a focused text field and reaches the shell's modal through the session's dispatcher.
- **The finder's modal** (Task 10): tabs derived from the registry's categories, per-source chips, a debounced search that discards a stale answer, failure/needs-key/empty states, and a footer action named by the category.

## Next

1. The owner reviews the plan and chooses subagent-driven or native execution.
2. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
3. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.

## Blockers / unverified

- **A theme's `credits.json` does not survive the host library** (`vg-698`): the editor writes and seeds it, but the host's library import re-writes only envelope, assets and thumbnail, so a library-saved theme reopens with an empty credits collection.
- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
