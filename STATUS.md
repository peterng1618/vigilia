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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 6 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–5 and 13 landed** — the Composition pane's row, its attended-row affordances, the Add pane's insert surface and its absorbed file path, every React root released on its own disposal path, and the Tokens pane's paint list — and **Task 6, the preset library beside the paint list, opens next**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R35, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **Paints are a list of swatch wells** — `panes/tokens/paint-list.tsx` and `tokens-pane.tsx` are new, and `palette-manager/panel.ts`'s factory now mounts one `createRoot` over them and returns `destroy()`.
- **Identity replaces the imperative `built`/`shape` rebuild** — the field set is keyed by token *and* paint kind, so a colour change re-renders in place and a kind switch remounts; both directions are pinned, because only one was the measured defect.
- **The pane's two nested roots die** — the picker and the gradient editor are React children now, so `react-root-disposal.dom.test.ts` declares `palette-manager/panel.ts` as **1**, down from 2 (R32).
- **`panel.ts` is de-hexed and gated** — the four `#ffffff` literals Task 13 left are gone; the two that remain as authored data live in `newTokenPaint`, and the file joins `scripts/design-tokens.gated.json` (42 files gated, 20 violations before it joined).
- **R19 landed** — `ui-copy.test.ts` chooses `[data-vigilia-palette-token-row="glow"]` instead of driving a native `<select>`, and the paint kinds are read from the Base UI popup that owns them.

## Next

1. **Plan 4 Task 6 — the preset list** — `tokens-pane.tsx` is written so the preset library mounts beside the paint list from the same pane host, and `vg-094`'s binding is the task after it.
2. **Tasks 6–12 follow:** the preset list and `vg-094`'s binding, the Document pane with its read-only References (R22), then the ratchet, the capture and the register.
3. **The plan's rulings live in the ledger, not here** — R1–R27, including the preflight scan of Tasks 4–12 and its ten rulings, each verified against source before it was made.
4. **The display proof stays blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"`, an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it.
- **Four things shipped unverified, parked, or changed unnamed** — Task 3's standalone fragment key cannot be red-proved while `insertGroups()` emits one ungrouped group; Task 13 parked three guard minors (a second `mouseover`/`mouseout` owner would slip past, the root list is unsorted, an `AbortSignal` switch would false-fail the popover case); Task 4 parked a sentence at `file-section.tsx:63-65` reading as "a duplicate is impossible"; and Task 4's in-flight import guard silently drops a second pick — a behaviour change the plan did not name, ruled deliberate (R35) because the old panel's unguarded concurrent imports were the race, not the parity.
- **The 246px width is a design decision, not a patch** (`vg-260`, now including the Add pane's clipped card label) — and two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
