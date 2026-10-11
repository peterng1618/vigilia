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
- **Phase 2 is open**: Task 4's one-string pairing is complete (`4bae5ed9`, fix `a512efb7`), Task 5's copy net is complete, and **Task 6's two copy-defect nets are complete** (this commit) — Phase 3 (Tasks 7–9) is next.
- **Two changes are ruled and queued after plan 6** (`vg-330`, `vg-331`): Settings becomes a pane opened from the rail's gear with the four slots kept and the drawing redrawn as a panel, and the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **Fix round 2 on Task 6's copy nets**: three false boundary claims corrected — the rail's `add` slot IS clicked by `shell-layout.dom.test.tsx` (its `segment()` helper composes the selector, so a literal search missed it), the artboard trigger renders the owned word "Custom" and is asserted by `artboard-panel.dom.test.ts`, and the View readings are not uniform.
- **The honest third category is the View menu's `dataSource` and `valueRuns` radios**, exercised by no test (only `chartRefresh` is proven); filed as `vg-339`, with the searches in that row and in the case's comment.
- **The gap case's chart-select bound is restated**: its trigger would render the gap word with no popup open, so it is bounded for the `line` target mount, not for popup cost.
- **Every negative claim now carries its search in the sentence** — the identifier and the helper, never a literal selector that a composed string defeats.
- **Report §1.1/§2/§7 made consistent**: the eight entries reach six of §1.1's bullets (five full, the "not set" gap partial), and the retracted title is gone.

## Next

1. **Plan 6 Task 5's re-review** (fix round 2 landed), then **Task 6 — the copy defects** fixed as defects: the surfaces a missing reading would fabricate into a zero or a dash, and the strings that name a capability no control can run.
2. **Plan 6 Tasks 7–9** — the gate, the Acceptance ledger and the parity capture; Task 9's browser assertion is the net the fixture-bound weight case cannot be, and it also carries the parity lines that the drawing draws its twisty at 10px where the product draws it at 13px and draws no kind mark at all.
3. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
4. **Then, in order: the Settings pane** (`vg-330`, architectural — brainstorm → spec → plan), **the attention-colour role** (`vg-331`), and `design-md-replaces-the-bible` before the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-330` supersedes a plan acceptance item that is TRUE today**: plan 6 Task 8 Step 3 checks that the rail's gear opens the settings modal rather than a fifth pane, which holds while Settings is a modal — so Task 8 must pass it as written and whoever runs it must not "fix" it forward, because the pane change lands after plan 6 and rewrites the item then.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind, and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 can check neither.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
