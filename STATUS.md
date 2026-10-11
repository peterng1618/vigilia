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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–7) pulls the modal's regions to it, Phase C (8–10) widens the drawings gate, counts the ratchet and takes the §13 capture; **Tasks 1–9 are complete, so Phase C has its last task left**.
- **Task 10 owns the next change** — the §13 capture beside the drawing; `vg-325`'s six product divergences stay filed rather than absorbed, since `editor-shell.css` is where they live and Task 9 Step 3 refuses a fix that moves pixels.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the drawings gate opens every drawing in `docs/design/mockups/current/` (six now), holds each literal to its own scale — radius to §3's table, spacing to §3's steps, type to §2's six sizes — and names the file, line and value it fails on.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 9 — `editor-shell.css`'s residuals get a counted ceiling** (`abdb7603`, fix round `32f5f7fc`): `scripts/design-tokens.mjs` gains `CEILINGS`, a second instrument over the one file kept out of `gated`, failing above the count and passing at or below it so it is green at HEAD and can only fall.
- **The file holds 61 at HEAD — 6 hex-literal, 31 off-scale px, 24 spacing px** and the ceiling counts **58** after the three exempt `margin-right` values, so plan 8's CSS edits moved the classes and not the total: the overlay's `#0009` became `var(--elev-scrim)` and the modal's nav column added `width: 150px`.
- **No no-op was left to convert**: all 61 violation literals were compared against the file's 114 declared custom-property values and none equals one, so plan 7 Task 6's substitution rule had nothing left in this file.
- **The three inexpressibles are exempt by name and reason in the constant** (`margin-right` 62/92/122 as the layer row's `6 + 26n + 4(n-1)`), an exemption that matches nothing is itself a failure, and the ceiling counts four of `vg-325`'s six divergences by name.
- **The last way it could pass while comparing against nothing is closed** (`32f5f7fc`): an absent, non-finite or string `max`, and an emptied `CEILINGS`, each exit 1 by plant, and a dead exemption no longer prints a green sentence beside its failure — red proof `#ff0000` at `editor-shell.css:455:10`, restored byte-identical (`cmp`); `npx vitest run` green at 245 files / 3416 tests and all six gates exit 0.

## Next

1. **Task 10 — the §13 capture** beside the drawing; **it cannot close while `vg-321`, `vg-322` and `vg-325` are only filed rows**, because its own condition is "every remaining difference either fixed or backed by a quoted predating rule".
2. **`vg-320`'s class came back not expressible by this gate** — it is a comparison between two documents, and `mockupDeclarations` has no cross-file element identity — so it is recorded rather than covered, and Task 10 must dispose of it explicitly.
3. **`vg-296`, `vg-302`, `vg-308`, `vg-314`, `vg-324`, `vg-325`, `vg-326` and now `vg-327` stay open on purpose** — surfaces, values, clusters and rules with no reader, and the ceiling's own count-versus-set limit.
4. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user, and none blocks the plan's next task** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px` or stays content-sized), and whether `current/settings.html` shows the editor behind the modal.
- **The instrument family is what to watch, and this plan has added to it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324`/`vg-327` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one deferred sentence:** `develop` is far ahead of `origin/develop` and no push is authorised, and the plan's "tell the user" step is deferred (R62) — the sentence it wrote is in `task-7-report.md` §6 and has not been delivered.
