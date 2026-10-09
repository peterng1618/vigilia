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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/2026-10-08-the-inspector.md) — is the active plan**: Tasks 1 and 2 are complete at `cdd6ecc0`, and Task 3, the Content and Layer sections, is next.
- **Plans 1 and 2 are complete and closed** — the gates and the control set, then the shell and the rail through `cea69cac`; exactly one plan is active at a time, and this is it.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **Plan 3 Task 2 landed at `cdd6ecc0`** — the five sections' chrome is React (`InspectorSection`), in `SETTINGS_SECTIONS` order, with the still-imperative field bodies mounted into a per-section container beside the view.
- **The count cannot lie**: it is the body's own length, carried through the projection and filled from that same array, so header and body cannot disagree.
- **The DOM-free guard got stronger** — `projectSelection` strips bodies at one reduction, and the round-trip test now feeds a section with a real element in.
- **`property-section.ts` is dead code** — zero production consumers, kept green by its own test file — and is removed with the `.vigilia-section*` CSS and the locators by Task 7, in one commit.
- **Review approved, no Critical or Important** — one Minor became a binding constraint on Task 3 (`column.tsx` cannot yet render `fields`/`extras`), and the act-warning risk measured nil.

## Next

1. **Task 3 — the Content and Layer sections** — dispatched with four binding constraints: `column.tsx` gains field and extras rendering, the deferred blur-race proof, `restoreFocus`'s host-scoped query, and the per-object lock notify burst.
2. **Task 7 owns one removal commit** — the four red e2e specs' locators, the dead `.vigilia-section*` CSS, and `property-section.ts` with its test cases.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **The browser suite has known reds, so it cannot be read as green**: `vg-135`, `vg-175`, `vg-196` and `vg-197` can redden a run, `vg-210` is deterministic at base, `vg-137` and `vg-204` fail deterministically, `vg-216` means two runs at once fabricate failures, and four specs are red by design until Task 7 — `editor.spec.ts`, `inspector-sections.spec.ts`, `shell-surfaces.spec.ts` and `rebuild-driver.ts` still read the `<details>`/`<summary>` markup Task 2 replaced.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
