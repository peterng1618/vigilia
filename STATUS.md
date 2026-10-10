# Vigilia status

Updated: 2026-10-10
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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Task 9 is complete; Task 8 is next, then 2 → 3 → 4 → 5 → 6 → 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: eight rows red on today's shell, no unresolved row, at both worker counts. **Task 8 waits for Task 1's fix round** — one writer per file, since both edit `tests/e2e/mockup-values.ts` and `design-language.spec.ts`.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must now be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument and its radius and chrome decisions.
- **Plan 6 (`iconography-and-copy`) moved behind both** — its first task is a census of the surfaces as they landed, and a census of a shell about to move would be redone.


## Last completed change

- **Plan 7 Task 1, fix round 2: the census's arithmetic agrees with its own lists** — of the 34 `fix` rows, **18 are this plan's** (A3–A7, A9, A18, A19, A20–A28, B1) and **16 another owner's**, enumerated by id and owner in the census, the report and the commit; the 21 it replaced named nine rows.
- **The reader refuses an ambiguous selector** — `[style*="…"]` matching two elements now throws naming the selector and the count instead of silently comparing whichever the document lists last, because a wrong element with a real value reads as a *pass*.
- **A `licensed` row's citation is read, not trusted** — the stage ground's declared `background` must contain the gradient §7.5 licenses; proved red by pointing the row at another element, restored byte-identically with `cmp`, and the `undefined` read under `noUncheckedIndexedAccess` now takes the row's own "measured nothing" path.
- **Two review-unverified items measured, both now facts** — `--radius-lg` reads `8px` from `:root` in the built bundle, so both dialog rows are red at 8 against the product's 12px and not for an unresolved token; and the closed modal **unmounts** (0 dialogs in the DOM after Escape, 1 with the sheet open), so the guard stays and its untrue comments were rewritten.
- **Still 8 rows red at `--workers=1` and `--workers=2`, reader 11/11** — the four flush-region radius rows stand by ruling `e2e3c5a1`, and the reader's header comment now describes `current/shell.html` instead of the superseded drawing.

## Next

1. **Execute plan 7 in its stated order** — Task 9 (dispatched), then Task 8, then 2 → 3 → 4 → 5 → 6 → 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Adjudicate Task 1's fix round 2, reported now**, then Task 9's review — Task 8 stays held behind Task 1 by one-writer-per-file.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-292` is the one that matters for the objective**: the acceptance instrument cannot fail, so "the surface matches the design" is currently an opinion; `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are the same family — each an instrument claiming more coverage than it has — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
