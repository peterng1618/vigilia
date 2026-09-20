# Web Quality Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic TypeScript/JSON/CSS formatting and static linting to the web workspace and CI.

**Architecture:** A root `biome.json` owns the supported file selection and the existing two-space formatting convention. `src/web/package.json` exposes all local actions; CI calls only read-only scripts so it enforces the exact local gate.

**Tech Stack:** Biome 2.5.14, npm workspaces, GitHub Actions.

**Spec:** `.agents/specs/0015-web-quality-tooling.md`

## Global Constraints

- Add only `@biomejs/biome@2.5.14`; record its MIT OR Apache-2.0 licence in both dependency inventories.
- Format TypeScript, JSON and CSS only; do not add a Markdown/YAML formatter or Git hooks.
- Preserve generated output exclusion and existing `.editorconfig` ownership.
- Stage explicit paths and commit the implementation and baseline formatting together.

## Review Focus

None. `format:check` and `lint` directly exercise the tool configuration, source selection and non-mutating CI contract in Task 1.

---

### Task 1: Biome workspace gate

**Files:**
- Create: `biome.json`
- Modify: `src/web/package.json`, `src/web/package-lock.json`, `.github/workflows/ci.yml`, `THIRD-PARTY-NOTICES.md`, `.agents/dependency-licences.md`, TypeScript/JSON/CSS files formatted by Biome, `.agents/status.md`

**Interfaces:**
- Consumes: npm workspace scripts, root `.editorconfig`, CI's `src/web` working directory.
- Produces: `npm run format`, `npm run format:check`, `npm run lint`, and `npm run lint:fix`.

- [ ] **Step 1: Verify a clean preflight**

Run before creating task files:

```powershell
git status --short
```

Expected: no output. Otherwise stop so unrelated changes cannot enter the
baseline-formatting commit.

- [ ] **Step 2: Add the exact tool dependency and licence inventory**

Run from `src/web`:

```powershell
npm install --save-dev --save-exact @biomejs/biome@2.5.14
```

Add `@biomejs/biome` version `2.5.14`, licence `MIT OR Apache-2.0`, and role
`format/lint` to `.agents/dependency-licences.md`; add it to the declared
development-dependency sentence in `THIRD-PARTY-NOTICES.md`.

- [ ] **Step 3: Add the root configuration and workspace scripts**

Create `biome.json`:

```json
{
  "$schema": "./src/web/node_modules/@biomejs/biome/configuration_schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "includes": ["src/web/**/*.ts", "src/web/**/*.json", "src/web/**/*.css"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 },
  "linter": { "enabled": true, "rules": { "recommended": true } }
}
```

Add these `src/web/package.json` scripts, which resolve the root config from
the workspace directory:

```json
"format": "biome format --write ..",
"format:check": "biome format ..",
"lint": "biome lint ..",
"lint:fix": "biome lint --write .."
```

- [ ] **Step 4: Establish the approved formatting baseline**

Run:

```powershell
npm run format
```

Keep all resulting TypeScript/JSON/CSS formatting changes in this task. Do not
reformat Markdown or YAML.

- [ ] **Step 5: Enforce the same read-only checks in CI**

Insert two `frontend` workflow steps immediately after `npm ci` and before
Typecheck:

```yaml
- name: Format check
  run: npm run format:check

- name: Lint
  run: npm run lint
```

- [ ] **Step 6: Verify the tool gate and unaffected compiler contract**

Run from `src/web`:

```powershell
npm run format:check
npm run lint
npm run typecheck
```

All commands must exit `0`. Update `.agents/status.md` with this evidence and
the known scope: Biome does not check Markdown or YAML.

- [ ] **Step 7: Commit the focused slice**

```powershell
git diff --name-only -z -- src/web | git add --pathspec-from-file=- --pathspec-file-nul
git add -- biome.json .github/workflows/ci.yml THIRD-PARTY-NOTICES.md .agents/dependency-licences.md .agents/status.md
git commit -m "build: add Biome quality checks"
```
