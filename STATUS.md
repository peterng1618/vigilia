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

- **Graphite's one capture regeneration ran on the frozen tree at `d310ac7b`**: a full `desktop-chromium` capture run (208 tests, 3 failed, 15.1 min) rewrote 61 PNGs, and **46 are committed** because their chrome moved from a light ground to graphite.
- **Fifteen rewritten PNGs were restored**, because a second and a third run of the same specs put their whole delta in the artboard's live canvas rather than the shell: `shell-palette-*` (six), the six settings-modal frames, `editor-shell-glyphs` and `editor-inspector-chart-graphite`.
- **`editor-font-trio-editorial` is the one `-editorial` frame committed** — 364k changed pixels against a ~16k run-to-run canvas noise floor, so the type-preset pane does render differently at HEAD; the fence excluded it, and the evidence is recorded for a ruling.
- **`editor-starter-cpu-card` could not be regenerated at all**: its spec times out at `editor.spec.ts:1131` waiting on a `[data-vigilia-layer="cpu-card"]` row that never appears, so that frame still shows the October 5 bundle.
- **Three specs fail deterministically at HEAD and none is in this file's red list** — `editor.spec.ts:1107`, `glass-authoring.spec.ts:293` and `reference-theme.spec.ts:2444` — each reproduced with and without `VIGILIA_CAPTURE`; reported here rather than fixed, since a source change would invalidate every capture.

## Next

1. **The contrast and visual stress set** — six palettes, 1280×720 and 1440×900, 200% zoom, a long Unicode name, a long unresolved reference, the two-hundred-row Composition fixture, reduced motion and forced colours; `design-language.spec.ts` already covers much of it, so the first step is measuring the gaps, not building.
2. **The three specs that fail at HEAD from the capture run** — `editor.spec.ts:1107`, `glass-authoring.spec.ts:293`, `reference-theme.spec.ts:2444`; the cause of the first is not established, so it is a filing decision, not a fix on sight.
3. **The backlog drain, opened with a reproduction pass** — 211 open rows sorted at HEAD into closes-with-evidence, needs-a-decision and real work before anything is fixed.
4. **§13.1's keyboard-only walkthrough gets its own plan** — the nine interactions plans 1–5 proved in isolation alone; `desktop-host` matches `host-(player|settings|media|bleed|chrome).spec.ts` and nothing else.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on its walkthrough half only**: the stress half ran on 2026-10-12 with every §13.1 item met, but one item — the long unresolved reference — is discharged at DOM level rather than in a browser, because the state is unreachable there (`vg-358`); the keyboard-only walkthrough still has no check on the real host, since `desktop-host` matches `host-(player|settings|media|bleed|chrome).spec.ts` and nothing else.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts`'s palette-picker test "the palette picker lands beside its trigger, and its tracks answer the arrow keys" (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
