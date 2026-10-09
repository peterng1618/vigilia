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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 3 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–3 landed** — the Composition pane's row, its attended-row affordances, and the Add pane's insert surface — and **Task 13, every React root unmounted on its own disposal path, is the next work, before Task 4**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R31, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **The Add pane's insert surface is React** — `panes/add/add-pane.tsx` draws `insertGroups()` as tiles in the owner's own order (R13), and `card-library.ts` owns the diagram name the pane draws.
- **Every React root is released, not merely removed** — `NewObjectPanel.destroy()` unmounts before `root.remove()` and `editor-session.ts` calls it, so the 12 document-level tooltip listeners stop stranding (R28).
- **A clipping tile discloses** — every grid tile carries its full name on focus and hover while the full-width Text row does not, so the one label that clips at 246px is readable (R30).
- **The glyphs are pinned to the owner** — the case derives its tile list from `insertGroups()`, so a new shape or chart family must be drawn rather than silently skipped.
- **The task's own review found the leak** — filed as issue #33 and fixed in the task that caused it; `vg-260` now carries the Add pane's clip, and Task 13 fixes the same defect in the palette panel.

## Next

1. **Plan 4 Task 13 — every React root unmounted on its own disposal path** — the palette panel's two nested roots leak per token switch, worse than the Add pane's did, plus a repo guard that fails when a shipped `createRoot` has no unmount (R29); it runs before Task 4.
2. **Tasks 4–12 follow:** the Add pane absorbing Assets and deleting `createAssetPanel` (its Files list is missing `accessible-names.dom.test.ts` and the accept rule — R16, R17), the Tokens pane discharging `vg-153` and `vg-094` (Tasks 5, 6 and 8 each return a `destroy()` — R29), the Document pane with its read-only References (R22), then the ratchet, the capture and the register.
3. **The plan's rulings live in the ledger, not here** — R1–R27, including the preflight scan of Tasks 4–12 and its ten rulings, each verified against source before it was made.
4. **The display proof stays blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"`, an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it.
- **One change in Task 3 is unverified** — the standalone fragment's key is derived from the group's own objects, but no test pins it: the collision is latent while `insertGroups()` emits one ungrouped group, so it cannot be red-proved yet.
- **The 246px width is a design decision, not a patch** (`vg-260`, now including the Add pane's clipped card label) — and two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
