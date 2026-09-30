# AGENTS.md — Vigilia

Project-specific facts and guardrails for coding agents. **Superpowers is the
sole development-process owner**: use its brainstorming, design/spec, planning,
execution, review and verification workflows rather than creating a parallel
Vigilia process.

## Project

- Repo: `peterng1618/vigilia`; default branch `main`; integration branch
  `develop`; remote `origin`.
- TypeScript/npm workspace at `src/web/`. No .NET or Python toolchain.
- Node 22.12+, 24 or 26+. Vitest + Playwright; Biome formats and lints.
- Fabric 7.4.0 is the one scene renderer. The editor uses `fabric/es` directly;
  the player uses the shared `scene-fabric` layer.
- Editor shell: React 19 + Base UI + Tailwind. Fabric stays imperative behind
  the editor boundary; never mirror Fabric objects in React.

## Process and documentation

- **Start with `STATUS.md`** — a fresh session continues from it alone. Follow
  its active Superpowers spec/plan/SDD links.
- **Exactly one implementation plan is active.** `STATUS.md` names it; every
  other incomplete plan is queued. Never execute two plans concurrently.
  Parallel subagents work only inside the active plan and phase, on independent
  scopes with non-overlapping ownership.
- **The agent environment is user-owned.** During product work, do not install,
  enable, disable, copy, edit or remove plugins, skills, hooks, MCP servers,
  Claude/Codex settings or `AGENTS.md` unless the user explicitly requests that
  exact change. Superpowers owns the workflow and its artifacts: never build a
  parallel Vigilia process, a project workflow skill, an alternate spec/plan
  directory, or a duplicate of its instructions elsewhere in the repo.
  Designs/specs live in `docs/superpowers/specs/`; executable plans in
  `docs/superpowers/plans/`; completed or superseded plans move to
  `docs/superpowers/plans/archive/` once no active or queued plan depends on them.
- Durable project truth lives under `docs/`; `docs/README.md` is the canonical
  map. `§N` requirement markers are stable; never renumber them.
- **Plans are contracts, not scripts.** Organize into phases of 3–5 tasks; each
  states outcome, owning symbols/landmarks, constraints, acceptance or failure
  modes, and verification. Avoid brittle line numbers, pasted implementation
  bodies, exact assertion text, staging recipes and speculative future edits —
  unless the item is itself a required invariant. A test count recorded as
  evidence that a case was collected is such an invariant; a count predicted
  before the code exists is not.
- **The ledger records rulings and completions, never what is running.** Write
  `<workspace>/dispatch-<agent id>.md` (plan, task, agent id, base sha, state)
  when you dispatch; delete it on completion. Compaction cannot reconstruct an
  unrecorded dispatch. `STATUS.md` owns which plan is active; these records only
  say what is running inside it, so one under a queued plan is a dispatch against
  the wrong plan (ADR-0010). A PreCompact hook snapshots git state and ledger
  tails to `.superpowers/sdd/checkpoint/` and re-injects dispatch state after
  compaction.
- Keep the root session through one substantial usable outcome or active phase;
  start a fresh root only at a major phase boundary, when the user asks, or when
  context is unreliable — `STATUS.md` is the handoff. In multi-agent mode the
  root orchestrates, workers implement disjoint tasks, and an independent
  reviewer checks contract and evidence, reporting findings to the root rather
  than changing process or environment.
- Before each completed task commit, **replace** `STATUS.md`'s "Last completed
  change" with a 1–5 bullet summary of that commit; never append older ones.
  Keep the file to current objective, active work, latest completed change, next
  steps and blockers/unverified only; run `npm run status:check` from `src/web/`.
  **The limit is bullet count, not line count** — 6/5/5/5 across active work,
  last completed change, next and blockers — and **one item per line, never
  wrapped**. A line cap was being gamed: each pass kept every fact and only
  re-wrapped the prose, so the file grew into a diary while every edit wasted
  tokens compressing it. Bullets bound how much there is to say; the one-line
  rule bounds each item, and forces the choice of what to drop at the moment of
  writing rather than in a rewrite pass.
