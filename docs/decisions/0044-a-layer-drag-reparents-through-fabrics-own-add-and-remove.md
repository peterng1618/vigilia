# 0044 — A layer drag reparents through Fabric's own `add` and `remove`

- **Date:** 2026-10-15
- **Status:** accepted
- **Paths:** `src/web/packages/editor/src/editor-shell/bridge.ts`,
  `src/web/packages/editor/src/panes/composition/composition-pane.tsx`
- **Task:** Phase 13.3 of `docs/superpowers/plans/2026-10-12-the-backlog-drain.md`
  (items 3, 4, 5; rows `vg-460`, `vg-461`, `vg-462`). `vg-099` (verified) left
  "deliberate intent or implementation limit" open on this refusal; item 4 answers it.

## The problem

A layer row could be dragged, but only within one parent: the bridge's `reorderLayer`
refused when `ownerOf(id) !== ownerOf(beforeId)`, and the panel marked only slots that
would land. The author asked for a row to be droppable *into* a group and back *out*
to the root.

The shape of the problem is not the gesture. It is that crossing a group boundary
changes Fabric membership, and **Fabric's group math is the expensive and invisible
part**: a child's `left`/`top` are in its parent's plane, a `Group`'s own box is
the fit of its members, and a naive `_objects.splice` would leave paint and
serialization agreeing only by accident. Nothing throws when that is wrong — the
scene just renders, or reloads, in a different place.

## Rung 1 — Vigilia

Searched: `grouping-manager` (`group`, `ungroup`, `enterGroup`), `layer-manager`
(`bringToFront`/`bringForward`/…), `layer-tree.ts` (`ownerOf`, `pathTo`,
`findById`), `clipboard-manager.add`, `card-library.ts:378`, and every `.add(`/`insertAt(`/`removeAll(`
call in `editor/src` and `scene-fabric/src`.

Found: **nothing moves an existing object into an existing group.** The only two
structural owners are `grouping-manager.group()`, which forms a *new* `Group` from
an `ActiveSelection` (`new Group(members)` after removing them from the canvas), and
`ungroup()`, which dissolves one with `removeAll()`. Both change a whole group,
neither reparents one object. `reorderLayer` was the only restacking owner and it was
deliberately single-parent. The refusal the author met is therefore an unstated
limit, not a mechanism someone had already built.

## Rung 2 — dependencies

Searched: `scene-fabric`'s public surface (`index.ts`, `scene.ts`, `adapter.ts`,
`authored-box.ts`) for a reparent or group-membership helper.

Found: nothing. `scene-fabric` reads and writes object state, boxes and paint; scene
*structure* is Fabric's, reached by the editor's managers. `fabric` 7.4.0 is the one
renderer (`AGENTS.md`), so there is no second candidate to import.

## Rung 3 — platform

Searched: `node_modules/fabric/dist/index.mjs` for `enterGroup`/`exitGroup`,
`_enterGroup`/`_exitGroup`, `_onObjectAdded`/`_onObjectRemoved`, `LayoutManager`,
`FitContentLayout`.

Found: **Fabric already owns both halves.**

- `Group.add(child)` → `_onObjectAdded` → `enterGroup(object, true)` → `_enterGroup(object, true)`
  (index.mjs:9232, :9326, :9336): applies `invert(group.calcTransformMatrix()) × child.calcTransformMatrix()`,
  i.e. takes a canvas-plane object into the group's plane.
- `Group.remove(child)` → `_onObjectRemoved` → `exitGroup(object, false)` → `_exitGroup`
  (index.mjs:9243, :9364): applies `group.calcTransformMatrix() × child.calcTransformMatrix()`,
  i.e. takes a group child back to the canvas plane.
- `canEnterGroup` refuses a cycle (`object === this || this.isDescendantOf(object)`)
  and a duplicate, and *logs* the refusal rather than throwing — which is why the
  caller must refuse in its own terms (rung 6).
- What Fabric leaves to the caller: `FitContentLayout.shouldPerformLayout` returns
  true only for `initialization`, `imperative` and a strategy change (index.mjs:8878),
  so an `added`/`removed` event does **not** commit a layout — yet the group's box
  must follow its members.

## Rung 4 — ecosystem

Searched (2026-10-15): `fabric.js move object into group`, `fabric.js drag layer
panel reparent`, `fabricjs add object to existing group coordinates`,
`fabric.js Group add remove child position`, `InteractiveFabricObject group
membership drag drop`.

Found: the Fabric community's answer to "move an object between groups" is exactly
`group.add()` / `group.remove()` and nothing higher — no library, helper or recipe
beyond it. The recurring *warning* in the discussions is the one this note is about:
adding to a group re-bases the child's coordinates, and callers who splice
`_objects` by hand end up with objects that look right until a transform or a
reload. The pattern the ecosystem does *not* have is the editor-level half — the
undo entry, the tree's re-projection, the refusal of a cycle — which is what lives
here rather than in a dependency.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Splice `_objects` / assign `object.group` by hand | Invisible | ~6 lines | High — transform bake, `subTargetCheck` flags and serialization all skipped; nothing fails | Rejected |
| Rebuild the group (`new Group([...members, moved])`, the `group()` idiom) | Fits the existing idiom | ~30 lines | High — a new instance loses the group's authored identity (`id`, `name`, `opacity`, glass), and every other reference to it goes stale | Rejected |
| Fabric's `group.add` / `canvas.remove` + `canvas.add` / `group.remove` | Native, symmetric | ~20 lines in `bridge.moveLayer` | Low — measured in rung 6 | **Chosen** |
| A new dependency for drag-and-drop trees | Invisible | A second owner of the tree | High | Rejected — the tree is `layer-tree.ts`'s |

