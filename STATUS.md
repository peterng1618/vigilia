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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/archive/2026-10-10-shell-parity.md) — is complete and archived**: every task, a whole-branch review, one fix round and one residual, both re-reviewed CLEAN.
- **Plan 8 — settings parity — is the active plan and is unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument, its radius scale and its chrome decision.
- **The instrument now reads the drawings rather than one file**: the radii gate opens every drawing in `docs/design/mockups/current/` and names the file it fails in, the comparator holds every corner of a shorthand, and the chrome boundary compares the whole colour.
- **Plan 6 (`iconography-and-copy`) follows plan 8** — its first task is a census *of the surfaces as they landed*, so it waits behind both parity plans rather than being redone against a shell that moves again.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and "Keep the original mockup html files and label them as such. Build new html."
- **One question still waits on the user**: whether `current/settings.html` shows the editor behind the modal or an empty ground — it is plan 8's drawing, and no agent has settled it.

## Last completed change

- **Plan 7 closed out, and the instrument it leaves behind is wider than it was** — the archive, the spec's plan table and this file move together: `c64c4c16` fixed the review's five findings, `af17f84e` moved the pure comparator into the unit suite where `vitest run` holds it, and `729123c5` corrected `vg-296`'s own overclaim.
- **The review's largest finding was a class, not a value** — three of the four drawings still declared the off-scale radii Task 3 corrected once in `shell.html`, and the gate read `MOCKUP_PATH` alone, so the whole class was invisible; the gate now reads the directory.
- **The register had been overclaiming the instrument's reach since I wrote the clause** — `vg-296` said the radii gate read every radius the drawing declared; it read one file, and the row now records both the overclaim and the artefact that made it true.
- **A guard behind a gated browser test is not a guard** — the comparator's own self-checks sat in a spec that skips off desktop, so a revert left the fast suite green; the decision and its proof now live in `mockup-values.ts` and `mockup-values.test.ts`.
- **`vg-314` stays open on purpose** — the drawing half landed at `221bf1a1`, and the title's second clause stands: a surface the drawing omits is one no gate can check.

## Next

1. **Write plan 8 (settings parity)** — from the spec's settings sections, on plan 7's instrument: 13 of 19 measured regions drift, and it inherits `vg-274`'s ratchet as a measurement (61 violations in `editor-shell.css`, 24 of them spacing values whose §3 substitution moves pixels).
2. **Then plan 6 (`iconography-and-copy`)** — the closed glyph set, the accessible-name/tooltip single owner, the copy rules — ending with its own §13 parity capture, now a comparison against the drawing.
3. **`vg-296`, `vg-302` and `vg-308` stay open on purpose** — the radii have their mechanism, but the drawing's cluster shadows and its bordered follow-the-system row still have no reader, and the ladder's magnitude has no rule to be held to.
4. **Then `design-md-replaces-the-bible`** — the bible becomes a root `DESIGN.md` with §N body markers, checked by `@google/design.md`, and the ~400 stable `§N` references must not renumber.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The instrument family is what to watch, and plan 7 narrowed it without closing it**: `vg-292`, `vg-304`, `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287`, `vg-296`, `vg-302` and `vg-313` are each an instrument claiming more coverage than it has — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is measured, not suspected** — the palette sweep alone at the default count is 8.5–8.6s against a 30s limit, so a default-count red on this box is contention, never that spec's runtime.
- **Three differences the plan found have owners rather than fixes**: `light`'s chrome is still translucent (`vg-310`), the bundle ships only the prefixed `backdrop-filter` so the glass blur is dead (`vg-311`), and any surface a drawing omits is one no gate can check (`vg-314`).
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62) — the sentence it wrote is in `task-7-report.md` §6 and has not been delivered.
