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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–8) pulls the modal's regions to it, Phase C (9–10) counts the ratchet and takes the §13 capture; **Tasks 1–6 are complete and reviewed — the instrument, the palette group and the boxed switch row are done — and Task 7 owns the last four red rows, the Keyboard panel's**.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the radii gate opens every drawing in `docs/design/mockups/current/` (six now) and names the file it fails in, the comparator holds every corner of a shorthand and every token of a value, and the settings modal has its own drawing plus a drawn Keyboard and About panel, with rows against all three.
- **The red set is four rows, and it is exactly the Keyboard panel's** — the chord mark's radius and inset, the per-row return-to-default action's radius and the group's, all Task 7's; a row that cannot fail is the defect the instrument exists to end.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 6 — the boxed follow-the-system row keeps its box, and the drawing takes §3's step** (`f735c81b`): `settings.html:89` declares `padding:8px 10px` where it declared the off-scale `9px 10px`, the product already renders `--space-8` and did not move, and the box's licence is §5 rule 2's own sentence (`design-language.md:167-171`), which names this exact shape.
- **The edit the brief understated was the one that would have failed the task** — the drawing's box has **two** parity rows and both embed the literal `padding:9px 10px` inside their `mockupSelector` strings, so the one-value drawing edit required rewriting both or both rows would have addressed no element.
- **The implementer caught a third edit on its own initiative**: the table's own prose said the drawn inset "is `9px`, which §3's scale has no step for", which its change made false — the same class of defect this plan has now corrected four times.
- **No inset row was added, by ruling and by measurement** — a `padding-top` row is impossible because the drawing writes the shorthand and `lookup` throws on a shorthand that sets a longhand a row reads; the review confirmed the guard is untouched and verified both rewritten selectors **by running the rows**, since a selector matching nothing is this task's whole risk.
- **`vg-303` is `verified`** and the parity red set is unchanged at four rows, all Keyboard (Task 7's).

## Next

1. **Task 7 — the Keyboard panel's rows**: the panel matches what Task 4 drew — the reference's header and its return-to-default action, the chord mark, the per-row affordance — and the four states §13.1 requires are driven and captured, which is what turns the last four red rows green.
2. **Then Task 8** — the drawings gate widened past radius to §3's spacing and §2's type, which is also where `vg-320`'s class (a drawing's on-scale divergence from the original) belongs, along with the drawing's `gap:3px`, `margin-bottom:7px` and `font-size:11.5px`.
3. **Then Tasks 9–10** — `vg-274`'s counted ceiling, then the §13 capture; **Task 10 cannot close while `vg-321` and `vg-322` are only filed rows**, because its own condition is "every remaining difference either fixed or backed by a quoted predating rule".
4. **`vg-296`, `vg-302` and `vg-308` stay open on purpose** — the drawing's cluster shadows and its bordered row still have no reader, and the ladder's magnitude has no rule to be held to.
5. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user, and none blocks the plan's next task** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px` or stays content-sized), and whether `current/settings.html` shows the editor behind the modal.
- **The instrument family is what to watch, and this plan has added to it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320` each claim more coverage than they have — `vg-320` is the newest and the sharpest, because the drawings gate holds a value to §3's *scale* and never to the *original's treatment*, so an on-scale divergence is invisible; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one deferred sentence:** `develop` is far ahead of `origin/develop` and no push is authorised, and the plan's "tell the user" step is deferred (R62) — the sentence it wrote is in `task-7-report.md` §6 and has not been delivered.
