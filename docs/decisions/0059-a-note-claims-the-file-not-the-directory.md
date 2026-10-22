# 0059 — A note claims the file, not the directory

- **Date:** 2026-10-17
- **Status:** accepted
- **Paths:** `scripts/reuse-gate.mjs`
- **Task:** Phase 21.1 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (row `vg-144`; the same defect from the other side is `vg-425`)

## The problem

`scripts/reuse-gate.mjs` refuses the first write to a watchlisted path while no
decision note claims it. The claim is the `- **Paths:**` bullet in
`docs/decisions/*.md`, and `covers()` read a claim ending in `/` as covering
**every path beneath it**. So a note that claimed
`renderer-core/src/charts/` licensed a write to *any* file under it — including
files that did not exist when the note was written, and that the note never
discusses.

The measured consequence is that the gate is a **one-shot latch per directory**:
it guards the first change to a boundary and nothing after it. The user ruled on
2026-10-12: **a note must claim the file, not the directory.** The blunt,
presence-only reading stays; only the unit a claim is made in changes.

The shape of the problem is therefore: *what unit does a path-scoped licence
take, when the licence is prose a human writes and a machine matches against a
path?* A directory is cheap to write and silently inherits to everything a later
commit adds. A file is exact, and costs one entry per file.

## Rung 1 — Yunari

Searched: `covers()`, `claimedPaths()`, `decide()`, `isWatched()`,
`matchesDirectory()` and `WATCHLIST` in `scripts/reuse-gate.mjs`; every
`- **Paths:**` bullet in `docs/decisions/*.md`, extracted with the gate's own
reader (continuation lines included); `docs/decisions/0025` (how deep a bare
watchlist entry matches — the one prior ruling on this matcher);
`docs/decisions/README.md`'s template; rows `vg-144`, `vg-425`, `vg-535`; and the
commits that landed each claiming note, to see which files its change was made
in.

Found:

- **63 distinct claimed paths, 15 of them directory claims across 14 notes.**
  Five distinct directories: `renderer-core/src/charts/` (0005, 0028),
  `renderer-core/src/theme/` (0022, 0023, 0028, 0041),
  `host/src/providers/` (0004), `editor/src/components/ui/` (0033, 0036, 0037,
  0038, 0049, 0050, 0056) and `editor/src/editor-shell/` (0035).
- **The trailing-slash branch has no separator.** `rel.startsWith(base)` means a
  claim on `…/charts/` also matches a sibling named `…/chartsomething`. No such
  sibling exists, so it is reachable in principle and not in fact — it is
  corrected by the same deletion rather than by a fix of its own.
- **The non-slash branch's file-as-directory arm cannot fire.** It is
  `rel === base || rel.startsWith(\`${base}/\`)`, and the second arm covers
  `…/theme/plan.ts/anything`. Checked against the registry rather than assumed:
  **no claim is a prefix-directory of another claim**, so a path under a file
  never occurs. The arm is dead today, and deleting it is safe.
- **No claim without a trailing `/` resolves to a directory on disk**, so the
  slash is the only directory mechanism the gate has.
- `vg-425` measured the same defect from the other end (16 of 20 watchlist
  entries allow a brand-new file) and waits on exactly this convention;
  `vg-535` records that the hook does not block, so this note is owed on the
  merits rather than enforced.

## Rung 2 — dependencies

Searched: `scripts/reuse-gate.mjs`'s imports and the other `scripts/*.mjs`.

Found: `node:fs`, `node:path`, `node:url` and nothing else. Every `scripts/`
entry is a dependency-free hygiene gate, and there is no path-matching,
glob-matching or policy package in the workspace that could own a claim language.
Nothing to discharge.

## Rung 3 — platform

Searched: whether any JavaScript or OS API scopes a policy to a path.

Found: nothing to search. `path.relative`/`resolve` is the whole of what the
platform gives a matcher, and it gives no notion of a licence, an owner or a
path pattern. This is not a platform question and rung 3 cannot answer it.

## Rung 4 — ecosystem

**Attempted and unrun.** This session had no web search — the query returned
nothing at all, twice — so this is **not** a finding that nobody solved this
shape; it is a rung that was not run. What can be said without it, from what is
installed here, and it is the reason the chosen option is a deletion rather than
a new pattern language:

