# Vigilia status

Updated: 2026-10-10
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set, the shell, the inspector and the whole Tokens pane are built. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract is
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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 12 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–11 and 13 landed** — the Composition pane's row, its attended-row affordances, the Add pane, every React root released on its own disposal path, the whole Tokens pane including `vg-094`, the Document pane on the control set, its References read-only, the ratchet that leaves no native control in any pane, and the parity capture that puts all four panes on record — and **Task 12, the comparison and the register, opens next**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R40, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **The four panes are captured beside the mockup** — one new test in `design-language.spec.ts` wrote `pane-{composition,add,tokens,document}` at 246×636 and twelve registered actions were re-captured; the four new images were inspected and each shows the pane its row names.
- **The capture is framed on the rail's column, not the pane `section`** — measured, the `section`'s own box is 220×2166 for Tokens, so a `section` screenshot is ~1800px of blank page; the column is what an author sees, and Task 12's comparison is told not to read the resulting crop as drift.
- **`vg-265` said the Composition role word was clipped; it is covered** — re-measured on the built bundle, the glyph extent equals its box in all ten rows while an absolutely-positioned, 75%-opaque `.vigilia-layer-state` (x 287–293) paints over the role's last 4px; the row's own proposed check (`scrollWidth > clientWidth`) passes and would not catch it.
- **The register and the plan both carry the correction** — `vg-265` rewritten with the measured cause and linked to `vg-260`, whose "fits by one pixel" is replaced by the measurement (role right 291, row clip 295, column 308; the name is what yields).
- **One README rule was wrong about its own scope** — "captures use `?static=1` and a controlled clock" is the player's rule; `?static=1` is read only by `packages/player/src/main.ts:66`, so the editor captures cannot follow it and the line now says so.

## Next

1. **Plan 4 Task 12 — the comparison and the register** — the four pane captures read against `docs/design/mockups/editor-shell.html` as language, not pixels; then `vg-153` and `vg-094` close as `verified` against an ancestor sha and `vg-154` stays open with its detail extended.
2. **Then the plan closes and the redesign spec's Acceptance walk begins** — every plan in this spec ends with its §13 parity capture, and this is plan 4's.
3. **The plan's rulings live in the ledger, not here** — R1–R75, including the pre-flight scans of Tasks 4–12 and six occurrences of the claim-from-purpose shape, each caught by running something.
4. **Two findings await rows in Task 12**, sourced from the `Discovered, not fixed:` trailers in `80facf67` (the dead `.editor-shell-inspector select` pair, and the ungated `preset-list.dom.test.tsx`).
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Parked and unverified observations live in the plan's ledger, one section per task, each with its ruling — read it there.** This file enumerates none of them, for the reason above; the newest section is Task 8's.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px rail is a design decision, and it also paints over itself** — `vg-260` (now including the Add pane's clipped card label), plus `vg-265`: the layer-state slot is `position: absolute`, 6px wide and 75% opaque, overlapping the role word's last 4px in every Composition row, with a fix that is a design decision no plan owns yet; two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
