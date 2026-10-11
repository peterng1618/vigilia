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
- **Task 2 is complete and its task review is running** (`ba1ae4be`): one chrome glyph vocabulary in `editor-shell/icons.ts` at one weight, the three out-of-band weights adjudicated one at a time, and both red proofs fired; three files sit outside the brief's list and the reviewer is judging each rather than the controller assuming.
- **The pre-flight scan's three rulings are in the plan, not just in a dispatch** (`2dab4302`): Task 3's test named a `STACK_GLYPH` that no task declares, Task 2's family assertion presupposed the answer to a question bible §6 leaves open, and Task 7's empty-list fixture would have tested a missing file rather than an empty list.
- **The user has ruled that Settings becomes a pane, not a modal** (`vg-330`): opened from the rail's gear with the four slots kept, and `current/settings.html` redrawn as a panel — their choice, having been told it edits the gold artefact. It needs brainstorm → spec → plan and is sequenced after plan 6.
- **The user has asked for a second highlight colour, orange for graphite** (`vg-331`), and defined its role before any colour is chosen: an attention or in-flight state, neither the primary action nor destructive. The role is defined once and the other five palettes follow.

## Last completed change

- **Plan 6's Task 2 — one icon vocabulary, one weight**: `editor-shell/icons.ts` owns the chrome glyph vocabulary and the one stroke weight (`GLYPH_STROKE_WIDTH = 1.75`, §6's 1.6–1.8 band), and every chrome call site draws through `Glyph`; `STACK_GLYPH` is exported for Task 3.
- **The census's four weights collapse to one**: 1.7×8, 1.75×17, 2×1, 2.5×2 → zero literal stroke weights in chrome, and the three out-of-band sites adjudicated one at a time — the live check takes §6's **fill** at 12px, the menu tick and the severity mark take the one weight.
- **Two sources are exempt and nothing is unaccounted**: `panes/add/add-pane.tsx`'s shape/text tiles and `panes/add/card-diagrams.tsx`'s eight unit diagrams keep their hand paths because §6 lets a fixed set draw what it builds — each with §6's reason recorded in the test's `EXEMPT_SOURCES`.
- **Both red proofs fired**: a planted `strokeWidth={2}` failed the one-weight case naming `['1.75','2']`, restored by `cp` and proved with `cmp`; a planted lucide import in `rail.tsx` failed the family case.
- **The user's four rulings are in the register** (`f800d3ec`), with the two rows they create: the boundary reading is the narrow one (so `vg-200`/`vg-318` close together), a preview bar is the palette's ground, the nav carries one name, and the modal-width question is rejected in favour of the pane.

## Next

1. **Plan 6 Task 3 — the kind glyph set** — `KIND_GLYPHS.group` is `STACK_GLYPH` and nothing else, over the closed kind list, with the compile-time and runtime halves both proved.
2. **Plan 6 Task 4 — the accessible-name/tooltip pairing** — the census's four icon-only controls with no tooltip (the font picker's star, the composition pane's twisty and group-entry, the gradient editor's stop dots), seeded at 4 and adjudicated per control.
3. **Plan 6 Tasks 5–9** — the copy nets, the gate, the Acceptance ledger and the parity capture; Task 9's browser assertion is the net the fixture-bound weight case cannot be.
4. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
5. **Then, in order: the Settings pane** (`vg-330`, architectural — brainstorm → spec → plan), **the attention-colour role** (`vg-331`), and `design-md-replaces-the-bible` before the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-330` supersedes a plan acceptance item that is TRUE today**: plan 6 Task 8 Step 3 checks that the rail's gear opens the settings modal rather than a fifth pane, which holds while Settings is a modal — so Task 8 must pass it as written and whoever runs it must not "fix" it forward, because the pane change lands after plan 6 and rewrites the item then.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected** (a default-count red on this box is contention, never that spec's runtime); `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
