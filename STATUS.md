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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan, and Task 1 is dispatched**: the drawing becomes a machine-read acceptance instrument, then the shell's composition, its radius scale, graphite's values and the chrome treatment follow, ending in a capture beside the drawing.
- **The user's ruling, 2026-10-10: the mockup is not replaced — "Do not replace the mockup. Even the setting panel you just built looks nothing like it."** — the product is pulled to the drawing, and §13 now says the drawing governs wherever the written rules are silent, with no self-licensing.
- **Plan 8 — settings parity — is next and unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument and its radius and chrome decisions.
- **Plan 6 (`iconography-and-copy`) moved behind both** — its first task is a census of the surfaces as they landed, and a census of a shell about to move would be redone.
- **The evidence is measured, not asserted**: `.superpowers/sdd/2026-10-08-settings-and-appearance/mockup-vs-shell-measurement.md` (flush vs 8px islands, four off-scale `12px` radii, one surviving colour role) and `settings-vs-mockup-measurement.md` (13 of 19 regions drift from the drawing's settings section).


## Last completed change

- **Plan 7 Task 1 landed: the drawing is read, not restated** — `mockup-values.ts` parses `docs/design/mockups/editor-shell.html`'s own declarations by selector, `PARITY` carries 10 rows, and `design-language.spec.ts` reddens on 8 of them at both `--workers=1` and `--workers=2`, the header's 42px passing as the control.
- **The census is 49 rows — `fix` 34, `licensed` 1, `drawing-stale` 4, `match` 9, `no-counterpart` 1** — at `.superpowers/sdd/2026-10-10-shell-parity/adjudication.md`, naming the 13 `fix` rows this plan does not own and the one licence it keeps.
- **Two comparators were withdrawn on the controller's ruling (fix round 1)** — the drawn `1180px` card has no counterpart in a product that *is* the window (`no-counterpart`), and `.mockup`'s `10px` no longer compares a dialog; both dialogs read `--radius-lg` from the scale and both are red.
- **Four `drawing-stale` rows name repairs this plan may not make** — two `9px` cluster radii and three `#0007` shadows against §3, a bordered follow-the-system row against §1 — filed as `vg-296`, the mirror of `vg-291`.
- **Two config one-liners, because neither runner could see the reader** — `vitest.config.ts` includes `tests/e2e/**/*.test.ts` and `playwright.config.ts` matches `*.spec.ts` only, so the two stop collecting each other's files.

## Next

1. **Read the settings-vs-mockup measurement, file its drifts, and write the mockup-parity plan** — the shell first (`vg-231`), then the settings modal, then whichever surfaces it names.
2. **Make the drawing enforceable, not advisory** — `vg-292`'s fix (a comparison that reddens, or the drawing's values as the source a surface resolves from) is how this stops recurring.
3. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
4. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-292` is the one that matters for the objective**: the acceptance instrument cannot fail, so "the surface matches the design" is currently an opinion; `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are the same family — each an instrument claiming more coverage than it has.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
