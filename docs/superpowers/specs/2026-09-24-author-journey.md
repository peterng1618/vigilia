# Author Journey — style what you selected

- **Status:** in progress — Tasks 1–5 landed; Task 6 (integration proof) open.
- **Plan:** [`2026-09-24-author-journey.md`](../plans/2026-09-24-author-journey.md)

## Why

This continues `2026-09-24-authoring-and-consumer-polish.md`, which recorded four
broken author journeys and fixed the first (selection geometry, landed). The
remaining two are text and style, and they share one root cause: **a selection
can be moved but not styled.**

## What the model already supports

Checked against the actual types, because the fix must use what exists:

- A text run carries `typePreset` **and** an optional `style` map
  (`renderer-core/src/theme/document.ts`): identity through a named preset,
  with per-run overrides already representable and already validated.
- Chart nodes carry typed settings; paint resolves through palette tokens (§73)
  and type through named presets (§75).
- Fabric objects carry opacity, angle and scale, all persisted through
  `SCENE_PERSISTED_PROPERTIES`.
- The editor already ships 13 type presets in the starter theme and a curated
  font catalogue of trios.

So the gap is the **control surface**, not the document model.

## Journeys

Observed, driving the running editor:

| Journey | Today |
|---|---|
| Style the text you just made | No weight, size, family or alignment input exists. The line-height and letter-spacing fields belong to theme presets, not to the object. |
| Edit text in place | Double-click yields no editable field: `querySelector("textarea")` is null. |
| Inspect a non-chart selection | The Style tab is a sentence; Data is chart-only. |
| Style a value in a text run | Impossible: no run-level surface at all. |
| Know what a token means | The inspector shows references but not the resolved colour or face. |

## Design

### One inspector, three kinds of selection

The Design tab (geometry, landed) grows an appearance section whose fields depend
on what is selected:

- **Any object** — opacity.
- **Text object** — the object's preset reference, alignment, wrap and overflow,
  and a link that reveals the existing type-preset panel rather than duplicating
  its fields.
- **Text run** — when a run is selected in the run list, its own preset
  reference and its overrides, using the `style` map the model already defines.
- **Chart** — its settings stay with the chart panel; the inspector links there.

Every write goes through `EditorInteraction` and the existing palette/type
owners. Nothing gains a second resolution path.

### Editing text in place

Double-click enters Fabric's text editing, and committing produces exactly one
history entry. Text alignment, wrap and overflow are the object's, not the
run's, matching the model.

### The inspector says what a token resolves to

Beside each reference, show the resolved value read-only ("palette.text → #e8ecf3",
"typePresets.metric → Inter 600 32px"). An author currently picks a token by name
alone; showing the resolution is the difference between guessing and choosing.

### Whitespace, alignment and the dock stay where they are

No new alignment surface: `arrange.ts` already owns aligning objects, and the
inspector's text alignment is about text **within** its box. Keeping the two
apart avoids two owners for the word "align".

## Non-goals

- Inline rich-text editing across runs (a real editor; the run list is the v1
  surface).
- Arbitrary font upload; the curated catalogue is deliberate and superior in fit
  to the fork's upload manager (spec 0014).
- Effects stacks, gradients on text, or boolean geometry.
- Duplicating the type-preset panel's own fields per object.

## Boundaries

- Fabric stays imperative; the inspector reads and writes through the shell.
- Palette and type resolution keep their owners; the inspector only displays the
  result.
- Copy in `ui-copy.ts` (§35). One history entry per commit, no runtime state
  (§67).
- The envelope is unchanged: every field already exists in the model.

## Acceptance

- Selecting text offers alignment, wrap and overflow, and changing one persists
  through save/reopen.
- Double-clicking a text object edits its content; Escape commits one entry;
  undo restores the previous text.
- Selecting a run in the run list offers its preset and overrides; a change
  survives save/reopen.
- A reference shows its resolved value beside it; an unresolvable reference is
  reported rather than blank.
- Selecting a chart still routes its settings to the chart panel.
- Rendered inspection of each state, plus the full local browser suite.

## Verification

Each acceptance line is driven in a browser against the running host, with the
persisted envelope inspected after save/reopen — not only the live DOM. Authored
state must round-trip, since that is what an author actually keeps.
