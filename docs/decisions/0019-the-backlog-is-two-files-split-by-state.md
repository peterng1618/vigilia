# 0019 — The backlog is two files split by state, and a commit is what closes a row

- **Date:** 2026-10-01
- **Status:** accepted
- **Paths:** `scripts/backlog-check.mjs`, `scripts/check-status.mjs`

## The problem

The defect registry had one shape problem and one enforcement problem.

The shape: `docs/product/backlog.jsonl` held every row forever. At 58 rows, 33 of
them `verified`, a fresh session read a third of a document to find out what was
still open. The obvious fix — "archive when more than 20 completed rows pile up" — was
raised in discussion on 2026-10-01 and is worth rejecting on its merits. It is a
chore with no trigger: every session would have to check whether it was due and
skip it when it was not, and the count it names (20) was already exceeded by the
33 verified rows present at the time, which is the tell that the number was
arbitrary. **No such rule ever existed** — nothing enforced it and nothing
failed; it was a proposal, and it loses to splitting by state.

The enforcement: a row's status was a word an agent typed into a file, inside the
same session that would have changed it. Nothing outside that session could
disagree. This is the failure the registry already has a scar for: two fixes
reported as landed that were not, both caught by the user testing, not by the
gate. A status that only moves inside the session that would have moved it is not
a durable status.

## Rung 1 — Vigilia

Searched: `scripts/backlog-check.mjs`, `scripts/check-status.mjs`,
`scripts/sdd-checkpoint.mjs`, `AGENTS.md`'s bug rule and backlog rule.

Found: `backlog-check.mjs` already owns the hard part — JSONL chosen so two agents
adding different items write different lines, and content-hashed ids so concurrent
creation cannot collide. Its `verified ⇒ check names a word from the title` rule
exists for exactly this class of failure, and it is the strongest thing in the
repo. The gap is that the check is *semantic* (a human judgement about wording)
while the thing that actually goes stale is *temporal* (was this claim still true
last week). No amount of prose fixes a temporal problem.

`sdd-checkpoint.mjs` is the closest prior art: it re-injects dispatch state after
compaction, so a fact survives session death. That is the property wanted here,
applied to row status rather than dispatch records.

## Rung 2 — dependencies

Searched: `package.json` scripts; no runtime dependencies in either gate.

Found: both scripts are dependency-free by design and must stay so — they run in
`gates:self-test` before anything is built.

## Rung 3 — platform

Searched: `git rev-parse`, `git merge-base --is-ancestor`, `git log --format`,
git commit trailers, git `notes-merge` and `notes` refs.

Found: git answers the ancestry question with zero new machinery.
`git cat-file -e <sha>^{commit}` proves a commit exists; `git merge-base
--is-ancestor <sha> HEAD` proves it is on the mainline rather than a lost branch.
Both are pure reads. **Measured, not assumed:** all 31 artefact shas across the
25 rows carrying them resolve and are ancestors of HEAD — so the rule is safe to
enforce against the registry as it stands. What is *not* true today: 0 of 31
commit subjects name their row id, so that check applies only to rows
materialised from trailers, never retro-fitted onto the archive.

Trailers give the pre-paid channel: an agent already writing a commit types one
extra line, opens no file and runs no command.

## Rung 4 — ecosystem

Searched: how git-native issue trackers partition open work from closed history,
and what they do about references spanning the split. Read renga, flatissues,
git-issue, steviee/git-issues, and nd.

Found: **every one splits by status** — git-issue `.issues/open|closed/`, renga
`issues/<status>/`, flatissues with status in the filename and `git mv` as the
transition, nd `.vault/issues` with a separate trash. Nobody uses a count
threshold; the ones with the most history all moved on state.

The finding that changed the design is about **drift**. renga's docs state that
frontmatter `status` is authoritative and that an active issue sitting under
`done/` is still operated on by active-issue commands, with a warning, plus
`renga validate --auto-correct` to repair it — because a tool that reads status
from a file has no reason to notice a second copy disagreeing. flatissues makes
the filename authoritative for the same reason. So the split must be
**derived, not asserted**, and the validator must compare.

**This is also where the tools were rejected.** All four install a second task
tracker. renga's own guidance is *"file an issue for any work that will take your
agent longer than about 2 minutes"* and *"do not use markdown TODO lists for task
tracking"* — which claims Superpowers' job directly. flatissues goes further and
has Claude file issues autonomously, against the rule this change exists to
enforce. Neither can keep status fresh either: their status moves when the
session that wrote the row edits it, which is the same defect the JSONL registry
has. Adding one would import constraint-1 risk and solve nothing.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| One file, never archive | reading cost grows without bound | none | a fresh session pays to read history every time | rejected |
| One file, archive at >20 completed | churns on a trigger nobody runs | a rule to check, then skip | the number was already arbitrary against 33 verified rows; no such rule was ever implemented | rejected |
| Adopt renga/flatissues | a real tracker, well built | a second task tracker beside Superpowers | claims the task tracker by its own docs; status still session-scoped | rejected |
| **Two files split by state; git derives closure** | transition needs no decision at the moment it happens | a `defer` field, one gate rule, one script | refs span two files | **chosen** |

## Rung 6 — probe

Run against the live registry, 58 rows:

- 33 `verified`, 22 `open`, 3 `withdrawn`. The proposed >20-completed threshold
  was already exceeded by the verified count alone, which is why the number itself
  was the tell — it was a proposed rule, never an implemented one.
- 6 of 22 `open` rows carry no `owner`, no `check` and no `issue`: vg-031, -032,
  -033, -037, -040, -050. Read individually, all six are genuinely parked —
  vg-040 is ruled but needs a spec, vg-037 is characterised-not-fixed, vg-031 and
  -033 need a new control. None is orphaned; none says so. That is what `defer`
  names.
- All 31 artefact shas resolve and are ancestors of HEAD; 0 commit subjects name
  their row id.

## Decision

**Two files, split by state, never by count.** `docs/product/backlog.jsonl` holds
`open`, `in progress` and `unverified`. `docs/product/backlog-archive.jsonl` holds
`verified` and `withdrawn`. A row leaves the live file at the moment it reaches a
closed state — one event, already true, nothing to remember — so the live file is
short by construction rather than by decree.

Two properties the split would otherwise cost, both kept:

- **The archive stays greppable.** Verified rows are the anti-double-report
  record; vg-027's value is that its detail says the original hypothesis was
  wrong. Grep the archive before filing a row.
- **Ids and `supersededBy` resolve across both files.** The gate checks the union.

**An `open` row must say whether it is claimed or parked** — `owner` for claimed,
`defer` (`out-of-scope` | `too-big` | `blocked`) for parked. This is the checkable
form of "filed because it is not this task's work".

**Closure is derived from git, never asserted.** A `verified` row's `artefacts`
shas must resolve and be ancestors of HEAD. The agent does not flip the status; the
status is true or the gate fails. A claimed-landed row citing a sha from a lost
branch fails — the ten-uncommitted-agent-deaths failure, caught by a check that
runs outside every session.

**Filing rides the commit the agent was already writing.** A `Found by the user,
not fixed:` or `Discovered, not fixed:` trailer is one line in a message being
composed regardless; a post-commit hook materialises rows from it. No file opened,
no command run, no category chosen at the moment context is most poisoned. The
root session is how the user's own feedback reaches a durable record, which is
otherwise unhandled: `settings.json` registers no `UserPromptSubmit` hook, so a
message from the user lives in one session's context and dies with it.

If the agent dies before committing, the finding dies with the code that produced
it — correct coupling, since the next search rediscovers it.