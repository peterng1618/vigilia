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

- **Plan 5 — [`settings-and-appearance`](docs/superpowers/plans/2026-10-08-settings-and-appearance.md) — is the active plan, and Tasks 1–2 have landed**: `13984ab9` (the gear and the modal it opens) plus its fix round `3b4be19d`, then Task 2 (Appearance); plans 1–4 are closed and exactly one plan is active at a time.
- **Plan 5's next task is Task 3 — the Keyboard tab and the `publish.*` chord**; Task 2's pre-flight conflict rulings R1–R10 and both scan tables are in `.superpowers/sdd/2026-10-08-settings-and-appearance/`.
- **Plan 4 — [`the panes`](docs/superpowers/plans/archive/2026-10-08-the-panes.md) — closed complete on 2026-10-10**: all 13 tasks landed, its file is in `docs/superpowers/plans/archive/`, and its ledger (`.superpowers/sdd/2026-10-08-the-panes/progress.md`, git-ignored but on disk) holds R1–R78.
- **Two plans remain after plan 5** — `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md), queued and unstarted; every plan ends with its §13 parity capture.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item, and plan 5's Task 6 is that capture.

## Last completed change

- **Plan 5's Task 2 landed — the Appearance tab carries the six shell palettes and follow-the-system, and the header chip is gone**: the gear is the only route to the choice, and the at-a-glance readout is the cost §7 accepted knowingly.
- **The choice is a `Choice row`: the bible's §5 gained exactly one control** — `components/ui/control-choice-row.tsx` is a `Radio.Root` in one labelled `radiogroup`, so the group owns the checked bit and the arrow keys rather than each row holding its own.
- **`clearShellChoice` is new, and it is what makes "follow the system" reachable at all**: the key's absence is what `readShellChoice` already read as "no choice", and until now nothing could produce it.
- **The old menu is deleted with its test**, the header's palette assertion is inverted to prove nothing came back, and `panel-labels.spec.ts`'s header entry follows the control into the modal rather than being retired.
- **Evidence:** editor unit suite 136 files / 1731 tests pass; `design:check` exit 0 over 53 gated files; the two e2e sweeps pass 13/13; removing `applyShellPalette` from the choose path reddens 7 of the 9 shell-appearance cases.

## Next

1. **Plan 5's Task 3 — Keyboard — runs next**: every chord becomes rebindable through one effective binding table, and `⌘⇧P` gets something to run before the header prints it.
2. **Then plan 5's Tasks 4, 4a, 5 and 6** — About, the font picker and dialog rendering, the ratchet census, then the parity capture.
3. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — the sequence's last two, each ending with its own §13 parity capture.
4. **The register's newest row is `vg-274`**, filed at plan 5's first task; read [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl) for every open row rather than this file.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the active plan's ledger with its ruling — read them there; this file mirrors neither, which is why it had grown into a diary.**
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and three rows filed at plan 3's close; a single sample proves nothing about the three that were load, so re-run any alone before believing it. **The display proof waits on the same class:** `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (`vg-119`), and `vg-253` is that file's 16 remaining `selectOption` sites.
- **The 246px rail is a design decision, and it also paints over itself, and the Tokens pane is wider than its column** — `vg-260` (the Composition row's one-pixel fit and the Add pane's clipped card label) and `vg-265` (the layer-state slot painting over the role word's last 4px, with a fix that is a design decision no plan owns yet) plus `vg-270` (the Tokens pane's 205px horizontal overflow); two palette defects stay pinned, `vg-200` (the resting `--edge` boundary, 2.15:1 graphite / 1.42:1 light) and `vg-201` (`--warn` text, 1.4–2.0:1 in ember, moss and plum), so §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The spec's Acceptance instrument is blind twice over** — `vg-271`: a replacement control emits its own native `<input>`, which no `<select>` grep counts; `vg-274`: the ratchet's `gated` list names no `.css` file, so every value in `editor-shell.css` is unchecked by it while both remaining plans only record the file's hex count.
