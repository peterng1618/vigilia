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

- **Active plan:** `docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md` — third in the user's sequence (**managers, then dead code, then the register**), and the only active plan; the dead-code sweep is **closed and archived** at `docs/superpowers/plans/archive/2026-10-12-the-dead-code-sweep.md` with its two deviations named in the file itself, and **task numbers in that plan are stable identifiers, not positions**.
- **Phase 1 closed with three moves and one dissolution** — [`manager-census.md`](docs/architecture/manager-census.md) ranked ten candidates and closed at `32265c25`; Task 9 moved ranks 4, 5 and 9 and confirmed rank 6 is not a move, its census label `Clean-ish` having hedged exactly that.
- **Phase 2's reports land in `docs/architecture/`, not the plan workspace** — `.gitignore:90` hides `.superpowers/` and `docs/README.md` calls that ledger temporary, so evidence Phase 3's removals rest on would have died with a fresh clone; the plan's two output paths were corrected before either ran.
- **`snap-manager` is the largest code problem and is not an extraction candidate at all** — one external production module reaches it, so its fix is a protocol re-shape needing a spec, and the plan no longer calls it the split's worked example.
- **The sweep's rule is detection before deletion**, and the user set its bias on 2026-10-12 — *"I want a clean codebase but be careful to not overdo it and break the app"*: a survivor costs a ticket, a live symbol deleted costs the product.
- **Two plans are queued behind it**: [`the backlog reproduction pass`](docs/superpowers/plans/2026-10-12-the-backlog-reproduction-pass.md), which re-derives its batches from the register at run time because a written count rots the moment a row is filed, and [`the keyboard-only walkthrough`](docs/superpowers/plans/2026-10-12-the-keyboard-only-walkthrough.md).

## Last completed change

- **All six triage tables are complete and committed** — **237 open rows**, the last three batches 40/40, 39/39 and 39/39, every id in exactly one batch and none in two, proved by set comparison rather than by adding counts.
- **The phase's verdicts: 21 close, 104 are decisions, 110 are work, 2 are parked by the user** — a close on movement is named as such and is never used as a substitute for a close on a fix.
- **49 rows wait on a serialised browser follow-up**, each carrying its spec, `--grep` and build command; the three the capture run already fails (`vg-359`, `vg-360`, `vg-361`) are among them.
- **B5's phase output is sixteen rules over fourteen rows** — the "no rule reads X" rows close only on gates that do not exist, and the user ruled those are separate holes and separate work rather than one merged pass.
- **One finding is deliberately not filed while the pass runs** — literal copy in the dev fixture `control-fixture.tsx`, which the copy walk does not mount; a row now would belong to no batch and break Task 7's coverage arithmetic, so the synthesis carries it.

## Next

1. **Task 7, the synthesis, is the pass's next step and its last** — it proves coverage over all six tables and writes `docs/superpowers/specs/2026-10-12-the-backlog-drain-design.md`, which is what the drain is planned from; its input is the **237 open rows** in [`backlog.jsonl`](docs/product/backlog.jsonl) plus 149 archived.
2. **The drain's rule is that a row whose defect does not reproduce is a finding about the row, not a licence to close it** — 21 rows close and each names which of the two kinds of close it is.
3. **The serialised browser follow-up runs 49 deferred rows one at a time** — they share the fixed preview ports, so two suites at once produce false results rather than slow ones, and one sample of a flaky spec is not a measurement.
4. **`vg-386` is a sweep of its own, not a fix inside the closed plan** — the tier's definition is undecided (76 on the plan's literal wording, 133 on the code's own intent) and 133 candidates have never been adjudicated; **none of the 133 is proven dead and none may be deleted on classification alone**.
5. **`vg-368` waits on a decision** — whether `src/web/.agent-scratch/` is deleted, relocated outside the tree, or excluded per tool; deleting is not obviously safe because it holds screenshots and a vitest report that may be the only copy.

## Blockers / unverified

- **Phase 1 carries one known behaviour exception and it will not be guessed at** — `vg-370`'s refusal on the resize path is reachable in principle and unestablished in fact, and the plan now records it at all three acceptance sites rather than asserting nothing changed; one browser check settles it together with `vg-233`, which is why neither is closed on the strength of a source read.
- **Five specs are red on `develop` and each is named rather than left a mystery**: the two deliberate walkthrough reds, and `vg-359`, `vg-360` and `vg-361`, which fail deterministically on the built bundle; `vg-204` passed 5/5 at HEAD and so is not reproducing today but stays open pending a ruling, and `vg-363` is the opposite hazard — a non-deterministic fixture, since a bare editor mount resumes among themes whose mtimes tie, which is the class most likely to be misread as flake.
- **Read a run's own report and apply its `incomplete` marker** — `summary.json` reads green for the census that is committed red because it is another project's run; the scanner's reports carry `incomplete: true` from start-up because a crash used to leave the previous run's pass on disk; and the exit code alone is wrong too, since a red `desktop-host` project is expected here.
- **Every open row lives in [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl), and every parked or unverified observation in the plans' ledgers with its ruling — but `.superpowers/` is now untracked, so a ruling recorded only there does not survive a fresh clone; durable decisions belong in [`docs/decisions/`](docs/decisions/), and promoting this session's is a deliberate act nobody has done.**
- **Unpushed:** `develop` is far ahead of `origin/develop` and no push is authorised.
