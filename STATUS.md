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

- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan, and it is 11 of its 13 tasks in**; plans 1–3 are closed and archived, and exactly one plan is active at a time.
- **Tasks 1–10 and 13 landed** — the Composition pane's row, its attended-row affordances, the Add pane, every React root released on its own disposal path, the whole Tokens pane including `vg-094`, the Document pane on the control set, its References read-only, and the ratchet that leaves no native control in any pane — and **Task 11, the parity capture, opens next**.
- **Plan 4's ledger is `.superpowers/sdd/2026-10-08-the-panes/progress.md`** (git-ignored but on disk): it holds the predecessor reconciliation and rulings R1–R40, and a fresh session continues from it rather than from this file.
- **Three plans remain after this one** — `2026-10-08-settings-and-appearance.md`, `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.

## Last completed change

- **The last native control left the panes** — `file-section.tsx` renders `ControlSelect`, so the four panes hold no native `<select>` and no native `range`; the grep fell 13 → 12 and every reader of the `data-vigilia-asset-select` hook re-pointed rather than relaxed.
- **The panel's `select` terms were dead and are deleted** — `80facf67` removed their last live consumer (the Add pane's select rendered under `aside.editor-shell-panel`) and the reason recorded for keeping them was false; `.editor-shell-panel input` stays, because Base UI's select renders a hidden value-carrier `input`.
- **That same conversion turned `shell-appearance.spec.ts` red and nothing in the task could see it** — all six palettes read `documentSelect = (absent)`, measured green at base; the sweep now reads `.editor-shell-panel [role="combobox"]` and carries a bite proof the old read never had.
- **Two of the plan's own numbers were wrong, and the plan was corrected rather than the ledger alone** — the grep split is five prose + eight real, and Step 5's answer is "delete the two select terms", not "nothing" (`6c7ad0b1`, `40913935`).
- **Task 11's Step 1 would have created ten duplicate capture rows** — all four panes already have registered actions whose title regexes still select live tests, so the step is a refresh, not an add (`a4337461`).

## Next

1. **Plan 4 Task 11 — the parity capture** — built bundles, one worker, the four panes in the states the mockup draws, each capture asserting it is photographing the new pane, placed beside `docs/design/mockups/editor-shell.html`; R62 rules the tell-the-user gate and R70 that the registration rows already exist.
2. **Then Task 12 — the captures, the register, STATUS.md** — every plan ends with its §13 parity capture and its register pass; two findings await rows there, sourced from the `Discovered, not fixed:` trailers in `80facf67` (the dead `.editor-shell-inspector select` pair, and the ungated `preset-list.dom.test.tsx`).
3. **The plan's rulings live in the ledger, not here** — R1–R71, including the pre-flight scans of Tasks 4–12 and a sixth occurrence of the claim-from-purpose failure shape, each caught by running something.
4. **Tasks 11 and 12's briefs are regenerated** against the corrected plan (`6c7ad0b1`, `40913935`, `a4337461`) and are current as they sit.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Parked and unverified observations live in the plan's ledger, one section per task, each with its ruling — read it there.** This file enumerates none of them, for the reason above; the newest section is Task 8's.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px width is a design decision, not a patch** (`vg-260`, now including the Add pane's clipped card label) — and two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
