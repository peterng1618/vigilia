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

- **The active plan is [`2026-10-12-the-keyboard-only-walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md)** — five tasks assembling §13.1's nine interactions into one spec on the real host, which is the last thing keeping the objective open; `design-md-replaces-the-bible` is closed and archived at [`archive/`](docs/superpowers/plans/archive/2026-10-10-design-md-replaces-the-bible.md) and Plan 6 is complete and archived.
- **Plan 6's nine tasks are complete**: the census, the one glyph vocabulary and weight rule, the closed kind set, the one-string pairing, the copy nets, the ratchet, the sixteen-item Acceptance ledger and Task 9's parity capture.
- **Its Acceptance ledger reads fifteen met, one not met** — §13.1's real-host walkthrough, which plan 6 was forbidden to add and no other plan owns.
- **`vg-330` is parked by the user (2026-10-11)** — "Let's park the settings becomes a pane spec" — and `vg-331` still waits: the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.
- **Four user rulings of 2026-10-11 scope the next stretch**: the "no rule reads X" rows are first-class work for the drain rather than deferred; acceptance item 3 splits into the stress set now and a keyboard-walkthrough plan later; `vg-351` is repainted under a media query; and the drain opens with a reproduction pass, not a fix pass.

## Last completed change

- **Graphite's capture regeneration ran on the frozen tree**: 208 tests (3 failed, 15.1 min) rewrote 61 PNGs, and **46 are committed** because their chrome moved from a light ground to graphite (`#fffdf7` → `#12161c`).
- **Fifteen rewritten PNGs were restored** because their whole delta lay in the artboard's live canvas rather than the shell: `shell-palette-*` (six), the six settings-modal frames, `editor-shell-glyphs` and `editor-inspector-chart-graphite`.
- **The one `-editorial` frame that was committed, inspected rather than assumed**: `editor-font-trio-editorial`'s ground is unchanged and its content change is real — the type-scale list shows all seven entries where three were visible — so reverting it would restore stale evidence.
- **`editor-starter-cpu-card` could not be regenerated at all**: its spec times out waiting on a `[data-vigilia-layer="cpu-card"]` row that never appears, so that frame still shows the October 5 bundle and is the only editor capture not on graphite.
- **Three deterministic failures at HEAD, named by no register and not by the red list below, are filed** as `vg-359`, `vg-360` and `vg-361` — the first reproduced directly at `editor.spec.ts` — and the red list now names them.

## Next

1. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
2. **The backlog drain, opened with a reproduction pass** — 215 open rows sorted at HEAD into closes-with-evidence, needs-a-decision and real work before anything is fixed.
3. **`vg-357`** — a dark OS's pre-attribute frame still takes editorial's display face and control paper, because four palettes inherit those tokens from the bare root; closing it means declaring them per palette.
4. **`vg-358`** — an unresolved palette reference takes the inspector column down though the product renders that state and carries its copy; whether the state is reachable at all is the decision it waits on.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on its walkthrough half only**: the stress half ran on 2026-10-12 with every §13.1 item met, but one item — the long unresolved reference — is discharged at DOM level rather than in a browser, because the state is unreachable there (`vg-358`); the keyboard-only walkthrough still has no check on the real host, since `desktop-host` matches `host-(player|settings|media|bleed|chrome).spec.ts` and nothing else.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: the capture run added three deterministic failures that no register and no red list named — `editor.spec.ts`'s frosted-CPU-card test (`vg-359`), `glass-authoring.spec.ts`'s empty-radius test (`vg-360`) and `reference-theme.spec.ts`'s background-media import (`vg-361`), each reproduced with and without `VIGILIA_CAPTURE`; and the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts`'s palette-picker test "the palette picker lands beside its trigger, and its tracks answer the arrow keys" (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
