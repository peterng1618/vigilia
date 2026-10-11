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

- **No plan is active.** Plan 6 is finished locally and moved to [`archive/`](docs/superpowers/plans/archive/2026-10-08-iconography-and-copy.md); the next plan starts at the queued rulings below.
- **Plan 6's nine tasks are complete**: the census, the one glyph vocabulary and weight rule, the closed kind set, the one-string pairing, the copy nets, the ratchet, the sixteen-item Acceptance ledger and Task 9's parity capture.
- **Its Acceptance ledger reads fifteen met, one not met** — §13.1's real-host walkthrough, which plan 6 was forbidden to add and no other plan owns.
- **Two changes are ruled and queued after plan 6** (`vg-330`, `vg-331`): Settings becomes a pane opened from the rail's gear with the four slots kept and the drawing redrawn as a panel, and the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **Task 9, the parity capture and the close**: the shell photographed in the drawing's own state by a new registered action, `captures the shell glyphs and words with the Add pane open` (image `editor-shell-glyphs`, `editor-shell-glyphs-desktop-chromium.png`), copied beside `current/shell.html` as `shell-capture-glyphs.png`.
- **The capture's assertion is the half `design:check` cannot read**: every rendered glyph's `stroke-width` is §6's weight for its own size (57 glyphs across sizes 13, 14, 15, 17, 20, 22px), no glyph's descendant overrides it, and all 20 icon-only controls' rendered tooltips equal their `aria-label`s.
- **Red-proved**: with `glyphStrokeWidth`'s top tier planted at `1.9` and the editor rebuilt, the capture failed `1 failed` while `npm run design:check` stayed green (exit 0, 71 files clean) — a weight set in a JSX prop is invisible to the token scan, which is why this reading exists.
- **Item 16 turns met and item 3 stays not met**: plan 6's own parity capture existed nowhere before this commit, so the ledger now reads fifteen met, one not met — §13.1's real-host walkthrough, which keeps the redesign open.
- **One mockup correction**: `current/shell.html`'s Text-row glyph declared 16px at `stroke-width="1.6"`, which is in no §6 tier, and now reads `1.7`; every other glyph stroke in `current/` is on-tier.

## Next

1. **The four rulings implemented**: `PINNED_FLOOR.boundary` deleted and §5's narrower rule written down, and the drawing's six preview bars repainted to the palette's ground with a `PARITY` row that reads a bar's colour.
2. **The Settings pane** (`vg-330`, architectural — brainstorm → spec → plan) — it rewrites Acceptance item 11 when it lands, so read it as written until then.
3. **The attention-colour role** (`vg-331`), defined before any colour is chosen.
4. **`design-md-replaces-the-bible`** before the multi-device display objective.
5. **Acceptance item 3** — §13.1's real-host walkthrough: no Playwright project matches it, so a plan that adds the check is what closes the editor-redesign objective.

## Blockers / unverified

- **Acceptance item 3 is not met, and it keeps the objective open**: §13.1's keyboard-only walkthrough has no check on the real host — the `desktop-host` project matches `host-(player|settings|media|bleed|chrome).spec.ts` only — so the six-plan sequence does not close cleanly while plan 6's local glyph work is done.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
