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

- **The plan-boundary broad gate is adjudicated, and none of its nine failures is this branch's** — three pass alone at `3e8c9523` (`glass-lifecycle.spec.ts:25`, `host-media.spec.ts:723`, `publish-loop.spec.ts:349`, the load class `vg-141` and `vg-212` already document) and the other six **fail identically at base `190dc1a4`**: 6 failed / 44 passed at each end, with the same tests and the same assertion values.
- **The measurement was made at both ends rather than argued from the file list** — a worktree at `190dc1a4` outside the repo tree, `npm ci` plus build, then the same eight spec files with `--workers=1`, because `editor-shell.css` and `layer-tree.ts` *are* in the branch and "plan 3 does not touch that surface" was not available.
- **Three rows carry the four that had none** — `editor-clip.spec.ts:296`'s no-op second camera step, the display cluster's two phone assertions, and the circle/rect photograph diffusion, which is related to `vg-037` without simply contradicting its bit-identical-luma ruling.
- **Both worktrees are gone** — the baseline tree and a pre-existing `vigilia-base`, which held a clean checkout with no unique commits but was held open by an orphaned `vite preview` on port 4198; only `D:/git-repos/vigilia` remains.

## Next

1. **Plan 4 — the panes — is the next work**, filling the four rail slots over plan 3's `selection-inspector/view.ts` and `inspector.tsx`: the Composition pane's kind-glyph rows, the Add pane rebuilt with `insertGroups()` units and the asset path absorbed (deleting the Assets slot), the Tokens pane's paint and preset lists discharging `vg-153` and `vg-094`, and the Document pane's four scopes — with every converted file added to `scripts/design-tokens.gated.json`'s `gated` list as it lands.
2. **The display proof is blocked on `vg-119`** — `author-journey-display.spec.ts` fails at `rebuild-composition.ts:148`'s stale `colour: "text"` (the document declares `palette.text`), an open row with its own owner; `vg-253` is the same file's 16 remaining `selectOption` sites.
3. **Plan 3's plan workspace is deleted at this close**, and its ledger is gone with it — what survives is this file, the register, and the commit messages.
4. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)** — read it there; this file no longer mirrors the register, which is why it had grown into a diary.
- **Six pre-existing browser failures are red at this branch's head and were red before it** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), and the three rows filed at this close; a green or red single sample of this suite proves nothing about the three that were load, so re-run any of the nine alone before believing it.
- **Three of the six are phone-chromium and none of them is understood** — the clip spec's second camera step, the display cluster overhanging the stage's edge by 149px, and a hover border that moves a box were each measured, not explained, and their causes are recorded as not established rather than guessed.
- **Two palette defects are pinned, not fixed** — vg-200 (the resting `--edge` boundary, 2.15:1 in graphite and 1.42:1 in light) and vg-201 (`--warn` text, 1.4–2.0:1 in ember, moss and plum) — so the gate is green with a measured floor under each, and §5's ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright — and this branch rewrote three of those specs, none of them typechecked.
