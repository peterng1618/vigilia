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

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 redistributes the manager layer (Tasks 8–9), Phase 2 the reference picture (1–3), Phase 3 removal (4–6), Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1's census is committed and under independent review** — [`docs/architecture/manager-census.md`](docs/architecture/manager-census.md), landed at `a2fe5a89`, ranks ten candidates by blast radius and marks each clean extraction or cross-cutting; the review is checking its own load-bearing number rather than its prose.
- **Task 9 consumes those ranks in the census's order**: ranks 4, 5, 6 and 9 are clean extractions and go first, while 1, 2, 3 and 7 wait on decisions nobody has made — reach is the reason to be careful, not the reason to be first.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **The census landed and its corrections followed in the same session** — `a2fe5a89` and `6f11027b`: the plan amended, four register rows corrected, the three `Discovered, not fixed:` trailers on the census commit materialised as `vg-365`–`vg-367`, and `backlog:check` green at 220 items.
- **The plan stopped calling `snap-manager` the split's worked example and Task 9 gained an ordering rule**, so the phase no longer starts with the largest and least tractable candidate — the census reaches it from one external production module, where three earlier figures had said eight files, eleven modules and 5,978 lines.
- **`vg-365`–`vg-367` are the census commit's own findings, filed rather than fixed**: `object-actions.ts` restating each manager's lock refusal at six eligibility sites, `scene-fabric/src/persist.ts` listing `"locked"` in `SCENE_PERSISTED_PROPERTIES`, and "is this referenced" being decided in both `editor-shell.ts` and `asset-manager`.
- **`vg-234` came back partly contradicted rather than confirmed** — the name guard is now shared through `isObjectName`, and the "unnamed module" it names is `renderer-core/src/theme/`, which the registry does name.
- **The register mixes two serialisation styles**, spaced and compact, which cost four splice attempts on a matcher that assumed one of them; every assertion fired before a write, so no row was ever half-edited.

## Next

1. **Task 9, the redistribution, once the census review closes** — one manager per commit, the move relocates the *decision* rather than the code, and the map is updated in the same commit as the move.
2. **Scanner fix round 4 is running on the partial-completion window** — the file on disk reads `19/19, incomplete false` between the two completion writes, which the endorsed predicate reads as a pass; then Phase 2's candidate report at HEAD.
3. **Nothing is deleted until Phase 2 verifies each candidate against the string-resolved vocabulary** — the `data-vigilia-*` attributes, the `--shell-*` custom properties, the `KIND_*` registries and the four gate scripts that read the source tree as data.
4. **The walkthrough's amended Task 1** — its census now takes two walks because the user ruled on 2026-10-12 that §13.1 means a region *with content*, so the inspector's tab stops are counted after a keyboard selection; `REGIONS` stays four.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Acceptance item 3 now keeps the objective open on one thing: the census amendment.** Both of the user's 2026-10-12 rulings landed — §13.1 means a region with content, and `vg-358`'s unresolved reference is unreachable through the palette editor, so that item is discharged because the state cannot arise rather than because a surface was built for it.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
