# Vigilia status

Updated: 2026-10-13
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–8 are closed and the keyboard-only walkthrough plan closed today, so
every instrument the redesign asked for exists. **The spec's Acceptance section
was counted on 2026-10-12 rather than reviewed: fifteen of its sixteen items have
a check that runs and passes, and the sixteenth does not** — see *Next*. The target is
[`DESIGN.md`](DESIGN.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in `DESIGN.md` and still does not look like the mockup. **That
section now states where each item stands**, which until today only plan 6's archived
ledger did.

## Active work

<!-- Machine-read: the active-plan bullet must stay exactly `- **Active plan:** \`<path>\``; scripts/sdd-checkpoint.mjs and check-status.mjs read only that form (docs/engineering/gotchas.md). -->
- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); it runs to eleven phases, and **task numbers in it are stable identifiers, not positions** (Task 6.5 was added mid-flight by a ruling), and **Phases 0 and 2–9 have closed while Phase 1 has not** — Phase 1's mechanism and four-session agenda are built but its ruling sessions (Tasks 1.2–1.5) are the user's and unrun.
- **Phase 9 closed on 2026-10-13 and Phase 10 is gated** — the drain's next phase is **gated on D4 and D3/D6** (its own Constraints line): D4's `vg-291` was ruled 2026-10-12, and what remains is the D3/D6 treatments Session 2 has not taken, `vg-308` being the browser-pinned one with no `RULED` marker, so **the drain is blocked on rulings rather than on work**.
- **The redesign's sixteenth acceptance item was worked rather than waited on, and both of its executable pieces are now taken** — the first clause's capture pair and `vg-319`'s read-only inset; the paths that remain are rulings or design calls, and **`vg-342`'s ruling needs the user's word because it reverses `4dc220c6`**.
- **Every phase close names its gate command and that command's exit code** — ruled in the ledger, because "gates run" is not a fact a later session can check; `npm run gate 2>&1 | tail` reports `tail`'s code and printed "exit 0" beside three biome errors. **The browser pass is named separately, because `gate`'s `test` is `vitest run` and never runs Playwright** — and **`gate` also omits `npm run design:check`, which CI runs as its own step** (`vg-435`).
- **The drain's rulings are taken in batches and recorded on the rows themselves** — a row's own `detail` is where a ruling exists, in the marker format `RULED <YYYY-MM-DD>:`, because one written only into a ledger is invisible to the next session and the marker is how it is found again. The agenda classifies all 104 decision rows and the remaining ask rows go in batches; **the tally moves as they land, so none is kept here**.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — `vg-240`'s protocol spec landed 2026-10-13 (`docs/superpowers/specs/2026-10-13-snap-manager-protocol-design.md`, 280 lines, no stubs), so what remains is the re-shape it describes, which is canvas work with no redesigned surface in it.

## Last completed change

- **The redesign's unmet acceptance item took its first clause** — the control set's capture pair (`controls-capture-graphite.png`, `controls-capture-editorial.png`) now sits in `docs/design/mockups/current/` beside `controls.html` and `controls-light.html`, run through the already-registered `control-set` action, and both PNGs are byte-identical to the copies already in `docs/evidence/screenshots/`, so the pair beside the drawing is the same evidence rather than a second render.
- **`controls-light.html` is named for the `light` palette and draws `editorial`'s** — it declares `#fffdf7`, `#f5f1e8` and `#14120e`, which is `editor-shell.css:186-195`; `light` is `editor-shell.css:400-402`'s mint, and the file's name, its `<title>`, `docs/design/mockups/README.md:25` and the parity row's own region label (`mockup-values.ts:925`) all say `light`.
- **Filed `vg-436` rather than fixed, and the capture placement stands** — the two repairs (redraw against the mint, which changes what the parity instrument checks, or rename to `controls-editorial.html` across six sites) are different answers to what the control set's second drawing is for; the pair matches by content because the capture's ground is editorial and so is the drawing's, so only the name is wrong.
- **`npm run design:check` was exit 1 at HEAD and is now exit 0** — Phase 8's rail `right: -7px` had no `CEILINGS` entry, now recorded by name with its reason, and the row's old `padding: 3px` licence was removed in the same change because the instrument reddens on an exemption that matches nothing.
- **Evidence, each with its command and code** — `npm run typecheck` **0**, `npm run gate` **0** (255 test files, 3362 tests), `npm run design:check` **0**, and `design-language.spec.ts`'s *"the shell and the settings modal are what the drawings draw"* **1 passed** on a rebuilt editor bundle.

