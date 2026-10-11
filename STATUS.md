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
- **Task 2 is complete**: one chrome glyph vocabulary in `editor-shell/icons.ts`, one weight, and both red proofs fired.
- **The pre-flight scan ran before Task 2 and ruled on three plan defects** (`2dab4302`): Task 3's test named a `STACK_GLYPH` that no task declares, Task 2's family assertion presupposed the answer to a question bible §6 leaves open, and Task 7's empty-list fixture would have tested a missing file rather than an empty list.
- **The plan is a contract the scan corrects, not one it obeys**: each ruling reached the plan file so the briefs Tasks 2 and 3 are extracted from carry it, because a ruling kept only in a dispatch is invisible to the reviewer.
- **Plan 8 — [`settings-parity`](docs/superpowers/plans/archive/2026-10-11-settings-parity.md) — is archived as superseded by its own residue, not as clean**: its §13 closure condition is unmet, six differences are `fix` with owners outside the plan (`vg-328`'s nav eyebrow among them), and three of those wait on the user's rulings.

## Last completed change

- **Plan 6's Task 2 — one icon vocabulary, one weight**: `editor-shell/icons.ts` owns the chrome glyph vocabulary and the one stroke weight (`GLYPH_STROKE_WIDTH = 1.75`, §6's 1.6–1.8 band), and every chrome call site draws through `Glyph`; `STACK_GLYPH` is exported for Task 3.
- **The census's four weights collapse to one**: 1.7×8, 1.75×17, 2×1, 2.5×2 → zero literal stroke weights in chrome, and the three out-of-band sites adjudicated one at a time — the live check takes §6's **fill** at 12px, the menu tick and the severity mark take the one weight.
- **Two sources are exempt and nothing is unaccounted**: `panes/add/add-pane.tsx`'s shape/text tiles and `panes/add/card-diagrams.tsx`'s eight unit diagrams keep their hand paths because §6 lets a fixed set draw what it builds — each with §6's reason recorded in the test's `EXEMPT_SOURCES`.
- **Both red proofs fired**: a planted `strokeWidth={2}` failed the one-weight case naming `['1.75','2']`, restored by `cp` and proved with `cmp`; a planted lucide import in `rail.tsx` failed the family case.
- **Gates green**: `design:check` 0 (66 gated files clean), `typecheck` 0, `build` 0, and `vitest` over `editor-shell/` + `font-picker/` 324 passed.

## Next

1. **Plan 6 Task 3 — the kind glyph set** — `KIND_GLYPHS.group` is `STACK_GLYPH` and nothing else, over the closed kind list.
2. **Plan 6 Task 4 — the accessible-name/tooltip pairing** — the census's four icon-only controls with no tooltip (the font picker's star, the composition pane's twisty and group-entry, the gradient editor's stop dots).
3. **Plan 6 Tasks 5–9** — the copy nets, the gate, the Acceptance ledger and the parity capture; Task 9's browser assertion is the net the fixture-bound weight case cannot be.
4. **`vg-321`, `vg-322` and `vg-328` wait on the user's rulings** — whether a palette preview bar depicts the palette's surface or its ground, whether the modal takes the drawing's fixed `560px` or stays content-sized, and whether the nav also carries the surface name.
5. **`vg-316`, `vg-319`, `vg-325`'s four product values and `vg-274`'s 24 spacing values wait on a product pass** in `editor-shell.css`; then `design-md-replaces-the-bible`, then the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Five open questions wait on the user, and one ruling settles two rows**: **`vg-200`/`vg-318`** (whether a resting boundary is a control's only separation — §5's 3:1 then binds the focus boundary and a boundary that is a control's sole marker, leaving the well and the modal frame as dividers; this decides the `PINNED_FLOOR.boundary` pin too), **`vg-321`** (whether a palette preview bar depicts the palette's surface or its ground), **`vg-322`** (whether the modal takes the drawing's fixed `560px` or stays content-sized at 405/507/393px per tab), **`vg-328`** (whether the nav also carries the surface name, the drawing's eyebrow against the product's single dialog title), and whether `current/settings.html` shows the editor behind the modal.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected** (a default-count red on this box is contention, never that spec's runtime); `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
