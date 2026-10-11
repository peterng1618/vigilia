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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–7) pulls the modal's regions to it, Phase C (8–10) widens the drawings gate, counts the ratchet and takes the §13 capture; **Tasks 1–8 are complete and reviewed, so Phase B is done and the parity red set is empty**.
- **Task 9 owns the next change** — `editor-shell.css`'s residuals get a counted ceiling over a file deliberately outside the gated list, with the three inexpressibles named; **it also now owns the product divergences Task 8's corrections exposed**, since `editor-shell.css` is where they live and Task 9 Step 3 already refuses a fix that moves pixels.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the drawings gate opens every drawing in `docs/design/mockups/current/` (six now), holds each literal to its own scale — radius to §3's table, spacing to §3's steps, type to §2's six sizes — and names the file, line and value it fails on.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 8 — the drawings gate holds spacing and type, not radius alone** (`80ae353f`): the six drawings' **268 off-scale literals** corrected to §3's steps and §2's six sizes, and the radii row widened to three classes over the same reader rather than a second one.
- **The correction removed far more divergences than it made**: the settings nav's `gap:9px`/`padding:7px 8px` → `8px`/`6px 8px` is `.editor-shell-settings-tab`'s own pair, the preview bars' `3px` → `4px` is `settings.tsx:173`'s, the palette and switch labels' `11.5px` → `11px` is `text-xs`, the mono rows' `11.5px` → `12px` is `font-mono text-sm`, and the dock's `2px`/`5px` → `4px`/`4px` is `.editor-shell-dock`'s.
- **Six divergences are created and reported, not absorbed**: the Close's `margin-top:16px` against `.editor-shell-dialog > button`'s off-scale `18px`, the rail's `gap:4px` against `.editor-shell-rail`'s off-scale `3px`, the asset buttons' `4px 8px`/`12px` against `4px 7px`/an inherited `13px`, the panel's `10px 10px 14px` against `12px`, and the nav column's `10px 6px`; four corrections have no product counterpart at all, and the stage's `72px` → `32px` moves a drawn composition rather than trimming a gutter.
- **The red proof**: one spacing and one type value planted (`settings.html:42`, `shell.html:137`) reddened the row with exactly two entries, one per arm; restored with `cp`, `cmp` byte-identical, `sha256sum` `ca733dae…`/`989f67d2…` before and after.
- **`npx vitest run` is green — 245 files / 3416 tests** (`vg-323`'s standing ruling that the six gates execute no test), and all six gates pass.

## Next

1. **Task 9 — `editor-shell.css`'s residuals get a counted ceiling** over a file deliberately outside the gated list, with the three inexpressibles named, and it inherits the six product divergences Task 8's corrections exposed.
2. **Then Task 10** — the §13 capture beside the drawing; **it cannot close while `vg-321` and `vg-322` are only filed rows**, because its own condition is "every remaining difference either fixed or backed by a quoted predating rule".
3. **Task 8's report carries what needs filing** — the six created divergences, the four corrections with no counterpart, and the decision that `vg-320`'s class is not expressible by a scale gate, which is Task 9's ceiling rather than a row this gate can hold.
4. **`vg-296`, `vg-302`, `vg-308`, `vg-314`, `vg-320` and `vg-324` stay open on purpose** — surfaces, values and clusters with no reader.
5. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user, and none blocks the plan's next task** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px` or stays content-sized), and whether `current/settings.html` shows the editor behind the modal.
- **The instrument family is what to watch, and this plan has added to it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one deferred sentence:** `develop` is far ahead of `origin/develop` and no push is authorised, and the plan's "tell the user" step is deferred (R62) — the sentence it wrote is in `task-7-report.md` §6 and has not been delivered.
