# Vigilia status

Updated: 2026-10-22
Branch: `main`

## Current objective

The theme store spec (phases A–G) and the theme-versioning spec are **landed**, their plans archived: semver computed from the published package, UUID theme ids and a remix credit are in the product. **No plan is running**; the user picks the next one from the queue. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; the user picks when one starts.
- **The catalogue is live with one real item**: `6041df49-9c61-4d51-a184-716890560bdb` (`Vigilia smoke theme`, 1.0.0), and `ci/catalogue-workflows` is merged so the `682379fc` pin and UUID regex are live.
- **Decisions `0088`–`0092`** carry the store's measured choices: raw-path index, host-side download, a hand-rolled GitHub client, a bundled GPL `ffmpeg-static`, and the token ratchet's scope.
- **Captures `store-submit-version` and `store-remix-credit`** are the newest registered actions, beside the install and submission ones.

## Last completed change

- **4K video is allowed**: `VIDEO_LIMITS.maxLongEdge` 1920 → 4096, with a capped-CRF ladder (6 Mbit/s at 1920, 12 at 2560, 20 at 4096) so 30 s stays inside the asset cap.
- **Audio and `+faststart` are fixed by stream copy**, not re-encode; the two new tests were red-proofed by disabling the copy branch, and the output is still re-probed.
- **Caps raised together**: asset 80 MiB, total 90 MiB, archive 95 MiB (under GitHub's 100 MiB), zip entry 80 MiB; `wide.mp4` regenerated at 5120 px; full gate 4385 tests green.

## Next

1. Weigh `vg-620` (a client disconnecting mid-stream kills the host) before the next plan opens.
2. The user picks the next queued plan; the next register pass starts from `vg-691`…`vg-697`.
3. A packaged release owes the GPL source offer for `ffmpeg-static`.

## Blockers / unverified

- **The rescoped remainder leaves player and host chrome outside the design language** (decision `0092`); they can drift from the editor's scales, and no instrument reports it.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork. PR #9 exercised only the verified-author first-submission arm.
- **No normalized video has been played back in a browser**, and the catalogue holds only the smoke item.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
