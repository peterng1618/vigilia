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

- **Plan 4's whole-branch review returned "Ready to merge — with fixes"** — 1 Critical, 2 Important, 6 Minor, and the Critical was reproduced by me before anything was done about it, not taken from the report.
- **The Critical was a unit test red at the plan's own close commit** — Task 10's `ControlSelect` made Base UI render a hidden value-carrier `<input>` in the Add pane that `accessible-names.dom.test.ts` pins one comment per control, and no whole-suite run happened after Task 10; fixed in `2f99a732`, whole suite green at 241 files / 3322 tests, 0 failed.
- **The plan-design half is fixed forward rather than filed** — plan 5's Task 4a and both remaining closes now require the whole editor unit suite and name the audit file, and plan 6's Task 8 acceptance step now carries that file's enumerated list beside the greps.
- **Three rows were filed** — `vg-271` (the spec's acceptance instrument cannot see a carrier a replacement control emits), `vg-272` (the plain-button idiom's four unowned copies), `vg-273` (`moveFocus`'s arrow branches untested) — and `vg-159`/`vg-160` were reworded so their "plan 4" names their own plan rather than this one.
- **Plan 4's file is archived and its ledger keeps R1–R78**; `npm run backlog:check` reads 144 items, all valid, and `npm run status:check` passes.

## Next

1. **Plan 5 — settings and appearance — opens** — the rail's gear, the Settings surface (Appearance, Keyboard, About), the palette chip's move out of the header, keyboard rebinding and the `publish.*` chord; its plan file is the active contract and it is not started.
2. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — the sequence's last two, each ending with its own §13 parity capture.
3. **The register's newest rows are the eight this close filed** — `vg-266`–`vg-273`; read [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl) for every open row rather than this file.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
5. **The plan's rulings live in the ledger, not here** — R1–R78, including the pre-flight scans of Tasks 4–12 and nine occurrences of the claim-from-purpose shape, each caught by running or measuring something rather than by reading it — the ninth being one a fix round introduced and a scoped re-review caught.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plan's ledger with its ruling — read them there; this file mirrors neither, which is why it had grown into a diary.** The newest ledger section is the whole-branch review's.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px rail is a design decision, and it also paints over itself, and the Tokens pane is wider than its column** — `vg-260` (the Composition row's one-pixel fit and the Add pane's clipped card label) and `vg-265` (the layer-state slot painting over the role word's last 4px, with a fix that is a design decision no plan owns yet) plus `vg-270` (the Tokens pane's 205px horizontal overflow); two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The spec's acceptance instrument for native controls is blind to the class it exists for** — `vg-271`: a replacement control emits its own native `<input>`, which no `<select>` grep counts, and the two remaining plans now work around it while the spec's own sentence stays unruled.
