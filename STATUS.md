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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–7 are complete through `73fea76e` after three fix rounds and two clean scoped re-reviews; Task 8, the control ratchet and no native control left in the column, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **The parity ledger names its whole instrument set** — `PRE_PLAN` in `index.dom.test.ts` says its 19 names are the *shared* floor and names the union that carries the claim; the census is recorded with its command at its own sha (**979 / 976 / 965**), `vigilia-field` is **0** in the inspector and 0 in `tests/e2e` (44 remain in plan 4's panes).
- **Every re-pointed locator is driven by hook, and the driver obeys its own scoping rule** — 17 `selectOption` calls on `[data-vigilia-run-*]` become `chooseIn`, `chooseToken` delegates to a scoped `chooseLabelIn`, and `typeIntoControl` reads the slider's IDL `.min`/`.max` rather than `getAttribute` (`Number(null) === 0` pinned every value to the floor).
- **The flake was a defect, not the loaded box** — `openList` fell back to a page-wide `[role="option"]` lookup whenever Base UI had not yet committed `open`, landing on a stale hidden option and timing out on a different case each run; it now waits for `aria-controls` and throws loudly instead.
- **A read by presentation class becomes a hook** — `Select.Value` carries `data-vigilia-value` and `choiceOf` reads it; `sectionExpanded` throws for a missing section rather than answering `false`.
- **Gates green** — vitest 36 files / 574; `author-journey-rebuild.spec.ts` **9/9 three times** by path at `--workers=1` after 7/2 and 8/1 on identical behaviour; `composition-panel:897` pre-existing and `vg-119` open, both unrelated.

## Next

1. **Task 8 is next in plan 3** — the control ratchet and no native control left in the column; Task 9's parity capture and Task 10's register and close follow it. Its Step 1 census must carry two corrections: **Ruling AC** (the brief's command returns 4 — one comment and three slider queries in the control set's own test — so it must scope to non-test source, where the true count is 0) and **Ruling AE** (the docblock's 47 names is 46, and the remainder 27, because a comment at `190dc1a4` quotes the hook prefix).
2. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites, filed separately because fixing the colour leaves those failing.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **Task 7's whole-project desktop run is the only broad sample this change has** — 223 passed, 3 failed: `composition-panel.spec.ts:897` is the pre-existing group-entry timeout measured at the plan-3 base, `keyboard.spec.ts:123` is `vg-204` (red at base, open), and `design-language.spec.ts:398` was a stale `dist` — `npm run build` empties it and does not build `control-fixture.html`, which needs `npm run build:fixture -w @vigilia/editor`; rebuilt, that spec is green. `vg-135`, `vg-175`, `vg-196`, `vg-197`, `vg-210`, `vg-137` and `vg-204` can still redden a run, and `vg-216` means two runs at once fabricate failures. **And the instrument is weak by construction:** the rebuild suite passed twice on the code that then failed twice, so a green run proves nothing about anything intermittent — the `openList` fix is trusted because it *deletes* the failing path rather than retrying it, and a recurrence needs instrumentation of the specific case, not more samples.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
