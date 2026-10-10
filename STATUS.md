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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Tasks 9, 1 and 8 are complete; Task 2 is next, then 3 → 4 → 5 → 6 → 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: the body-flush and radius rows are red on today's shell by design at both worker counts, and no row is unresolved. **Task 8 added the two `fixture` rows that read the control drawings**, so `current/controls.html` and `current/controls-light.html` are no longer drawings nothing reads.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must now be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument and its radius and chrome decisions.
- **Plan 6 (`iconography-and-copy`) moved behind both** — its first task is a census of the surfaces as they landed, and a census of a shell about to move would be redone.


## Last completed change

- **Plan 7 Task 8: the field row is one geometry again — the drawing's 74px label column and one `flex:1` value cell, declared once in `ControlRow`** — the four per-kind widths that started a box at four different left edges (`vg-297`) are gone, and the assertion that fixes it failed first with the four edges it measured (`text/number/select/segmented` at 117/100.5/63.1/179.8) before passing on one.
- **Task 8 Step 3: the legacy unlayered rules were the second owner under it (`vg-298`)** — the inspector's ancestor-wide input/button box rule and both `label { display:block; margin-top:12px }` arms came off the product's controls, re-scoped to the eight `data-vigilia-*` hooks the inspector's plain DOM buttons still carry, because unlayered they beat every utility.
- **Task 8 Step 4: the fixture was greener than the product (`vg-299`)** — it mounts `.editor-shell-inspector` now, and reverting that mount turned the assertion green again, which is the proof the gate could not see the product's own ancestor; three separate reds were recorded on the way (a select's right edge at 272 against 276, labels 6px below their control, five inputs painting a box inside a well that already draws one).
- **Both control drawings are read by a test now** — two `surface: "fixture"` `PARITY` rows compare the drawing's declared `74px` column with the rendered label, and the shell test skips rows it does not own rather than reporting them as rows that measured nothing.
- **Whole editor unit suite green: 1791 tests over 138 files; the `mockup-values` reader 12/12** — the body-flush and radius rows of the shell parity test stay red by design until Tasks 2 and 3 land, and Task 8's report records them as not its own.

## Next

1. **Execute plan 7 in its stated order** — Tasks 9, 1 and 8 are done, so Task 2 is next, then 3 → 4 → 5 → 6 → 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Adjudicate Task 8's report** (`task-8-report.md`) with Task 1's fix round 2 and Task 9's review — Task 2 owns the body-flush rows Task 8 left red.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-292` is the one that matters for the objective**: the acceptance instrument cannot fail, so "the surface matches the design" is currently an opinion; `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are the same family — each an instrument claiming more coverage than it has — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
