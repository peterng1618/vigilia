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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–8) pulls the modal's regions to it, Phase C (9–10) counts the ratchet and takes the §13 capture; **Tasks 1–5 are complete and reviewed, so the instrument and the palette group are done — Task 6 owns the boxed follow-the-system row**.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the radii gate opens every drawing in `docs/design/mockups/current/` (six now) and names the file it fails in, the comparator holds every corner of a shorthand and every token of a value, and the settings modal has its own drawing plus a drawn Keyboard and About panel, with rows against all three.
- **The red set is four rows, and it is exactly the Keyboard panel's** — the chord mark's radius and inset, the per-row return-to-default action's radius and the group's, all Task 7's; a row that cannot fail is the defect the instrument exists to end.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 5 — the palette group is the drawing's card grid** (`411dbe91`): the six palettes render on the drawing's `repeat(3,1fr)` grid of `--radius-lg` cards, each carrying two 16px bars with its own `data-shell-palette`, the name beneath, and the chosen card lifted by an accent border plus a 3px ring.
- **The three palette rows went green as a consequence, not by edit** — `mockup-values.ts` and `design-language.spec.ts` are absent from the commit, and the review confirmed the rows still read Task 1's own text; the red set went seven → four, and the four are exactly Task 7's Keyboard rows.
- **`ControlChoiceRow` grew `shape?: "row" | "card"`** where the brief asked whether the palettes stop using it; every other call site takes `row` unchanged, and the rows genuinely share the radio, the group-owned value, roving focus and the refusal path.
- **The review's own strongest evidence was a two-palette read of all six cards** — six distinct grounds and six distinct accents under every palette in force, with each ground|accent pair byte-identical whichever palette is live, so no preview paints the palette in force.
- **Two rows filed, and `vg-322` is the one with consequence**: the drawing's frame is a fixed `560px` while the modal is content-sized (405px on Appearance), so the cards render ~58px against the drawing's ~120px — the group satisfies its rows and still does not look like the drawing; `vg-321` is the drawing's six bars depicting a different token per palette.

## Next

1. **Task 6 — the boxed follow-the-system row**: it keeps the drawing's panel box under a rule that predates this plan, takes a §3 step for the inset the drawing draws off-scale (`vg-303`), and has every declared value read rather than one.
2. **Then Tasks 7–8** — the Keyboard panel's four red rows, then the drawings gate widened past radius to §3's spacing and §2's type, which is also where `vg-320`'s class belongs.
3. **Then Tasks 9–10** — `vg-274`'s counted ceiling, then the §13 capture; **Task 10 cannot close while `vg-321` and `vg-322` are only filed rows**, because its own condition is "every remaining difference either fixed or backed by a quoted predating rule".
4. **`vg-296`, `vg-302` and `vg-308` stay open on purpose** — the drawing's cluster shadows and its bordered row still have no reader, and the ladder's magnitude has no rule to be held to.
5. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **Four open design questions wait on the user, and none blocks the plan's next task** — `vg-200`/`vg-318` (whether a resting boundary is a control's only separation, which decides both rows), `vg-321` (whether a palette preview bar depicts the palette's surface or its ground), `vg-322` (whether the modal takes the drawing's fixed `560px` or stays content-sized), and whether `current/settings.html` shows the editor behind the modal.
- **The instrument family is what to watch, and this plan has added to it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320` each claim more coverage than they have — `vg-320` is the newest and the sharpest, because the drawings gate holds a value to §3's *scale* and never to the *original's treatment*, so an on-scale divergence is invisible; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one deferred sentence:** `develop` is far ahead of `origin/develop` and no push is authorised, and the plan's "tell the user" step is deferred (R62) — the sentence it wrote is in `task-7-report.md` §6 and has not been delivered.
