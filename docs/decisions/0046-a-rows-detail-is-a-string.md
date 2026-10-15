# 0046 — A row's `detail` is a string, and the checker says so

- **Date:** 2026-10-16
- **Status:** accepted
- **Paths:** `scripts/backlog-check.mjs`

## The problem

`vg-530`: the register has one field that every reader consumes and the checker
never validates the *shape* of. `check()` validates `title`, `state`, `source`,
`check` and `artefacts` — it even refuses a bare-string `artefacts` as "a shape
the reader cannot consume" — and `detail`, which is free prose, was tested by
nothing.

That is not theoretical. `vg-174`'s `detail` was a **two-element array** for as
long as it has been that way, and the failure was silent and *reader-dependent*:
`row.detail.match(...)` throws, while `MARKER.test(row.detail)` coerces the array
to a comma-joined string and **matches anyway**. Two probes over the same register
therefore disagreed about whether that row carried a ruling, and the instrument
that decides whether a phase closes was reading a coerced value for one of its
104 rows. `vg-174` is normalised; what this note settles is the rule.

The non-obvious part is not "validate a field" — it is that the register's `detail`
is **prose**, and prose is the field least suited to a shape rule. So the decision
is what the rule accepts, not whether to have one.

## Rung 1 — Vigilia

**Searched:** every reader of `.detail` in `scripts/`; every field `check()` in
`scripts/backlog-check.mjs` already validates, and how it words a shape refusal.

**Found:** the pattern to reuse, twice over. `check()` refuses a bare-string
`artefacts` **as a shape** rather than reading it as absent, with the comment that
"a bare string and an absent key are different defects". And `checkParked` already
defends itself against the same hazard in the other direction, reading
`typeof item?.detail === "string" ? item.detail : ""` — a guard written because the
hazard was live. Both are the same idea: **the checker states the shape it reads,
and a value that is not that shape is reported rather than coerced.**

Only `scripts/backlog-check.mjs` reads `detail` in code; everything else that reads
it is a session grepping the file, which is exactly the reader a type rule protects.

## Rung 2 — dependencies

**Searched:** `src/web/package.json` and every `packages/*/package.json` for a
schema validator (`ajv|zod|joi|yup|superstruct|valibot`).

**Found:** nothing needed and nothing to add. `check()` is a hand-rolled rule set
over ~10 fields and the project's convention is to state each rule where it is
read; a schema library would replace ten readable lines with a schema plus a
dependency, which is the dependency-for-a-few-lines case.

## Rung 3 — platform

**Searched:** what JSON and Node give a reader that must decide "is this field the
shape I can use".

**Found:** `typeof x === "string"` — native, exact, and already the idiom in this
file. JSON itself has no notion of a field's type, which is *why* the rule has to
live in the checker: the format will happily parse an array into a field every
reader treats as prose.

## Rung 4 — ecosystem

**Searched: COULD NOT BE RUN.** No web search or fetch tool is available in this
session, so this rung has no evidence and is recorded as **not run** rather than as
"nobody has solved this shape". Those are different claims and only one is true here.

**What stands in its place, and why it is weaker:** the general expectation — that
a JSONL register with a hand-rolled validator states each field's shape where it is
read, and that "coerce on read" is the anti-pattern because it converts a data
defect into a silent wrong answer — is **not verified here** and is deliberately not
written as a finding.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Refuse a non-string `detail` in `check()` | The file's existing pattern, applied to the last unvalidated field a reader consumes | One rule and one self-test case | A future row that genuinely wants a structured `detail` is refused — which is the point, and is why `detail` is prose by convention | **Chosen** |
| Coerce on read (`String(item.detail)`) | Never throws | Hides the shape at every call site, and the register is the source of truth | The exact failure `vg-174` produced: two readers disagreeing, one of them silently | **Rejected** |
| Leave `detail` unvalidated, since `vg-174` is fixed | Zero work | The rule that would have caught it is still absent | The same defect returns with a different row, and the next session re-learns it the same way | **Rejected** |
| Refuse an *absent* `detail` too | Tidier-looking invariant | Rows without prose are legitimate — a one-line finding needs none | Manufactures a rule the register does not need | **Rejected** |

## Rung 6 — probe

Measured rather than asserted, over both registers at 2026-10-16:

- **531 rows, and all 531 carry a `detail` that is a string** — `[["string", 531]]`,
  with none absent and none of another type. So the rule lands on a register where
  it currently matches nothing, and cannot retroactively reinterpret a row.
- The hazard's own shape, read at source: `checkParked` already guards with a
  `typeof` test, and `check()` already refuses a wrong-shaped `artefacts` **as a
  shape**. Both are the same rule this note extends to `detail`.

## Decision

**`check()` refuses a row whose `detail` is present and not a string.** The specific
reason: `detail` is the last field a reader consumes that the checker does not state
the shape of, and the file already carries the pattern twice — `artefacts` is
refused as a shape rather than read as absent, and `checkParked` guards with the
same `typeof`. `vg-174` proved the failure mode is silent *and reader-dependent*,
which is the one property a gate exists to remove.

**What this deliberately does not cover.** `vg-529` stays open and is the harder
half of the same idea: the checker also never tests whether a **path inside a
`check`** still exists. That one needs a decision this note does not make — what
counts as a check's path, whether an untracked path under the gitignored
`.superpowers/sdd/` ledger is permitted, and whether a bare basename may be cited.
Measured while considering it, and recorded because it is the evidence: a naive
extraction over the 307 `verified` rows' checks flagged `jsdom` (from prose),
`npm audit --json` (a flag), and `package.json` (the extension alternation matching
`js` before `json`). A rule that reds on those is a rule that gets worked around,
so `vg-529` is a decision, not a regex.
