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

- **Plan 7 — [`shell-parity`](docs/superpowers/plans/2026-10-10-shell-parity.md) — is the active plan. Tasks 9, 1, 8, 2, 3, 4, 5 and 6 are complete; Task 7 — the parity capture — is next and closes it.** The four **new** drawings are at `docs/design/mockups/current/` and the instrument reads them: the body-flush rows, the six radius rows, graphite's eleven role rows and the two rows Task 6 added are **green**, and no row is unresolved.
- **Task 3's first step is a class rather than a list** — the drawing's twenty-one off-scale radii (seventeen dock buttons, three view-cluster buttons, the follow-the-system track) now read their §3 or §5 entry, and nothing but the named degenerate marks is left off the scale.
- **The drawings' README no longer lets a divergence pass as "deliberate"** — a difference must be **licensed by a rule that predates it** or fixed, which is the escape hatch that let a week of drift pass every check green.
- **The user's rulings, 2026-10-10: the mockup is not replaced — "Do not replace the mockup."** — the built product is pulled to the drawing; and, told a refresh would overdraw them, "Keep the original mockup html files and label them as such. Build new html."
- **The drawing is the acceptance instrument.** §13 now says it governs wherever the written rules are silent, with no self-licensing and no "deliberate" disposition, and Task 1 landed the reader that reddens on eight real rows of today's shell.
- **Plan 8 — settings parity — is next and unwritten**, and plan 6 (`iconography-and-copy`) follows both: thirteen of the modal's nineteen measured regions drift, plan 8 consumes plan 7's instrument and its radius and chrome decisions, and plan 6 opens with a census of a shell that would move again under it.

## Last completed change

- **Task 6 is closed: the two instruments this plan's hand-fixes needed, and the ratchet measured rather than assumed** — the drawing's radii are read against §3's scale (75 declarations, each a scale step or a named degenerate) and its token table from every site that declares it, both proved red on a planted break and restored by `cmp`.
- **The ratchet path was withdrawn, licensed by a rule that predates the plan** — `editor-shell.css` holds 61 violations (7 hex-literal, 30 off-scale px, 24 spacing px), so listing it in `design-tokens.gated.json` turns `design:check` red at HEAD; the list's contract is "the files already converted" (`design-tokens.mjs:9`) and ADR-0040 gives the reason, that a gate which starts red and stays red is turned off.
- **The six violations whose fix is a genuine no-op are fixed, each verified against its declaration** — `--shadow-raised`, `var(--text-md)` three times, and a dead `var(--shell-accent)` fallback; the other 24 spacing values move pixels and belong to `vg-274`'s pass, three of them (`margin-right: 62px/92px/122px`) no §3 step can express.
- **`vg-308`'s magnitude was searched for, and no rule states one** — §3, §4, §5 and the drawing read, none giving a minimum separation between two grounds, so no constant was added and the row stays open rather than acquiring a threshold nobody can cite.
- **The review found the radii row would reject its own comment's example** — `8px 8px 0 0` is an ordinary value and the corner `0` sat in neither the scale nor the degenerate set; the fix accepts zero in both spellings with an in-row self-check, because a fix for a false positive that nothing exercises is a fix nobody can trust.

## Next

1. **Finish plan 7 with its last task** — Task 7, the §13 parity capture beside the drawing, which is the plan's own completion condition; it is reviewed and adjudicated like every task before it, and the plan archives only once it lands.
2. **Then plan 8 (settings parity)** — 13 of the modal's 19 measured regions drift, and it consumes plan 7's instrument, radius scale and chrome decision — and it inherits the ratchet pass `vg-274` now carries as a measurement rather than an estimate: 61 violations in `editor-shell.css`, 24 of them spacing values whose §3 substitution moves pixels and three that no §3 step can express.
3. **`vg-296` and `vg-308` stay open on purpose** — the radii have their mechanism but the drawing's `#0007` cluster shadows and its bordered follow-the-system row still have no reader, and the ladder's magnitude has no rule to be held to; neither is closed by a plan that could only have invented the missing half.
4. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
5. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The instrument family is what to watch, and it has narrowed**: `vg-292` (a divergence's reason is still not machine-checked), `vg-304` (a parity row is never checked against the property set its drawing declares), `vg-271`, `vg-274`, `vg-278`, `vg-286`, `vg-287` and `vg-313` (the boundary assertion names its sets as literals, so an element added later escapes half the check) are each an instrument claiming more coverage than it has — though the shell-parity gate itself now reddens on demand, measured — and **`vg-192` is that family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` is now measured rather than suspected** — the palette sweep alone at the default count is 8.5–8.6s against a 30s limit, so a default-count red on this box is contention between concurrent runs, never that spec's runtime, and re-running it alone at the same commit costs seconds.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, and now `vg-310` (light's chrome is still translucent, so "chrome is opaque" holds in five of six) and `vg-311` (the bundle ships only the prefixed `backdrop-filter`, so the glass blur is dead), so §5's contrast ratios do not hold there until they are ruled on — and Task 4 widened `vg-200`'s measured gap, graphite's well boundary now `1.20:1` where the old white hairline measured `2.15:1`.
- **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).
