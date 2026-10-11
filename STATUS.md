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

- **The active plan is [`2026-10-12-the-dead-code-sweep`](docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md)**, reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 redistributes the manager layer (Task 8 closed, Task 9 next), Phase 2 the reference picture (1–3), Phase 3 removal (4–6), Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1's census is closed** — [`docs/architecture/manager-census.md`](docs/architecture/manager-census.md) landed at `a2fe5a89` and closed at `32265c25`: ten candidates ranked by shape, three fix rounds that moved no verdict, and a re-review that reproduced every count independently rather than reading the diff.
- **Task 9 consumes those ranks in the census's order**: ranks 4, 5, 6 and 9 are clean extractions and go first, while 1, 2, 3 and 7 wait on decisions nobody has made — reach is the reason to be careful, not the reason to be first.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Task 9's rank 5 landed and passed both verdicts** — `248ff08f` gives the library save protocol its own owner: `theme-library-manager/index.ts` takes 223 lines out of `editor-session.ts`, which drops from 1283 to 1077.
- **Nothing changed behaviour and the whole unit suite says so** — 3287 tests in 246 files, plus the session suite at 25/25, with 184 of the 240 deleted lines appearing verbatim in the new owner and the remaining 56 accounted for line by line.
- **The plan named the wrong harness, and the correction is in both places** — no manager test references the session, so `editor-session.dom.test.ts` was rank 5's real harness; the plan and this file no longer claim the 528 manager tests as the evidence for a move they never touch.
- **The census's `~250 lines` measures 223 and survives as an approximation** — 223 and 240 bracket it, and the implementer quoted the harsher reading.
- **Rank 5 surfaced three rows rather than three fixes** — `vg-372` (`biome check` red where the gate is green), `vg-373` (the save error still reported under `controls`), `vg-374` (`editor-session.ts` past the 800 stop, and the new owner the only manager with no test).

## Next

1. **Task 9's third candidate goes out next — rank 9, `object-actions`' eligibility agreement** — six sites in one file, and the file already holds the pattern at `:243-245`, where eligibility delegates to `arrangeEligible` rather than re-encoding the refusal.
2. **Rank 6 goes last of the four, and its hedge is already surveyed** — `controls-manager`'s Line writes are Fabric `Control` action handlers, so the move either delegates to an existing geometry owner or the candidate dissolves; the census names no destination, and inventing one to give it somewhere to point is the failure mode.
3. **Phase 2's candidate report at HEAD, then per-candidate verification** — nothing is deleted until each candidate is checked against the string-resolved vocabulary: the `data-vigilia-*` attributes, the `--shell-*` custom properties, the `KIND_*` registries and the four gate scripts that read the source tree as data.
4. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
