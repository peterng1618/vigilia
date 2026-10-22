# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

Give every display client its own theme, then let a person browse, install and submit themes: `2026-10-18-per-display-themes.md` is **complete and archived**, and the store spec's phases **A, B, C, D, E and G are landed**. **F** (the publish-time normalizer and the media caps) is planned and starts next. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-22-theme-store-media.md` — the store spec's **phase F**, five tasks; `docs/decisions/0091` claims the paths it writes, and phase E's ledger is `.superpowers/sdd/2026-10-22-theme-store-submission/progress.md`.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts until F closes or the user picks one.
- **The catalogue repo `peterng1618/vigilia-store` is live**: `validate` and `auto-merge` workflows, a verified-author list holding one login, and `index.json` answering `200` with zero entries.
- **A merge regenerates the listing** through `workflow_call`, because a `GITHUB_TOKEN` push starts no workflow — a defect a live proof found and the fix closed.
- **Decision `0090`** (a hand-rolled client) and **`0091`** (the normalizer bundles a GPL `ffmpeg-static`) carry the phase E and F mechanism choices.

## Last completed change

- **Phase F task 5**: the Add pane offers `Normalize video` and `Fill the artboard` for a declared video only; `cover` carries the artboard's own aspect.
- **The master is never replaced silently**: the host's copy is held, a refusal shows the host's sentence and writes nothing, and `Use the normalized copy` swaps the bytes in place with one history entry.
- **`AssetManager.replaceBytes`** swaps bytes the manager did not read from a file, keeping the declaration's id, path and metadata; the pane posts and reads the host route itself.
- **Evidence**: 22 pane DOM tests, 75 affected editor tests, `typecheck`, `biome check`, `build` and the desktop Playwright claim all exit 0; the new `editor-video-normalize` capture is registered and shows the refusal beside both controls.

## Next

1. Open phase F: `2026-10-22-theme-store-media.md` — the video property check, its caps at three doors, then the normalizer.
2. Decide which queued plan opens after F: `wallpaper-engine-import` or `asset-finder`.
3. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
4. User review pending: [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md).
5. The next register pass starts from `vg-691`…`vg-696`.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: the remainder is 20 against its ceiling of 19, and no file this phase touched is among them (`vg-626`, `vg-426`).
- **`capture-freshness` is red at `vg-402`**: 11 registered captures predate the chrome changes.
- **The auto-merge workflow's unverified-author and ownership arms are reasoned from the YAML**, not exercised: both need a second GitHub account with a fork.
- **The catalogue is empty**, so no store claim has ever run against real items, a real thumbnail or a real package.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
