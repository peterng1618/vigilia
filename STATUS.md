# Vigilia status

Updated: 2026-10-10
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set, the shell, the inspector and now the Composition pane are built. The target is
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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 1 of its 12 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Task 1 landed** — the Composition pane's row is React — and **Task 2, the row's affordances and the pane's footer, is the next work**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R15, and a fresh session continues from it rather than from this file.
- **Two plans remain after this one** — `2026-10-08-settings-and-appearance.md`, then `2026-10-08-iconography-and-copy.md`; the spec's Acceptance list is walked against the built product once they close, and every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **The Composition pane's row is React** — `layer-panel.tsx` went **841 → 40 lines** and now holds only the `LayerActions` footer; the row moved to `panes/composition/composition-pane.tsx` and `kind-mark.tsx` with its own spec.
- **A group's row draws the stack glyph as a constant** — the arm reads no member of `mark` and `KindMark`'s prop is a union with no children field, so §5.1's correction is structural rather than a comment.
- **The pane column is the bible's 246px**, superseding plan 2's measured 360px: the row's mark slot was re-measured 40 → 28px, and `composition-panel.spec.ts`'s width case was re-pointed at the superseded column.
- **The ratchet was seeded in the same commit** — `gated` 28 → 30 entries, `design:check` clean; `panel-labels.spec.ts` re-run 4/4 green; the browser spec ran 9 with 8 passing, `:897` (`vg-210`) red as before.
- **The width case's red proof was vacuous and is now shown to bite** — the review's fix round proved it fails at `:206` when the instrument is narrowed, and corrected a comment still quoting the old 40px slot.

## Next

1. **Plan 4 Task 2 — the row's affordances and the pane's footer** — rename, eye and lock on the attended row, the group-entry control, arrow-key navigation, and the footer over Task 1's `panes/composition/`.
2. **Tasks 3–12 follow:** the Add pane absorbing Assets and deleting `createAssetPanel`, the Tokens pane discharging `vg-153` and `vg-094` including the preset chooser's binding to the selection, the Document pane with its read-only References, then the ratchet, the capture and the register.
3. **The plan's rulings live in the ledger, not here** — R1–R15, including the reconciliation's two corrections: nothing carries the selection's preset id, and there is no programmatic pane-open call.
4. **The display proof stays blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"`, an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it.
- **The 246px Composition row fits its role column by one pixel** (`vg-260`) — the worst case is `group-trends-card`, and no test can see it because the width case asserts directions and never a pixel.
- **Two palette defects are pinned, not fixed** — `vg-200` (the resting `--edge` boundary, 2.15:1 graphite and 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
