# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5, 7 and 8 are closed. The target is
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

- **Plan 6 — [`iconography-and-copy`](docs/superpowers/plans/2026-10-08-iconography-and-copy.md) — is the active plan**, nine tasks in three phases: Phase 1 (1–3) the census and the glyph set, Phase 2 (4–6) the one-string pairing and the copy, Phase 3 (7–9) the gate, the Acceptance and the parity close.
- **Task 1 is complete and reviewed clean** (`5f676da4`): the census of what landed, which refuted three of the plan's own hypotheses — 15 lucide importers against a guessed nine, **four** stroke weights against three, and both "hand-wired" pairings the brief named already one string by construction.
- **Task 2 is complete and reviewed clean** (`ef81b183` + `93b2286f` + `08c71e28`): one chrome glyph vocabulary with one weight rule, the census's four weights collapsed, the three out-of-band sites adjudicated one at a time, and both hand-authored sources exempted with §6's reason recorded.
- **Task 3 is complete and reviewed clean** (`9031ed7d`): the object-kind glyph set closed over `LayerKind` with a totality case enumerating the kind vocabulary rather than the map's own keys, and both closure halves red-proved — `satisfies` rejects a missing key and an excess one alike.
- **Phase 1 is done**, so Phase 2 is open: the accessible-name/tooltip pairing, where each icon-only control's two strings become one by construction (Task 4, in review), then the copy (Tasks 5–6).
- **Two changes are ruled and queued after plan 6** (`vg-330`, `vg-331`): Settings becomes a pane opened from the rail's gear with the four slots kept and the drawing redrawn as a panel, and the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **Task 4's review finding is fixed** (this commit, on top of `4bae5ed9`): the census's `mountFleet` now mounts the gradient editor, so the fourth control the census found is *in* the test that measures it rather than absent from it.
- **The `svg` clause is the mechanism, not the defect, and it is now proved live**: with the two stop dots mounted, deleting the clause makes the record case report **6** (the two stop dots, the two colour-picker triggers, the font picker's search field and its favourites-only checkbox), where before the dots were mounted the same deletion still reported 0.
- **A second harness defect had to be fixed for that proof to exist**: `tooltipFor` now dismisses the previous popup before opening the next, because jsdom's synthetic `focus` left it in the document and every later control read it as its own — which is what made a count of 0 vacuous.
- **`useControlTooltip` stays the control set's one owner of the label/tooltip pairing**, and the star, the twisty and the group-entry button were adjudicated one at a time (§6 rule 1's first and middle clauses), so `noTooltip` settles at 0 because no glyph control lacks the name its tooltip states.
- **Two false claims in `task-4-report.md` are corrected**: there are three (not two) direct `tooltip()` callers — `control-well.tsx`, `settings-field.ts`, `add-pane.tsx` — and the capture was never unstaged, only written to a scratch dir, so the committed image stays the 2026-10-08 one with Task 9 owning the refresh.

## Next

1. **Plan 6 Task 4's review**, then **Tasks 5–6 — the copy**: the nets that reach the React surfaces, then the copy defects the census found fixed as defects.
2. **Plan 6 Tasks 7–9** — the gate, the Acceptance ledger and the parity capture; Task 9's browser assertion is the net the fixture-bound weight case cannot be, and it also carries the parity lines that the drawing draws its twisty at 10px where the product draws it at 13px and draws no kind mark at all.
3. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
4. **Then, in order: the Settings pane** (`vg-330`, architectural — brainstorm → spec → plan), **the attention-colour role** (`vg-331`), and `design-md-replaces-the-bible` before the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-330` supersedes a plan acceptance item that is TRUE today**: plan 6 Task 8 Step 3 checks that the rail's gear opens the settings modal rather than a fifth pane, which holds while Settings is a modal — so Task 8 must pass it as written and whoever runs it must not "fix" it forward, because the pane change lands after plan 6 and rewrites the item then.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind, and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 can check neither.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
