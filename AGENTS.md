# AGENTS.md — Vigilia

Operating rules for coding agents. Product/design state lives in `.agents/`;
keep this file about how to work.

## Project

- Repo: `peterng1618/vigilia`; default branch `main`; remote `origin`.
- TypeScript/npm workspace at `src/web/`, six packages.
- Node 22.12+, 24, or 26+. Tests: Vitest + Playwright.
- No .NET or Python toolchain is required.
- Fabric 7.4.0 is the shared scene renderer; the editor uses the adopted
  `fabricjs-image-editor` source fork.
- The current Vigilia shell is TypeScript/Vite, not React. React + shadcn/Base UI
  is a later shell-modernization stage in plan §35, not a current dependency.

## Non-negotiables

- **One owner per concept.** Search before adding a type, key, default, action,
  helper, route, style property or schema value. Reuse/move the owner; record
  new owners in `.agents/architecture.md`.
- **Prefer mechanisms to reminders.** Derive, type-check or test invariants.
- **Fix root causes.** Do not add compatibility glue for obsolete internal
  architecture.
- **Report unverified behaviour plainly.** Source inspection is not runtime
  proof.
- **Use libraries for generic editor mechanics.** Vigilia owns telemetry,
  semantic bindings, theme semantics and charts, not a general graphics editor.

## Brevity rules

- Write the shortest text that preserves the decision/invariant.
- Git stores history. Current docs do not narrate old attempts or debugging.
- Do not repeat rationale across status/specs/decisions/source comments.
- Code comments are 1–3 lines by default and explain why, not what.
- `status.md` is current handoff only; target ≤250 lines.
- Active specs describe incomplete/current behaviour, edge cases and acceptance,
  not completed history. Remove completed/superseded specs after durable rules
  move to plan/architecture/tests. Do not keep a historical spec archive merely
  because it once existed.
- Spec 0014 is explicitly a **review backlog**, not accepted requirements.
- Before committing prose, remove duplicated explanation and stale chronology.

## Change workflow

1. Read the relevant plan section, active spec, decision and ownership entry.
2. If a persisted shape changes, update schema/version policy.
3. Implement at the existing owner/boundary.
4. Add/update tests at the nearest useful layer.
5. Render and inspect visible changes.
6. Run `vigilia:verify`.
7. Update `.agents/status.md` with current evidence only.
8. Commit focused paths.

## Commands

Run from `src/web/`:

| Task | Command |
|---|---|
| Install | `npm install` |
| Unit tests | `npm test` |
| Typecheck | `npm run typecheck` |
| Build all | `npm run build` |
| Build one bundle | `npx vite build packages/player` (or `editor`, `host`) |
| Player size gate | `npm run size` |
| Browser tests | `npm run test:e2e` |
| Run host | `node packages/host/bin/vigilia.js --no-browser` |
| Dev bundle | `npx vite dev packages/player` (or `editor`) |

Prefer workspace scripts over hand-written project lists.

## Important traps

- Host binary is `vigilia-dashboard`; plain `vigilia` is unrelated on npm.
- Build the host before running `bin/vigilia.js`.
- Playwright previews built bundles. Rebuild after source changes and after
  reverting a deliberate test break.
- Install Chromium with `npx playwright install chromium` if needed.
- Screenshot capture requires `VIGILIA_CAPTURE=1` and `--workers=1`; capture
  only affected visual actions from `.agents/screenshots/README.md`.
- Vite 8 uses Rolldown; `manualChunks` must be a function.
- Use `fileURLToPath` for file URLs on Windows.
- Symlinks are not reliable in tracked content in this repo.
- Bare gitignore patterns match at any depth.

## Windows terminal methods

- Keep commands rooted at the current working directory; do not repeat `src/web/`
  after changing into it.
- Quote Playwright `--grep` values with single quotes in PowerShell so spaces
  and `|` reach Playwright unchanged.
- The PowerShell `apply_patch.bat` wrapper does not preserve multiline patch
  arguments. Invoke its underlying `codex.exe --codex-run-as-apply-patch` with
  a UTF-8 patch file when a Windows patch must span lines.

## Testing

- Unit-test pure decisions; browser-test wiring and visuals.
- **Disable a fix and re-run before trusting a new regression test.**
- Visible behaviour requires rendered inspection, not only geometry/object counts.
- Browser E2E previews bundles directly and does **not** exercise the host.
- Screenshots are evidence, not cross-platform golden files.

## Code structure

- Follow surrounding naming/import style; avoid unrelated formatting churn.
- No licence headers in source files.
- No re-export wrappers after moves except package public barrels.
- Avoid generic folders such as `helpers`, `common`, `utils`, `internal`,
  `shared`; name by responsibility.
- 500 lines is a signal, 800 is a stop for source files.
- `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are enabled.
- Refuse invalid numeric input instead of coercing it to zero.

## Files not to hand-edit

| File | Do instead |
|---|---|
| `src/web/package-lock.json` | Change manifests, then `npm install` |
| `src/web/packages/*/dist/**` | Build output |
| `.claude/plugins/vigilia/skills/*/SKILL.md` | Edit `.agents/skills/<name>/SKILL.md` |
| `.agents/design/environment-setup.md` | User-authored methodology; change only on explicit request |

## Dependencies

Before adding a dependency, update `THIRD-PARTY-NOTICES.md` and verify its
licence from primary/package metadata. The editor consumes the compiled
`peterng1618/fabricjs-image-editor` Git fork. Keep it on the same pinned
`fabric/es` runtime as `scene-fabric`.

## Documentation ownership

| Content | Owner |
|---|---|
| Current state / next / unverified | `.agents/status.md` |
| Architecture and ownership | `.agents/architecture.md` |
| Incomplete feature behaviour | `.agents/specs/` |
| Legacy behaviours pending re-evaluation | `.agents/specs/0014-editor-behaviour-review.md` |
| Current architectural decisions | `.agents/decisions.md` |
| Durable lessons | `.agents/lessons.md` |
| Product requirements | `.agents/design/plan.md` |
| Implementation plans | `docs/superpowers/plans/` |

`§N` markers in `plan.md` are stable labels. Never renumber them.

## Sub-agents

Use sub-agents for independent source audits, library investigation, isolated
tests or documentation checks. Keep shared contracts and overlapping files under
one agent. The primary agent integrates results and owns architecture.

## Git and commits

- Check status before staging. Stage explicit paths; never `git add -A` or
  `git commit -a`.
- Inspect each selected visual-evidence artifact before staging its capture.
- Never discard user changes or use destructive git commands without explicit
  instruction.
- Update `.agents/status.md` before commit/push.
- Use Conventional Commit titles.
- Pushing/opening a PR are external actions.
- Propagate a decision change to contradictory docs/comments/tests together.

## Review boundary

Seek human review for scope expansion, product taste, publishing, LAN exposure,
licensing changes and other external effects. Architecture, schema design and
sequencing are agent-owned unless the user already directed them.

## Skills

Canonical skills live in `.agents/skills/`; Claude plugin files are pointers.
Before commit/push use `vigilia:verify`. Other available skills cover review,
PRs, lasting decisions, evidence and spec-driven development.

## Communication

Be concise and factual. Surface assumptions/blockers early. State what was not
verified.
