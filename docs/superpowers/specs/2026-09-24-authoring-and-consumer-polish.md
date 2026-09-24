# Authoring and Consumer Polish — Critique and Design

## Why

Vigilia's engine is sound: real telemetry through two providers, a Fabric
renderer, a persisted envelope, LAN pairing and device assignment. What is
missing is the part a theme **author** and a **consumer** actually touch.

This is the strictest-critic pass. Every finding below was observed by driving
the running product, not by reading code, and each names the journey it breaks.

## What was observed

### Journeys that work end to end

- **Consumer, first run → dashboard.** Land on `/`, follow the page to the
  editor, save to the library, dashboard renders. Verified in a browser.
- **Consumer, phone.** `--host 0.0.0.0` prints a pairing link; paired devices
  read, unpaired get 403, revocation works.
- **Consumer, honest gaps.** An unreadable sensor shows a notice naming the
  sensor and the reason.
- **Author, create.** Add offers Text and four chart families; charts bind to
  semantic keys, and saving round-trips through the host.

### Journeys that break

| # | Journey | Observed |
|---|---|---|
| A1 | Author selects an object and adjusts it | **Nothing to adjust.** The Design tab shows only "Move, arrange and lock the selection with the canvas dock" plus document-level Theme settings. There is no X/Y, size, rotation or opacity control for the selected object anywhere in the editor. |
| A2 | Author styles text they just created | **No controls.** No bold, italic, family, size or alignment input exists. The only `line height`/`letter spacing` fields belong to the theme's type **presets**, not to the selected object. |
| A3 | Author edits text in place | **Not reachable.** Double-clicking a text object produces no editable field; `document.querySelector("textarea")` is null. |
| A4 | Author inspects a non-chart selection | **Style tab is a sentence.** It reads "Colours and type resolve through the theme palette and type presets." and offers no way to see or change the selection's own paint or type reference. Data shows only "Select a chart to edit its settings." |
| A5 | Consumer opens the dashboard with no themes | **Was a dead end**, now fixed: it returned 404 with no link. The first-run page now leads to the editor. Kept here because it shows the class of defect: copy that names a next step the reader cannot take. |

## Design

### 1. A selected object has an inspector (A1, A2, A4)

The Design tab becomes the selection inspector, falling back to the existing
document panels when nothing is selected.

- **Geometry**: X, Y, width, height, rotation — read from Fabric, written
  through the existing `EditorInteraction` managers so history and the dock's
  eligibility rules are unchanged. Whole artboard units, matching §57.
- **Appearance**: opacity, plus the selection's palette reference (already
  authored; §73 requires paint to resolve through the palette) and its type
  preset when the object is text (§75). Editing a reference reuses the existing
  reassignment owners, never a second resolution path.
- **Text**: alignment, wrap and overflow when the selection is text (§89).
  Weight/size/family remain the **preset's** business: an object references a
  preset, and the preset panel already owns editing one. The inspector links
  there rather than duplicating the fields.

Rationale: an author's most common action is "select a thing, change a thing".
Today that is impossible, so every layout decision needs the dock or a drag.

### 2. Text is editable in place (A3)

Double-click enters editing on the Fabric text object and commits on Escape or
blur, with the edit entering history once as a single entry (§67: authored
state only; no runtime state joins history).

### 3. The Style tab shows the selection's resolved appearance (A4)

Read-only resolution of the selected object's paint and type reference from the
theme globals, with the same edit affordances as the Design tab. When nothing is
selected it lists the document's globals, which is what a first-run author needs
to see.

### 4. Rail and inspector agree on one state

Which pane and tab are shown must follow the selection, not a stale value. The
shell already derives selection through `SelectionStore`; the inspector's tab
should reset to Design on a new selection so a chart's Data tab does not linger
over a shape.

## Non-goals

- A general graphics editor: no boolean geometry, no path editing, no effects
  stack.
- Duplicating the type-preset panel's fields on every text object.
- Multi-selection property editing (dropped in spec 0014).
- Rulers, grid or resize-snapping (still spec 0014 review candidates).

## Boundaries

- The inspector dispatches through `EditorInteraction` and the existing
  palette/type owners. No new geometry model, no second resolution path.
- Fabric stays imperative; the inspector reads and writes the selected object
  through the shell that already owns it.
- Copy goes in `ui-copy.ts` (§35).
- History: one entry per committed edit, and no runtime/derived state in it
  (§67).

## Acceptance

- Selecting a shape shows numeric geometry fields; editing one moves the object
  and produces exactly one history entry; undo restores the previous value.
- Selecting text shows alignment controls and the object's preset reference;
  double-click edits its content in place.
- Selecting nothing shows the document panels, as today.
- A chart selection still routes Data to its settings and bindings.
- Every new control has an accessible name and is reachable by keyboard.
- Rendered inspection of each state, plus the full local browser suite.

## Verification

Findings A1–A4 were observed against the running host with a browser driven at
the editor; A5 was fixed inline and verified by walking the whole journey. The
replacement behaviour is verified the same way: drive the editor, inspect the
rendered panel, assert the observable outcome.
