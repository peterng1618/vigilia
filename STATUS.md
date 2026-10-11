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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–8) pulls the modal's regions to it, Phase C (9–10) counts the ratchet and takes the §13 capture; **Tasks 1–7 are complete and reviewed, so Phase B is done and the parity red set is empty for the first time**.
- **Task 8 owns the next change** — the drawings gate widened past radius to §3's spacing and §2's type, which is where the measured ~270 off-scale declarations and `vg-320`'s class land.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the radii gate opens every drawing in `docs/design/mockups/current/` (six now) and names the file it fails in, the comparator holds every corner of a shorthand and every token of a value, and the settings modal has its own drawing plus a drawn Keyboard and About panel, with rows against all three.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 7 — the Keyboard panel is the drawing's, and the parity red set is empty** (`90187a82`, `68273e99`): the chord chip scoped to the panel, both return-to-default actions and the row container at §3's `--radius-md`, "Reset all" moved into the panel header, and the four §13.1 states driven with observable behaviour.
- **The scoping is proved rather than argued**: the `?` sheet's own `kbd` computes `0px/0px/0px` in the browser test, and no drawing in `current/` governs the sheet, so the shared rule stays Task 3's.
- **The fix round's red proof records both restore hashes** (`be16e4f2…340264` → `87e9f212…1cbfba` → `be16e4f2…340264`, `cmp` byte-identical) — the standard the plan's red proofs should have met all along, and now the one on record.
- **Task 6's red unit suite was mine, not an implementer's** (`vg-323`): none of the six gates executes a test, so `f735c81b` closed with `vitest run` red until Task 7 fixed the stale address.
- **`vg-323` filed** (the gate list runs no test), **`vg-324` filed** (no drawing draws the `?` sheet), **`vg-319`'s reason corrected** to ownership, and **`vg-316`** gains the reset actions as a second instance.

## Next

1. **Task 8 — the drawings' declared spacing and type held to §3 and §2, not radius alone**, carrying the ruling that a drawing is corrected to the bible either way and any product divergence the correction exposes is filed rather than absorbed.
2. **Then Task 9** — `editor-shell.css`'s residuals get a counted ceiling over a file deliberately outside the gated list, with the three inexpressibles named.
3. **Then Task 10** — the §13 capture beside the drawing; **it cannot close while `vg-321` and `vg-322` are only filed rows**, because its own condition is "every remaining difference either fixed or backed by a quoted predating rule".
4. **`vg-296`, `vg-302`, `vg-308`, `vg-314`, `vg-320` and `vg-324` stay open on purpose** — surfaces, values and clusters with no reader.
5. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user, and none blocks the plan's next task** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px` or stays content-sized), and whether `current/settings.html` shows the editor behind the modal.
- **The instrument family is what to watch, and this plan has added to it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320`/`vg-323`/`vg-324` each claim more coverage than they have; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one deferred sentence:** `develop` is far ahead of `origin/develop` and no push is authorised, and the plan's "tell the user" step is deferred (R62) — the sentence it wrote is in `task-7-report.md` §6 and has not been delivered.
