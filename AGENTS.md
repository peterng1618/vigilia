# AGENTS.md — Vigilia

Project-specific facts and guardrails for coding agents. **Superpowers is the
sole development-process owner**: use its brainstorming, design/spec, planning,
execution, review and verification workflows rather than creating a parallel
Vigilia process.

## Project

- Repo: `peterng1618/vigilia`; default branch `main`; integration branch
  `develop`; remote `origin`.
- TypeScript/npm workspace at `src/web/`, seven packages.
- Supported Node: 22.12+, 24, or 26+. Tests: Vitest + Playwright. Formatting and
  linting: Biome.
- No .NET or Python toolchain is required by Vigilia.
- Fabric 7.4.0 is the one scene renderer. The editor uses `fabric/es` directly;
  the player uses the shared `scene-fabric` layer.
- Editor shell: React 19 + Base UI + Tailwind. Fabric remains imperative behind
  the editor boundary; never mirror Fabric objects in React.

## Process and documentation

- **Start with `STATUS.md`.** A fresh session should be able to continue from it
  without a long user prompt; follow its active Superpowers spec/plan/SDD links.
- **Exactly one implementation plan is active.** `STATUS.md` names it; every
  other incomplete plan is queued. Never execute two plans concurrently.
- Parallel subagents may work only inside the active plan and active phase, on
  independent scopes with non-overlapping ownership.
- Plans are contracts, not scripts. Organize work into phases of 3–5 tasks.
  Each task should state the outcome, owning symbols/landmarks, constraints,
  acceptance or failure modes, and verification. Avoid brittle line numbers,
  pasted implementation bodies, exact assertion text, test counts for work not
  yet written, staging recipes and speculative future edits unless one is itself
  a required invariant. A count recorded as evidence that a case was collected
  is such an invariant; a count predicted before the code exists is not.
- **The agent environment is user-owned.** During product work, do not install,
  enable, disable, copy, edit or remove plugins, skills, hooks, MCP servers,
  Claude/Codex settings or `AGENTS.md` unless the user explicitly requests that
  exact environment change. Do not create project-local skills to improve the
  agent's own workflow.
- Keep the root session through one substantial usable outcome or active phase.
  Start a fresh root only at a major phase boundary, when the user asks, or when
  context/state is no longer reliable. `STATUS.md` is the handoff.
- In multi-agent mode, the root orchestrates; workers implement disjoint tasks;
  an independent reviewer checks the contract and evidence. Reviews report
  findings back to the root rather than changing process or environment.
- The ledger records rulings and completions, never what is running. Write
  `<workspace>/dispatch-<agent id>.md` (plan, task, agent id, base sha, state)
  when you dispatch and delete it on completion — compaction cannot reconstruct
  an unrecorded dispatch, and a plan counts as active only while it holds such a
  record (ADR-0010). A PreCompact hook snapshots git state and ledger tails to
  `.superpowers/sdd/checkpoint/` and re-injects the dispatch state after
  compaction.
- Before each completed task commit, **replace** `STATUS.md`'s "Last completed
  change" with a concise 1–5 bullet summary of what that commit achieved. Never
  append older commit summaries; GitHub already owns commit history.
- Keep `STATUS.md` to current objective, active work, latest completed change,
  next steps and blockers/unverified only. Maximum 70 lines; run
  `npm run status:check` from `src/web/`.
- Let Superpowers own the workflow and its artifacts.
- Designs/specs live in `docs/superpowers/specs/`.
- Executable plans live in `docs/superpowers/plans/`; completed/superseded
  plans move to `docs/superpowers/plans/archive/` once no active or queued plan
  depends on them.
- Do not create project workflow skills, alternate spec/plan directories, or duplicate Superpowers workflow instructions elsewhere in the repository.
- Durable project truth lives under `docs/`; see `docs/README.md` for the canonical map. Before cross-cutting changes, read `docs/architecture/ownership.md`.
- `§N` product-requirement markers are stable; never renumber them.

## Architecture guardrails

- **One owner per concept.** Check `docs/architecture/ownership.md` and the existing owner before adding a type, key, default, action, route, helper, style property or schema value.
- `renderer-core` stays Fabric/DOM-free.
- Player may use `scene-fabric`, never editor UI/managers or interactive
  `Canvas`.
- Fabric JSON is the persisted scene. Do not create a second simplified scene
  tree or write-back model.
- Persist authored state only. Telemetry, built ECharts options, playback,
  selection and viewport state are runtime/derived/transient.
