# 0055 — A `check` belongs to a closed row, and the axis is closed, not `verified`

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/backlog-check.mjs`

## The problem

`check` and `artefacts` are validated **only** on `state === "verified"` (`backlog-check.mjs:143`), so a
row in any other state may carry either and nothing reads it. Measured 2026-10-15, `vg-037` was `open` and
already carried a `check` from an earlier close — one that proved a capability *nearby* its claim — and the
close script's own guard (`if (/"check"\s*:/.test(line)) throw`) would have refused the close as written.
`vg-514` filed it and named the two candidate behaviours, refusing to pick one without a decision, because
the register's contract states what a `verified` row must carry and is **silent** on whether an `open` row
may carry a check.

## Rung 1 — Yunari

Searched: every rule in `scripts/backlog-check.mjs`; `AGENTS.md`'s close rules; the register itself.
Found: **the checker already has the axis this needs, and already refuses across it in both directions.**
`checkPlacement` computes `closed = item.state === "verified" || item.state === "withdrawn"` and refuses a
closed row in the live file *and* an unclosed row in the archive — on the stated ground that *a rule the
checker knows and does not test is a convention, and a convention loses to whoever is in a hurry*. A check
is evidence of a close, and the checker knows it: rule 2 of its own header says *a `verified` item carries
a `check`*. The converse was simply never tested.

`AGENTS.md` records the cost of a stale check being read as evidence: *a check of a capability nearby is
not a check of this finding … that mistake cost two false "landed" reports, both caught by the user
testing.* That is what a reopened row closed again without its check replaced reproduces.

## Rung 2 — dependencies

Searched: the checker's imports.
Found: nothing, and deliberately so — see `0054`. No schema library is needed for a field-presence rule.

## Rung 3 — platform

Searched: nothing was needed beyond `Object.hasOwn`, which the file already uses implicitly in its
`item.artefacts !== undefined` checks.
Found: the whole rule is field presence plus the state list the checker already holds in `STATES`.

## Rung 4 — ecosystem

Searched: the same Exa query as `0054` covered ledger integrity, not field-level invariants, so this rung
was **not** separately searched — and saying so is the point. The shape here is *a record's fields are
conditional on its status*, which is a schema concern rather than a ledger one; the register already
answers it in its own vocabulary (`checkPlacement`, `STATES`), and rung 4 would have returned JSON-Schema
`if/then` as the generic mechanism, which rung 2 shows is a dependency this gate does not take.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Refuse `check`/`artefacts` on any row that is not `verified` | Simple, one condition | **Fails 7 existing `withdrawn` rows carrying a `check` and 3 carrying `artefacts`** | Deleting evidence that a withdrawn row's subject *was* examined, to satisfy a rule about closes | rejected |
| Refuse on a row in an **unclosed** state (`open`, `in progress`, `unverified`) | Reuses `checkPlacement`'s own axis | One live row to clean (`vg-348`) | None found | **chosen** |
| Tolerate it as inert, and make every close replace rather than append | No rule to enforce | Nothing enforces the replacement either | The failure is a convention again, which is what the row was filed about | rejected |

## Rung 6 — probe

Parsed both registers and counted by state at `61582d4f`:

| State | Rows | carry `check` | carry `artefacts` |
|---|---|---|---|
| `open` | 154 | **1** | 0 |
| `verified` | 366 | 366 | 366 |
| `withdrawn` | 23 | **7** | **3** |

The 7 and the 3 are the measurement that decides this note: they are the reason the rule is written on
**closed** rather than on `verified`. The single live instance, `vg-348`, was read in full, and its `check`
is not evidence at all — it reads `"NOT YET RUN - the case to add: …"`, a to-do written into the field that
means *here is what proved this*, which is the shape the rule exists to refuse. **Its content is already in
the row's own `detail`** (the same measurement, the same case, and the ruling), so stripping the field
loses nothing.

`vg-037`, the row's own example, has since closed and moved to the archive as `verified` — so the live
violation this rule must clear is exactly one row, not two.

## Decision

**`check` and `artefacts` are refused on a row whose state is not closed.** Closed means `verified` or
`withdrawn`, which is the same pair `checkPlacement` already computes — so the checker gains one rule on an
axis it already owns, rather than a second notion of "done".

**The reason, specifically:** the axis is **closed**, not `verified`, because a `withdrawn` row's check is
a record of what was examined before the subject turned out to be gone — it is evidence, seven rows carry
it, and a rule that deleted it would be destroying the register's memory to satisfy a rule about closes.
An unclosed row's check is the opposite: a claim about a close that does not stand, which is precisely the
shape that has already cost two false "landed" reports.

**The cleanup this owes, named rather than discovered later:** `vg-348` loses its `check` field, and no
content moves because its `detail` already carries all of it.
