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

- **Plan 5 — [`settings-and-appearance`](docs/superpowers/plans/2026-10-08-settings-and-appearance.md) — is the active plan, and Tasks 1–3 are complete**: `13984ab9`/`3b4be19d` (the gear and the modal it opens), `64fea389`/`eba81b2a` (the Appearance tab, and the header chip's departure), then `9b0af9d1` with fix rounds `6644abd1` and `12c31ec2` (the Keyboard tab); plans 1–4 are closed and exactly one plan is active at a time.
- **Plan 5's next task is Task 4 — About, version and provenance from what the editor actually has**; the pre-flight conflict rulings R1–R10 and both scan tables are in `.superpowers/sdd/2026-10-08-settings-and-appearance/`.
- **Plan 4 — [`the panes`](docs/superpowers/plans/archive/2026-10-08-the-panes.md) — closed complete on 2026-10-10**: all 13 tasks landed, its file is in `docs/superpowers/plans/archive/`, and its ledger (`.superpowers/sdd/2026-10-08-the-panes/progress.md`, git-ignored but on disk) holds R1–R78.
- **Two plans remain after plan 5** — `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item, and plan 5's Task 6 is that capture.

## Last completed change

- **Plan 5's Task 3 is complete — every chord is rebindable through one effective table, the reference is generated from that same table, and the header's publish chord runs the host** (`9b0af9d1`, fix rounds `6644abd1` and `12c31ec2`).
- **Its review found the new storage layer silently losing an author's override** — the reader validated a stored entry against the defaults while the capture validated against the effective table, so a binding accepted on screen reverted on the next reload with nothing reported.
- **The fix that holds is one predicate, not one reproduction**: the first round closed the reported case, and the re-review found the same class one layer in — the refusal accepting punctuation the reader would drop — so `storableKey` is now the single rule the reader and the capture both call, with a capture→reload round trip committed.
- **The evidence gap was closed by measurement rather than styling** — the armed row's ring was read as rendered pixels across all six palettes (editorial 18.39:1, graphite 11.65:1, ember 5.68:1, moss 6.18:1, plum 7.68:1, light 3.44:1) with `editor-shell.css` byte-identical, and `F5`/`F11`/`F12` now refuse as browser-reserved rather than unprintable, which is what the code should always have said.
- **Evidence:** editor unit suite 138 files / 1781 tests pass; `shortcut-manager/` + `editor-shell/` 30 files / 368 tests; `design:check` exit 0 over 56 gated files; `backlog:check` reads 149 items, all valid.

## Next

1. **Plan 5's Task 4 — About — runs next**: version and provenance read from what the editor actually has rather than a build-time constant.
2. **Then plan 5's Tasks 4a, 5 and 6** — the dialog and font-picker rendering, the ratchet census and every re-pointed locator, then the parity capture.
3. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — the sequence's last two, each ending with its own §13 parity capture.
4. **The register's newest row is `vg-278`**, filed at plan 5's second task; read [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl) for every open row rather than this file.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the active plan's ledger with its ruling — read them there; this file mirrors neither, which is why it had grown into a diary.**
- **Seven browser specs are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), three rows filed at plan 3's close, and `shell-surfaces.spec.ts:53` (`vg-277`, filed 2026-10-10: `.first()` reaches the Document pane's hidden section now that plan 4 keeps every pane mounted); a single sample proves nothing about the ones that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px rail is a design decision, and it also paints over itself, and the Tokens pane is wider than its column** — `vg-260` (the Composition row's one-pixel fit and the Add pane's clipped card label) and `vg-265` (the layer-state slot painting over the role word's last 4px, with a fix that is a design decision no plan owns yet) plus `vg-270` (the Tokens pane's 205px horizontal overflow); two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The spec's Acceptance instrument is blind three ways** — `vg-271`: a replacement control emits its own native `<input>`, which no `<select>` grep counts; `vg-274`: the ratchet's `gated` list names no `.css` file, so every value in `editor-shell.css` is unchecked; `vg-278`: the design-language fixture nests the choice row inside `.editor-shell`, so it proves the shell's global focus rule rather than the treatment the portalled modal actually ships.
