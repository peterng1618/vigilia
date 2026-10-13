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
- **Phase 9 closed on 2026-10-13 and Phase 10 cannot start** — the drain's next phase is **gated on D4 and D3/D6** — D4's `vg-291` was ruled 2026-10-12 (it dissolves into `vg-292`), but the D3/D6 treatments the settings modal is being brought to are Session 2's and unrun, and **`vg-308` is the browser-pinned one carrying no marker**, so **the drain is now blocked on rulings rather than on work**; Phase 10 is the unowned mockup-parity plan (the gate's reason policy, and the settings modal's thirteen regions).
- **Every phase close names its gate command and that command's exit code** — ruled in the ledger, because "gates run" is not a fact a later session can check; `npm run gate 2>&1 | tail` reports `tail`'s code and printed "exit 0" beside three biome errors. **The browser pass is named separately, because `gate`'s `test` is `vitest run` and never runs Playwright** — a close that ran only the gate would claim browser evidence it never gathered. Phase 9's close reads **exit 0, 255 files / 3362 tests**, and names no browser run.
- **The drain's rulings are taken in batches and recorded on the rows themselves** — a row's own `detail` is where a ruling exists, in the marker format `RULED <YYYY-MM-DD>:`, because one written only into a ledger is invisible to the next session and the marker is how it is found again. The agenda classifies all 104 decision rows and the remaining ask rows go in batches; **the tally moves as they land, so none is kept here**.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.

## Last completed change

- **Phase 9 closed all three of its tasks on 2026-10-13** — both files past the 800-line stop were split by responsibility and the plans directory now answers "what is executable"; the boundary gate ran **exit 0**, 255 test files and 3362 tests, and the phase names no browser run because it changed no rendered surface.
- **`shell-layout.tsx` 984 → 534** with `shell-menu-bar.tsx` 251, `hosting-store.ts` 113 and `shell-stores.ts` 102 (`vg-276`, `verified`), split by responsibility rather than to a line count and with no re-export shim.
- **`editor-session.ts` 1088 → 660** with `editor-document.ts` 612 (`vg-374`, `verified`) — not a move but a rewrite, so equivalence rests on typecheck and the suites rather than a textual diff, and `theme-library-manager/index.test.ts` was red-proofed (2 cases fail when one comparison is inverted, restored byte-identical by `cmp` and sha256).
- **The plans directory went 15 live plans → 9, and `archive/` 32 → 38** (`vg-152`, `verified`) — six `git mv` moves, each licensed by a closure table the review re-derived; `vg-161` stays **open** on a deliberate half-measurement, its Insert complaint resolved and pinned by `shell-layout.dom.test.tsx:1169` while its View complaint is not.
- **Four rows came out of the phase and three docs moved with it** — `vg-432`, `vg-433` and `vg-434` are open, and `ownership.md`, `docs/architecture/README.md` and `manager-census.md` were corrected; **all three stale-doc findings trace to a controller-written brief that closed a directory**, which is the phase's one durable lesson.

## Next

1. **The drain's next executable phase is blocked, so the unblock is the work** — Phase 10 waits on D3/D6's treatments (`vg-308` the browser-pinned one), and the four ruling sessions (Tasks 1.2–1.5) that would settle them are the user's to answer; a four-row batch (`vg-023`, `vg-037`, `vg-123`, `vg-269`) is drafted and waiting in the drain's ledger.
2. **`vg-434` is the phase's own leftover and is not a repoint** — no check resolves a reference into the plans directory, measured at **55 of 70 register rows** and **32 of 82 repo-wide path tokens**; the fix is a new gate instrument plus two rulings about the register's semantics, so it is filed rather than fixed.
3. **Phase 6's two open rows close nowhere in this plan** — `vg-240` waits on the re-shape Task 6.1's spec describes, and `vg-342` is a rendered-surface rewrite that would reverse `4dc220c6` and needs a browser run.
4. **Closing the sixteenth acceptance item is the redesign's only remaining work** — it needs the user's ruling on the settings frame's width and on which role a palette preview bar depicts, the work on the other `fix` differences, and a decision on `vg-390`.
5. **Two of the seven stray gate cells are still live and `vg-386` is a sweep of its own** — `vg-313` ended in a gate and left the register, `vg-316` remains, and `vg-333`, `vg-335`, `vg-338`, `vg-339` closed in Phase 7; `vg-386` holds **133 candidates, none proven dead**.

## Blockers / unverified

- **What waits on the user** — three acceptance decisions (which width the settings frame takes, `vg-322`; which role a palette preview ground bar depicts; and `vg-390`'s narrowing of the parity item), **the rest of the four ruling sessions** (Session 1's remaining six and Session 2's twenty-five are the next two batches), and **the Phase 10 gate** — D4 is answered (`vg-291` ruled), and what remains is D3/D6's treatments, whose browser-pinned member `vg-308` carries no `RULED` marker. **`vg-331` does not gate it**: it is a Phase 8 work row (`DESIGN.md`'s second-highlight role plus six palette values), named in Phase 8's close rather than in Phase 10's constraints. **The colour and gradient rebuild spec needs your review decision** — [`2026-10-12-colour-and-gradient-rebuild-design.md`](docs/superpowers/specs/2026-10-12-colour-and-gradient-rebuild-design.md), committed `975a9dbd`.
- **The `renderer-core/dist` blocker this file used to carry was wrong, and measuring it is what showed that** — the package declares **no build script** (`scripts` holds `typecheck` alone), every consumer resolves it as source (`exports`, `main` and `types` all point at `./src/index.ts`, and the editor's, player's, host's, scene-fabric's and theme-package's vite aliases and tsconfig `paths` all map to `../renderer-core/src/index.ts`), and `dist/` is gitignored; the stale output is inert, not a hazard a browser run can walk into.
- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`.
- **What remains red is deliberate, and must not be read as the same thing** — Phase 5 removed `reference-theme.spec.ts`'s two `test.fail` cases, so that file's pins are gone and its cases assert the strip; `vg-204` passes today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture most likely to be misread as flake. **The browser suite has been executed once**, at `3a368c6a` on 2026-10-13: exit 1, 18 failed. **Phase 9 ran no browser pass** — it relocated two files behind unchanged public surfaces and its own Verify names typecheck, the affected suites and a re-read of the plans directory.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up; and the exit code alone is wrong too, since a red `desktop-host` project is expected here. **The registers mix `"k": "v"` and `"k":"v"` spellings**, so a row lookup must parse each line rather than match a prefix — a `startsWith('{"id":...')` matcher reported four present rows as absent. **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
