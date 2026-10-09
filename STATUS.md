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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–6 are complete; Task 7 landed at `9501542c` with fix round 1 on top, and Task 8, the control ratchet and no native control left in the column, follows.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **The parity ledger names its whole instrument set** — `PRE_PLAN` in `index.dom.test.ts` now says its ~20 names are the *shared* hooks and names the union (`crop/runs/panel/glass/artboard-panel.dom.test.ts`, the built-bundle e2e specs), so the table reads as the floor, and STATUS's census reads the measured 976.
- **The rebuild journey's stale locators are re-pointed** — 17 `selectOption` calls on `[data-vigilia-run-*]` (Base UI comboboxes now) become `chooseIn`, and the trends case reads its bindings off `data-vigilia-value`; `author-journey-rebuild.spec.ts` **9 passed**, two full samples.
- **The driver obeys its own scoping rule** — `chooseToken` delegates to a scoped `chooseLabelIn`, and `typeIntoControl` reads the slider's IDL `.min`/`.max` (the `getAttribute` form landed every value on 0, because `Number(null) === 0`).
- **A read by presentation class becomes a hook** — `Select.Value` carries `data-vigilia-value` and `choiceOf` reads it; `sectionExpanded` throws for a missing section rather than answering `false`.
- **Gates green** — format, lint, typecheck, `design:check`, build; vitest 36 files / 574; e2e by path 111 passed, with `composition-panel:897` (pre-existing) and `editor:4105` (green alone in 2.7 s — a load flake) the only reds.

## Next

1. **Task 8 is next in plan 3** — the control ratchet and no native control left in the column; Task 9's parity capture and Task 10's register and close follow it.
2. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; that file also still drives `[data-vigilia-run-*]` with `selectOption` at 16 sites.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **Task 7's whole-project desktop run is the only broad sample this change has** — 223 passed, 3 failed: `composition-panel.spec.ts:897` is the pre-existing group-entry timeout measured at the plan-3 base, `keyboard.spec.ts:123` is `vg-204` (red at base, open), and `design-language.spec.ts:398` was a stale `dist` — `npm run build` empties it and does not build `control-fixture.html`, which needs `npm run build:fixture -w @vigilia/editor`; rebuilt, that spec is green. `vg-135`, `vg-175`, `vg-196`, `vg-197`, `vg-210`, `vg-137` and `vg-204` can still redden a run, and `vg-216` means two runs at once fabricate failures.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
