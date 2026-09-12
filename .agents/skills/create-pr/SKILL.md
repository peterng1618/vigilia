---
name: vigilia:create-pr
description: Creates a pull request for Vigilia with a Conventional Commit title and the repo's Why/What/Testing body. Use when opening a PR, submitting changes for review, or asked to push a branch and raise a pull request.
---

# Creating a Vigilia pull request

## Before anything: check the repo actually has a remote

```bash
git remote -v
```

**At the time of writing there is no remote and no commits.** If that is still
true, a PR is impossible — say so and stop. Do not create a GitHub repository or
push anywhere without the user explicitly asking; publishing is theirs to
authorise.

`gh` is **not installed** on this machine. If a remote exists, either use the
GitHub web UI or ask before installing tooling.

## Commit convention

**Conventional Commits.** Not enforced — there are no git hooks in this repo and
no CI title check — so correctness is on you.

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Scopes that match the architecture: `contracts`, `core`, `host`, `providers`,
`platform`, `renderer`, `player`, `editor`, `schema`, `docs`, `agents`.

```
feat(providers): add PawnIO tier detection to the Windows provider
fix(renderer): draw a gap instead of a zero arc for missing samples
docs(gates): record G0-P1 per-sensor elevation results
```

Subject in the imperative, no trailing period, under ~72 characters.

## Branch

Branch from `main`. Never commit directly to `main` — if you are on it, branch
first.

```
<type>/<short-kebab-description>
```

## PR body

The repo has no PR template, so use this structure:

```markdown
## Why
The problem or requirement. Cite design-document sections (§NN) where they apply.

## What
The change, in the order a reviewer should read it. Call out anything touching
the contract mirror, the theme schema, or a boundary.

## Testing
Exact commands run and their results. State plainly what you did **not** run —
per §33, untested behaviour must be reported, and the .NET side currently cannot
be built at all without an SDK.

## Risk
Blast radius. Whether a theme saved under the previous schema still loads.
Whether both sides of the contract mirror changed.
```

## Before opening

- [ ] Frontend: `npx vitest run`, both `tsc --noEmit` projects, `vite build packages/player`, `check-size.mjs` — all from `src/web/`
- [ ] .NET: build and test **if an SDK exists**; otherwise say so explicitly
- [ ] Contract mirror changed on **both** sides if either changed
- [ ] New dependency added to `THIRD-PARTY-NOTICES.md` with its licence verified from the package's own metadata
- [ ] `schemaVersion` considered if the theme schema changed
- [ ] Measurements recorded in `docs/gates/`, decisions in `docs/decisions/`

## Hygiene

- Never include secrets, tokens, weather coordinates or device tokens in a diff,
  a test fixture, or a PR body (§143).
- For a security-relevant fix, describe the fix without a working exploit recipe.
- Human review is required for schema breaks, major dependency changes, and
  scope expansion (§164). Flag these in the PR body rather than assuming.

Attribution lines for commits and PR bodies come from the session's own
instructions — follow those, not a copy pasted here.