- Judge a defect's size when you observe it. **File a bug issue** when any of
  these holds: the cause is not established; more than one owner could fix it;
  the fix needs a design decision; it spans subsystems; it blocks the active
  plan; it would need a spec rather than a task. **Fix it on the fly** when all
  of these hold: the cause is named with `file:line`, the fix sits inside one
  owner, the correct behaviour is already specified, a regression test is
  obvious, and no work is lost and no data misrepresented. Say which side you
  took and why, in the commit. **If a third attempt at the same defect fails,
  record it in the same commit and say what was tried** — the third failure is
  the trigger, not the absence of a record, so it survives compaction and a
  fresh root. **The register is
  [`docs/product/backlog.jsonl`](docs/product/backlog.jsonl)**, which is the source of
  truth for what is known, what is fixed and what is verified; a GitHub issue is
  an input surface for jotting an idea down, and never the register itself. Fill
  a row there — `npm run backlog:check` refuses a `verified` row whose check
  does not name the thing that was reported. A filed issue is pulled into the
  register when asked; an issue is closed with a comment naming the row and the
  check that ran, and the close reason alone records nothing. Do not duplicate a
  finding in specs, status or reports; plans may link it.
- A filed request is `undecided` until judged, and `covered` once the register
  owns it. An accepted request closes with a link to the spec, plan or row that
  now owns it; a declined one closes as `not planned` **and carries its reason in
  a closing comment** — the close reason alone says nothing, and a decision
  nobody can read is a decision lost. `STATUS.md` alone decides acceptance, so the
  queue keeps one owner. When an
  issue waits on a named plan or an unanswered decision, set `blocked` and say
  what it waits on.

## Architecture guardrails

- **One owner per concept.** Before any cross-cutting change, read
  `docs/architecture/ownership.md` and the existing owner before adding a type,
  key, default, action, route, helper, style property or schema value.
- `renderer-core` stays Fabric/DOM-free. The player may use `scene-fabric`, never
  editor UI/managers or an interactive `Canvas`.
- Fabric JSON is the persisted scene. No second simplified scene tree or
  write-back model.
- Persist authored state only. Telemetry, built ECharts options, playback,
  selection and viewport state are runtime/derived/transient, and raw ECharts
  options never enter persisted theme data.
- Providers acquire; the host owns scheduling, buffering and fallback. Missing or
  non-`ok` telemetry is never fabricated as zero/default data.
- Pre-release internal architecture may break cleanly; no compatibility glue
  solely to preserve superseded internal designs.

## Reuse before build

**Vigilia is a product, not a framework to rebuild the platform under.** The
default failure is not a hard bug — it is judging a problem "simple", writing it
from scratch, and discovering three tasks later that it was a rabbit hole that
someone else had already mapped. That is the expensive kind of wrong: it looks
like progress while it compounds, and the refactor to undo it costs more than the
search would have. **Explore first, always.** A capability that *exists* has
still not been discharged by existing.

**The gate is about integration, not existence.** "A native feature exists" is
not an answer, and neither is "we could write it ourselves". The question is
whether anyone has solved *this shape* of problem — in this renderer, against
this host, under these constraints — and what they learned doing it. A capability
that still needs sampling, ordering, invalidation, disposal and ownership
decisions is exactly the undischarged case, because **that is where the work is**.
Native APIs usually work, which is precisely why checking one is not the end of
the search.

A **mechanism boundary** is an owner where a wrong decision is expensive and
invisible — nothing fails, it just renders wrong or leaks. Watchlist:
`scripts/reuse-gate.mjs`.

Before designing a change to one, work all seven rungs (owner, dependencies,
platform, ecosystem, comparison, probe, build) and record each result, including
the rungs that found nothing. **Rung 3 passing does not discharge rungs 4–5** —
that conditional is what made the rule skippable.

Land a note at `docs/decisions/NNNN-<slug>.md` before the first write; the hook
refuses until one claims the path. Template, and what needs no note:
[`docs/decisions/README.md`](docs/decisions/README.md). **The searches are the
evidence** — a note listing three libraries without saying what was searched, or
that nobody solved this shape, is worth nothing.

