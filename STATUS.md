# Vigilia status

Updated: 2026-10-10
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

- **No implementation plan is active.** Plan 5 closed on 2026-10-10; the next plan is a new **mockup-parity** plan, written once the measurement in flight names the drifts, and it outranks the two queued redesign plans.
- **The user's ruling, 2026-10-10: the mockup is not replaced — "Do not replace the mockup. Even the setting panel you just built looks nothing like it."** — the product is pulled to the drawing, which reopens shell work plan 2 had closed.
- **`vg-231` is a decided defect, not an open question**: the shell insets its four regions 8px apart at an off-scale `12px` radius where the drawing is flush; `vg-291` keeps only its process half (nothing signals that a mockup and the product have drifted).
- **`vg-292` files the cause**: no gate compares a built surface to the mockup, so §13's parity capture emits images plus a prose difference list that nothing can fail — which is why five plans closed green on accumulating drift.
- **A read-only measurement of the settings modal against the drawing's settings section is in flight** (`.superpowers/sdd/2026-10-08-settings-and-appearance/settings-vs-mockup-measurement.md`), with a companion shell measurement already on disk; the fix is scoped from those, not from impression.
- **Queued behind it:** `2026-10-08-iconography-and-copy.md`, then [`2026-10-10-design-md-replaces-the-bible.md`](docs/superpowers/plans/2026-10-10-design-md-replaces-the-bible.md); the multi-device display objective comes after both.

## Last completed change

- **Plan 5 (`settings-and-appearance`) closed complete on 2026-10-10** — Tasks 1–6 landed with `13984ab9`…`3fe3f22e`, its ledger carries the rulings, and its file is in [`docs/superpowers/plans/archive/`](docs/superpowers/plans/archive/).
- **The final fix round is verified** (`3fe3f22e`, scoped re-review clean on all four fixes): the publish chord opens the surface and moves no host state (`publish.toggle` → `publish.surface`), the refusal renders in the armed row, §7.7 is proven at 640×360, and the CSS comment drops the ordinal instead of correcting it.
- **The plan-boundary gates are green at the close**: `lint` clean over 620 files, `typecheck` clean across 7 workspaces, unit suite **791 files / 3392 tests / 0 failed**, `backlog:check` 160 items valid, `status:check` clean.
- **`format:check` is green again** — the red was one extra blank line committed at `controls.dom.test.ts:253` by `7007d21f`, not the CRLF earlier claimed here; fixed on the fly and riding the close commit.
- **§13's parity is NOT satisfied by plan 5's capture**, and the ledger says so: ten of eleven settings differences were recorded as deliberate while the drawing stayed as it was.

## Next

1. **Read the settings-vs-mockup measurement, file its drifts, and write the mockup-parity plan** — the shell first (`vg-231`), then the settings modal, then whichever surfaces it names.
2. **Make the drawing enforceable, not advisory** — `vg-292`'s fix (a comparison that reddens, or the drawing's values as the source a surface resolves from) is how this stops recurring.
3. **Then plan 6 (`iconography-and-copy`), then `design-md-replaces-the-bible`** — each ending with its own §13 parity capture, which now means a comparison against the drawing.
4. **Then the multi-device display objective** — detect connected displays and hold a theme per device; architectural, so brainstorm → spec → plan, and "device" already means the hardware behind a theme's sensor in `packages/host/src/settings/devices.ts`.
5. **Unpushed:** `develop` is far ahead of `origin/develop`; no push is authorised, and the plan's "tell the user" step is deferred rather than satisfied (R62).

## Blockers / unverified

- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **`vg-292` is the one that matters for the objective**: the acceptance instrument cannot fail, so "the surface matches the design" is currently an opinion; `vg-271`, `vg-274`, `vg-278`, `vg-286` and `vg-287` are the same family — each an instrument claiming more coverage than it has.
- **The red browser list is short but stale** — `composition-panel.spec.ts:897` (`vg-210`), `keyboard.spec.ts:123` (`vg-204`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`); **`vg-285` says a run at the default worker count can read red at a clean head**, so re-run any of these alone at `--workers=2` before believing it.
- **The 246px rail is a design decision that also paints over itself** — `vg-260`, `vg-265` (a fix that is a design decision no plan owns) and `vg-270`, plus the pinned palette defects `vg-200` and `vg-201`, so §5's contrast ratios do not hold there until they are ruled on.
- **`vg-192` is repo-wide:** `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
