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

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-dead-code-sweep.md` — reordered by the user on 2026-10-12 to **managers, then dead code, then the register**: Phase 1 is closed, **Phase 2 closed with both reference reports reviewed**, Phase 3 removal is under way with **Task 4 complete and Tasks 5–6 next**, Phase 4 the register (7); **task numbers are stable identifiers, not positions**, because a dozen references cite them.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **Task 4 landed and passed both review verdicts** — the editor package's five §2.1 symbols and 143 `export` keywords go in `11029413` + `93bb2c5f`, and the scanner's after-picture reproduces exactly: 312 → 163 candidates, editor 224 → 75.
- **The review re-established every deletion rather than sampling it** — all five §2.1 symbols dead under its own searches, tested against each named hiding form (barrel, namespace import, dynamic import, `require`, gate JSON), plus all 143 keyword rows scanned for an importer or a quoted-string registration.
- **No fix round, ruled on cost rather than on the count** — five of the report's numbers are wrong or unreproducible (seven workspaces not six, 77 files not 76, 144 lines not 145, two property keys not one, and the `npm run lint` wrapper artefact unreproduced at 0 where the lane reported 1), and every correction stands beside the report in `task-4-review.md`.
- **The 13 over-retained keywords are a residual, not a defect** — kept on a `vi.mock` factory that never names the symbol, which is the scanner's own sound conservatism about what a search can see, applied as a retention rule; the corrected rule travels into Task 5 rather than into a round.
- **Two register rows were filed on verified verdicts, never on the lane's word** — `vg-381` (`importImage`'s inert `scale` option, passed `image-contain` by `asset-manager`) and `vg-382` (the `redundant-export` tier counting an object-literal property key as a use).

## Next

1. **Task 5 is next — the host, player and shared packages** — 88 candidates between them, and it carries Task 4's corrected retention rule: a test importer justifies keeping a keyword only when the test *names the symbol*, never when it mocks the module wholesale.
2. **Task 6 follows it** — the ungated trees and stale references, where `.mjs` sits in no gate at all and `tests/e2e/**` in no tsconfig, so the scanner's own coverage limits are limits rather than results.
3. **Task 7 closes the plan** — Phase 4 discharges the register rows the sweep's instruments produced (`vg-378`, `vg-379`, `vg-381`, `vg-382` and the rest), each with a check naming a word from its own title.
4. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.
5. **The three failures the capture run surfaced** — `vg-359` (which also owns the one stale capture), `vg-360` and `vg-361`; nothing fixed on sight, because the first question for each is whether the surface moved or the locator did, and those want opposite fixes.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
