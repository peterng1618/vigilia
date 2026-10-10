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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 8 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–7 and 13 landed** — the Composition pane's row, its attended-row affordances, the Add pane, every React root released on its own disposal path, and the whole Tokens pane including `vg-094` — and **Task 8, the Document pane, opens next**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R40, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **`vg-094` is gone** — the pane's preset chooser opened on the first declared preset, so an author who set a run to `24-400` read `17-400`; it now opens on the selection, observed in a built bundle rather than argued (`24-400` after, `Nothing selected.` when cleared).
- **Three answers read distinctly** — "the selection is set to X", "nothing selected", and a dangling reference as a **third**, unresolved answer; a group or multi-selection now states what the Inspector's own owner already states for it (`selectionChildrenTypes`), where it previously said the selection carried no preset.
- **The reveal is two steps and the join is pinned** — the Inspector's control opens the Tokens slot and then scrolls to the row, through one `reveal(slot, target)` owner; a case that changes the `"tokens"` literal now fails, where before it stayed green everywhere.
- **Two defects found by review rather than by a failing test** — `presetRevealTarget` was resolving to `undefined` under the session test, which mocks its barrel wholesale, so the reveal had been untestable through that seam; and the redundant re-export that caused it is deleted.
- **R40's parked question came back answered** — collapsing `Binding`'s four props to three would be a **defect**, not a tidy-up: a zero-member `ActiveSelection` reports `activeKind === "group"` with `selectedCount 0`, so the derived boolean would read "nothing selected" as "carries no type preset".

## Next

1. **Plan 4 Task 8 — the Document pane** — artboard, background and metadata on the control set, with every field, branch and refusal it has today enumerated **before** the rewrite, that enumeration being the checklist the rewrite is measured against; `artboard-panel.ts` keeps its signature and `root`/`render` and gains `destroy()`.
2. **Then Tasks 9–12:** the Document pane's References read-only (R22), then the ratchet, the capture and the register — every plan ends with its §13 parity capture.
3. **The plan's rulings live in the ledger, not here** — R1–R40, including the preflight scan of Tasks 4–12 and its ten rulings, each verified against source before it was made.
4. **Tasks 8–12's briefs must be regenerated before dispatch** — they were written before the day's plan edits (Task 13's insertion, `destroy()` on Tasks 5/6/8, R24's amendment, R36, R39 and R40) and are stale as they sit.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Parked and unverified observations live in the plan's ledger, one section per task, each with its ruling** — no longer enumerated here, for the reason above. The newest are Task 7's: the container wording is DOM-asserted but not observed in a browser; a dangling reference is pinned by a unit case only; `presetRevealTarget`'s `CSS.escape` branch is untested because jsdom has no `CSS`; and the 246px readout fit was measured by the implementer but not re-measured by review.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px width is a design decision, not a patch** (`vg-260`, now including the Add pane's clipped card label) — and two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
