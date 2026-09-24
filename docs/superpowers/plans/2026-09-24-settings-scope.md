# Settings scope implementation plan

> **For agentic workers:** execute task-by-task, committing after each task.

**Goal:** Global settings describe this PC and never depend on a theme;
theme-specific settings are the questions a theme raises, asked once and
remembered.

**Spec:** `docs/superpowers/specs/2026-09-24-settings-scope.md`

## Global Constraints

- Global settings must render identically whatever theme is active. Nothing in
  the Global section may read the active theme.
- `required-devices.ts` serves the theme-specific section only.
- Resolution stays one path: theme answer → global answer → provider default.
- Both sections loopback-only; the page stays dependency-free HTML from source.
- No new schema or settings framework.
- Visible changes need rendered inspection plus the full local browser suite.

## Evidence already gathered

| Observed | How |
|---|---|
| Filtering global groups by the active theme hid a machine-level setting | Choosing a theme reading no disks hid the disk groups |
| The derivation works | `disk-only` asked only for a system disk; `cpu-only` asked nothing |
| Device settings already persist per host | Restarted hosts kept assignments |

## File Structure

| Path | Responsibility |
| --- | --- |
| `host/src/settings/devices.ts` | Global assignments and names (existing) |
| `host/src/settings/theme-settings.ts` | Per-theme answers, keyed by theme id |
| `host/src/settings/theme-settings.test.ts` | Persistence, override, absence |
| `host/src/settings/required-devices.ts` | Which slots a theme reads (existing) |
| `host/src/server.ts` | Serve and accept per-theme answers |
| `host/public/settings.html` | Global section; theme questions on first selection |

## Tasks

### Task 1 — Per-theme answers, stored

- [x] `theme-settings.ts`: read and write one answers object per theme id,
      validating groups and ids the way the global store does.
- [x] Tests: absent reads as nothing; a round-trip persists; unknown groups and
      unsafe ids are dropped; a theme deleted leaves no stale answers.
- [x] Commit.

### Task 2 — Show global settings unaffected by the theme

- [x] The Global section renders every slot the machine has, whatever theme is
      active, and states that these apply to every theme unless a theme overrides
      them.
- [x] Tests: the same groups appear with no theme, a theme reading nothing, and a
      theme reading one slot.
- [x] Commit.

### Task 3 — Ask a theme's questions when it is first chosen

- [x] Choosing a theme with requirements and no stored answers opens them: only
      the slots it reads, one question each, with the global answer shown as the
      default.
- [x] A theme needing nothing shows no questions; a theme already answered shows
      none.
- [x] Tests: each of those four states.
- [x] Rendered proof of each, inspected.
- [x] Commit.

### Task 4 — Resolve theme over the global answer

- [x] Resolution reads theme answer → global answer → provider default, at the
      one existing assignment boundary.
- [x] Tests: a theme override changes its own samples and leaves another theme's
      alone; an unanswered theme follows the global choice.
- [x] Commit.

### Task 5 — Integration proof

- [x] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [x] Full local `npm run test:e2e`.
- [x] Capture and inspect the four states from Task 3 plus the Global section.
- [x] Update `.agents/status.md`, `.agents/architecture.md` and the spec.
- [x] Commit.

## Self-Review

- Spec coverage: Task 1 is storage, 2 the global invariant, 3 the asking, 4 the
  resolution, 5 the proof.
- Ownership: two stores under one folder, one resolution boundary, one page.
- Risk: the default-and-override rule. Task 4 asserts both directions — an
  override affects only its theme, and an unanswered theme follows the global.
