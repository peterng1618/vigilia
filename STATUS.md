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
- **Phase 2 is closed and Phase 3 is down to Task 9**: Task 4's one-string pairing (`4bae5ed9`, fix `a512efb7`), Task 5's copy net, **Task 6's two copy-defect nets**, **Task 7's ratchet and its three closures** and **Task 8's Acceptance ledger** are complete — the parity capture is Task 9's.
- **Two changes are ruled and queued after plan 6** (`vg-330`, `vg-331`): Settings becomes a pane opened from the rail's gear with the four slots kept and the drawing redrawn as a panel, and the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **Task 8, the Acceptance ledger — fix round 1**: the corrected ledger is this commit's body; item 3 is **not met** because §13.1's real-host walkthrough has no check and none was added (the closure ran its preview half only, `keyboard.spec.ts` 5/5), and item 16's plan-6 parity capture is still Task 9's — 14 met, 2 not met.
- **Item 5's evidence corrected, verdict kept**: the `<select` command returns 12 hits and all twelve are comments, the carrier array is 38 entries, and the one live `input[type=range]` is Base UI's slider (`control-slider.tsx:135`, `selection-inspector/column.tsx:180`), which is not in the list — so the item rests on spec §2.2's carve-out, not on the list.
- **Item 1's sentence corrected**: `editor-shell/controls/tooltip.ts` does render (`:81`, `:103`); it is exempt as ours on ADR 0033, not "nothing left".
- **The parity evidence line corrected**: plans 1 and 3 have no report on disk, their surviving record is the commit bodies `1f991845` and `9ee1fc21`, and **plan 1's ten differences no longer exist anywhere** — the verdict stays `not met`.
- **The trailer materialised by updating rows in place**: `vg-268`'s "three native selects" clause corrected to `ControlSelect`, and `vg-204` records that `keyboard.spec.ts` passed 5/5 at HEAD while the row **stays open**.

## Next

1. **Task 9, the parity capture and the close** — the rebuilt bundle captured by an action registered in `docs/evidence/screenshots/README.md`, the image placed beside `docs/design/mockups/editor-shell.html` with every difference fixed or licensed by a cited rule, then this plan archived; it is what makes Acceptance item 16 met.
2. **Plan 6's browser assertion (Task 9 Step 1)** — every rendered glyph's `stroke-width` is `glyphStrokeWidth(its size)`, no icon-only control's tooltip disagrees with its accessible name; run against a bundle from before Task 2 and confirm it fails.
3. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
4. **Then, in order: the Settings pane** (`vg-330`, architectural — brainstorm → spec → plan), **the attention-colour role** (`vg-331`), and `design-md-replaces-the-bible` before the multi-device display objective.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-330` supersedes an Acceptance item Task 8 recorded as met today**: the rail's gear opens the settings modal rather than a fifth pane, which holds while Settings is a modal — so Task 9 must keep it as written and not "fix" it forward, because the pane change lands after plan 6 and rewrites the item then; **two Acceptance items are not met** — item 3, because §13.1's real-host walkthrough has no check and adding one was out of this round's scope, and item 16, because plan 6's own parity capture is Task 9's — and the redesign stays unclosed until the latter lands.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind, and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 can check neither.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
