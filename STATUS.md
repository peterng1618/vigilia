# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5, 7 and 8 are closed, and plan 6 is finished locally and archived; the
objective stays open on one blocked acceptance item. The target is
[`DESIGN.md`](DESIGN.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in `DESIGN.md` and still does not look like the mockup.

## Active work

- **No implementation plan is active**: `design-md-replaces-the-bible` is closed and archived at [`archive/`](docs/superpowers/plans/archive/2026-10-10-design-md-replaces-the-bible.md); Plan 6 is complete and archived at [`archive/`](docs/superpowers/plans/archive/2026-10-08-iconography-and-copy.md).
- **Plan 6's nine tasks are complete**: the census, the one glyph vocabulary and weight rule, the closed kind set, the one-string pairing, the copy nets, the ratchet, the sixteen-item Acceptance ledger and Task 9's parity capture.
- **Its Acceptance ledger reads fifteen met, one not met** — §13.1's real-host walkthrough, which plan 6 was forbidden to add and no other plan owns.
- **`vg-330` is parked by the user (2026-10-11)** — "Let's park the settings becomes a pane spec" — and `vg-331` still waits: the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.
- **Four user rulings of 2026-10-11 scope the next stretch**: the "no rule reads X" rows are first-class work for the drain rather than deferred; acceptance item 3 splits into the stress set now and a keyboard-walkthrough plan later; `vg-351` is repainted under a media query; and the drain opens with a reproduction pass, not a fix pass.

## Last completed change

- **`vg-351`: the bare `:root` base is `systemShellPalette`'s answer** — `light` on a light-reporting OS, `graphite` from a new `prefers-color-scheme: dark` block — instead of editorial's values shared with `[data-shell-palette="editorial"]`, which is what a fresh profile painted before React resolved a palette.
- **`packages/editor/index.html`'s pre-shell `<style>` follows the same rule**, and its dark branch's `#0b1419`/`#eef9f4` — literals from the 2026-10-07 plan that match no palette in the set — become graphite's `#0b0e12` and `#e8ecf3`.
- **The swatch keeps the editorial baseline**: `.editor-shell-palette-swatch` stays grouped with editorial, and `--shell-display`/`--shell-flat` keep a bare-`:root` home so ember, moss, plum and light still inherit them; `editor-shell.tokens.test.ts` reds if either base copy drifts from the palette it mirrors, or lands below the palette blocks.
- **The new browser case blocks the bundle and reads the frame before `data-shell-palette` is written** — the state every existing assertion of that attribute cannot see — and asserts the paint and both `--shell-backdrop`/`--shell-text` against the palette the OS resolves, with no colour copied into the test.
- **The dark base deliberately omits `--vigilia-control-bg`, `--shell-display` and `--shell-flat`**: they are what ember, moss, plum and light inherit from the bare root rather than declare, so carrying them would move those four palettes under a dark-reporting OS. The cost — a dark OS's pre-attribute frame takes editorial's display face and control paper — is recorded in the stylesheet.

## Next

1. **The contrast and visual stress set** — six palettes, 1280×720 and 1440×900, 200% zoom, a long Unicode name, a long unresolved reference, the two-hundred-row Composition fixture, reduced motion and forced colours; `design-language.spec.ts` already covers much of it, so the first step is measuring the gaps, not building.
2. **Graphite's Part C, the one capture regeneration** — runs last on a frozen tree, because a capture is evidence about one commit and any later source change makes it stale.
3. **The backlog drain, opened with a reproduction pass** — 211 open rows sorted at HEAD into closes-with-evidence, needs-a-decision and real work before anything is fixed.
4. **§13.1's keyboard-only walkthrough gets its own plan** — the nine interactions plans 1–5 proved in isolation alone; `desktop-host` matches `host-(player|settings|media|bleed|chrome).spec.ts` and nothing else.

## Blockers / unverified

- **Acceptance item 3 is not met, and it keeps the objective open**: §13.1's keyboard-only walkthrough has no check on the real host — the `desktop-host` project matches `host-(player|settings|media|bleed|chrome).spec.ts` only — so the six-plan sequence does not close cleanly while plan 6's local glyph work is done.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts`'s palette-picker test "the palette picker lands beside its trigger, and its tracks answer the arrow keys" (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
