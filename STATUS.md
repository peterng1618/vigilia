# Vigilia status

Updated: 2026-10-09
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

The look is specified and the rewrite under it is decided; the gates, the control
set, the whole shell and now the inspector's boundary are built. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract
is
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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/archive/2026-10-08-the-inspector.md) — is complete**: all ten tasks are done and reviewed, this close commit being the last, and its plan now lives in `archive/`, with only the final whole-branch review outstanding.
- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan and the next to run**; plans 1 and 2 are complete and closed through `cea69cac`, and exactly one plan is active at a time.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **`vg-148` is `verified` and archived** — locking through the layer row used to leave the column offering its writing fields; the row now carries `check` = `src/web/tests/e2e/inspector-sections.spec.ts:648` (its own route, `[aria-label="Lock"]`, asserting `[data-vigilia-locked]`) and `artefacts` = `f1a35b82`, plan 3's Task 1, where `OBJECT_LOCK_CHANGED_EVENT` and the inspector's subscription landed.
- **The archive was grepped on the `id` field, never the bare string** — `grep -c '"id":"vg-148"' docs/product/backlog-archive.jsonl` returned `0` before the move, because the bare string matches a cross-reference in `vg-157`'s prose; the close therefore neither suppressed nor double-filed the row, and `npm run backlog:check` reads `127 items, all valid` after it.
- **The rows that stay open say so** — `vg-094` and `vg-153` are the Tokens pane's (plan 4's), `vg-158`'s cause is still not established, and `vg-160`, `vg-185`, `vg-192` and `vg-254` are untouched; no new row was added, and `vg-203`'s record is corrected rather than left: plan 3 *did* reach the duplicated text/number pair without converging it, so its line citations are refreshed and it needs a new owner.
- **Plan 3's plan is archived and plan 4 named next** — `git mv` to `docs/superpowers/plans/archive/`, STATUS re-pointed at the new path, and plan 4 — the panes — is next with its landmarks.

## Next

1. **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the next work**, filling the four rail slots over plan 3's `selection-inspector/view.ts` and `inspector.tsx`: the Composition pane's kind-glyph rows, the Add pane rebuilt with `insertGroups()` units and the asset path absorbed (deleting the Assets slot), the Tokens pane's paint and preset lists discharging `vg-153` and `vg-094`, and the Document pane's four scopes — with every converted file added to `scripts/design-tokens.gated.json`'s `gated` list as it lands.
2. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites, filed separately because fixing the colour leaves those failing.
3. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **Task 7's whole-project desktop run is the only broad sample this change has** — 223 passed, 3 failed: `composition-panel.spec.ts:897` is the pre-existing group-entry timeout measured at the plan-3 base, `keyboard.spec.ts:123` is `vg-204` (red at base, open), and `design-language.spec.ts:398` was a stale `dist` — `npm run build` empties it and does not build `control-fixture.html`, which needs `npm run build:fixture -w @vigilia/editor`; rebuilt, that spec is green. `vg-135`, `vg-175`, `vg-196`, `vg-197`, `vg-210`, `vg-137` and `vg-204` can still redden a run, and `vg-216` means two runs at once fabricate failures. **And the instrument is weak by construction:** the rebuild suite passed twice on the code that then failed twice, so a green run proves nothing about anything intermittent — the `openList` fix is trusted because it *deletes* the failing path rather than retrying it, and a recurrence needs instrumentation of the specific case, not more samples.
- **A pane's title bar and footer scroll with its body** (`vg-208`) — bible §7.7 wants them outside it, but the plan makes the aside the single scroller deliberately, so it is a structure decision rather than a task.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — the parity spec included.
