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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–8 are complete through `59a678fe`, each reviewed, after three fix rounds and two clean scoped re-reviews; Task 9, the parity capture beside the mockup, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Task 8 read the ratchet rather than extending it, and that is the finding** — `design:check` exits **0** over **28** gated files, and an emptied list exits **1** naming the list, proved through one `os.tmpdir()` path because a `/tmp` literal resolves differently for Git Bash and Node and would have failed as "no such file" — a non-zero exit that looks like the proof while proving nothing.
- **The guard was red-proved, not assumed** — planting `#ff00aa` and `7px` in a gated surface turned it red, so a green run is a measurement rather than an absence of one.
- **No CSS was deleted, because the deletion set is empty** — `.vigilia-field*` still has live emitters in plan 4's panes and `.vigilia-resolution` is still emitted at `appearance.ts:233`; deleting them would break rendering now and fail the step's own grep, so the brief's conditional "Modify" line resolved to nothing.
- **Ruling AE is applied** — the `PRE_PLAN` docblock reads **46** names with a remainder of **27**, the over-count caveat travelling beside the instrument rather than being dropped.
- **The plan's own figures re-measured, one corrected** — `editor-shell.css` is 88 hex occurrences on **83** lines and the editor source 358 across 51 files; the controller's earlier **53** was a shared-`/g` `lastIndex` artefact, caught by the agent and reproduced by the reviewer.

## Next

1. **Task 9 is next in plan 3** — the parity capture beside the mockup, with three pre-flight corrections: the three captures and their README rows **already exist**, so Step 1 is giving the existing ones the preconditions they lack (subject block leads, five sections with Position closed, a read-only Spends row with no editable control), and **two of the three images are stale** — card and shape were last written 2026-10-06 at `8b4274b7`, 328 commits back, before this plan rebuilt the column; `captureVisualReview` returns early and silently when `VIGILIA_CAPTURE` is unset, so "1 test ran" is not proof an image was written; and the dark-palette capture the brief requires is registered nowhere. Task 10's register and close follows.
2. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites, filed separately because fixing the colour leaves those failing.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **Task 7's whole-project desktop run is the only broad sample this change has** — 223 passed, 3 failed: `composition-panel.spec.ts:897` is the pre-existing group-entry timeout measured at the plan-3 base, `keyboard.spec.ts:123` is `vg-204` (red at base, open), and `design-language.spec.ts:398` was a stale `dist` — `npm run build` empties it and does not build `control-fixture.html`, which needs `npm run build:fixture -w @vigilia/editor`; rebuilt, that spec is green. `vg-135`, `vg-175`, `vg-196`, `vg-197`, `vg-210`, `vg-137` and `vg-204` can still redden a run, and `vg-216` means two runs at once fabricate failures. **And the instrument is weak by construction:** the rebuild suite passed twice on the code that then failed twice, so a green run proves nothing about anything intermittent — the `openList` fix is trusted because it *deletes* the failing path rather than retrying it, and a recurrence needs instrumentation of the specific case, not more samples.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