## Next

1. **The drain's next executable phase waits on rulings, and the unblock is the work** — Phase 10 needs the D3/D6 treatments Session 2 has not taken (`vg-308` the browser-pinned one), and a four-row batch (`vg-023`, `vg-037`, `vg-123`, `vg-269`) is drafted and waiting in the drain's ledger.
2. **The sixteenth acceptance item's first clause has landed and its remaining paths are each a decision, not a task** — `vg-322` is parked transitively on the user-parked `vg-330`; `vg-316` repaints `--vigilia-control-bg`, which `design-language.spec.ts` names as editorial's one licensed exception; `vg-319`'s first and third facts need to know which drawing wins a shared heading (10px uppercase against 12px sentence case) and whether §5 rule 2 binds a read-only `dl` at all; `vg-274`'s spacing pass is a design pass by its own measurement; `vg-436` decides whether `controls-light.html` is redrawn as `light` or renamed `controls-editorial`; and `vg-390` is the plans 1–3 wording.
3. **`vg-342` needs the user's word before anything moves** — either its ruling is re-read as "the descriptor route should have a **React** owner", which makes the work a control in `selection-inspector/` and lets `settings-field.ts` retire, or the imperative island is accepted on purpose and the Acceptance section's React clause gains a named exemption beside ADR-0033's.
4. **`vg-435` needs a decision about the gate itself** — `npm run gate` calls itself "the one command that means green" and omits `npm run design:check`, which CI runs as its own step; two consecutive closes ran only the gate over a red check, so either `design:check` joins `gate` or the close recipe names both commands and both exit codes.
5. **`vg-434` is the phase's own leftover and is not a repoint** — no check resolves a reference into the plans directory, measured at **55 of 70 register rows** and **32 of 82 repo-wide path tokens**; the fix is a new gate instrument plus two rulings about the register's semantics. **`vg-386` is a sweep of its own** — 133 candidates, none proven dead.

## Blockers / unverified

- **What waits on the user** — the ruling sessions (Session 1's remaining six and Session 2's twenty-five are the next two batches), **the Phase 10 gate** (`vg-308`), three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item), **the `vg-342` conflict**, and **the colour and gradient rebuild spec's review** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`.
- **The `renderer-core/dist` blocker this file used to carry was wrong, and measuring it is what showed that** — the package declares **no build script** (`scripts` holds `typecheck` alone), every consumer resolves it as source (`exports`, `main` and `types` all point at `./src/index.ts`, and the editor's, player's, host's, scene-fabric's and theme-package's vite aliases and tsconfig `paths` all map to `../renderer-core/src/index.ts`), and `dist/` is gitignored; the stale output is inert, not a hazard a browser run can walk into.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — Phase 5 removed `reference-theme.spec.ts`'s two `test.fail` cases, so that file's pins are gone and its cases assert the strip; `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake. **The browser suite has been executed once as a whole**, at `3a368c6a` on 2026-10-13: exit 1, 18 failed; **since then only targeted specs have run**, the parity case above on a rebuilt bundle.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. **The registers mix `"k": "v"` and `"k":"v"` spellings**, so a row lookup must parse each line rather than match a prefix. **Playwright's webServer is `vite preview`**, so a browser run reads `dist` — a source change needs a rebuild first. **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
