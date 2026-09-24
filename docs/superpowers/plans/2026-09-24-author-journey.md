# Author Journey Implementation Plan

> **For agentic workers:** execute task-by-task, committing after each task.

**Goal:** An author can style what they selected and edit text in place, using
the document model as it already stands.

**Spec:** `docs/superpowers/specs/2026-09-24-author-journey.md`

**Predecessor:** `2026-09-24-authoring-and-consumer-polish.md`, whose Task 1
(selection geometry) has landed.

## Global Constraints

- Every write goes through `EditorInteraction` and the existing palette/type
  owners; no second resolution path.
- The envelope is unchanged: text runs already carry `typePreset` and a `style`
  map, and Fabric objects already carry opacity and alignment-relevant state.
- One history entry per committed edit; no runtime or derived state in it (§67).
- Text alignment (within a text box) and object alignment (`arrange.ts`) stay
  apart; neither gains the other's owner.
- Copy in `ui-copy.ts` (§35); every control has an accessible name.

## Evidence already gathered

| Observed | Evidence |
|---|---|
| No text styling controls | `bold`, `italic`, `font size`, `font family`, `align` all absent from the editor DOM |
| The preset fields are not the object's | The `line height`/`letter spacing` inputs belong to the type-preset panel |
| No in-place editing | Double-clicking a text object leaves `querySelector("textarea")` null |
| The Style tab is a sentence | "Colours and type resolve through the theme palette and type presets." |

## File Structure

| Path | Responsibility |
|---|---|
| `editor/src/selection-inspector/appearance.ts` | Opacity, preset reference and text fields over the selection |
| `editor/src/selection-inspector/appearance.dom.test.ts` | Field behaviour, persistence and refusal |
| `editor/src/selection-inspector/resolved.ts` | Read-only resolution of a reference for display |
| `editor/src/selection-inspector/index.ts` | Composes geometry (landed) with appearance and text |
| `editor/src/editor-shell/shell-layout.tsx` | Style tab renders the appearance section |
| `editor/src/new-object-panel.ts` (unchanged) | Text creation stays here |

## Tasks

### Task 1 — Opacity, with the resolution shown

- [ ] Opacity field (0–100 % shown, 0–1 stored) writing through Fabric with one
      history entry.
- [ ] A read-only resolution line for the selection's palette reference, using
      the palette owner to resolve — not a new resolver.
- [ ] Tests: the field shows the object's opacity; committing changes it and
      records one entry; a value outside the range is refused.
- [ ] Commit.

### Task 2 — Text object fields

- [ ] For a text selection: alignment, wrap and overflow, written to the object's
      text content and persisted.
- [ ] The object's type-preset reference, plus a control that reveals the
      existing type-preset panel (no duplicated fields).
- [ ] Tests: each field persists through save/reopen; a non-text selection shows
      none of them.
- [ ] Commit.

### Task 3 — Text editing in place

- [ ] Double-click enters Fabric's text editing; Escape and blur commit, with
      exactly one history entry for the edit.
- [ ] Tests: entering and committing records one entry; a non-text object
      ignores the gesture; undo restores the previous text.
- [ ] Rendered proof: type into an object, commit, and capture the result.
- [ ] Commit.

### Task 4 — Run-level styling

- [ ] A run list for a text selection, showing each run's text, its preset
      reference and whether it carries overrides.
- [ ] Editing a run's preset or an override writes the run's `style` map the
      model already defines, with one history entry.
- [ ] Tests: a run change round-trips through save/reopen; clearing an override
      returns the run to its preset.
- [ ] Commit.

### Task 5 — The Style tab

- [ ] Replace the placeholder sentence with the appearance section, and the
      document's globals when nothing is selected.
- [ ] Tests: a selection shows its resolved paint and type; no selection lists
      the globals.
- [ ] Commit.

### Task 6 — Integration proof

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [ ] Full local `npm run test:e2e`.
- [ ] Capture and inspect each state: shape, text, run, chart, none.
- [ ] Inspect the **persisted envelope** after save/reopen for each change, not
      only the live DOM.
- [ ] Update `docs/architecture/README.md` / `docs/architecture/ownership.md` and the spec.
- [ ] Commit.

## Self-Review

- Spec coverage: Tasks 1–2 are object appearance, 3 is in-place editing, 4 is
  run-level style, 5 is the Style tab, 6 is the proof.
- Ownership: the inspector writes through `EditorInteraction`; palette and type
  resolution stay with their owners; `arrange.ts` keeps object alignment.
- Risk: run-level editing is the largest surface, and the model already supports
  it. Task 4 asserts a round-trip through the persisted envelope, which is where
  a mistake there would show.
