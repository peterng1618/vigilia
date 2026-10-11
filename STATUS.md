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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–8) pulls the modal's regions to it, Phase C (9–10) counts the ratchet and takes the §13 capture; **Tasks 1–4 are complete and reviewed, so Phase A is done and the instrument is finished — Task 5 opens Phase B**.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the radii gate opens every drawing in `docs/design/mockups/current/` (six now) and names the file it fails in, the comparator holds every corner of a shorthand and every token of a value, and the settings modal has its own drawing plus a drawn Keyboard and About panel, with rows against all three.
- **The red set is seven rows, and both owners are named** — three are the palette group's (Task 5) and four are the Keyboard panel's (Task 7); a row that cannot fail is the defect the instrument exists to end.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 4 — the drawing set is complete**: `current/settings-keyboard.html` and `current/settings-about.html` are drawn in the frozen original's treatment with the product's real rows and copy, reading census rows `#13`–`#18`, which were `no-counterpart` because no panel existed to compare them.
- **The rows are read with their panel showing** — Base UI keeps an inactive panel out of the DOM, so a Keyboard row scoped to the modal would have reported "measured nothing" about a panel that renders; the parity test now clicks the tab, reads, and names the row's own drawing on failure instead of printing one file for every path.
- **The review verified the content row by row against the product** — 20 rows, 5 groups, `Ctrl+Shift+Z · Ctrl+Y`, `Ctrl+} · Ctrl+]`, `Delete · Backspace`, `?`, nothing invented — and confirmed the frame, nav and Close are byte-identical to `settings.html`'s.
- **Its one real finding was found by eye, which is the row it produced**: the Keyboard row container carried `4px` where the original draws `6px` and §3 gives a control `--radius-md`, and 4px is *on* §3's scale, so the drawings gate passed it — filed as `vg-320`, with the product's shared `h3`/`dl` divergence as `vg-319`.
- **Fix round 1 (`3b46efb8`) moved exactly 20 radii 4→6** and corrected the reader's own coverage comment from "the four"/"a fifth drawing" to the six files the directory holds; the parity red set is unchanged at seven rows, which is the evidence no row read the container whose radius moved.

## Next

1. **Task 5 — the palette group is the drawing's card grid**: the six palettes render on the drawing's three-column grid of `--radius-lg` cards, each carrying two colour bars, which turns the last three red rows that are not the Keyboard panel's.
2. **Then Tasks 6–8** — the boxed follow-the-system row (with `vg-303`'s stale `9px`), the Keyboard panel's four red rows, and the drawings gate widened past radius.
3. **Then Tasks 9–10** — `vg-274`'s counted ceiling, then the §13 capture, plan 8 archived, plan 6 opened.
4. **`vg-296`, `vg-302` and `vg-308` stay open on purpose** — the drawing's cluster shadows and its bordered row still have no reader, and the ladder's magnitude has no rule to be held to.
5. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-318` and `vg-200` are one class and one user ruling decides both** — whether a resting boundary is a control's only separation (section 5's 3:1 binds it) or a frame that also carries a fill and a shadow; both rows stay open until the user rules, and `vg-318`'s remedy is a reader that does not exist yet.
- **The instrument family is what to watch, and this plan has added to it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302`, `vg-313`, `vg-314` and now `vg-320` each claim more coverage than they have — `vg-320` is the newest and the sharpest, because the drawings gate holds a value to §3's *scale* and never to the *original's treatment*, so an on-scale divergence is invisible; and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one question still waits on the user:** `develop` is far ahead of `origin/develop` and no push is authorised; the plan's "tell the user" step is deferred (R62, the sentence in `task-7-report.md` §6); and whether `current/settings.html` shows the editor behind the modal or an empty ground is still unsettled.
