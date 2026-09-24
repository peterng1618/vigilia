# Authoring and Consumer Polish Implementation Plan

> **For agentic workers:** execute task-by-task, committing after each task.

**Goal:** Make a selected object inspectable and editable, so an author can
change the thing they just selected, and make text editable in place.

**Spec:** `docs/superpowers/specs/2026-09-24-authoring-and-consumer-polish.md`

## Global Constraints

- Dispatch through `EditorInteraction` and the existing palette/type owners. No
  new geometry model, no second token-resolution path.
- Fabric stays imperative behind `mountEditorShell`; read/write only the
  selection the shell already owns.
- One history entry per committed edit; nothing runtime or derived enters it
  (§67).
- Copy in `packages/editor/src/ui-copy.ts` (§35).
- Every control has an accessible name and keyboard reach.
- Visible changes need rendered inspection plus the full local browser suite.

## Evidence already gathered

Observed by driving the running editor, not by reading code:

| Finding | Evidence |
|---|---|
| Design tab has no selection properties | Selecting an object yields only "Move, arrange and lock the selection with the canvas dock." plus Theme settings |
| No text styling controls | `bold`, `italic`, `font size`, `font family`, `align` all absent from the editor DOM; the `line height`/`letter spacing` hits belong to the type-**preset** panel |
| No in-place text editing | Double-clicking a text object leaves `document.querySelector("textarea")` null |
| Style tab is a sentence | "Colours and type resolve through the theme palette and type presets." |
| Data tab is chart-only | "Select a chart to edit its settings." for a non-chart selection |

## File Structure

| Path | Responsibility |
|---|---|
| `editor/src/selection-inspector/index.ts` | Selection geometry/appearance/text fields over the active object |
| `editor/src/selection-inspector/index.dom.test.ts` | Field/eligibility/history behaviour |
| `editor/src/editor-shell/shell-layout.tsx` | Route the Design tab to the inspector; reset tabs on selection change |
| `editor/src/editor-session.ts` | Compose the inspector into the document inspectors' slot |
| `editor/src/font-preview.ts` (existing) | Unchanged; the inspector links to the preset panel rather than duplicating it |
| `editor/src/ui-copy.ts` | New field labels |
| `tests/e2e/editor.spec.ts` | Rendered inspection of each selection state |

## Tasks

### Task 1 — Selection geometry fields

- [ ] Add `createSelectionInspector(editor, hosts)` owning X, Y, width, height and
      rotation for the active object, reading from Fabric and writing through
      `editor.canvas` with `editor.historyManager.saveState()` once per commit.
- [ ] Reject non-finite input rather than coercing to 0 (AGENTS.md), restoring
      the last valid value as the artboard panel already does.
- [ ] Tests: a field shows the object's current value; committing a change moves
      it and produces one history entry; an invalid value is refused and the
      field reverts; nothing renders with no selection.
- [ ] Rendered proof: select a shape, change X, capture the canvas before/after.
- [ ] Commit.

### Task 2 — Appearance fields (opacity, paint reference, type preset)

- [ ] Opacity: 0–1 field writing through Fabric with one history entry.
- [ ] Paint: the selection's palette reference, reusing the palette owner's
      reference editing, not a new resolver. Show the resolved colour read-only
      beside it so the author sees what the token means.
- [ ] Text presets: when the selection is text, show its preset reference and a
      link that reveals the existing type-preset panel. Do not duplicate the
      preset's own fields.
- [ ] Tests: reference change updates the object and persists; a non-text
      selection shows no preset row; an unresolvable reference is reported
      rather than blanked.
- [ ] Commit.

### Task 3 — Text editing in place

- [ ] Double-click on a text object enters Fabric's editing; Escape and blur
      commit once, producing a single history entry.
- [ ] Text alignment and wrap controls appear for a text selection.
- [ ] Tests: entering and committing records one entry; no runtime state enters
      it; a non-text object ignores the gesture.
- [ ] Rendered proof: type into an object and capture the result.
- [ ] Commit.

### Task 4 — Inspector routing and tab behaviour

- [ ] Design tab renders the selection inspector; no selection renders the
      existing document panels.
- [ ] A new selection resets the active tab to Design, so a chart's Data tab
      never lingers over a shape; a chart selection still reaches Data.
- [ ] Tests: each selection kind renders the expected panel set; changing
      selection resets the tab.
- [ ] Commit.

### Task 5 — Style tab shows the resolved appearance

- [ ] Replace the placeholder sentence with the same fields as Task 2, grouped
      as style, and the document globals when nothing is selected.
- [ ] Tests: a selection shows its resolved paint/type; no selection lists the
      document's globals.
- [ ] Commit.

### Task 6 — Integration proof

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test &&
      npm run build && npm run size`.
- [ ] Full local `npm run test:e2e`.
- [ ] Capture and inspect each selection state (shape, text, chart, none).
- [ ] Update `docs/architecture/ownership.md` and the
      spec's acceptance section.
- [ ] Commit.

## Self-Review

- Spec coverage: Task 1–2 = A1/A4, Task 3 = A2/A3, Task 4 = the routing rule,
  Task 5 = A4's Style tab, Task 6 = acceptance.
- Ownership: every write goes through `EditorInteraction`; the palette and type
  owners keep their resolution.
- Risk: history granularity during a drag-driven edit; Task 1 asserts one entry
  per commit and Task 6 re-checks it end to end.
