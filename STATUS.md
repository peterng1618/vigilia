# Vigilia status

Updated: 2026-10-10
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–4 are closed and plan 5 is running, so the gates, the control set, the
shell, the rail, the inspector and the four panes are built, and the settings
surface is opening. The target is
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

- **Plan 5 — [`settings-and-appearance`](docs/superpowers/plans/2026-10-08-settings-and-appearance.md) — is the active plan, and Tasks 1–5 are complete**: `13984ab9`/`3b4be19d` (the gear and the modal it opens), `64fea389`/`eba81b2a` (the Appearance tab, and the header chip's departure), `9b0af9d1` with fix rounds `6644abd1`/`12c31ec2` (the Keyboard tab), `91c3fdac` (the About tab), `0251ce27`…`846e451c` and `6e210367`…`9fa7b7b4` (every remaining imperative or native-control surface as React), and `4698f233` (Task 5); plans 1–4 are closed and exactly one plan is active at a time.
- **Plan 5's last work is Task 6 — the parity capture beside the mockups**, whose Step 1 must also show the About tab under a document carrying a release version, since Task 4's version thread has no rendered proof until then; its brief is already at `.superpowers/sdd/2026-10-08-settings-and-appearance/task-6-brief.md`.
- **Plan 4 — [`the panes`](docs/superpowers/plans/archive/2026-10-08-the-panes.md) — closed complete on 2026-10-10**: all 13 tasks landed, its file is in `docs/superpowers/plans/archive/`, and its ledger (`.superpowers/sdd/2026-10-08-the-panes/progress.md`, git-ignored but on disk) holds R1–R78.
- **Two plans remain after plan 5** — `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item, and plan 5's Task 6 is that capture.

## Last completed change

- **Plan 5's Task 5 is complete — the ratchet, the §2.3 census and every re-pointed locator proven** (`4698f233`): the `gated` list grew 61 → 63 by the two files Tasks 2 and 4a left out, `design:check` prints `63 gated file(s) clean`, and an empty list still exits 1 naming the path.
- **Every re-pointed locator was proven red, one break at a time**, each restored with `cp` and `cmp` identical: the header chip put back, `applyShellPalette` dropped (7 browser failures, `unexpected value "editorial"`), the effective chord defaulted, `Dialog.Close` removed, the arm button and the six choice rows unnamed.
- **Two of the four locators the brief's Step 3 named do not guard the behaviour it claimed** — `keyboard.spec.ts:275` asserts the `?` sheet's `<kbd>` **count** and never a chord, and removing a **named** control is invisible to a sweep whose contract is "every control present has a name"; each behaviour is nonetheless proven red by a paired locator, so §2.3 holds.
- **The task review then found the census had omitted the sheet's own effective-chord locator, making `4698f233`'s body assert something false** — `shortcut-reference.dom.test.tsx:70-91` does guard it, proven red at `expected 'Ctrl+Shift+P' to be 'Ctrl+J'`; the commit is **not** amended, and the correction and the amended `vg-284` ride the close commit instead of a rewritten history.
- **Three register rows ride the task** — `vg-284` (the count-only sheet assertion, amended to name both jsdom guards), `vg-285` (a default-worker browser run reporting 30 s timeouts as failures at a clean HEAD) and `vg-286` (the ratchet has no rule for test files: 9 ungated plan-touched files, 6 under `tests/e2e`).

## Next

1. **Plan 5's Task 6 runs next** — the parity capture beside `docs/design/mockups/editor-shell.html`'s settings section, every difference accounted for, and the About tab captured under a document carrying a release version.
2. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — the sequence's last two, each ending with its own §13 parity capture.
3. **The register's newest rows are `vg-284`–`vg-286`**, all filed at Task 5; read [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl) for every open row rather than this file.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the active plan's ledger with its ruling — read them there; this file mirrors neither, which is why it had grown into a diary.**
- **The red browser list is short but stale** — `shell-surfaces.spec.ts` and the display proof are green (`vg-277`, `vg-119`, `vg-253` verified), leaving `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-282` is why their siblings stayed red unseen** (no command runs the rebuild or display configs), and **`vg-285` now says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision, and it also paints over itself, and the Tokens pane is wider than its column** — `vg-260` (the Composition row's one-pixel fit and the Add pane's clipped card label) and `vg-265` (the layer-state slot painting over the role word's last 4px, with a fix that is a design decision no plan owns yet) plus `vg-270` (the Tokens pane's 205px horizontal overflow); two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The spec's Acceptance instrument is blind four ways** — `vg-271`: a replacement control emits its own native `<input>`, which no `<select>` grep counts; `vg-274`: the ratchet's `gated` list names no `.css` file, so `editor-shell.css` is unchecked — **measured at Task 5: 85 hex literals across 80 of 2115 lines, 68 unchecked violations (9 hex, 38 off-scale px, 21 spacing px), and plan 6's before-state**; `vg-278`: the design-language fixture nests the choice row inside `.editor-shell`, so it proves the shell's global focus rule rather than the treatment the portalled modal ships; `vg-286`: no rule decides which test files the ratchet covers, so a literal asserted in a browser spec is unchecked.
