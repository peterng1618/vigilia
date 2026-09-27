# Delete cannot remove an object that lives inside a group

**Status:** open. Non-critical: the object is not destroyed or corrupted, and the
author can still reach it by ungrouping first. It is recorded because it makes
one of the editor's advertised operations silently do nothing.

## What happens

Enter a group, select a child, press Delete. Nothing is deleted.

`deletion-manager/index.ts:28` calls `canvas.remove(...targets)`. Fabric's
collection `remove` searches the canvas's own `_objects` and splices only what it
finds there (`fabric/src/Collection.ts:68-79`). A child of a group is not in
`canvas._objects` — it is in `group._objects` — so `indexOf` returns `-1`, the
method returns an empty array, and no `object:removed` event fires.

The manager then returns `true` and calls `save()`, so the caller believes it
deleted something. The history entry it records is a scene identical to the one
before, which `EditorHistory.save` discards as unchanged.

## Why it is not a glass bug

Found while pinning Task 5's group-lifecycle cases. Glass subscribes to
`object:removed`, and **it is correct**: the event that never fires is the one
Fabric never emits, and the fix belongs in whoever issues the removal. Glass's
own group-membership handling is exercised directly in
`scene-fabric/src/glass-lifecycle.dom.test.ts` and does not depend on this
path.

## Evidence

Fabric's `Collection.remove` is the whole mechanism, read at
`node_modules/fabric/src/Collection.ts:68-79`:

```js
remove(...objects) {
  const array = this._objects,
    removed = [];
  objects.forEach((object) => {
    const index = array.indexOf(object);
    // only call onObjectRemoved if an object was actually removed
    if (index !== -1) {
      array.splice(index, 1);
      removed.push(object);
      this._onObjectRemoved(object);
    }
  });
  return removed;
}
```

## Next pickup action

Pick the owner and implement. The candidates, neither of which this bug record
chooses between:

- **`deletion-manager`** — resolve the object to the collection that actually
  holds it (`object.group` first, then the canvas) and remove from there. This
  is where the intent already lives and is the smallest change, but it means
  deciding what a delete means for a grouped child: remove it from the group
  and leave the group, or delete it outright.
- **Fabric's collection API** — there may be an existing method that removes
  from the owning collection; `Group.removeAll` exists and would at least make
  the unreachable case explicit.

Whichever is chosen, the test is the shape of the current one: a panel inside a
group, removed through the manager, and asserted gone from `group.getObjects()`.
