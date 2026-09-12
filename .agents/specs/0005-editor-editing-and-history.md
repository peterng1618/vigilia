# 0005 — Editor document editing and undo history

- **Status:** implemented
- **Design document sections:** §61, §67, §122, §137, §139
- **Specs superseded:** none

## Problem

A gesture produces new transforms; something has to put them into the document
and make the result undoable. Two requirements make this more than a stack of
snapshots:

- **§67: one undo transaction per gesture.** A drag emits a transform on every
  pointer move. Committing each one puts eighty entries in the history for one
  drag, and undo then appears to do nothing.
- **§139: saving marks history clean without clearing it.** Undo must still
  reach edits from before the save.

## Behaviour

### Edits are immutable, with structural sharing

Every command in `commands.ts` takes a document and returns a document. Branches
that did not change are returned **by reference**, so:

- An undo entry is a whole document and costs almost nothing.
- A caller can detect "nothing changed" by identity and skip both the commit and
  the redraw. Several callers rely on this, including the inspector, which is
  redrawn by a 1 Hz tick and must not commit on every tick.

Commands: `updateTransforms`, `updateStyle`, `renameNode`, `setNodeFlags`,
`deleteNodes`, `insertNodes`, `reorderNode`.

`reorderNode` takes `'front' | 'back' | 'forward' | 'backward'` and reorders
**within the node's own parent**. Paint order is child order (§137), so this is
z-order; moving a node between parents is a different operation and is not one
of these.

### History

```
{ past: HistoryEntry[], current, future: [], preview?, savedDocument?, limit }
```

`visibleDocument(history)` returns `preview ?? current`. That one line is how
§67 is satisfied:

- A gesture calls `preview(history, document)` on every pointer move. The scene
  and overlay render the preview; **the history is untouched.**
- Release calls `commit(history, label, document)` — one entry.
- Escape calls `cancelPreview(history)` and the in-progress gesture vanishes with
  no trace in the history.

Edge cases:

- `commit` with a document identical **by reference** to `current` is ignored
  (it only cancels the preview). A gesture that ends where it started must not
  leave an entry that appears to do nothing when undone.
- Any commit clears `future`. Keeping a redo branch across a new edit would let
  an author redo their way into a document that never existed.
- `limit` (default `DEFAULT_HISTORY_LIMIT = 100`) counts **undo steps**; oldest
  entries fall off the back. §122's bounded-history requirement applies to the
  editor as much as to sampling.

### Dirty tracking (§139)

`markSaved` records `savedDocument: current`. `isDirty` compares `current`
against it **by reference** — exact, and free. So:

- Saving does not clear `past`: undo still reaches before the save.
- Undoing *back to* the saved document makes the editor clean again, which is
  correct and is the behaviour a reference comparison gives for free.
- `replaceDocument` (open a file) resets the history rather than appending to it.
  An undo that crossed a file boundary would restore half of another theme.

### Locked and hidden (§61)

Locked is enforced in the **gesture** layer, not in the commands: a locked node
is filtered out before a transform is computed. The commands themselves are
unconditional, because the inspector must still be able to set `locked: false`
on a locked node — enforcing it in `updateTransforms` would make locking
irreversible.

## Out of scope

- **Coalescing separate edits.** Two consecutive "set x" edits are two entries.
  Time-based merging is a common editor feature and a common source of "my undo
  ate too much"; the preview mechanism already covers the case that matters.
- **Persistence.** Nothing writes to disk yet; the editor loads a checked-in
  fixture. Open and save are the next milestone item, and §139's rule above is
  the part that is already built for it.
- Multi-user or collaborative editing, and therefore operational transforms.

## Acceptance

| Behaviour | Test |
|---|---|
| A drag is one undo entry, not one per move (§67) | `tests/e2e/editor.spec.ts` — "a drag is one undo step, not one per pointer move (§67)" |
| Escape abandons a gesture entirely | `tests/e2e/editor.spec.ts` — "escape cancels a drag in progress" |
| Redo replays, and a new edit discards the branch | `history.test.ts`; `tests/e2e/editor.spec.ts` — "redo replays the move" |
| A no-op commit leaves no entry | `history.test.ts` |
| The limit bounds the history (§122) | `history.test.ts` |
| Saving marks clean without clearing (§139) | `history.test.ts` |
| Delete removes the selection and undo restores it | `tests/e2e/editor.spec.ts` — "delete removes the selection and undo brings it back" |
| Untouched branches are shared by reference | `commands.test.ts` |

Not verified: `markSaved` has no caller yet — there is nothing to save to — so
§139 is proven at the unit level and has never run in the product. Recorded here
rather than ticked.
