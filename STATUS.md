# Vigilia status

Updated: 2026-10-21
Branch: `develop`

## Current objective

Give every display client its own theme, then let a person browse the themes it holds: `2026-10-18-per-display-themes.md` is **complete, reviewed and archived**, and `2026-10-18-theme-store.md`'s phase A is closed with its spec **accepted 2026-10-21**. The store spec's phases **A, B and G are landed**, and **phase C is in flight** under `2026-10-21-theme-store-online-tab.md`; D–F remain, each needing its own plan and an external gate. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), [checked drawings](docs/design/mockups/README.md). **The backlog drain has no executable work left.**

## Active work

- **Active plan:** `docs/superpowers/plans/2026-10-21-theme-store-online-tab.md` — the store spec's **phase C**, eight tasks dispatched one seat at a time; its ledger is `.superpowers/sdd/2026-10-21-theme-store-online-tab/progress.md`.
- Its scope: the online half as a second `ItemSource` over the catalogue's `index.json`, that index's shape owned by `renderer-core`, the generator the catalogue's Action runs, the online cell and the modal's online facts.
- **Decision `docs/decisions/0088`**: the editor's **browser** fetches the index from the raw path, because it revalidates conditionally for free against a server measured to answer `304` while Node's `fetch` has no HTTP cache at all; a script cannot set `If-None-Match` on either route (preflight `403`).
- **The catalogue repo is `peterng1618/vigilia-store`**, created public; its workflow and README are committed locally in `C:\tmp\vigilia-store` and **not pushed**, because the Action pins `dfb51024` and `origin/develop` is 48 commits behind.
- D–F cannot start: D needs open question 1 decided, E needs D and a registered OAuth app, F needs E and the ffmpeg licence read.
- **The drain still has no executable work left** — its ledger is `.superpowers/sdd/2026-10-12-the-backlog-drain/progress.md`, and the panel work sits behind the store's remaining phases.

## Last completed change

- **Phase C's Task 6: the modal's online facts** — an item carrying `catalogue` joins its downloads and favourites to the caption's right-hand end (`1.4.0 · 2026-10-14 · 1,204 · 38`); a library item's caption is unchanged.
- **The footer's action set is a function of `installStateOf(item)`** — `none` keeps the library's four, `installed` draws the control-free mark, and `install`/`update` draw disabled buttons with their reason; the modal never compares a version itself.
- **No new copy** — the footer readings and the disabled reason reuse `store.cell.installStates` and `store.cell.unavailable`, and each count is a bare number through the modal's own `Intl.NumberFormat("en-US")`, as the cell's is.
- **Evidence**: store-mode 6 files / 88 tests, copy 8, `typecheck` and `biome check ..` exit 0; both red proofs measured — the comparison mutated to `installed` failed the Install arm, the update branch failed the Update arm, and removing the catalogue guard threw `Cannot read properties of undefined (reading 'downloads')`.

## Next

1. **Execute phase C's eight tasks**, ending at the boundary's five rendered claims driven against a routed `index.json` rather than the live origin.
2. **Push `develop`, then push the catalogue repo** — Task 3's one remaining step, and one action; a shared-branch push is why it waits for the user.
3. `vg-688` asks for a spec edit and `vg-689` for a guard on a duplicated wire type; `vg-690` is the store's missing status bar — all three are rulings or small surfaces rather than this plan's tasks.
4. Decide whether `vg-626` (the red `design:check`) blocks the next plan as it did the per-display close; `vg-620` is the next to weigh, since a client disconnecting mid-stream kills the host.
5. User review pending: [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191`.

## Blockers / unverified

- **`npm run gate` is RED at `design:check`** and the closed plan records it as a named exception, never as a passed gate: the design-token remainder is 20 against its ceiling of 19, none of the 20 being a file that plan touched, and every other step exits 0 alone; raising `remainderCeiling` is the one move the instrument exists to refuse (`vg-626`, `vg-426`).
- **The gate is also red at random, which is older than any plan here** — `vg-661` names a full-suite timeout two runs answered differently, and `vg-595` records the shared preview serving another worktree's `dist`, so a red sample is not evidence until it is attributed.
- **Phase C's claims will be against a routed index, never the live origin**, because the catalogue holds no items until phase E; and the provenance feature stays drawn rather than reachable until phase D installs a theme.
- **`vg-685` and `vg-686` are known holes rather than oversights**: no copy test reads the badge or the provenance line because they are plain spans, and three controls commit a draft without the composing guard, so an IME's Enter commits a half-typed string there.
- **Earlier plans' carried limits are not repeated here** — each lives in its own ledger under `.superpowers/sdd/`, including the unverified surfaces Phase 25 never ran on a physical phone, the glass fix proved in desktop Chromium only, and `vg-582`, `vg-588` and `vg-589` which stay open.
