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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Task 9 has landed; Task 8 is next, then 2 → 3 → 4 → 5 → 6 → 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument now reads them: eight rows red on today's shell, no unresolved row, at both worker counts.
- **Task 8 is the field-row alignment the user reported** — the shared control row's four widths and the legacy unlayered shell rules that re-box inputs; it must land before Task 7 puts the stylesheet under the ratchet.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument and its radius and chrome decisions.
- **Plan 6 (`iconography-and-copy`) moved behind both** — its first task is a census of the surfaces as they landed, and a census of a shell about to move would be redone.


## Last completed change

- **Plan 7 Task 9 landed: the drawings show today's surfaces, and the originals are labelled** (`5773f652`) — four files under `docs/design/mockups/current/` (`shell`, `settings`, `controls`, `controls-light`), drawn in the originals' treatment with nothing addressed to the reader.
- **The originals are kept, not redrawn** — one identical label line each, verified as the only change to each file, so the record of what was designed first survives.
- **The instrument reads the new drawings and still fails on today's shell** — eight rows red at `--workers=1` and `--workers=2`, no unresolved row, the header's 42px passing as the control; reader 10/10 and the whole editor suite 792 files / 3402 tests / 0 failed.
- **A flush region of the shell is square, by ruling** (`e2e3c5a1`) — the drawing declares a radius wherever it wants one and none on the rail, panes, stage, inspector, header or status; only `.editor-shell-dialog` takes `--radius-lg`.
- **`vg-300` filed, not fixed** — the README's "How a gate uses them" still lets a divergence through as "recorded as deliberate", which is the clause class the user's complaint is about.

## Next

1. **Execute plan 7 in its stated order** — Task 9 (dispatched), then Task 8, then 2 → 3 → 4 → 5 → 6 → 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Adjudicate Task 1's task review, running now** over the frozen range `d7d5baaa..8d127f56`; Task 9's review follows it.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-292` is the one that matters for the objective**: the acceptance instrument cannot fail, so "the surface matches the design" is currently an opinion; `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are the same family — each an instrument claiming more coverage than it has — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
