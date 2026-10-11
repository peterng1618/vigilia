# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5, 7 and 8 are closed, and plan 6 is finished locally and archived; the
objective stays open on one blocked acceptance item. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in the bible and still does not look like the mockup.

## Active work

- **No plan is active.** Plan 6 is complete and moved to [`archive/`](docs/superpowers/plans/archive/2026-10-08-iconography-and-copy.md), its final whole-branch review clean; the next plan starts at the queued rulings below.
- **Plan 6's nine tasks are complete**: the census, the one glyph vocabulary and weight rule, the closed kind set, the one-string pairing, the copy nets, the ratchet, the sixteen-item Acceptance ledger and Task 9's parity capture.
- **Its Acceptance ledger reads fifteen met, one not met** — §13.1's real-host walkthrough, which plan 6 was forbidden to add and no other plan owns.
- **`vg-330` is parked by the user (2026-10-11)** — "Let's park the settings becomes a pane spec" — and `vg-331` still waits: the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **Nine one-off captures are deleted with their generators**: `editor-snap-guides` and `editor-rotation-indicator`, whose capture blocks leave `src/web/tests/e2e/editor.spec.ts`, and — once the v1 landing was confirmed against HEAD, not the tree — `player-chrome-phone-chromium` plus the six `assets-`/`portrait-cover-`/`stress-` fixture captures.
- **The screenshot registry is reconciled**: the deleted captures' rows are gone from `docs/evidence/screenshots/README.md`, and `editor-chart-creation`, standing but unregistered, gains the row the file's own rule requires.
- **`vg-346` and `vg-349` record what the deletions left unowned**: the deleted indicator block was the only test performing the editor's rotation canvas gesture — its angle readout is unit-tested, `indicator-manager/index.dom.test.ts` — and the deleted snap block was the only plain, unmodified single-object drag across a snap line.
- **`vg-345` is settled by the same removal**: the registry row and the orphan `player-chrome-phone-chromium.png` are both gone, and its archived detail now says so rather than claiming the image is still on disk.

## Next

1. **The schema-v1 screenshots pass** — the captures whose generator this deletion removed are listed by filename in `.superpowers/sdd/2026-10-11-schema-v1-retirement/task-1-report.md`; the screenshot inventory (item 2) folds into it.
2. **The screenshot inventory** — remove every capture whose generator no longer exists, and regenerate the ones that are valid but outdated (`vg-341`'s seven are one known family); nothing is deleted until the orphan list is evidence-backed, because a wrong call destroys evidence.
3. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour — brief written at `.superpowers/sdd/2026-10-11-design-rulings/task-1-brief.md`, waiting behind the two surveys above.
4. **`vg-331`** (the attention-colour role, defined before any colour is chosen); **`vg-330` is PARKED by the user** (2026-10-11) and is not queued.
5. **`design-md-replaces-the-bible`**, then the multi-device objective; **Acceptance item 3** still keeps the editor-redesign objective open.

## Blockers / unverified

- **Acceptance item 3 is not met, and it keeps the objective open**: §13.1's keyboard-only walkthrough has no check on the real host — the `desktop-host` project matches `host-(player|settings|media|bleed|chrome).spec.ts` only — so the six-plan sequence does not close cleanly while plan 6's local glyph work is done.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts`'s palette-picker test "the palette picker lands beside its trigger, and its tracks answer the arrow keys" (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
