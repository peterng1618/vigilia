# Vigilia status

Updated: 2026-10-12
Branch: `develop`

## Current objective

**Rebuild the editor's GUI in the design language — the whole editor, every
frontend surface except the canvas.**

Plans 1–5, 7 and 8 are closed, and plan 6 is finished locally and archived; the
objective stays open on one blocked acceptance item. The target is
[`DESIGN.md`](DESIGN.md), the contract is
[`2026-10-08-editor-design-language-design.md`](docs/superpowers/specs/2026-10-08-editor-design-language-design.md),
the checked drawing is [`docs/design/mockups/`](docs/design/mockups/), and the boundary that
makes it affordable is
[0039](docs/decisions/0039-the-editor-ui-is-react-and-only-the-canvas-is-imperative.md).

**The drawing is the acceptance instrument, by the user's ruling of 2026-10-10:** the
mockup is not replaced and the shipped surface is pulled to it. The measure of done is the
spec's Acceptance section, counted rather than reviewed — and it is not met while a surface
satisfies every token in `DESIGN.md` and still does not look like the mockup.

## Active work

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, the user's instruction of 2026-10-12 to sweep several rounds of refactoring's dead and stale code; Task 1 is the scanner, running now.
- **Two plans are queued behind it**: [`2026-10-12-the-backlog-reproduction-pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md) (215 open rows sorted at HEAD) and [`2026-10-12-the-keyboard-only-walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md), whose Task 1 is allowed to land because its files overlap neither plan.
- **The sweep's rule is detection before deletion**: `data-vigilia-*` attributes, `--shell-*` properties, `KIND_*` registries and Fabric JSON keys are string-resolved, so an empty grep is not proof of death, and four gate scripts read the source tree as data.
- **The register already holds the candidates**, 77 dead or stale rows: `vg-283`/`vg-268` are the same missing FontPicker mount filed twice, `vg-266` is two selectors matching nothing, `vg-344` an unreachable variant, `vg-342` a control with no production caller.
- **The dead-or-pending question is not the sweep's to settle** — a module with no production mount but a real test may be abandoned or built ahead of the surface that will mount it, and those want opposite remedies.
- **Its scanner is small on purpose**, node `fs`/`path` only with no new dependency, and `.mjs` is in no gate, so its self-test is the only thing that can fail it.

## Last completed change

- **The dead-code sweep plan and its ledger were written**, three phases: the reference scanner, verified removal one owner at a time, then the register rows the removals discharge.
- **Its pre-flight scan found two defects in the plan's own text**, both fixed before dispatch: the candidate kinds missed `test-only-consumer`, which is the shape FontPicker actually has, and Task 1's self-proof asserted no negative case.
- **The backlog reproduction pass plan was written** — six coverage-proven batches over all 215 open rows, 215 of 215 with none missing.
- **Three rulings are recorded in the sweep's ledger**: the queue order, that Phase 2 re-runs the scanner because editor removals unlock shared-package exports, and that the walkthrough's Task 1 may land but is not resumed.

## Next

1. **Sweep Task 1's report**, then Phase 1's candidate report at HEAD; nothing is deleted until Phase 2 verifies each candidate against the string-resolved vocabulary and the gate inputs.
2. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.
3. **The backlog drain's reproduction pass**, queued behind the sweep, which shares the sweep's detection step and owns the other 138 rows.
4. **`vg-358`** — an unresolved palette reference takes the inspector column down though the product renders that state and carries its copy; whether the state is reachable at all is the decision it waits on.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on its walkthrough half only**: the stress half ran on 2026-10-12 with every §13.1 item met, but one item — the long unresolved reference — is discharged at DOM level rather than in a browser, because the state is unreachable there (`vg-358`); the keyboard-only walkthrough still has no check on the real host, since `desktop-host` matches `host-(player|settings|media|bleed|chrome).spec.ts` and nothing else.
- **Two things are asserted but unprovable by any rendered surface**: the 10px weight tier, because nothing draws a glyph at or below 10px, and the five `KIND_GLYPHS` choices, because nothing renders `KIND_GLYPHS` — the drawing depicts no object kind and draws its `--faint` twisty at 10px where the product draws it at 13px, so Task 9 could check neither and recorded both.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the closed plans' ledgers with its ruling — read them there; this file mirrors neither.**
- **The known-red and over-claiming set is what to watch**: `editor.spec.ts`'s frosted-CPU-card test (`vg-359`), `glass-authoring.spec.ts`'s empty-radius test (`vg-360`) and `reference-theme.spec.ts`'s background-media import (`vg-361`) fail deterministically; `composition-panel.spec.ts:897` (`vg-210`), `publish-loop.spec.ts:380` (`vg-212`) and `editor-clip.spec.ts`'s phone run (`vg-257`) are red, while `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling; and **`vg-192` is the over-claiming family repo-wide**: `tests/e2e/` belongs to no tsconfig, so a type error in a browser spec is caught by neither `typecheck` nor Playwright.
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