## Code and files

- Navigate with CodeGraph first, when available, for ownership, callers/callees,
  dependency paths and blast radius; language-server navigation for definitions,
  references and diagnostics; targeted `rg`/grep for exact strings, config keys,
  generated text and as fallback when graph data is unavailable or stale. **Read
  the actual source before editing it** — graph results locate code, they do not
  replace inspection.
- Do not dump whole files, trees, giant diffs or full test logs into context when
  a focused query or range suffices.
- Before adding a shipped dependency, verify its licence from package metadata and
  update `THIRD-PARTY-NOTICES.md` and `docs/engineering/dependencies.md`.
- Do not hand-edit `src/web/package-lock.json` (change manifests, then
  `npm install`) or `src/web/packages/*/dist/**`.
- Follow surrounding naming/import style; avoid unrelated formatting churn. No
  licence headers in source files. No re-export wrappers after moves except
  package public barrels.
- Avoid generic folders such as `helpers`, `common`, `utils`, `internal` and
  `shared`; name by responsibility.
- 500 lines is a signal and 800 is a stop for normal source files; proven
  vendored source may be an explicit exception.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
  Refuse invalid numeric input rather than coercing it to zero.

## Verification requirements

Superpowers owns sequencing; these are Vigilia-specific evidence rules:

- Unit-test pure decisions and contracts; browser-test wiring and visible
  behaviour. Visible behaviour requires rendered/browser inspection, not only
  object counts or geometry assertions.
- A new regression test should fail when the fix is disabled before it is
  trusted.
- Use focused proof during implementation. Run the broad/full gate at the
  plan/milestone/merge boundary or for genuinely cross-cutting changes.
- Playwright previews built bundles; rebuild affected bundles after source
  changes and after reverting a deliberate break.
- Browser tests exercise the real host only where the test explicitly starts it.
- Screenshots are evidence, not cross-platform golden files.
- Report anything not actually verified.

## Commands

Run from `src/web/`; the scripts are `package.json`'s, so read them there rather
than trusting a copy. The one command that is not a script is the host:
`node packages/host/bin/vigilia.js --no-browser`, after building it. See
*Important traps*.

## Important traps

- Host binary is `vigilia-dashboard`; plain `vigilia` is unrelated on npm. Build
  the host before running `bin/vigilia.js`.
- Install Chromium with `npx playwright install chromium` if needed.
- Screenshot capture requires `VIGILIA_CAPTURE=1` and `--workers=1`; capture
  only affected actions registered in `docs/evidence/screenshots/README.md`.
- Vite 8 uses Rolldown; `manualChunks` must be a function.
- Use `fileURLToPath` for file URLs on Windows.
- Symlinks are not reliable in tracked content in this repo.
- Bare gitignore patterns match at any depth.
- In PowerShell, single-quote Playwright `--grep` values containing spaces or
  `|`.

## Git

- Check status before staging. Stage explicit paths; never `git add -A` or
  `git commit -a`.
- Never discard user changes or use destructive git commands without explicit
  instruction.
- Use Conventional Commit titles, and inspect selected visual evidence before
  staging it.
- Propagate a changed decision to contradictory current docs/tests together.
- Pushing, publishing and opening a PR are external actions.
- **Creating or updating a GitHub issue is also an external action**, and the user
  has authorised it for agents: file, edit, label and close issues as
  `AGENTS.md`'s bug rule requires without asking first. It is still an external
  action, so name it in the commit and keep every claim in the body supportable —
  a cause you have not established is written as "cause not established", not
  guessed. Anything beyond an issue — a release, a wiki edit, a transfer, or
  anything on a repo other than this one — still needs the user.

## Communication and brevity

Be concise and factual. Surface assumptions, blockers, reuse decisions and
unverified behaviour early. Report outcomes and evidence, not a transcript.
Write the shortest text that preserves a decision or invariant; comments are
normally 1–3 lines and explain **why**, not what the code says. Never write
diary-style comments, debugging chronology or implementation narratives into
source, and do not repeat the same rationale across specs/ADRs/architecture/
comments. Current docs describe current truth; Git stores the story.
