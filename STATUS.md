# Vigilia status

Updated: 2026-10-22
Branch: `develop`

## Current objective

Give every display client its own theme, then let a person browse and install the themes it holds: `2026-10-18-per-display-themes.md` is **complete and archived**, and the store spec's phases **A, B, C, D and G are landed** — C is live end to end and **D's install works in the app**. **E cannot start**: it needs an OAuth app registered by the user. **F** waits on E. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-22-theme-store-submission.md` — the store spec's **phase E** (submission), ten tasks; `docs/decisions/0090` claims the paths it writes, and phase D's ledger is `.superpowers/sdd/2026-10-21-theme-store-install/progress.md`.
- **Queued, in order:** `2026-10-21-wallpaper-engine-import.md`, then `2026-10-21-asset-finder.md`; neither starts until the user picks one.
- **The catalogue repo `peterng1618/vigilia-store` is live**: the Action pins app commit `2c7e97b8e63bf78e2fddd65f814fc4b2f61b48ca`, and the raw `index.json` answers `200` with zero entries because items arrive with E.
- **Decision `0088`**: the editor's browser fetches that index from the raw path, which revalidates conditionally for free against a server measured to answer `304`.
- **Decision `0089`**: the host, not the browser, fetches a package — measured, since the asset sends no `access-control-allow-origin` on either hop.
- **Five rows filed by this close** — `vg-691` to `vg-695`: other loopback routes unguarded, in-place settings saves, raw error text, the queue's key, and the `server.test.ts` assignment flake.

## Last completed change

- **Phase E's whole-branch review fixed** (17 findings): author check fails the auto-merge job and gates every later step, ownership read from the directory's latest `main` commit, renames and deletions counted, and `workflow_run` retries after validate.
- **App guards**: `packageUrl` must equal the store's canonical URL, the package is capped before upload, the login is validated, temp token files are cleared, a repeat submission answers the open PR's link, and remote links must be `https://`.
- **Submit state is scoped by item id**, so one theme's link, refusal or device code can never draw on another theme's surface.
- **Evidence**: typecheck exit 0; `npm run test` exit 0 with 4198 tests in 300 files; workflow YAML parses; six guards red-proved by disabling each and watching its test fail.

## Next

1. **Phase E (submission)** needs the user to register an OAuth app; until then it has no first action.
2. Decide which queued plan opens next: `wallpaper-engine-import` or `asset-finder`.
3. Weigh `vg-620` (a client disconnecting mid-stream kills the host) and `vg-626` (the red `design:check`) before the next plan opens.
4. User review pending: [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md).
5. The next register pass starts from `vg-691`…`vg-695`, which this phase filed rather than fixed.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`**: the remainder is 20 against its ceiling of 19, and no file this phase touched is among them (`vg-626`, `vg-426`).
- **`capture-freshness` is red at `vg-402`**: 11 registered captures predate the chrome changes — re-measured 2026-10-21 as exit 1 with 11 stale rows.
- **The store's online claims are still made against routed fixtures**, never the live origin: the catalogue is empty until E, so no thumbnail has ever been drawn from jsDelivr.
- **`vg-685` and `vg-686` remain known holes**: no copy test reads the badge or the provenance line, and three controls commit a draft without the composing guard.
- **`server.test.ts` flakes on assignment cases** in about one full run in three, measured pre-existing at `5e5be86f` (`vg-695`).
