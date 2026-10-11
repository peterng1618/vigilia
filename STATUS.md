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

- **Plan 8 — [`settings-parity`](docs/superpowers/plans/2026-10-11-settings-parity.md) — is the active plan**, ten tasks in three phases: Phase A (1–4) makes the drawing the modal's comparator, Phase B (5–8) pulls the modal's regions to it, Phase C (9–10) counts the ratchet and takes the §13 capture; **Tasks 1, 2 and 3 are complete and reviewed, and Task 4 is next**.
- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **The instrument reads the drawings rather than one file**: the radii gate opens every drawing in `docs/design/mockups/current/` and names the file it fails in, the comparator holds every corner of a shorthand and every token of a value, and the settings modal has its own drawing with six measured rows against it.
- **The red set is three rows, all of them the palette grid's** — column count, card radius and swatch bar height — and Phase B's Task 5 owns them; a row that cannot fail is the defect the instrument exists to end.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.

## Last completed change

- **Plan 8 Task 3 landed at `51245173`** — the modal's overlay renders §3's scrim as `--elev-scrim` where it wrote a `#0009` hex literal (§10), and the two rules both dialogs share move with it: `kbd` to §2's `--text-xs` and `> button` to `--text-sm`.
- **Its reach was counted on the rendered DOM, not read off the file list** — 1 direct-child button and 20 kbds on the `?` sheet, the same on the Keyboard tab, 0 buttons on Appearance; the other three dialogs already take `text-sm` from `ACTION_BUTTON`, which is why the change reaches exactly two buttons.
- **The review approved spec and quality, and found the one thing the implementer had discharged too cheaply** — the scrim is the page's dimming, so it moved the modal frame's own boundary (graphite 1.22:1 → 1.08:1) in a region no gate measures; `vg-200` pins the rail's hairline by a test that opens no dialog, so that regression is now `vg-318` rather than "already pinned".
- **`vg-294` closed `verified` on the property, not on the file** — the parity row compares the overlay's rendered colour against the `:root` token and Task 3's red proof is that experiment, while the file-wide ratchet is still `vg-274`'s: the gated list holds 63 entries and not one is a `.css` file.
- **A dialog's unowned base type is filed as `vg-317`** — `.editor-shell-dialog` declares no base `font-size`, so the `?` sheet's rows inherit the portalled document's 13px and land on §2's `--text-md` where §2 gives list rows `--text-sm`.

## Next

1. **Task 4 — the drawing gains the Keyboard and About panels**, in the frozen original's treatment with the product's real copy, so those two surfaces stop being ones no row can check (`vg-314`'s class).
2. **Then Tasks 5–8** — the palette grid's three red rows, the boxed follow-the-system row, the Keyboard panel's rows and the widened drawings gate.
3. **Then Tasks 9–10** — `vg-274`'s counted ceiling, then the §13 capture, plan 8 archived, plan 6 opened.
4. **`vg-296`, `vg-302` and `vg-308` stay open on purpose** — the drawing's cluster shadows and its bordered row still have no reader, and the ladder's magnitude has no rule to be held to.
5. **Then `design-md-replaces-the-bible`**, then the multi-device display objective — architectural, so brainstorm → spec → plan.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-318` and `vg-200` are one class and one user ruling decides both** — whether a resting boundary is a control's only separation (section 5's 3:1 binds it) or a frame that also carries a fill and a shadow; both rows stay open until the user rules, and `vg-318`'s remedy is a reader that does not exist yet.
- **The instrument family is what to watch**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302` and `vg-313` are each an instrument claiming more coverage than it has — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — a default-count red on this box is contention, never that spec's runtime.
- **Unpushed, and one question still waits on the user:** `develop` is far ahead of `origin/develop` and no push is authorised; the plan's "tell the user" step is deferred (R62, the sentence in `task-7-report.md` §6); and whether `current/settings.html` shows the editor behind the modal or an empty ground is still unsettled.
