# Web quality tooling design

## Goal

Give the `src/web` workspace deterministic formatting and narrow static linting
without commit hooks or a broad style-rule catalog.

## Scope

Biome is the sole formatter and linter. It checks TypeScript, JSON, YAML,
Markdown, CSS and GitHub workflow files. It ignores generated output and
dependencies. `.editorconfig` remains the editor baseline.

The workspace exposes `format`, `format:check`, `lint` and `lint:fix` scripts.
CI runs the read-only checks after dependency installation and before typecheck.
Contributors and agents run the same scripts explicitly; no Git hooks are
installed.

## Rules

Formatting is delegated to Biome. Linting starts with Biome's recommended rules
and correctness-focused checks only. The initial adoption does not mass-reformat
the repository; formatting existing files is an explicit later change.

## Verification

`npm run format:check` and `npm run lint` must pass locally and in CI. Existing
typecheck, unit, build, size, and browser gates remain unchanged.
