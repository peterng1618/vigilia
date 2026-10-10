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

- **Task 1 fix round 2, closed: the report no longer claims a check the controller ran** — the census's open-items list said 13 rows with another owner and named A20–A28 on **both** sides; the controller corrected `adjudication.md` after the scoped re-review, and the report now attributes that to them.
- **The reader's header comment no longer says a `body` row exists** — no `PARITY` row uses a rule selector, so the `<style>` half of the reader is exercised by the reader's own proofs and the inline half by every drawing-side row, including Task 8's two control-drawing rows.
- **Re-verified at `0e7b3405` rather than carried forward** — reader 12/12, the shell parity test still reddens 8 rows at `--workers=1` and the same 8 at `--workers=2`, the header's 42px passing as the control, no row unresolved.
- **Task 8's two `surface: "fixture"` rows are untouched by this round** — the shell test skips them (`design-language.spec.ts:1839`), so they do not reach the `undefined` guard as unresolved rows, which was checked rather than assumed.

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
