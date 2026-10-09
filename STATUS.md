# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set, the whole shell and now the inspector's boundary are built. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract
is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
and the boundary that makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

The measure of done is the spec's Acceptance section, which is counted rather
than reviewed: no hex colour and no off-scale spacing in a surface, no native
`<select>`, and every panel's existing behaviour surviving its rewrite.

**The standing author-loop objective is suspended, not withdrawn.** Driving the
product to find what is broken resumes when this objective closes, and the
backlog it produced stays live in the register.

## Active work

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–7 are complete, and Task 8, the control ratchet and no native control left in the column, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 7 proves parity rather than reviewing it** — `index.dom.test.ts` gains *the field inventory the plan inherits (base 190dc1a4)*: every `SELECTION_KINDS` member and a locked object asserted against the pre-plan hook list read from `git show 190dc1a4:`, as a superset, in eight cases.
- **Every re-pointed locator is shown to fail when what it guards is disabled** — removing the option hook reddens the picker (`Expected: 1 / Received: 0`), dropping the row's reason reddens the glass refusal, removing `aria-expanded` reddens the section reader, and dropping `data-vigilia-panel-stroke` reddens the inventory.
- **A real defect is fixed in the surface, not the test** — Base UI clears its value and reports `reason: "none"` when the option list loses the item it had selected, which undid `reassignPaletteToken` and left a panel unpainted; `control-select.tsx` now commits only an author's own choice.
- **The class primitives are gone** — `grep vigilia-field` is **0** against 998 hook reads (965 at base, 3 `vigilia-field`); `property-section.ts`, its test cases and the dead `.vigilia-section*` CSS are deleted.
- **Gates green** — 36 files / 574 selection-inspector + editor-session + editor-shell tests (581 − the 7 `property-section` cases), `settings-fields.test.ts` 41 unmodified, and format, lint, typecheck, build and `design:check` all clean.

## Next

1. **Task 8 is next in plan 3** — the control ratchet and no native control left in the column; Task 9's parity capture and Task 10's register and close follow it.
2. **Three suites were not run by Task 7** — `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts` and `rebuild-composition.ts` all import the `rebuild-driver.ts` paths Task 7 changed and each has its own runner, so they are the first thing Task 8 should exercise.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **Task 7's whole-project desktop run is the only broad sample this change has** — 223 passed, 3 failed: `composition-panel.spec.ts:897` is the pre-existing group-entry timeout measured at the plan-3 base, `keyboard.spec.ts:123` is `vg-204` (red at base, open), and `design-language.spec.ts:398` was a stale `dist` — `npm run build` empties it and does not build `control-fixture.html`, which needs `npm run build:fixture -w @vigilia/editor`; rebuilt, that spec is green. `vg-135`, `vg-175`, `vg-196`, `vg-197`, `vg-210`, `vg-137` and `vg-204` can still redden a run, and `vg-216` means two runs at once fabricate failures.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