- Raw ECharts options never enter persisted theme data.
- Providers acquire; the host owns scheduling, buffering and fallback.
- Missing/non-`ok` telemetry is never fabricated as zero/default data.
- Pre-release internal architecture may break cleanly; do not add compatibility
  glue solely to preserve superseded internal designs.

## Reuse before build

Vigilia is a product, not a general-purpose framework. Before implementing a
generic capability or substantial infrastructure:

1. Search Vigilia for an existing owner or partial implementation.
2. Inspect current direct/transitive dependencies.
3. Check the browser/Node/OS/platform API.
4. Search the relevant ecosystem for maintained libraries or reusable source.
5. Compare realistic options on fit, maintenance, licence, platform support,
   runtime/bundle cost and testability.
6. Run the smallest executable probe when behaviour is uncertain.
7. Build custom only when the alternatives are unsuitable; record why in the
   active Superpowers design/plan when the choice is non-obvious.

This gate applies especially to editor mechanics, hardware/OS integration,
networking, parsers/protocol clients, archives, media processing, persistence,
caches, schedulers, auth/security primitives and other generic infrastructure.
Do not reject a library merely because its API is unfamiliar.

## Code navigation

- Use CodeGraph/code intelligence first for ownership, callers/callees,
  dependency paths and blast-radius questions when available.
- Use language-server navigation for definitions, references and diagnostics.
- Use targeted `rg`/grep for exact strings, config keys, generated text and as
  fallback when graph/index data is unavailable or stale.
- Read the actual source before editing it. Graph results locate code; they do
  not replace source inspection.
- Avoid dumping whole files, trees, giant diffs or full test logs into agent
  context when a focused query/range is enough.

## Brevity

- Write the shortest text that preserves a decision or invariant.
- Comments are normally 1–3 lines and explain **why**, not what the code says.
- Never write diary-style comments, debugging chronology or long implementation
  narratives into source.
- Do not repeat the same rationale across specs/ADRs/architecture/comments.
- Current docs describe current truth. Git stores the story.

## Verification requirements

Superpowers owns sequencing; these are Vigilia-specific evidence rules:

- Unit-test pure decisions and contracts; browser-test wiring and visible
  behaviour.
- A new regression test should fail when the fix is disabled before it is
  trusted.
- Visible behaviour requires rendered/browser inspection, not only object counts
  or geometry assertions.
- Use focused proof during implementation. Run the broad/full gate at the
  plan/milestone/merge boundary or for genuinely cross-cutting changes.
- Playwright previews built bundles; rebuild affected bundles after source
  changes and after reverting a deliberate break.
- Browser tests exercise the real host only where the test explicitly starts it.
- Screenshots are evidence, not cross-platform golden files.
- Report anything not actually verified.

## Commands

Run from `src/web/`:

| Task | Command |
|---|---|
| Install | `npm install` |
| Unit tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Build all | `npm run build` |
| Format check | `npm run format:check` |
| Lint | `npm run lint` |
| Player size gate | `npm run size` |
| Browser tests | `npm run test:e2e` |
| Run host | `node packages/host/bin/vigilia.js --no-browser` |

Prefer workspace scripts and focused test paths over hand-written broad command
lists.

## Dependencies and files

- Before adding a shipped dependency, verify its licence from primary/package
  metadata and update `THIRD-PARTY-NOTICES.md` plus
  `docs/engineering/dependencies.md` when required.
- Do not hand-edit `src/web/package-lock.json`; change manifests then run
  `npm install`.
- Do not hand-edit `src/web/packages/*/dist/**`.
- Follow surrounding naming/import style; avoid unrelated formatting churn.
- No licence headers in source files.
- No re-export wrappers after moves except package public barrels.
- Avoid generic folders such as `helpers`, `common`, `utils`, `internal`
  and `shared`; name by responsibility.
- 500 lines is a signal and 800 is a stop for normal source files. Proven
  vendored source may be an explicit exception.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
- Refuse invalid numeric input rather than coercing it to zero.

## Important traps

- Host binary is `vigilia-dashboard`; plain `vigilia` is unrelated on npm.
- Build the host before running `bin/vigilia.js`.
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
- Use Conventional Commit titles.
- Inspect selected visual evidence before staging it.
- Propagate a changed decision to contradictory current docs/tests together.
- Pushing, publishing and opening a PR are external actions.

## Communication

Be concise and factual. Surface assumptions, blockers, reuse decisions and
unverified behaviour early. Report outcomes and evidence, not a transcript.
