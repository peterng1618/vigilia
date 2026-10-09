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

- **Plan 3 — [`the inspector`](docs/superpowers/plans/archive/2026-10-08-the-inspector.md) — is complete**: ten tasks done and reviewed, the close commit landed, the final whole-branch review returned no Critical, and the one fix it produced is in and re-reviewed.
- **Plan 4 — [`the panes`](docs/superpowers/plans/2026-10-08-the-panes.md) — is the active plan and the next to run**; plans 1 and 2 closed through `cea69cac`, and exactly one plan is active at a time.
- **The spec is `draft` and unimplemented** — its acceptance sections are plans of measurement, not results.
- **Reactify ([0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md)) is the frame, not a phase** — every editor surface becomes React, only the canvas stays imperative, and no Fabric object is ever mirrored into React state.
- **The mockups are the checked reference** ([`docs/design/mockups/`](docs/design/mockups/)), not files read once and remembered; spec §13 makes a capture beside them a gate item.
- **Seven user rulings from the design pass are recorded** in the spec's *Ruled during review*, including four rail slots, `View` staying in the menubar, and the stage drawing no device.

## Last completed change

- **The imperative island is gone** — `3e8c9523` renders the type-preset reveal as a React button and deletes the body slot outright (`SectionParts.body`, `mountBodies`, `data-vigilia-section-body`, and the `focusedControl`/`restoreFocus` pair), which takes `selection-inspector/index.ts` from **822 to 736** lines, back under AGENTS.md's 800 stop.
- **One scoped re-review, no Critical** — all six questions CONFIRMED and both red-proofs real, with `data-vigilia-reveal-type-presets` and Spends' count preserved; its one Advisory, a comment naming the deleted focus pair, is fixed in `runs.tsx`.
- **`format:check` was red on a line plan 3 wrote** — `tests/e2e/inspector-sections.spec.ts:65`, Task 9's capture-slack formula, because `format:check` and `lint` sit in neither the plan's gate nor the broad run; biome's own wrap applied and 593 files are green.
- **Two rows carry what was measured** — `vg-255` records 822 → 736 and stays open, and `vg-153` records the *second* imperative UI surface the re-review found (`style.ts:43-97`, `appearance.ts:227-237`), which the final review had missed.

## Next

1. **Plan 4 — the panes — is the next work**, filling the four rail slots over plan 3's `selection-inspector/view.ts` and `inspector.tsx`: the Composition pane's kind-glyph rows, the Add pane rebuilt with `insertGroups()` units and the asset path absorbed (deleting the Assets slot), the Tokens pane's paint and preset lists discharging `vg-153` and `vg-094`, and the Document pane's four scopes — with every converted file added to `scripts/design-tokens.gated.json`'s `gated` list as it lands.
2. **A base-commit baseline for six browser failures is in flight** — a measurement-only agent at `190dc1a4`, and its result decides whether any of them is this branch's; any that is becomes a fix before plan 4 starts.
3. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **The plan-boundary broad gate was red with nine failures, and three are now settled** — re-run alone at `3e8c9523`, `glass-lifecycle.spec.ts:25`, `host-media.spec.ts:723` and `publish-loop.spec.ts:349` all pass, which is the load class `vg-141` and `vg-212` already document, so a green or red single sample of this suite proves nothing about any of them.
- **Six failures stay red in isolation and are not yet called pre-existing** — `composition-panel.spec.ts:897` (`vg-210`) and `keyboard.spec.ts:123` (`vg-204`) are rows that each say they fail at base, but `editor-clip.spec.ts:296`, `editor-display.spec.ts:610`, `editor-display.spec.ts:706` and `glass-circle-parity.spec.ts:361` — every one of them phone-chromium — have no row, and the `190dc1a4` sample that would settle them has not reported.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — and this branch rewrote three of those specs, none of them typechecked.
