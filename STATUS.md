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
- **Active plan:** `2026-10-12-the-backlog-drain.md` — [plan](docs/superpowers/plans/2026-10-12-the-backlog-drain.md); it runs to eleven phases, and **task numbers in it are stable identifiers, not positions** (Task 6.5 was added mid-flight by a ruling), and **Phases 0 and 2–8 have closed while Phase 1 has not** — Phase 1's mechanism and four-session agenda are built but its ruling sessions (Tasks 1.2–1.5) are the user's and unrun, and **Phase 9 is on its last task**.
- **Phase 9 (W8) has closed both structural stops and has only the plans directory left** — the two splits landed as `vg-276` and `vg-374`, and **Task 9.3 is next**: `docs/superpowers/plans/` with its `README.md` must answer "what is executable" truthfully for `vg-152` and `vg-161`; **Phase 10 stays gated** on `vg-308` and `vg-331`, neither of which anyone has ruled.
- **Every phase close names its gate command and that command's exit code** — ruled in the ledger, because "gates run" is not a fact a later session can check; `npm run gate 2>&1 | tail` reports `tail`'s code and printed "exit 0" beside three biome errors. **The browser pass is named separately, because `gate`'s `test` is `vitest run` and never runs Playwright** — a close that ran only the gate would claim browser evidence it never gathered.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — a row's own `detail` is where a ruling exists, in the marker format `RULED <YYYY-MM-DD>:`, because one written only into a ledger is invisible to the next session and the marker is how it is found again. The agenda classifies all 104 decision rows and the remaining ask rows go in batches; **the tally moves as they land, so none is kept here**.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Phase 9 closed both files past the 800-line stop, split by responsibility rather than by count** — `shell-layout.tsx` 984 → **534** with `shell-menu-bar.tsx` 251, `hosting-store.ts` 113 and `shell-stores.ts` 102 (`vg-276`), and `editor-session.ts` 1088 → **660** with `editor-document.ts` 612 (`vg-374`); both rows are `verified` in the archive, and neither split left a re-export shim.
- **The second split is not a move, and its review did not treat it as one** — bodies moved through mechanical rewrites (`this.#envelope` → `this.#document.envelope`), so equivalence rests on typecheck and 255 test files rather than a textual diff; the reviewer read the extraction and found no drift, accepted the ports-at-write-time design, and marked the experiment cited for it **not reproducible**, the named line belonging to an ordering that does not exist at HEAD.
- **`vg-374`'s second half is discharged with a red-proof rather than a token test** — `theme-library-manager/index.test.ts` (331 lines, 9 cases) fails 2 cases when one comparison is inverted, and the reviewer reproduced that independently and restored the file byte-identical by `cmp` and by sha256.
- **Two rows came out of the two tasks** — `vg-432` (a settings test citing `readStorage` at a line that now lands on a JSX comment about the header strip) and `vg-433` (`EditorSession.#panelHosts` assigned and read nowhere, its seven other occurrences being the same-named constructor *option*), both re-measured by the controller before filing because the first reading of each was wrong.
- **Three architecture docs moved with the splits, and both times the brief was the reason they had not** — `ownership.md`, `README.md` and `manager-census.md` were corrected after two reviews found the owner map and the orientation doc still naming the pre-split owners; the briefs said "do not touch `docs/`" while the dispatches said to propagate, and the census's one present-tense sentence that had gone false was distinguished from its dated tables, which stay as they were.

## Next

1. **Phase 9 has one task left: the plans directory** — `vg-152` and `vg-161` need `docs/superpowers/plans/` and its `README.md` to answer "what is executable" truthfully, carrying the ruling that the unlanded `2026-10-03-editor-left-column-and-header.md` is neither archived nor decided, since its Task 3 is actively false and restoring it would delete tests a closed plan made load-bearing.
2. **Phase 6's two open rows close nowhere in this plan** — `vg-240` waits on the re-shape Task 6.1's spec describes, and `vg-342` is a rendered-surface rewrite that would reverse `4dc220c6` and needs a browser run.
3. **The drain's four ruling sessions are the user's to answer, and a four-row batch is drafted and waiting** — `vg-023` (does the canvas dim when a group is entered), `vg-037` (a Circle's frost reads stronger than a Rect's at one value), `vg-123` (should a part snap to a part), `vg-269` (what a pane's title bar counts) are written out with their options in the drain's ledger under "The next ask batch", and none of the four has been ruled.
4. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
5. **Two of the seven stray gate cells are still live and Phase 8 closed `vg-317`** — `vg-313` ended in a gate and left the register; `vg-316` remains, and `vg-333`, `vg-335`, `vg-338`, `vg-339` closed in Phase 7. **`vg-386` is a sweep of its own** — 133 candidates, none proven dead.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item) and **the rest of the four ruling sessions**, answered in batches rather than waiting on a session nobody has held — Session 1's remaining six and Session 2's twenty-five are the next two batches. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`: its three forks are decided from your rulings, and the vendored ReUI port plus its two open questions (where the swatch lives, which presets ship) are yours.
- **The `renderer-core/dist` blocker this file used to carry was wrong, and measuring it is what showed that** — the package declares **no build script** (`scripts` holds `typecheck` alone), every consumer resolves it as source (`exports`, `main` and `types` all point at `./src/index.ts`, and the editor's, player's, host's, scene-fabric's and theme-package's vite aliases and tsconfig `paths` all map to `../renderer-core/src/index.ts`), and `dist/` is gitignored; the stale output is inert, not a hazard a browser run can walk into.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — Phase 5 removed `reference-theme.spec.ts`'s two `test.fail` cases, so that file's pins are gone and its cases assert the strip; `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake. **The browser suite has been executed once**, at `3a368c6a` on 2026-10-13: exit 1, 18 failed, and neither Phase 9 split ran it — a pure relocation and a doc-only fix each ran `typecheck`, the affected suites and `biome`, not Playwright.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
