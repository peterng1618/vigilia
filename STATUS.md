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

- **No plan is active.** Plan 8 is complete in all ten tasks and archived; plan 6 (`iconography-and-copy`) is the spec's next plan and starts at the user's word.
- **Plan 8 — [`settings-parity`](docs/superpowers/plans/archive/2026-10-11-settings-parity.md) — is archived as superseded by its own residue, not as clean**: its §13 closure condition is unmet, five differences are `fix` with owners outside the plan, and two of those wait on the user's rulings.
- **The §13 capture landed**: `settings-capture-graphite.png` and `settings-capture-editorial.png` sit in `docs/design/mockups/current/` beside `settings.html`, byte-identical to the six registered captures they were copied from.
- **The instrument reads the drawings rather than one file**: the drawings gate opens every drawing in `docs/design/mockups/current/` (six, plus two parity PNGs it skips), holds each literal to its own scale — radius to §3's table, spacing to §3's steps, type to §2's six sizes — and names the file, line and value it fails on.
- **Plan 6 waits on nothing but the user**: its first task is a census of the surfaces as they landed, which is cheapest now that both parity plans have stopped moving the shell.

## Last completed change

- **Plan 8 Task 10 — the §13 capture** (`b78ee264`, `93710665`): the six registered settings captures re-taken in both palettes against rebuilt bundles, `1 test` per action, and the Appearance pair placed beside the drawing.
- **The difference list is disposed of and is not empty**: four differences are `licensed` by predating bible rules (§3 `:77`/`:79`, §10 `:449` with §4's roles), and five stay open with owners — the Close (`vg-316`), the frame width (`vg-322`), the preview bars (`vg-321`), the shared `h3`'s type (`vg-319`) and the product's four off-scale values (`vg-274`/`vg-325`).
- **Task 9's ceiling is the §9 evidence**: 61 measured, 58 counted, ceiling 58 — the third figure is what the three exempt `margin-right` values subtract, and a ceiling of 61 could never have fired.
- **Five citations were corrected to the line they actually quote** (`:79`→`:77`, `:48`→`:49`, `:121`→`:124`, `:56`→`:54`, `editor-shell.css:1295`→`:1317`), and the corrections live in the register rows rather than in a report that dies with the session; no licence was invalidated.
- `npx vitest run` green at 245 files / 3416 tests, `design-language.spec.ts` 9 passed at `--workers=1`, and all eight gate commands (format, lint, design, typecheck, status, backlog, gates:self-test, hooks:check) exit 0.

## Next

1. **Plan 6 — `iconography-and-copy`** — the spec's next plan, and the redesign's next step; read its file and dispatch Task 1.
2. **`vg-321` and `vg-322` wait on the user's rulings** — whether a palette preview bar depicts the palette's surface or its ground, and whether the modal takes the drawing's fixed `560px` or stays content-sized.
3. **`vg-316`, `vg-319`, `vg-325`'s four product values and `vg-274`'s 24 spacing values wait on a product pass** in `editor-shell.css`, whose ceiling (58) counts four of them by name.
4. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px`), and whether `current/settings.html` shows the editor behind the modal.
- **One plan step is discharged in a session report rather than in a file, and its pointer was wrong here:** "tell the user the files exist and that they should open them" is [`2026-10-11-settings-parity.md`](docs/superpowers/plans/archive/2026-10-11-settings-parity.md) line 223, **Task 4 Step 5** — not `task-7-report.md` §6, which is *Findings* and holds no such sentence.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected** (a default-count red on this box is contention, never that spec's runtime); `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324`/`vg-327` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
