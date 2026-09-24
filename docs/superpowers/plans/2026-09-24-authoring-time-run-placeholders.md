# Authoring-time run placeholders implementation plan

> **For agentic workers:** execute task-by-task, committing after each task.

**Goal:** While authoring, a value run shows which data it is, instead of an
indistinguishable `—` or a live number.

**Spec:** `docs/superpowers/specs/2026-09-24-authoring-time-run-placeholders.md`

## Global Constraints

- Editor surface only. The player never shows a token name, and the envelope is
  unchanged: this is transient editor state (§67).
- No new persisted field; the mode is editor transient, like selection.
- The binding picker stays the only way a binding is chosen (§93).
- Switching mode produces no history entry and no dirty state.
- Copy in `ui-copy.ts` (§35); the control has an accessible name.
- Visible changes need rendered inspection plus the full local browser suite.

## Evidence already gathered

| Observed | Where |
|---|---|
| A value run renders `—` or a value, never its token | `resolveTextSegments` returns `MISSING_VALUE_TEXT` for both an undeclared binding and an unmapped sensor |
| The two failure states are indistinguishable | Same constant used for both |
| The editor already has a preview/live switch | `editor-main.ts`'s data-source control |

## File Structure

| Path | Responsibility |
| --- | --- |
| `editor/src/run-placeholder.ts` | The mode, and the text a value run shows in it |
| `editor/src/run-placeholder.test.ts` | Substitution and the three distinct states |
| `editor/src/live-runtime.ts` | Paints runs in the authoring mode |
| `editor/src/editor-main.ts` | The View-menu control; no persisted state |
| `editor/src/ui-copy.ts` | The control's label and the placeholder copy |

## Tasks

### Task 1 — The placeholder rule

- [ ] `run-placeholder.ts`: given a run and the bindings, return the authoring
      text — the token for a resolvable binding, a marked form for a declared-but-
      unmapped one, and a distinct form for a run with no binding.
- [ ] Tests: the three states are pairwise distinct; a resolvable run shows its
      semantic key prefixed; nothing reads as a number.
- [ ] Commit.

### Task 2 — Paint runs in the authoring mode

- [ ] The editor's runtime applies the placeholder to value runs instead of a
      sample, in both data modes, for the editor canvas only.
- [ ] Tests: the editor canvas shows placeholders; the run list still names each
      run; toggling back restores values.
- [ ] Rendered proof: a bound run shows `@cpu.temp`, an unmapped one shows the
      marked form, and the persisted envelope is unchanged after both.
- [ ] Commit.

### Task 3 — The control

- [ ] View menu (or the source control's neighbourhood) gains a "Value runs:
      tokens / values" choice, defaulting to tokens, remembered for the session
      only.
- [ ] Tests: the default is tokens; switching changes the canvas and adds no
      history entry and no dirty state.
- [ ] Commit.

### Task 4 — Prove the display is untouched

- [ ] Through the real host, a player loading the same theme shows values or
      gaps, never a token name, in both editor modes.
- [ ] Tests: the existing host-player spec covers the value path; add the token
      case.
- [ ] Commit.

### Task 5 — Integration proof

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [ ] Full local `npm run test:e2e`.
- [ ] Capture and inspect all three authoring states, and the same theme in the
      player.
- [ ] Update `.agents/status.md`, `.agents/architecture.md` (the new owner) and
      the spec.
- [ ] Commit.

## Self-Review

- Spec coverage: Task 1 is the rule, 2 the editor render, 3 the control, 4 the
  display boundary, 5 the proof.
- Ownership: the mode lives in the editor; `scene-fabric` gains a switch the
  player never sets; no envelope change.
- Risk: leaking into the display. Task 4 exists solely to catch that, through the
  host rather than a bundle preview.
