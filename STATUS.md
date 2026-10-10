# Vigilia status

Updated: 2026-10-11
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5 are closed. The target is
[`docs/design/design-language.md`](docs/design/design-language.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is now the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in the bible and still does not look like the mockup.

## Active work

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Tasks 9, 1 and 8 are complete; Task 2 is next, then 3 → 4 → 5 → 6 → 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: the body-flush and radius rows are red on today's shell by design at both worker counts, and no row is unresolved. **Task 8 added the two `fixture` rows that read the control drawings**, so `current/controls.html` and `current/controls-light.html` are no longer drawings nothing reads.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must now be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**: thirteen of the modal's nineteen measured regions drift, and it consumes plan 7's instrument and its radius and chrome decisions.
- **Plan 6 (`iconography-and-copy`) moved behind both** — its first task is a census of the surfaces as they landed, and a census of a shell about to move would be redone.


## Last completed change

- **Task 8 is closed after two fix rounds, and its gate is measured rather than claimed** — I restored the deleted `.editor-shell-panel` box rule myself, and the fixture reddened naming three inputs painting a `1/1/1/1px` border inside a `h-[26px]` well, then went green on a `cmp`-identical restore.
- **The panel half of the ancestor-wide box rule is gone** — `.editor-shell-panel button/input` and its `:hover` are replaced by the three asset hooks and `.vigilia-layer-rename`, so a pane's `ControlText` no longer draws a 30px bordered input inside its own 26px well.
- **A row's 74px column became a shape rather than every surface's default** — `ControlRow` takes `column`/`boxed`/`headed`, and the modal's switch row and the Add pane's trigger read their `border-radius` **and `gap`** from their own drawings under test.
- **`vg-297`, `vg-298`, `vg-299` and `vg-302` are closed**, and `vg-302` needed correcting as well: the panes' drawing does declare the label column (`shell.html:227` and eleven siblings), so the panes never drifted.
- **`vg-303` and `vg-304` filed, not fixed** — the settings drawing's `padding:9px` is off §3's scale so plan 8 would gate against a stale drawing; and a parity row is never checked against the property set its drawing declares.

## Next

1. **Execute plan 7 in its stated order** — Tasks 9, 1 and 8 are complete, so Task 2 is next, then 3 → 4 → 5 → 6 → 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Task 2 owns the body-flush rows Task 8 left red** — the eight red shell-parity rows belong to Tasks 2 and 3, and Task 6 must carry R25: the `biblePx` list is not a precedent, and a value needs a rule before it needs an entry.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The instrument family is what to watch, and it has narrowed**: `vg-292` (a divergence's reason is still not machine-checked), `vg-304` (a parity row is never checked against the property set its drawing declares), `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are each an instrument claiming more coverage than it has — though the shell-parity gate itself now reddens on demand, measured — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
