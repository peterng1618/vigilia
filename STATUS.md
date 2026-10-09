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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 4 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–3 and 13 landed** — the Composition pane's row, its attended-row affordances, the Add pane's insert surface, and every React root released on its own disposal path — and **Task 4, the Add pane absorbing the file path as Assets stops existing, is the next work**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R32, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **Every React root is released, not merely removed** — `PalettePanel.destroy()` unmounts the picker's and the gradient's roots before `root.remove()`, the rebuild path releases the previous field set, and `editor-session.ts:714` calls it (Task 13, `1186b20f`).
- **A repo guard counts roots, not files** — `react-root-disposal.dom.test.ts` pins the five shipped `createRoot` files with their arities, so a second stranded root inside a file that already unmounts one now fails.
- **The instrument question was settled by measurement** — the reviewer was right that an open popover yields per-type listener evidence, so Base UI's twelve document types are asserted added and removed; the brief's contrary claim was wrong (R32).
- **The `mouseover`/`mouseout` listeners are jsdom's** — `nwsapi`'s `:hover` bookkeeping, named in the test beside React's `selectionchange`, so nothing of the panel's is unreleased.
- **A stale comment is corrected** — the picker is Base UI, and `mountPicker`'s doc now gives the alpha-channel reason rather than naming a library that is not in the file.

## Next

1. **Plan 4 Task 4 — the Add pane absorbs the file path, and Assets stops existing** — the pane gains the imports, with the pre-document refusal kept in words; its Files list is missing `accessible-names.dom.test.ts` and the accept rule at `asset-manager/panel.ts:257` moves with the panel (R16, R17).
2. **Tasks 5–12 follow:** the Tokens pane discharging `vg-153` and `vg-094` (Tasks 5, 6 and 8 each return a `destroy()`, which is what R29's guard holds), the Document pane with its read-only References (R22), then the ratchet, the capture and the register.
3. **The plan's rulings live in the ledger, not here** — R1–R27, including the preflight scan of Tasks 4–12 and its ten rulings, each verified against source before it was made.
4. **The display proof stays blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"`, an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it.
- **Two changes shipped unverified** — Task 3's standalone fragment key cannot be red-proved while `insertGroups()` emits one ungrouped group, and Task 13 parked three guard minors: a second document owner of `mouseover`/`mouseout` would slip past, the declared root list is unsorted, and an `AbortSignal` release switch in Base UI would false-fail the popover case.
- **The 246px width is a design decision, not a patch** (`vg-260`, now including the Add pane's clipped card label) — and two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
