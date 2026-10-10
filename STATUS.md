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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Tasks 9, 1, 8 and 2 are complete; Task 3 is next, then 4 → 5 → 6 → 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: the body-flush rows are **green** as of Task 2 and the six radius rows are red by design, and no row is unresolved. **Task 8 added the two `fixture` rows that read the control drawings**, so `current/controls.html` and `current/controls-light.html` are no longer drawings nothing reads.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must now be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument and its radius and chrome decisions.
- **Plan 6 (`iconography-and-copy`) moved behind both** — its first task is a census of the surfaces as they landed, and a census of a shell about to move would be redone.


## Last completed change

- **Task 2 is closed: the body is flush, and each interior boundary has one owner** — the rail and the pane draw the hairline on their right, the inspector on its left, the stage none, and every owner is named in a comment.
- **The rail's `padding-left: 1px` is the hairline's arithmetic, not a licensed rounding** — §7.2 fixes the strip at 46px and the drawing's rail is a 47px border-box, so Task 3 Step 1 now corrects the drawing rather than the product.
- **The palette sweep stopped requiring an opaque background from an element Base UI clips to nothing** — its first `.editor-shell-panel input` is `aria-hidden`, `tabindex="-1"`, `clip-path: inset(50%)`; corrected by hand, with all six palettes failing before and one passing after.
- **`vg-305` closed by the controller, and it was the controller's miss** — Task 8's deleted ancestor-wide rule was verified against the gate it was watched by and never against what else it painted.
- **`vg-285` is narrowed rather than re-framed** — the palette sweep alone at the default count is 8.5–8.6s against a 30s limit, so its runtime is not the cause; concurrent runs on one box and one bundle are.

## Next

1. **Execute plan 7 in its stated order** — Tasks 9, 1, 8 and 2 are complete, so Task 3 is next, then 4 → 5 → 6 → 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Task 3 owns the six red radius rows, the three off-bible drawing values, and the rail's 47px box** — and Task 6 must carry R25: the `biblePx` list is not a precedent, and a value needs a rule before it needs an entry.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The instrument family is what to watch, and it has narrowed**: `vg-292` (a divergence's reason is still not machine-checked), `vg-304` (a parity row is never checked against the property set its drawing declares), `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are each an instrument claiming more coverage than it has — though the shell-parity gate itself now reddens on demand, measured — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is now measured rather than suspected** — the palette sweep alone at the default count is 8.5–8.6s against a 30s limit, so a default-count red on this box is contention between concurrent runs, never that spec's runtime, and re-running it alone at the same commit costs seconds.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
