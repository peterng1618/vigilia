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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Tasks 9, 1, 8, 2, 3, 4 and 5 are complete; Task 6 is next, then 7.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: the body-flush rows, the six radius rows and graphite's eleven role rows are **green**, and no row is unresolved.
- **Task 3's first step is a class rather than a list** — the drawing's twenty-one off-scale radii (seventeen dock buttons, three view-cluster buttons, the follow-the-system track) now read their §3 or §5 entry, and nothing but the named degenerate marks is left off the scale.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**, and plan 6 (`iconography-and-copy`) follows both: thirteen of the modal's nineteen measured regions drift, plan 8 consumes plan 7's instrument and its radius and chrome decisions, and plan 6 opens with a census of a shell that would move again under it.

## Last completed change

- **Task 5 is closed: one treatment boundary, per element rather than per palette** — `.editor-glass` is the chrome default (`background: var(--panel)`, no gradient, no blur, no shadow) and only `.editor-shell-dock` and `.editor-shell-zoom` opt into the glass, so `editorial`'s two clusters are lifted like every other palette's instead of the whole palette being flat.
- **`shell-appearance.spec.ts`'s flat/glass assertion was amended deliberately, and the commit says so** — "editorial is flat and the other five are glass" became "chrome is flat and opaque, and the canvas clusters keep the glass", because the split it described was a *palette* split and §3 draws the boundary between elements: elevation 0 for chrome, elevation 1 for clusters over the canvas.
- **The chrome's own contrast is measured now, and nothing measured it before** — a new case in `design-language.spec.ts` reads §4's text, muted, edge and accent against the rail's rendered pixel in all six palettes; every one clears its floor, and graphite's edge moved `1.22 → 1.27` while light's held at `1.40` (`vg-200`'s pin, no floor lowered).
- **Filed `vg-310` and `vg-311`** — `light` is the one palette whose chrome is still translucent (`--shell-surface: #eff9f2bf`, and no surface role it declares is opaque, so the derivation has no value to read), and the built stylesheet ships only the prefixed `-webkit-backdrop-filter`, which this Chromium does not apply, so the glass blur is dead in the bundle.
- **`vg-222`'s premise was amended rather than left stale** — its citation of `.editor-glass`'s old base and per-palette overrides is now a landmark of a block Task 5 replaced; the off-ladder cluster treatment it measures is unchanged and now reaches all six palettes where it reached five.

## Next

1. **Execute plan 7 in its stated order** — Tasks 9, 1, 8, 2, 3, 4 and 5 are complete, so Task 6 is next, then 7 — with each task reviewed and adjudicated before the next is dispatched.
2. **Task 6 must carry R25 and the instrument family's three new members** — the `biblePx` list is not a precedent and a value needs a rule before it needs an entry; nothing reads a drawing's `border-radius` against §3's scale (`vg-296`), the ladder cannot state a magnitude (`vg-308`), and the drawing's table is read from one element (`vg-309`) — all three are the gate Task 6 owns.
3. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The instrument family is what to watch, and it has narrowed**: `vg-292` (a divergence's reason is still not machine-checked), `vg-304` (a parity row is never checked against the property set its drawing declares), `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are each an instrument claiming more coverage than it has — though the shell-parity gate itself now reddens on demand, measured — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is now measured rather than suspected** — the palette sweep alone at the default count is 8.5–8.6s against a 30s limit, so a default-count red on this box is contention between concurrent runs, never that spec's runtime, and re-running it alone at the same commit costs seconds.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, and now `vg-310` (light's chrome is still translucent, so "chrome is opaque" holds in five of six) and `vg-311` (the bundle ships only the prefixed `backdrop-filter`, so the glass blur is dead), so §5's contrast ratios do not hold there until they are ruled on — and Task 4 widened `vg-200`'s measured gap, graphite's well boundary now `1.20:1` where the old white hairline measured `2.15:1`.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
