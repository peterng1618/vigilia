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

- **Plan 5 — [`settings-and-appearance`](docs/superpowers/plans/2026-10-08-settings-and-appearance.md) — is the active plan, and its Phase 1 plus all of Task 4a are complete**: `13984ab9`/`3b4be19d` (the gear and the modal it opens), `64fea389`/`eba81b2a` (the Appearance tab, and the header chip's departure), `9b0af9d1` with fix rounds `6644abd1`/`12c31ec2` (the Keyboard tab), `91c3fdac` (the About tab), then Task 4a — `0251ce27`…`846e451c` and `6e210367`…`9fa7b7b4` (every remaining imperative or native-control surface as React); plans 1–4 are closed and exactly one plan is active at a time.
- **Plan 5's next work is Task 5 — the ratchet, the §2.3 census, and every re-pointed locator proven**, whose precondition Task 4a has discharged: zero hand-authored native select/range controls remain in the editor's source; the pre-flight rulings R1–R10 and both scan tables are in `.superpowers/sdd/2026-10-08-settings-and-appearance/`.
- **Plan 4 — [`the panes`](docs/superpowers/plans/archive/2026-10-08-the-panes.md) — closed complete on 2026-10-10**: all 13 tasks landed, its file is in `docs/superpowers/plans/archive/`, and its ledger (`.superpowers/sdd/2026-10-08-the-panes/progress.md`, git-ignored but on disk) holds R1–R78.
- **Two plans remain after plan 5** — `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item, and plan 5's Task 6 is that capture.

## Last completed change

- **Plan 5's Task 4a is complete — every remaining imperative surface and hand-authored native control is React over the control set** (`64171c97`…`846e451c`, then `6e210367`…`9fa7b7b4`): the three dialogs behind one new `components/ui/modal-host.tsx`, the font picker's last three `<select>`s on `ControlSelect`, and the `.vigilia-dialog*` block gone with its last consumer.
- **Its reviews found two things the task's own evidence could not see** — a missed re-point of `tests/e2e/rebuild-driver.ts` that left ~12 browser tests red, and `ControlSelect`'s positioner at `z-60` sitting under the dialog scrim's `70`, so **every option inside a converted dialog was unclickable**; both fixed in-task, the second being a product defect the conversion exposed rather than a test problem.
- **Task 4a's acceptance is discharged by measurement, not by the report** — `grep -rnE '<select|type="range"'` over the editor's `.ts` and `.tsx` returns **zero non-comment hits**, so no hand-authored native select or range control remains, which is Task 5's precondition.
- **Four register rows ride this work** — `vg-277`, `vg-119` and `vg-253` closed on checks the controller ran (the display proof now passes: 1 test in 4.6m), and `vg-280`–`vg-283` filed, the last being that `FontPicker` has no production mount in any package while the live font surface is `FontControls`.
- **Evidence:** editor unit suite 791 files / 3390 tests pass; `design:check` 61 gated files; ratchet 61; `panel-labels` 4/4 and the font/type-preset browser specs green on built bundles; the `editor-font-trio` capture now pairs graphite with editorial.

## Next

1. **Plan 5's Task 5 runs next** — the ratchet, the §2.3 census, and every re-pointed locator proven to fail when the behaviour it guards is disabled.
2. **Then plan 5's Task 6** — the parity capture beside the mockups, which must also show the About tab under a document carrying a release version (Task 4's thread has no rendered proof until then).
3. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — the sequence's last two, each ending with its own §13 parity capture.
4. **The register's newest rows are `vg-280`–`vg-283`**, all filed on 2026-10-10 at Task 4a; read [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl) for every open row rather than this file.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the active plan's ledger with its ruling — read them there; this file mirrors neither, which is why it had grown into a diary.**
- **The red browser list is shorter than it was, and the rest was last measured at Task 2's head rather than re-run** — `shell-surfaces.spec.ts`'s palette check is verified green (`vg-277`) and **the display proof now passes** (`vg-119`, `vg-253` verified at `ab89957a`: 1 test in 4.6m), leaving `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); a single sample proves nothing about the ones that were load or concurrency, so re-run any alone before believing it. **`vg-282` is why three of these stayed red unseen:** no command runs the rebuild or display configs — `playwright.config.ts` testIgnores them and nothing passes `--config`.
- **The 246px rail is a design decision, and it also paints over itself, and the Tokens pane is wider than its column** — `vg-260` (the Composition row's one-pixel fit and the Add pane's clipped card label) and `vg-265` (the layer-state slot painting over the role word's last 4px, with a fix that is a design decision no plan owns yet) plus `vg-270` (the Tokens pane's 205px horizontal overflow); two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The spec's Acceptance instrument is blind three ways** — `vg-271`: a replacement control emits its own native `<input>`, which no `<select>` grep counts; `vg-274`: the ratchet's `gated` list names no `.css` file, so every value in `editor-shell.css` is unchecked; `vg-278`: the design-language fixture nests the choice row inside `.editor-shell`, so it proves the shell's global focus rule rather than the treatment the portalled modal actually ships.
