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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1–3 are complete at `b89d61c4`, and Task 3a, the chart content and paint fields, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Plan 3 Task 3 landed at `b89d61c4`** — Content and Layer are React field views (name, run editor, rotation, opacity), with `runs.ts`'s 817 lines replaced by `runs.tsx`.
- **Three fix rounds, two clean re-reviews**: the integer rule found a home in the control set, the accessible-name audit stopped treating `aria-hidden` as reachable, and a literal run's text left its own React key.
- **The three findings were verification shapes, not typos** — a rule with nowhere to live, a `--grep` matching test titles read as having measured a red set, and a regression called pre-existing after being checked against the task's own commit rather than its base.
- **`vg-249` filed**: a text run has no identity in the persisted model, so row keys must come from content; Task 3a meets the same shape for chart series rows, with `vg-044`'s mutation-time reconciliation as the precedent.
- **Task 7's sweep now carries seven e2e files**, selected as files and never by a title grep.

## Next

1. **Task 3a — chart content and paint** — chart UI stops returning `HTMLElement[]` into a React inspector; Task 3 already dispatches the `chartContent`/`chartPaint` extra kinds to `null` with their owner named.
2. **Task 7 owns one removal commit** — seven e2e specs' locators, the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases.
3. **Manager-ownership cleanup is deferred, not dropped** — the survey's fifteen rows (`vg-232`…`vg-246`) are live in the register; the ordering is re-decided at plan 3's close, since a mid-plan pause leaves the column half-converted and the inspector's own modules are two of those rows.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and seven specs are red by design until Task 7 — `editor.spec.ts`, `inspector-sections.spec.ts`, `shell-surfaces.spec.ts`, `rebuild-driver.ts`, `author-journey-rebuild.spec.ts`, `author-journey-display.spec.ts` and `rebuild-composition.ts` still read the `<details>`/`<summary>` markup or drive native `<select>`s that Task 2 and Task 3 replaced.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