- **The ecosystem's unit for a path-scoped exemption is a glob, and the defect
  travels with the unit.** Biome is this repo's formatter and linter, and its own
  `biome.json` scopes with `"files": { "includes": ["src/web/**/*.ts", …] }` — a
  pattern a file added tomorrow inherits without anyone deciding it should. Ruff's
  `per-file-ignores`, ESLint's `overrides` and CODEOWNERS' directory patterns are
  the same shape.
- **The tools that avoid the inheritance name the site, not the tree** — a
  `# noqa`, an `eslint-disable-next-line`, a suppression with a line number — and
  they pay for it with one entry per site, which is the cost this decision takes
  knowingly.
- The search that would test that against a policy engine (OPA/Conftest,
  `cargo-deny`, a licence-allowlist tool) is the one not run, and it is recorded
  as unrun rather than as empty.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep the directory claim | Nothing changes | None | The gate stays a latch per directory — the row itself | rejected |
| **Exact-file claims, with the 15 claims re-pointed in the same commit** | Answers the question the gate appears to answer | 15 claims re-pointed, one commit, each read from the note and its commit | A note re-pointed **too narrowly** refuses a write it was written to license, and the refusal reads as a decision — the migration's real risk | **chosen** |
| Globs (`charts/**`, `charts/*.ts`) | A directory stays cheap to write | A second matching language inside the gate | A glob *is* a directory claim with more syntax; `**` re-opens exactly what the ruling closed, and `*` invents a depth rule nobody ruled on | rejected |
| A claim keyed to the writing agent, session or base sha | Precise about *which change* | The gate has no identity, and the register already keys by sha | Invents a state the gate cannot observe; a hook that cannot see the writer cannot match on it | rejected |
| A directory claim that lapses after N days | Needs no re-pointing at all | A clock inside a repo-hygiene gate | A boundary that unguards itself, silently, and the lapse is the failure the watchlist exists for | rejected |
| Delete claims; require a note per change | The strongest reading of "presence" | The gate has no notion of a change, so every write needs a note | Not what the ruling says, and it widens the gate past what it was asked to do | rejected |

## Rung 6 — probe

Measured on 2026-10-17 at `8c1c4b30`, by reading the registry with the gate's own
extractor and by running the gate itself:

| Measurement | Value | How |
|---|---|---|
| `…/charts/settings-fields.ts` through the gate, before | **exit 0** | `printf '{"tool_input":{"file_path":"…/charts/settings-fields.ts"}}' \| node scripts/reuse-gate.mjs` |
| Distinct claimed paths | **63** | the gate's `claimedPaths()` extraction over `docs/decisions/*.md` |
| Directory claims | **15** in **14** notes | same extraction, claims ending in `/` |
| Claims that are a prefix-directory of another claim | **0** | pairwise `startsWith(a + "/")` over the 63 |
| `--self-test`, before | **10 cases, all pass, exit 0** | `node scripts/reuse-gate.mjs --self-test` |

**What the probe shows, and the one thing it corrects.** The row's probe path is
claimed, after the re-point, by **`0028`** — the note whose decision *is* the
descriptor table in that file. So the probe still returns `0`, and correctly: the
directory claim is gone, and a note that governs the file remains. The fix's
effect is visible on a chart file **no note names** (`charts/grid.ts`), which is
what the acceptance case uses.

## Decision

**A claim names a file, and only that file.** `covers(rel, claimed)` becomes
`claimed.some((c) => rel === c)`; the trailing-slash branch and the
file-as-directory arm are **deleted rather than narrowed**, because each was a
rule the ruling does not want and neither has a case behind it.

The 15 directory claims are re-pointed in the same commit to the files each
note's change was made in, read from the note and from the commit that landed it.
**Never guessed:** where a note's subject genuinely spanned a directory with no
bounded file set, the honest answer is to say so, because a note naming three of
nine files is worse than one naming a directory — the gate then refuses the other
six and the refusal looks like a decision. No note in this migration turned out
to be unbounded.

**A claim ending in `/` now names nothing.** That is deliberate and not a
compatibility gap: under this rule a directory claim is malformed, and a gate
that refuses the paths beneath it is answering loudly rather than licensing
silently. The template in `docs/decisions/README.md` already asked for
watchlisted *paths*, and after this note a path is a file.

**The self-test gained two cases read against the live registry**, which no
synthetic array can see — the gap `vg-425` names from its own side. The pair is
the point: a chart file a note names is allowed and one no note names is refused,
so a registry that answers the same to both fails the check whether it is latched
by a directory claim or names nothing at all. Both paths are **found** rather
than pinned, so a later note naming the file does not turn the case red for the
wrong reason.
