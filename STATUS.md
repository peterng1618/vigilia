# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5, 7 and 8 are closed. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in the bible and still does not look like the mockup.

## Active work

- **Plan 6 — [`iconography-and-copy`](docs/superpowers/plans/2026-10-08-iconography-and-copy.md) — is the active plan**, nine tasks in three phases: Phase 1 (1–3) the census and the glyph set, Phase 2 (4–6) the one-string pairing and the copy, Phase 3 (7–9) the gate, the Acceptance and the parity close.
- **Task 1 is complete and reviewed clean** (`5f676da4`): the census of what landed, which refuted three of the plan's own hypotheses — 15 lucide importers against a guessed nine, **four** stroke weights against three, and both "hand-wired" pairings the brief named already one string by construction.
- **The pre-flight scan ran before Task 2 and ruled on three plan defects** (`2dab4302`): Task 3's test named a `STACK_GLYPH` that no task declares, Task 2's family assertion presupposed the answer to a question bible §6 leaves open, and Task 7's empty-list fixture would have tested a missing file rather than an empty list.
- **The plan is a contract the scan corrects, not one it obeys**: each ruling reached the plan file so the briefs Tasks 2 and 3 are extracted from carry it, because a ruling kept only in a dispatch is invisible to the reviewer.
- **Plan 8 — [`settings-parity`](docs/superpowers/plans/archive/2026-10-11-settings-parity.md) — is archived as superseded by its own residue, not as clean**: its §13 closure condition is unmet, six differences are `fix` with owners outside the plan (`vg-328`'s nav eyebrow among them), and three of those wait on the user's rulings.

## Last completed change

- **Plan 6's Task 1, the census** (`5f676da4`): its commit body carries the four inventories — glyph sites and weights, copy owners with the accessors they read, icon-only pairings, and the strings that name a capability — each marked as already closed by an earlier plan or as this plan's open work.
- **The review's two findings were fixed in the body, not deferred**: the importer-grep blind spot is **four** chrome surfaces, not two (`layer-panel.tsx:34`, `pane.tsx:48`, `add-pane.tsx`, `card-diagrams.tsx`), and inventory 2 is enumerated rather than counted, because its only copy had been in a git-ignored report.
- **The scan's rulings reached the plan file** (`2dab4302`), together with the four out-of-band weights now adjudicated one at a time, the census's four weights replacing the plan's pre-census guess of three, and Task 4's `noTooltip` count seeded at 4 rather than left as a placeholder filled after the fact.
- **`vg-181` and `vg-182` were re-measured and amended** (`cb89fab6`): the duplicate contract is at `ui-copy.ts:85-86`, and `vg-182`'s cross-module disagreement is gone — `uiCopy.shortcuts.named` no longer exists — leaving a narrower residual that stays **open**.
- **Four gates green at the close:** `backlog:check` `188 items, all valid`, `status:check`, `design:check`, and the whole-file `ui-copy`/`accessible-names` nets untouched by a task that changed no source.

## Next

1. **Plan 6 Task 2 — one icon vocabulary, one weight** — `editor-shell/icons.ts`, the four weights collapsing into §6's 1.6–1.8 band, the three out-of-band sites (`2`, `2.5`, `2.5`) adjudicated one at a time against §6's filled-glyph escape, and `STACK_GLYPH` exported for Task 3.
2. **`vg-321`, `vg-322` and `vg-328` wait on the user's rulings** — whether a palette preview bar depicts the palette's surface or its ground, whether the modal takes the drawing's fixed `560px` or stays content-sized, and whether the nav also carries the surface name.
3. **`vg-316`, `vg-319`, `vg-325`'s four product values and `vg-274`'s 24 spacing values wait on a product pass** in `editor-shell.css`, whose ceiling (58) counts four of them by name.
4. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px`), and whether `current/settings.html` shows the editor behind the modal.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected** (a default-count red on this box is contention, never that spec's runtime); `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324`/`vg-327`/`vg-329` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
