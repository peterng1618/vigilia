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
- **Task 3 is complete and closes Phase 1**: `KIND_GLYPHS` in `icons.ts` is the one glyph per object kind, `group` is `STACK_GLYPH` and nothing else, and the compile-time and runtime halves of the closure are both proved red.
- **Rulings applied to the plan**: the pre-flight scan's three (`2dab4302` — Task 3's test named a `STACK_GLYPH` no task declared, Task 2's family assertion presupposed what §6 leaves open, Task 7's empty-list fixture would have tested a missing file), and the user's two mid-Task-2 ones, each given after the divergence was shown at the sizes in play: the weight is the drawing's tier rule rather than §6's flat number, and the group mark is lucide `layers-2` rather than `Layers`.
- **Two changes are ruled and queued after plan 6** (`vg-330`, `vg-331`): Settings becomes a pane opened from the rail's gear with the four slots kept and the drawing redrawn as a panel, and the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **Task 3 closed** — the object-kind glyph set is closed over `LayerKind`: `KIND_GLYPHS` in `editor-shell/icons.ts`, one glyph per kind, `group` being `STACK_GLYPH` and nothing else.
- **Both halves of the closure are proved, and each fails alone**: the compile-time `satisfies Readonly<Record<LayerKind, LucideIcon>>` (`TS2741` on a sixth kind) and the runtime comparison against `uiCopy.panels.layerKinds`, which never enumerates the map's own keys.
- **The drawing draws no object kind at all**: `grep -c layer docs/design/mockups/current/*.html` is 0 across all six files, so there was no kind-glyph comparison to invent — the Add pane's card and shape tiles are the only kind-adjacent artwork there.
- **The row keeps its treatments**, and `kind-mark.tsx` now records which arm is a glyph (`chart`, `group`) and which is a depiction (`text`, `shape`, `image`); no kind→component map existed to move, and no arm may be derived from what a row holds.
- **The Add pane is asserted over its owner's own list**: one tile per object `insertGroups()` offers, each drawing a mark, so an insertable kind cannot arrive unmarked.

## Next

1. **Plan 6 Task 4 — the accessible-name/tooltip pairing** — the census's four icon-only controls with no tooltip (the font picker's star, the composition pane's twisty and group-entry, the gradient editor's stop dots), seeded at 4 and adjudicated per control.
2. **Plan 6 Tasks 5–9** — the copy nets, the gate, the Acceptance ledger and the parity capture; Task 9's browser assertion is the net the fixture-bound weight case cannot be, and it also carries the new parity line that the drawing draws its twisty at 10px where the product draws it at 13px.
3. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
4. **Then, in order: the Settings pane** (`vg-330`, architectural — brainstorm → spec → plan), **the attention-colour role** (`vg-331`), and `design-md-replaces-the-bible` before the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-330` supersedes a plan acceptance item that is TRUE today**: plan 6 Task 8 Step 3 checks that the rail's gear opens the settings modal rather than a fifth pane, which holds while Settings is a modal — so Task 8 must pass it as written and whoever runs it must not "fix" it forward, because the pane change lands after plan 6 and rewrites the item then.
- **The 10px weight tier is unreachable, not merely unproven**: no source draws a glyph at or below 10px, so only `glyphStrokeWidth`'s boundary case covers it and Task 9's browser assertion cannot see it either — the drawing draws its `--faint` disclosure twisties at 10px where the product draws them at 13px, and that size gap is what Task 9 records.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
