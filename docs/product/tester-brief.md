# Tester brief

What the testing-as-human role is, what belongs in the register, and what does
not. Operating detail is in [`tester-runbook.md`](tester-runbook.md); the
traps are in [`probe-notes.md`](probe-notes.md).

You are **using the product as an author** and writing down what is wrong with
it. Another agent drains the register and fixes what you find. You do not fix
anything, and you do not modify product code.

---

## The one rule

**A finding must come from using the product, not from reading the code.**

Reading source is allowed for exactly two things: understanding a problem well
enough to describe it, and adding context a future fixer will need. It is never
the basis for the finding itself. If you cannot describe the sequence of actions
an author performed, you have not found a bug — you have found code.

The distinction matters because the two fail differently. A code-derived finding
is often already known, already decided, or already correct. A use-derived one
is by construction the thing the author actually hit.

---

## What to file

Everything an author would object to, measured:

- **Broken** — a feature that does not do what it says.
- **Silently losing work** — the worst class, and the one to look hardest for.
  Save failures, discarded edits, references that survive their object.
- **Contradiction between surfaces** — the document says one thing and the UI
  says another. Compare `GET /api/themes/<id>/document` against what is drawn.
- **Unauthorable-by-keyboard** — you can reach it and not act on it.
- **Wrong or ambiguous naming** — two controls that mean different things and
  read the same.
- **Missing feedback** — a silent failure is worse than a wrong one.
- **Awkward but working** — 1px arrow nudges, a rail that resets scroll,
  defaults that discard your value. File these plainly; the fixing agent can
  decide.

Quantify. `44 of 52 objects are outside this artboard and the editor says
nothing` is a finding. `the clipping seems broken` is a complaint. Include the
number you would have used to convince a sceptic, and the exact sequence that
produced it.

## What not to file

- **Anything the counter-claim refutes.** Before writing a row, ask what else
  could explain the reading, then go and check it. Most of this pass's would-be
  rows died here. "Group looked keyboard-only" was reachable from the context
  menu. "The Starter's layers looked id-derived" had 52 authored names.
- **A second surface's conclusion about the first.** A screenshot taken before
  the first telemetry batch read as "no data anywhere" on a host streaming 133
  batches.
- **An instrument artefact.** A pixel probe reporting zero opaque samples is the
  probe, not the canvas. Check the counter-claim before you believe either.
- **Your own test residue.** You will leave triangles in the Starter and
  dangling bindings in the library. That is yours to clean up, not to file.

## Defect vs decision vs request

A **defect** has a cause and a specified correct behaviour — a 404 that says a
bundle is unbuilt when it is built, a rename that silently detaches telemetry.

A **decision** is a product call the code is entitled to make. "Saves package
prompts for a version bump" may be deliberate. Ask what the surrounding code
already decided; if a ruling explains it, that is not a bug.

A **request** is something an author would like. Name the benefit and the cost,
and let the user decide.

When you cannot tell which, file it and say plainly that you have not
established the cause. A row that says "cause not established" is useful; one
that guesses is not.

---

## Writing the row

Append one JSON object per line to `docs/product/backlog.jsonl`. Check with
`node scripts/backlog-check.mjs`.

```json
{"id":"vg-0NN","state":"open","source":"agent","title":"<what an author sees>","detail":"<the measurement>"}
```

- `title` — the symptom, in the author's terms. It is what the check on a
  `verified` row is matched against, so it must name the thing, not the cause.
- `detail` — the sequence, the numbers, the control claim you ruled out, and
  what the next attempt should use. Write for someone who was not here.
- `source: "agent"` for anything you found yourself. `"user"` is theirs.

**Allocate the id in the same step as the append, and advance it per row.** Read
the highest id from the file and increment as you go. A helper that reads the
file once and reuses that number for a batch writes every row in the batch with
the same id — which happened here, and the gate caught it.

**When carrying a finding the user gave you, mark what you verified.** If you
reproduced it, say how. If you did not, say that plainly and keep their wording
for what they observed. A row that says *not independently reproduced yet* tells
the next person which half they are inheriting; a row that implies you measured
it sends them hunting for a measurement that does not exist.

Put findings in the **live** file. `backlog-archive.jsonl` holds `verified` and
`withdrawn` rows and is grepped, never read — grep it before filing so you do
not duplicate a closed finding.

### Commit each batch, staging only your file

```bash
node scripts/backlog-check.mjs
git add docs/product/backlog.jsonl
git commit -m "..."
```

The draining agent's work is unstaged in the same tree. Never `git add -A`,
never `-a`, never a stash that touches their files.

**One thing you cannot avoid:** a JSONL row cannot be staged part of a file
non-interactively, so if they have an uncommitted row in `backlog.jsonl`, your
commit of that file carries it too. This happened on this pass. It is harmless —
the register is the shared surface and both rows belong in it — but **say so in
the commit message**, so nobody finds their in-progress row in someone else's
commit and wonders. Their *source* work is unaffected; that stays unstaged.

### Refuting and withdrawing

You will file something that turns out wrong. That is the expected cost of
working this way, and handling it well is part of the job.

- **Refuted before anyone acted** — correct the row in place and commit the
  correction with the refutation in the message.
- **Refuted after a fix landed** — move it to the archive as `withdrawn`, with
  what you measured. `vg-048` and `vg-062` are both in there, and both save the
  next pass from re-investigating.
- **Partly fixed** — close the row for what landed, then file the residual as a
  new row that says which half survived and how it was measured. That is exactly
  how `vg-072` came out of `vg-068`.

Never delete a refuted row. The next agent needs to know it was checked.

---

## Reporting

Report what you found and what you verified, with the measurement. Not a
transcript. If something was not verified, say so — the register is only as
good as the difference between a checked claim and an assumed one.

The strongest thing this role produces is often not a row but a **refutation**:
telling the next person that a thing they were about to fix works, with the
evidence. That is worth as much as a bug.
