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
- **Task 2's outcome was amended by two user rulings, each given after the divergence was shown at the sizes in play**: the weight is a rule over size (`glyphStrokeWidth`, §6's tiers 1.7/1.8/2) rather than the flat 1.75 the plan asked for, and the group mark is lucide `layers-2` rather than `Layers`.
- **Task 2 lands as `ef81b183` + `93b2286f`, and one review over `b5abe5f0..93b2286f` is running** — the earlier approval predated both rulings and was made against §6, which is what the task was written to, so it does not stand alone.
- **The pre-flight scan's three rulings are in the plan, not just in a dispatch** (`2dab4302`): Task 3's test named a `STACK_GLYPH` that no task declares, Task 2's family assertion presupposed the answer to a question bible §6 leaves open, and Task 7's empty-list fixture would have tested a missing file rather than an empty list.
- **Two changes are ruled and queued after plan 6** (`vg-330`, `vg-331`): Settings becomes a pane opened from the rail's gear with the four slots kept and the drawing redrawn as a panel, and the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **The glyph weight is a rule over size** (`93b2286f`): `GLYPH_STROKE_WIDTH` is gone and `glyphStrokeWidth(size)` gives §6's tiers — 1.7 at 14px and above, 1.8 at 11–13px, 2 at 10px and below — with `Glyph` deriving its weight from its own size prop, so no call site's props changed.
- **The rule came from measuring the drawing, not the bible**: every glyph stroke in `current/shell.html` is 1.7 at 14–22px (44), 1.8 at 13px (3), 2 at 10px (9) — the flat 1.75 matched no value the drawing uses at any size, which is the defect the ruling corrected.
- **`STACK_GLYPH` is lucide `Layers2`**, two planes like the drawing's stack, because `Layers`' third plane lands about a pixel under the second and reads as a smudge in the 13px layer row.
- **Bible §6, `ownership.md`'s row and the plan's Goal, Task 2, 7 and 9 all moved with the rule**, so no current document still states the superseded one weight.
- **`design:check` needed no `biblePx` change, and the cause is now known**: the scanner's regex requires a `px` suffix, so a bare numeric literal was never visible in `icons.ts` — which is why `1.75` was green there while absent from the allowlist.

## Next

1. **Close Task 2 on the running review**, then dispatch **Task 3 — the kind glyph set** — `KIND_GLYPHS.group` is `STACK_GLYPH` and nothing else, over the closed kind list, with the compile-time and runtime halves both proved.
2. **Plan 6 Task 4 — the accessible-name/tooltip pairing** — the census's four icon-only controls with no tooltip (the font picker's star, the composition pane's twisty and group-entry, the gradient editor's stop dots), seeded at 4 and adjudicated per control.
3. **Plan 6 Tasks 5–9** — the copy nets, the gate, the Acceptance ledger and the parity capture; Task 9's browser assertion is the net the fixture-bound weight case cannot be, and it also carries the new parity line that the drawing draws no live check.
4. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
5. **Then, in order: the Settings pane** (`vg-330`, architectural — brainstorm → spec → plan), **the attention-colour role** (`vg-331`), and `design-md-replaces-the-bible` before the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-330` supersedes a plan acceptance item that is TRUE today**: plan 6 Task 8 Step 3 checks that the rail's gear opens the settings modal rather than a fifth pane, which holds while Settings is a modal — so Task 8 must pass it as written and whoever runs it must not "fix" it forward, because the pane change lands after plan 6 and rewrites the item then.
- **The 10px weight tier is asserted but not proven**: no fixture mounts a 10px glyph, so only `glyphStrokeWidth`'s boundary case covers it — Task 9's browser assertion is its real net and is not written yet.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
