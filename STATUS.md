# Vigilia status

Updated: 2026-10-10
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–4 are closed, so the gates, the control set, the shell, the rail, the
inspector and the four panes are built. The target is
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

- **Plan 5 — [`settings-and-appearance`](docs/superpowers/plans/2026-10-08-settings-and-appearance.md) — is the active plan, and it has not started**; plans 1–4 are closed and exactly one plan is active at a time.
- **Plan 4 — [`the panes`](docs/superpowers/plans/archive/2026-10-08-the-panes.md) — closed complete on 2026-10-10**: all 13 tasks landed, its four-pane parity comparison and its register moves are in its closing commit, and its ledger (`.superpowers/sdd/2026-10-08-the-panes/progress.md`, git-ignored but on disk) holds the predecessor reconciliation and rulings R1–R78.
- **Plan 4's plan file is in `docs/superpowers/plans/archive/`** — the two queued plans that name it (`settings-and-appearance.md:18`, `:619`; `iconography-and-copy.md:18`) spell the bare filename, never a path, and a sequence paragraph and a boundary clause are pointers rather than dependencies, which is how plan 3 was archived under the identical mentions; `vg-152` now owns the closed plans still live, redesign 1 and 2 among them.
- **Two plans remain after plan 5** — `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted, subagent-driven when it runs; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item, and plan 4's four pane captures were read that way.

## Last completed change

- **The four pane captures were read beside `editor-shell.html` as language, not pixels** — its Add specimen is the only pane it draws and was rendered and compared directly; Composition, Tokens and Document were adjudicated against the bible and the plan's field inventories, and the framing rule (the images are the rail's 246×636 column, not the pane `section`, whose own box is 220×2166 for Tokens) is what kept two crops from being read as drift.
- **`vg-153` and `vg-094` are `verified` and moved to `backlog-archive.jsonl`** — each with a `check` naming a word from its own title and `artefacts` naming ancestors of `HEAD` (`ebe1743b`+`56516ce0`; `ff2ad1a6`+`40ac5d02`), and `vg-154` stays open with its detail extended by the insert half landing and a selection-scoped replace not existing.
- **Five rows were filed by the same pass** — `vg-266` (the dead `.editor-shell-inspector select` pair), `vg-267` (the ungated `preset-list.dom.test.tsx`, and its sibling), `vg-268` (`font-picker.tsx` on no product surface), `vg-269` (no pane's title bar carries §7.3's count), `vg-270` (the Tokens pane overflows its column sideways by 205px).
- **The plan's mockup was left as it stands** — every difference it shows is deliberate with a reason, is owned by a later plan, or is a row (`vg-266`–`vg-270`); nothing in it was stale against the bible, so `docs/design/mockups/editor-shell.html` is unedited.
- **`npm run backlog:check` reads 141 items, all valid, and `npm run status:check` passes after this file names plan 5.**

## Next

1. **Plan 5 — settings and appearance — opens** — the rail's gear, the Settings surface (Appearance, Keyboard, About), the palette chip's move out of the header, keyboard rebinding and the `publish.*` chord; its plan file is the active contract and it is not started.
2. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — the sequence's last two, each ending with its own §13 parity capture.
3. **The register's newest rows are the five this close filed** — `vg-266`–`vg-270`; read [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl) for every open row rather than this file.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
5. **The plan's rulings live in the ledger, not here** — R1–R78, including the pre-flight scans of Tasks 4–12 and nine occurrences of the claim-from-purpose shape, each caught by running or measuring something rather than by reading it — the ninth being one a fix round introduced and a scoped re-review caught.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file does not mirror the register, which is why it had grown into a diary.
- **Parked and unverified observations live in the plan's ledger, one section per task, each with its ruling — read it there**; the newest section is Task 12's.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px rail is a design decision, and it also paints over itself, and the Tokens pane is wider than its column** — `vg-260` (the Composition row's one-pixel fit and the Add pane's clipped card label) and `vg-265` (the layer-state slot painting over the role word's last 4px, with a fix that is a design decision no plan owns yet) plus `vg-270` (the Tokens pane's 205px horizontal overflow); two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
