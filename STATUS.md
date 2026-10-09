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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 2 of its 12 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–2 landed** — the Composition pane's row is React, with its rename, eye and lock on the attended row — and **Task 3, the Add pane's insert surface, is the next work**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R15, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **The row's rename, eye and lock are React** — `panes/composition/row-affordances.tsx` owns the attendance gate, the row is the control set's 26px box, and `ROW_HEIGHT` 24 → 26 moved with the stylesheet and the drop-line in one commit.
- **The footer kept the registry** — `objectActionsFor(bridge)` unchanged, with a case that proves the eligibility filter by disabling it, and the pane's own controls proven to reach the bridge rather than selecting through them.
- **Review Focus 2 closed as code** — `tabIndex`, `onFocus` and the blur guard that keeps a row's controls mounted under the keyboard are now covered, each red-proofed.
- **The browser case measures rendered geometry again** — the slot's own 122px box bound to the `:has` arm's computed margin, both halves red-proofed, the stylesheet-restating assertions gone.
- **`vg-260` carries Task 2's re-measurement** — at the bible's 246px the four-control row clips both the key and the name, so the pane's width is now a design decision rather than a one-number patch.

## Next

1. **Plan 4 Task 3 — the Add pane's insert surface** — Cards, Shapes, Charts and Text as tiles from `insertGroups()`, in the owner's own order (Cards, Text, Shapes, Charts: ruling R13), with the pre-document refusal kept in words.
2. **Tasks 4–12 follow:** the Add pane absorbing Assets and deleting `createAssetPanel` (its Files list is missing `accessible-names.dom.test.ts` and the accept rule — R16, R17), the Tokens pane discharging `vg-153` and `vg-094`, the Document pane with its read-only References (R22), then the ratchet, the capture and the register.
3. **The plan's rulings live in the ledger, not here** — R1–R27, including the preflight scan of Tasks 4–12 and its ten rulings, each verified against source before it was made.
4. **The display proof stays blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"`, an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it.
- **The 246px Composition row fits its role column by one pixel** (`vg-260`) — the worst case is `group-trends-card`, and no test can see it because the width case asserts directions and never a pixel.
- **Two palette defects are pinned, not fixed** — `vg-200` (the resting `--edge` boundary, 2.15:1 graphite and 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
