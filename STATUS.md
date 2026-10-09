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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–9 are complete through `1ab06ad2`, each reviewed; Task 10, the register and the close, is next and is the last task in the plan.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **The parity captures are now the real column, and two of them had been pictures of the old one** — card and shape were last written at `8b4274b7` on 2026-10-06, 328 commits back; all four are regenerated, shoot the 276px column instead of a 1280×720 viewport, and came back byte-identical when the reviewer re-ran them into a scratch directory.
- **Ruling AF: Opacity was a §5 defect, not a deliberate simplification** — bible §5's closed control table, the mockup's own caption at `inspector-controls.html:201` and this plan's `glass.ts:180-184` precedent all call a bounded number a slider, so it is one now; Rotation stays a number because angles wrap and nothing bounds them.
- **Ruling AG: the capture shot the viewport, so `Spends` had never been photographed** — the clip is `.editor-shell-inspector`'s `overflow: auto`, and a plain element capture still showed a blank band; `captureVisualReview` gained an optional scope, leaving every existing caller's output unchanged.
- **A fourth capture for the dark half, which was genuinely uncovered** — the existing captures are the editorial palette and `shell-palette-graphite` photographs an empty column, so `editor-inspector-chart-graphite` is the only capture that could catch a hard-coded hex; it did not, because the accent is palette-driven.
- **Two claims corrected rather than carried** — the report's "mockup panels draw no count" is false (the historical panel draws the product's exact `Content 1` / `Position 3` / `Spends 8`, so that item is a parity match), and `vg-254` is filed for the slider's missing drag preview, measured in the built editor and traced to `column.tsx:183-192` passing no `onPreview`.

## Next

1. **Task 10 is next, and it is the plan's last task** — the register and the close, **pre-verified**: `vg-148` is live at `backlog.jsonl:36` and is fixed by plan 3, with `check` = `selection-inspector/index.dom.test.ts:731` (run at `7a56d174`: **1 passed | 88 skipped**) and `artefacts` = `f1a35b82`, which `git merge-base --is-ancestor` confirms is on the mainline; all six rows it leaves open (`vg-094`, `vg-153`, `vg-158`, `vg-160`, `vg-185`, `vg-192`) are live and `open`, and the archive must be grepped on the **`id` field**, because the bare string `vg-148` matches a cross-reference in `vg-157`'s prose.
2. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites, filed separately because fixing the colour leaves those failing.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **Task 7's whole-project desktop run is the only broad sample this change has** — 223 passed, 3 failed: `composition-panel.spec.ts:897` is the pre-existing group-entry timeout measured at the plan-3 base, `keyboard.spec.ts:123` is `vg-204` (red at base, open), and `design-language.spec.ts:398` was a stale `dist` — `npm run build` empties it and does not build `control-fixture.html`, which needs `npm run build:fixture -w @vigilia/editor`; rebuilt, that spec is green. `vg-135`, `vg-175`, `vg-196`, `vg-197`, `vg-210`, `vg-137` and `vg-204` can still redden a run, and `vg-216` means two runs at once fabricate failures. **And the instrument is weak by construction:** the rebuild suite passed twice on the code that then failed twice, so a green run proves nothing about anything intermittent — the `openList` fix is trusted because it *deletes* the failing path rather than retrying it, and a recurrence needs instrumentation of the specific case, not more samples.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
