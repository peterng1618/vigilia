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

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md` — reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 is closed, **Phase 2 closed with both reference reports reviewed**, Phase 3 removal (Tasks 4–6) is next, Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Phase 2 closed: both reference reports landed and both passed their reviews** — [`dead-selectors.md`](docs/architecture/dead-selectors.md) (135 tokens in scope, **0 dead**, 6 cleared as composed or dependency-written) and [`dead-code-candidates.md`](docs/architecture/dead-code-candidates.md) (312 candidates at HEAD), the picture Phase 3's removals rest on.
- **The selector report took two fix rounds, and the second was a deletion round** — round 1 closed all four review findings but added 135 lines including one false claim of its own; round 2 repaired it by cutting, not elaborating (§5's counts clause, §3's unbacked uniqueness, §6's wording), so the document went 354 → 346 lines.
- **A reviewer's seat lost an argument to the implementer's instrument, and it was right that it did** — the review counted 4 runtime-composed selectors, the implementer 7; the scoped re-review reclassified the sweep's own output by left-adjacency (`left-adjacent=7 whole=31`) and found the document right and the reviewer's 4 an undercount.
- **The candidate report's delta was proved row-by-row, not by totals** — the reviewer rebuilt a worktree at `93c4f704`, reproduced 596/311 exactly, and diffed the rows to **+1** (`theme-library-manager/index.ts :: ThemeLibraryManagerOptions`), −0, which a totals argument could not have excluded four other modified files from.
- **The register moved with the evidence** — `vg-266` retitled to the four arms that actually survive, plus `vg-378` (the compaction banner's unasserted conventions), `vg-379` (the scanner's self-test that no command runs) and `vg-380` (the reverse-direction gap: a class production writes that no stylesheet defines).

## Next

1. **Phase 3 opens with Task 4, the editor package** — 224 of the 312 candidates, the largest and most refactored surface; every candidate is re-established at HEAD before it is touched, because a name composed at runtime is live with an empty grep and a symbol that moved looks exactly like one that died.
2. **Tasks 5 and 6 follow it** — the host, player and shared packages (88 candidates between them), then the ungated trees and stale references, where `.mjs` sits in no gate at all and `tests/e2e/**` in no tsconfig.
3. **Phase 2's candidate report at HEAD, then per-candidate verification** — nothing is deleted until each candidate is checked against the string-resolved vocabulary: the `data-vigilia-*` attributes, the `--shell-*` custom properties, the `KIND_*` registries and the four gate scripts that read the source tree as data.
4. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
