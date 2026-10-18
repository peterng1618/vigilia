# Vigilia status

Updated: 2026-10-18
Branch: `develop`

## Current objective

Give every display client its own theme: `docs/superpowers/plans/2026-10-18-per-display-themes.md` (register `vg-574`) is active and lands before the theme store. The backlog drain resumes when its Phase 1 stops. Editor redesign contract: [spec](docs/superpowers/specs/2026-10-08-editor-design-language-design.md), [DESIGN.md](DESIGN.md), and [checked drawings](docs/design/mockups/README.md).

## Active work

- **Active plan:** `2026-10-18-per-display-themes.md` — [plan](docs/superpowers/plans/2026-10-18-per-display-themes.md), [spec](docs/superpowers/specs/2026-10-18-per-display-themes-design.md); execution ledger `.superpowers/sdd/2026-10-18-per-display-themes/progress.md`.
- **Phase 1 is active** (Tasks 1.1–1.8: the display record, its credential, pairing, the one-time code, the host's own monitors), made active by the user's 2026-10-18 ruling; the pre-flight scan ruled four conflicts (R1–R4) into the ledger before the first dispatch.
- **The backlog drain is suspended, not closed**: `2026-10-12-the-backlog-drain.md` resumes at Task 23.4, and its Phase 23 stays mid-phase with no seat running.
- Plan queue after this: `2026-10-18-theme-store.md` (its phase A only — B–G each need their own plan, G before C), then the panel work; the colour/gradient spec is unreviewed and unplanned.
- Recorded objectives rather than queued plans: a **native player app**, the only path to real device brightness (`vg-583`), and a **TURZX panel display** ([rough capture](docs/superpowers/specs/2026-10-18-turzx-panel-displays-design.md)), both sequenced after the theme store.
- Last census at `d4147298`: 129 open, 38 parked, 93 homeless, 56 homeless and unparked; `vg-538`'s parking makes that census historical — re-derive before quoting current totals.

## Last completed change

- The schema refuses an empty theme name and the loader names what it finds unnamed (`vg-221`): `$defs/metadata/properties/name` gains `minLength: 1`, and `namedEnvelope` supplies the document's own `id` on `validateFabricThemeEnvelope`'s success return — the place a document becomes an envelope, whatever brought the bytes.
- The review found the first version threw on `name: null` (`null.length`), the failure the migration exists to prevent, and `ThemeStore.list`'s catch turned one such document into an empty library; the guard now reads the name as a string, red-proved with `TypeError: Cannot read properties of null (reading 'length')`.
- The red proof on the integrated tree: with naming disabled, exit 1 with `expected '' to be 'nameless'`, restore proved by `cmp` + SHA-256; `npm run gate` exit 0, 265 files and 3506 tests.
- Four comments asserting the schema permits an empty name — three in the editor and the migration case's own — were corrected, the case's because `entryFor`'s `??` does not fall back on `""` and the library line read empty before this.
- Filed rather than absorbed: `vg-601` (the runtime has no twin of either bound — it repairs an empty name rather than refusing it, and stores one over 200 characters); `vg-585` gained a second sample of its 20 s timeout.

## Next

1. Phase 1 Task 1.1 (the display store) is the running seat; dispatch each next task once its review is clean.
2. Review every task against its brief and evidence; run the phase gate with the exit code and the browser results named separately.
3. Resume the drain at Task 23.4 when per-display Phase 1 stops, then the theme store's phase A; resume Phase 21 after font-picker spec approval and Phase 12 after settings-pane spec review.
4. Re-home unparked rows carried only by closed phases; never treat a mention as a live implementation home.
5. Revisit redesign's final acceptance item after carrying rows land; propagate ruled acceptance text before closing `vg-390`.

## Blockers / unverified

- User review pending: [theme store](docs/superpowers/specs/2026-10-12-theme-store-design.md), [settings pane](docs/superpowers/specs/2026-10-16-settings-pane-design.md), [colour and gradient rebuild](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md) and [font-picker keyboard model and budget](docs/superpowers/specs/2026-10-17-font-picker-keyboard-design.md); [display capabilities](docs/superpowers/specs/2026-10-18-display-capabilities-design.md) is **approved 2026-10-18 as panel-only** — no observable effect until a panel exists, so it is a phase of the panel work after this plan's Phase 1 creates the record it hangs on — and per-display itself is approved by the user's ruling to execute it.
- Decisions remain for `vg-546`, `vg-559`, `vg-350`, `vg-354` and `vg-191` (whose fixture Task 25.7 made unraisable, so it is the user's to withdraw or re-point rather than an agent's), and Phase 20 carried `vg-556` without closing it — do not invent approval or edit AGENTS.md.
- Phase 25 is complete but nothing in it ran on a physical phone, so every iOS and Android statement there is documentation; `vg-582`, `vg-588` and `vg-589` stay open, and `vg-587`'s handoff is that the secure origin is real but nothing advertises it — the printed pairing link, LAN banner, console pairing link, revoke curl, `hosting-client.ts`'s `displayUrl` and `publish-control.tsx`'s phone address all still print `http://`, and this plan's spec and plan still assert the host has no TLS, the user having ruled those surfaces belong to it.
- `vg-023`'s cancelled review needs an explicit user request to restart and `vg-370`'s resize refusal stays unestablished; `gate` runs unit tests rather than Playwright, so browser proof needs rebuilt bundles, one worker and each run's own JSON report.
- `vg-595` makes that proof unreliable rather than merely slow — the shared 4174 preview reuses an existing server, so a proof can be served by another worktree's `dist` and read green, as it did — and `vg-590` is the second file to redden that way, two being where "the box was busy" stops explaining one case; no push is authorised, `develop` remains ahead of `origin/develop`, and local work plus untracked SDD records are preserved.
