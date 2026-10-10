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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 9 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–8 and 13 landed** — the Composition pane's row, its attended-row affordances, the Add pane, every React root released on its own disposal path, the whole Tokens pane including `vg-094`, and the Document pane on the control set — and **Task 9, References, opens next**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R40, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **The Document pane renders on the control set** — `artboard-panel.ts` fell from 594 lines to 145, all 16 `data-vigilia-*` hooks surviving on their focusable elements, with Step 1's enumeration of every field, branch and refusal written into the commit before a line of it moved.
- **A silent refusal the red proofs could not see** — a fractional artboard dimension was accepted by the field, refused by the pane's own guard, and announced to nobody; found by review rather than by a failing test, then pinned with `integer: true` on both halves and a case that drives `1.5`.
- **The first fix's own case was vacuous** — the mid-draft canvas case stayed green with the panel's `object:modified` subscription dead, because both its assertions were end-state, so the scoped re-review sent it back to observe the redraw.
- **`vg-264` was filed on a premise the review measured false** — the pane never printed a size bound (`linkedPair` calls `numberInput`; `boundLine` is `numberField`'s, whose only caller is the settings path) — and was rewritten to what survives: the React control set prints its refusals as hardcoded English while `uiCopy.panels.invalidNumber` stays live.
- **Three divergences ruled rather than filed** — the clamp-to-refuse change (`0` used to commit as `1`), the note's move out of the size pair, and the enumeration case's hook-only contract, each named in the fix commit and in the ledger.

## Next

1. **Plan 4 Task 9 — References** — the document's resolved references read-only in the Document pane, with the marker on the header *before* the section is opened; `InspectorSection` hides a collapsed body rather than unmounting it, so "still closed" is the panel's `hidden` (R41).
2. **Then Tasks 10–12:** the ratchet and the four panes' native-control count, the parity capture beside the mockup, then the register — every plan ends with its §13 parity capture.
3. **The plan's rulings live in the ledger, not here** — R1–R56, including the pre-flight scans of Tasks 4–12 and of Tasks 9–12, each ruled before dispatch and then applied to the plan text rather than only recorded.
4. **Tasks 9–12's briefs must be regenerated before dispatch** — they were written before the day's plan edits (Task 13's insertion, `destroy()` on Tasks 5/6/8, R24's amendment, R36, R39, R40, and R41–R49) and are stale as they sit.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Parked and unverified observations live in the plan's ledger, one section per task, each with its ruling — read it there.** This file enumerates none of them, for the reason above; the newest section is Task 8's.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px width is a design decision, not a patch** (`vg-260`, now including the Add pane's clipped card label) — and two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