## Rung 6 — probe

Measured, not read. A `jsdom` probe (`vitest`, deleted before the commit) built a
`Canvas`, a `Group([a, b])` at 20×20 rects spanning x −0.5…60.5, and a loose rect at
(200, 100), then read each object's absolute point (`getRelativeCenterPoint()` through
the **parent's** `calcTransformMatrix()`) and the group's `getBoundingRect()`:

| Step | a | b | loose | group box |
|---|---|---|---|---|
| start | (0, 0) | (40, 0) | (200, 100) | 61 × 21 at (−10.5, −10.5) |
| after `group.add(loose)` | (0, 0) | (40, 0) | (200, 100) | 221 × 121 |
| after an imperative layout pass | (0, 0) | (40, 0) | (200, 100) | 221 × 121 |
| after `group.remove(a)` + `canvas.add(a)` | (0, 0) | (40, 0) | (200, 100) | 181 × 121 |

Two things this settles, and one it corrected:

1. **No object moves on screen**, in either direction: the coordinate bake is
   Fabric's and it is right.
2. **The container's box follows the membership** — 61×21 → 221×121 → 181×121 —
   even though `FitContentLayout` skips the `added`/`removed` layout. The serialized
   group agrees (`toObject()` = 120, 50, 181, 121 for the box above), and the
   imperative pass is a **no-op** here (identical numbers before and after), so the
   caller must not add one.
3. **Corrected assumption:** the probe first read the child's own
   `calcTransformMatrix()`, which is the child's matrix *including* its own
   transform, and every number came out doubled. `getRelativeCenterPoint()` is
   already in the parent's plane; the parent's matrix is what takes it to the canvas.

Also measured, and the reason `moveLayer` releases a multi-selection first: an
`ActiveSelection` member's `group` **is the selection**, so a `remove` issued against
the tree's own parent while the selection is live bakes against a matrix the object
no longer belongs to.

## Decision

`bridge.moveLayer(id, beforeId)` — the anchor names both the container (its parent)
and the position (directly above it) — resolves both objects, refuses a cycle
(`pathTo(root, beforeId).includes(moved)`, in the tree's own terms rather than
Fabric's logged refusal), releases an `ActiveSelection` that holds the moved object,
and then hands the two structural writes to Fabric: `remove` from the collection it
leaves, `add` to the collection the anchor is in. The call is split from `reorderLayer`,
which it replaces: `layerMove` plans the move (both objects, the destination, the
index) and `moveLayer` performs it, with `canMoveLayer` answering the same plan
without performing it — the one question the panel asks before it marks a slot, so
the refusal and the drop are the same decision rather than two that must agree. The
index arithmetic is the old `reorderLayer`'s, kept where it was because a
same-parent restack and a cross-parent reparent are one question about an index in a
destination, and the move closes with one history entry and a re-projected tree, as
every other layer command does.

**Two consequences worth naming.** A same-parent restack now goes through
`moveObjectTo` on the collection the two objects share (Fabric's own `moveObjectTo`
splices `_objects` and nothing else needs to happen), while a reparent goes through
`remove`+`insertAt`; both are Fabric's, and neither touches a child's coordinates by
hand. And the pane's rule changed shape: it no longer asks "is this the same parent"
but "would this land", which is why the module that refuses is the module that is
asked.

**The specific reason:** the transform bake is the only part of this that is
expensive and invisible, and Fabric already owns it — correctly, symmetrically, and
in the code path its own `loadFromJSON` uses. A hand-written splice or a rebuilt
group buys nothing except the opportunity to be wrong in a way no test would see.

## The second path this note claimed, and did not take

An earlier draft claimed `components/ui/` for one line of completion:
`ControlProps.describedById` exists and says it is "an element outside this control
that describes it — the pane's own standing note, whose id the control cannot mint",
and `ControlIconButton` did not read it. The layer footer was expected to need exactly
that, for "refused-but-present rows" (§5 rule 3).

**It is not taken here, because the footer has no refused rows to describe.** The
footer draws the commands the selection can run and the constructions, which need no
selection at all; an action the selection cannot run is absent rather than refused
(`objectActionsFor`), and `ControlIconButton`'s existing `refused` → `aria-describedby`
path is what an actually-refused control uses. So `components/ui/` is not a path of
this decision, and the icon button is unchanged.

The gap itself is real and stays open, in a different surface: `ControlIconButton`
routing only its own `refused` means a control handed `describedById` loses the note
silently. That is a defect in that component's reading of the control-set contract,
recorded in the commit that landed this decision rather than fixed by it.
