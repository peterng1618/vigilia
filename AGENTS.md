# AGENTS.md — Vigilia

Operating rules for coding agents. Project design lives in `.agents/`; keep this
file about how to work.

## Project

- Repo: `peterng1618/vigilia`; default branch `main`; remote `origin`.
- TypeScript throughout, one npm workspace at `src/web/`, six packages.
- Node 22.12+, 24, or 26+. Tests: Vitest + Playwright.
- No .NET or Python toolchain is required.
- No component framework is currently used. Add one only if the editor work
  clearly benefits from it.

## Non-negotiables

- **One owner per concept.** Search before adding a type, key, default, action,
  helper, route, style property, or schema value. Reuse or move the owner; do not
  duplicate it. Record new owners in `.agents/architecture.md`.
- **Prefer mechanisms to reminders.** Derive, type-check, or test invariants
  instead of writing “keep these in sync”.
- **Fix root causes.** Avoid compatibility glue that exists only to preserve an
  obsolete internal architecture.
- **Report unverified behaviour plainly.** Code inspection is not runtime proof.
- **Use libraries for generic editor mechanics.** Vigilia owns telemetry,
  semantic bindings, theme semantics and chart behaviour; it should not rebuild
  a general-purpose graphics editor.

## Brevity rules

These are constraints, not style suggestions.

- Write the **shortest text that preserves the decision or invariant**.
- Do not narrate debugging history in code comments or current-state docs. Git
  already stores history.
- Do not repeat rationale across `status.md`, a spec, `decisions.md` and source
  comments. Put it in the single document that owns it and link there.
- Code comments are **1–3 lines by default**. Longer comments are only for a
  non-obvious invariant, API trap or measured constraint. A comment over 8 lines
  should usually become a test name, helper name, or doc reference instead.
- Comments explain **why**, never restate what the code does.
- Specs describe current behaviour, edge cases, acceptance and out-of-scope.
  They are not session diaries. Target **≤400 lines / ≤20 KB**. If an edited spec
  is much larger, compact it before adding more.
- `status.md` is a handoff, not a changelog. Keep only current state, next work,
  blockers and unverified items. Target **≤250 lines**.
- A decision entry should normally be one short paragraph plus bullets for
  consequences/reopening conditions. Reversed reasoning stays in git history.
- Do not paste sabotage/debug narratives into docs. State the conclusion and the
  test that guards it.
- Before committing prose, remove duplicated explanation and stale chronology.

## Change workflow

1. Read the relevant design section, spec, decision and ownership entry.
2. If a persisted shape changes, update its schema and version policy.
3. Implement at the existing owner/boundary.
4. Add or update tests at the nearest useful layer.
5. For visible work, render it and inspect it.
6. Run `vigilia:verify`.
7. Update `.agents/status.md` with current evidence only.
8. Commit focused paths.

## Commands

Run from `src/web/`:

| Task | Command |
|---|---|
| Install | `npm install` |
| Unit tests | `npm test` |
| Typecheck all workspaces | `npm run typecheck` |
| Build all | `npm run build` |
| Build one bundle | `npx vite build packages/player` (or `editor`, `host`) |
| Player size gate | `npm run size` |
| Browser tests | `npm run test:e2e` |
| Run host | `node packages/host/bin/vigilia.js --no-browser` |
| Dev bundle | `npx vite dev packages/player` (or `editor`) |

Prefer workspace scripts over hand-written project lists.

## Important traps

- The host bin is `vigilia-dashboard`; plain `vigilia` is an unrelated npm
  package.
- The host must be built before `bin/vigilia.js` can run.
- Playwright previews built bundles. Rebuild after source changes and after
  reverting a deliberate test break.
- Install the expected Chromium with `npx playwright install chromium` if
  Playwright reports a missing browser.
- Screenshot capture requires `VIGILIA_CAPTURE=1` and `--workers=1`.
- Vite 8 uses rolldown; `manualChunks` must be a function.
- Use `fileURLToPath` for file URLs on Windows.
- Symlinks are not reliable in this repo.
- Bare gitignore patterns match at any depth.

## Testing

- Unit-test pure decisions; browser-test wiring and visuals.
- **Disable a fix and re-run before trusting a new regression test.**
- When visual behaviour changes, inspect the rendered result; object counts and
  geometry alone do not prove pixels are correct.
- The browser suite previews bundles directly and does **not** exercise the host.
- Do not invent pixel-baseline claims across OSes; screenshots are evidence, not
  cross-platform golden files.

## Code structure

- Follow surrounding naming and import style; avoid unrelated formatting churn.
- No licence headers in source files.
- No re-export wrappers after moves. Package public barrels are the exception.
- Avoid generic folders such as `helpers`, `common`, `utils`, `internal`, or
  `shared`; name by responsibility.
- **500 lines is a signal, 800 is a stop** for source files. Split before adding
  to an oversized file unless there is a strong reason not to.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
- Refuse invalid numeric input rather than coercing it to zero.

## Files not to hand-edit

| File | Do instead |
|---|---|
| `src/web/package-lock.json` | Change manifests, then `npm install` |
| `src/web/packages/*/dist/**` | Build output |
| `.claude/plugins/vigilia/skills/*/SKILL.md` | Edit `.agents/skills/<name>/SKILL.md` |
| `.agents/design/environment-setup.md` | User-authored; propose changes only |

## Dependencies

Before adding a dependency, add its verified licence to
`THIRD-PARTY-NOTICES.md`. CI derives external dependency names from workspace
manifests and checks for notice entries.

For the Fabric editor migration, `../fabricjs-image-editor` is already cloned as
source beside Vigilia. Evaluate it as source/a potential permanent fork, not only
through its published package surface.

## Documentation ownership

| Content | Owner |
|---|---|
| Current state / next / unverified | `.agents/status.md` |
| Architecture and ownership | `.agents/architecture.md` |
| Feature behaviour and edge cases | `.agents/specs/` |
| Current architectural decisions | `.agents/decisions.md` |
| Durable lessons | `.agents/lessons.md` |
| Product requirements | `.agents/design/plan.md` |

`§N` markers in `plan.md` are stable labels, not line numbers. Never renumber.

## Sub-agents

Use sub-agents for independent work that can run in parallel: source audits,
library investigation, isolated tests, or documentation checks. Keep shared
contracts and overlapping files under one agent. The primary agent integrates
results and owns architectural decisions.

## Git and commits

- Check `git status` before staging. Stage explicit paths; never `git add -A` or
  `git commit -a`.
- Never discard user changes or use destructive git commands without explicit
  instruction.
- Update `.agents/status.md` before commit/push.
- Use Conventional Commit titles.
- Pushing and opening a PR are external actions.
- Propagate a decision change to contradictory docs, comments and tests in the
  same commit.

## Review boundary

Seek human review for scope expansion, product taste, publishing, LAN exposure,
licensing changes and other external effects. Architecture, schema design and
sequencing are agent-owned unless the user has already directed them.

## Skills

Canonical skills live in `.agents/skills/`; Claude plugin files are pointers.

- Before commit/push: `vigilia:verify`.
- Review: `vigilia:code-review`.
- PR: `vigilia:create-pr`.
- Lasting decision: `vigilia:write-adr`.
- Measurement/evidence: `vigilia:gate-evidence`.
- Work covered by a spec: `vigilia:spec-driven-development`.

## Communication

Be concise and factual. Surface assumptions and blockers early. State what was
not verified.