# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5 and 7 are closed. The target is
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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan and has all ten tasks done, and it is NOT archived**: Step 5's archive move is held for the controller's ruling, because Step 3's difference list holds five live differences that are neither fixed nor backed by a predating rule, each filed with an owner.
- **Task 10 landed the §13 capture**: `settings-capture-graphite.png` and `settings-capture-editorial.png` sit in `docs/design/mockups/current/` beside `settings.html`, and the six registered settings captures were re-taken against rebuilt bundles in both palettes.
- **Task 1's table is green on the shipped build** — all nineteen rows re-adjudicated at `--workers=1` (`adjudication.md`'s re-run section), the parity red set is empty, and the one row still `fix` is `#19`, the Close, which no plan-8 task owns (`vg-316`).
- **The instrument reads the drawings rather than one file**: the drawings gate opens every drawing in `docs/design/mockups/current/` (six now, plus two parity PNGs it skips), holds each literal to its own scale — radius to §3's table, spacing to §3's steps, type to §2's six sizes — and names the file, line and value it fails on.
- **Plan 6 (`iconography-and-copy`) waits behind this ruling** — it is the spec's next plan and its first task is a census of the surfaces as they landed, so it cannot start while plan 8 is unclosed.

## Last completed change

- **Plan 8 Task 10 — the §13 capture** (`b78ee264`): the six registered settings captures re-taken in both palettes against rebuilt bundles, `1 test` per action, and the Appearance pair — the one view `settings.html` draws — placed beside the drawing.
- **The difference list is disposed of and is not empty**: the frame's inset, the nav column's inset, the Add pane body's inset and the nav column's ground are `licensed` by predating bible rules (§3 `:79`'s spacing table, §10 `:449`'s hex rule with §4's roles); the Close (`vg-316`), the frame width (`vg-322`), the preview bars (`vg-321`), the shared `h3`'s type (`vg-319`) and the product's four off-scale values (`vg-274`/`vg-325`) stay open with owners.
- **The census was re-run, not replaced**: Task 1's nineteen rows are re-read against the shipped build in `adjudication.md`, and the three drawing repairs it asked for were verified in the file (`:22` `10px 6px`, `:89` `8px 10px`, `:97` `4px 12px`/`12px`).
- **The plan is not archived**, because five differences are neither fixed nor licensed — its own closure condition — so the ruling is the controller's.
- `npx vitest run` green at 245 files / 3416 tests, and all eight gate commands (format, lint, design, typecheck, status, backlog, gates:self-test, hooks:check) exit 0.

## Next

1. **The controller's ruling on plan 8's closure** — and, if it closes, the archive move and the handoff to plan 6.
2. **`vg-321` and `vg-322` wait on the user's rulings** — whether a palette preview bar depicts the palette's surface or its ground, and whether the modal takes the drawing's fixed `560px` or stays content-sized.
3. **`vg-316`, `vg-319`, `vg-325`'s four product values and `vg-274`'s 24 spacing values wait on a product pass** in `editor-shell.css`, whose ceiling (58) counts four of them by name.
4. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user, and none blocks the plan's next task** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px` or stays content-sized), and whether `current/settings.html` shows the editor behind the modal.
- **Task 10 disposed of five differences it did not fix and did not license** — `vg-316` (the Close's fill, text and placement), `vg-322`, `vg-321`, `vg-319` (the shared `h3`) and `vg-325`'s product values; the citation search for `vg-325`'s nav column found only plan 8's own comment at `editor-shell.css:1438-1441`, which cannot license it, so that case rides the §3 `:79` composition licence the census already records for `#4`/`#7` or stays open.
- **The known-red and over-claiming set is what to watch**: the red browser list is short but stale — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`), with **`vg-285` measured rather than suspected** (a default-count red on this box is contention, never that spec's runtime); `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324`/`vg-327` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed, and one deferred sentence:** `develop` is far ahead of `origin/develop` and no push is authorised; Task 10's images are named in `task-10-report.md` and in its reply, and R62's own sentence (`task-7-report.md` §6) is still undelivered.
