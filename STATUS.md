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

- **No implementation plan is active**: `design-md-replaces-the-bible` closed with this commit (six tasks, acceptance verified end to end); Plan 6 is complete and archived at [`archive/`](docs/superpowers/plans/archive/2026-10-08-iconography-and-copy.md).
- **Plan 6's nine tasks are complete**: the census, the one glyph vocabulary and weight rule, the closed kind set, the one-string pairing, the copy nets, the ratchet, the sixteen-item Acceptance ledger and Task 9's parity capture.
- **Its Acceptance ledger reads fifteen met, one not met** — §13.1's real-host walkthrough, which plan 6 was forbidden to add and no other plan owns.
- **`vg-330` is parked by the user (2026-10-11)** — "Let's park the settings becomes a pane spec" — and `vg-331` still waits: the palettes gain a second highlight whose role is an attention or in-flight state, defined before any colour is chosen.

## Last completed change

- **`design-md-replaces-the-bible` closed**: all six tasks done, and the plan's eight-item Acceptance list walked with evidence — `DESIGN.md` at the root, the old `docs/design/design-language.md` gone, and `design:check` lint/sync/cite clean.
- **Eighteen markers resolve**: `§1`–`§10` and `§7.1`–`§7.8` each carry their marker in `DESIGN.md`, and `design:md --cite` is clean over 289 citation sources.
- **Items 5 and 7 recorded as amended**: no current-truth document claims a bible exists (`git grep bible` empty over `DESIGN.md`, `AGENTS.md`, `docs/README.md`, `docs/design`, `docs/architecture`, `docs/engineering`, `docs/evidence`, `src` and `scripts`), and no queued plan names the deleted file.
- **Four register rows re-pointed** — `biblePx` → `designLanguagePx` on `vg-227`, `vg-308`, `vg-332` and `vg-340`, by raw-line substitution, never a JSON round-trip.
- **Nothing filed from the sweep**: it was a name sweep, not a citation audit, and it found nothing that warranted a row.

## Next

1. **Graphite's Part C, the one capture regeneration** — unblocked now the design-md plan is closed; runs once with the machine to itself, and the deliberate `-editorial`/`-graphite` pairs stay.
2. **`vg-351` needs a ruling**: the `:root` base still carries editorial, so a fresh profile's first frame is editorial while the settled default is graphite — repaint the base under `prefers-color-scheme`, or correct the comment.
3. **`vg-331`** (the attention-colour role, defined before any colour is chosen); **`vg-330` is PARKED by the user** (2026-10-11) and is not queued.
4. **The multi-device objective** — `DESIGN.md` has landed, so it is next: detect the connected displays and hold a theme per device (a "device" is a hardware sensor device in the host, not a display).
5. **Acceptance item 3 keeps the editor-redesign objective open** — §13.1's keyboard-only walkthrough on the real host has no check; see Blockers.

## Blockers / unverified

- **Acceptance item 3 is not met, and it keeps the objective open**: §13.1's keyboard-only walkthrough has no check on the real host — the `desktop-host` project matches `host-(player|settings|media|bleed|chrome).spec.ts` only — so the six-plan sequence does not close cleanly while plan 6's local glyph work is done.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: the red browser list is short but mixed — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts`'s palette-picker test "the palette picker lands beside its trigger, and its tracks answer the arrow keys" (`vg-204`, which **passed 5/5 at HEAD** and so is not reproducing today, but the row **stays open** pending a ruling), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected**; `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
