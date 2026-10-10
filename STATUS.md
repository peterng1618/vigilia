# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5 are closed. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is now the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in the bible and still does not look like the mockup.

## Active work

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Tasks 9, 1, 8, 2 and 3 are complete; Task 4 is next, then 5 → 6 → 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: the body-flush rows and the six radius rows are **green**, and no row is unresolved.
- **Task 3's first step is a class rather than a list** — the drawing's twenty-one off-scale radii (seventeen dock buttons, three view-cluster buttons, the follow-the-system track) now read their §3 or §5 entry, and nothing but the named degenerate marks is left off the scale.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**, and plan 6 (`iconography-and-copy`) follows both: thirteen of the modal's nineteen measured regions drift, plan 8 consumes plan 7's instrument and its radius and chrome decisions, and plan 6 opens with a census of a shell that would move again under it.

## Last completed change

- **Task 3 is closed: the shell's four flush regions are square, and the one floating surface takes its scale entry** — the rail, both panes, the stage and the inspector lose their `12px`, and the two dialogs take `--radius-lg`, asserted equal to each other so a change made for one and missed on the other fails a row.
- **The checked drawing was corrected rather than the product** — its twenty-one off-scale literals (seventeen dock buttons at `7px`, three view-cluster buttons at `5px`, the follow-the-system track at half its height) now read §5's icon button and §3's `full`, and the fix changed nothing but those twenty-one values, proven by re-diffing the file with radii masked.
- **Two false premises were the controller's, and both are corrected in the plan** — the rail's "47px box" (the drawing carries `* { box-sizing: border-box }`, so it was always 46) and Step 2's "layer rows at `6px`" (neither drawing draws a layer row); each was caught only because the implementer measured instead of complying, and the second was one the plan's own prose had put in their report.
- **Filed `vg-306`** — the drawing's view cluster draws 22px glyph buttons where §5's icon button starts at 26px; filed rather than folded, because size is not radius and moving a drawn control's size moves the cluster's whole layout.
- **`vg-296` is narrowed, not closed, and its instrument clause is now measured** — the shell drawing's part is done, the bordered follow-the-system row is the modal's and stays plan 8's, and putting one `7px` back into the drawing leaves the suite green, so nothing holds that correction in place.

## Next

1. **Execute plan 7 in its stated order** — Tasks 9, 1, 8, 2 and 3 are complete, so Task 4 is next, then 5 → 6 → 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Task 6 must carry R25, and now `vg-296`'s instrument clause too** — the `biblePx` list is not a precedent and a value needs a rule before it needs an entry, and nothing in the suite reads a drawing's `border-radius` against §3's scale, which is Task 6's gate to own.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The instrument family is what to watch, and it has narrowed**: `vg-292` (a divergence's reason is still not machine-checked), `vg-304` (a parity row is never checked against the property set its drawing declares), `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are each an instrument claiming more coverage than it has — though the shell-parity gate itself now reddens on demand, measured — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is now measured rather than suspected** — the palette sweep alone at the default count is 8.5–8.6s against a 30s limit, so a default-count red on this box is contention between concurrent runs, never that spec's runtime, and re-running it alone at the same commit costs seconds.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
