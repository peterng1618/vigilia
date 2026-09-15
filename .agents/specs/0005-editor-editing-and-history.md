# 0005 — Editor document editing and history

- **Status:** behaviour retained; implementation may change under [0013](0013-fabric-scene-migration.md)
- **Design sections:** §61, §67, §122, §137, §139

## Requirements

- Generic transform gestures should create one history entry, not one per pointer
  move.
- Cancelled/no-op gestures create no entry.
- New edits clear the redo branch.
- History is bounded.
- Saving marks the document clean without clearing undo history.
- Opening/replacing a theme resets history; undo never crosses file boundaries.
- Locked state blocks transforms but must not make unlocking impossible.

## Runtime separation

Telemetry, chart samples, animation/playback, selection and viewport state are
runtime/UI state and must never enter authored history.

Chart-specific property changes may be non-undoable if integrating them into the
new editor foundation would require substantial custom history code. This is an
accepted product compromise.

## Implementation direction

Do not preserve the current immutable-document history solely because it exists.
The `fabricjs-image-editor` source fork may reuse, narrow or replace its stock
history. Choose the simplest mechanism that protects authored/runtime separation
and the requirements above.

## Out of scope

- collaborative editing;
- complex time-based coalescing beyond one interaction gesture;
- chart-setting undo as a migration blocker.

## Acceptance

Verify in the chosen editor foundation:

- drag/resize/rotate undo as one transaction where supported;
- cancel/no-op leaves no entry;
- redo branch is discarded after a new edit;
- save/clean state works without clearing undo;
- file replacement resets history;
- runtime telemetry updates do not alter dirty/history state.