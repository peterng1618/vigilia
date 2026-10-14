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
- What Fabric leaves to the caller: the base `LayoutStrategy.shouldPerformLayout`
  returns true only for `initialization`, `imperative` and a strategy change
  (index.mjs:8870), but **`FitContentLayout` overrides it and always returns true**
  (index.mjs:8916), and that is the strategy a `Group` is constructed with — so an
  `added`/`removed` event *does* commit a layout, and the group's box and its
  children's `left`/`top` both follow the membership from that one call. **This
  bullet is a correction:** the first draft of this note read the base condition as
  the `FitContentLayout` one and concluded the caller had to trigger layout itself.
  It must not — the imperative pass is a measured no-op (rung 6) — but it must
  refresh the coordinate *caches* the rebase leaves behind (see the decision).
- What the same read leaves to the caller, and this is the invisible half:
  `Group.setCoords` cascades to its children only while `subTargetCheck` is true
  (`_shouldSetNestedCoords`), and a group's default is false — so after a reparent
  neither the surviving children nor the inserted object have a cached box that
  matches the transform the layout just rewrote (rung 6, measured).
- `StaticCanvas._onObjectRemoved` (index.mjs:2038) fires `object:removed` and nulls
  `object.canvas`; `Group._onObjectRemoved` fires it too, but on the *group*, so a
  removal from a canvas root and a removal from a group are the same shape to the
  object and **very different to a listener on the canvas** — which is what the
  scene adapter is (see the decision).
- Removing at the root is not one write but four, split between two methods:
  `Collection.remove` splices `_objects` and then calls the canvas's removal hook,
  and `Canvas._onObjectRemoved` (`fabric/src/canvas/SelectableCanvas.ts:356`) drops
  the cached render list (`:357`), releases the active object (`:359`) and the
  hovered target (`:367`) before its `super` nulls the canvas and fires the event.
  The splice is `Collection.remove`'s; the rest is the hook's.

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
| Fabric's `group.add` / `canvas.remove` + `canvas.add` / `group.remove` | Native, symmetric | ~20 lines in `bridge.moveLayer` | High — measured: `canvas.remove` disposes the object through the scene adapter, and the move then inserts the corpse | Rejected in review round 1 |
| The same, with the **root-side** removal silent (`_objects` splice + the removal hook's own bookkeeping) and the transform bake left to Fabric's `insertAt` | Fabric's bake, Fabric's collection API for a group child | ~30 lines | Low — measured in rung 6, and every write re-implemented is a write the removal hook makes | **Chosen** |
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
   which the `added`/`removed` layout commit does on its own (`FitContentLayout`
   answers true to everything, corrected above). The serialized group agrees
   (`toObject()` = 120, 50, 181, 121 for the box above), and an imperative layout
   pass is a **no-op** here (identical numbers before and after), so the caller must
   not add one.
3. **Corrected assumption:** the probe first read the child's own
   `calcTransformMatrix()`, which is the child's matrix *including* its own
   transform, and every number came out doubled. `getRelativeCenterPoint()` is
   already in the parent's plane; the parent's matrix is what takes it to the canvas.

Round 2 measured three more things on the same surface, each of which is now a case
in `bridge.dom.test.ts`:

| Probe | Reading |
|---|---|
| Reparent a root `VigiliaChart` into a group **with the scene adapter installed** | `moveLayer` returned true, the chart was in the group, and `chart.disposed` went false → true: `canvas.remove` fires `object:removed`, the adapter disposes it (`scene-fabric/src/adapter.ts:62`), and the disposed object is then inserted |
| `groupingManager.group()` over an `ActiveSelection` holding a chart, adapter installed | The member is disposed the same way — the same defect in the other caller of `canvas.remove`, and it is why the fix is not "always order the writes differently" |
| After a reparent into a group at `angle: 24, scaleX: 1.4` | A surviving child's cached `getBoundingRect().left` was `74.496` while its recomputed box was `−28.858`; a `setCoords()` on every member of both collections brings the cache and the transform back into agreement |
| Dropping on an empty group | `layerDrop`/`moveLayer` both answered true and the group stayed empty, because the destination is the anchor's parent — a group whose last child was dragged out could never be refilled |

Round 3 measured the two shapes the first fix missed, both now cases in
`bridge.dom.test.ts`:

| Probe | Reading |
|---|---|
| Reparenting while the canvas's active object and hovered target are both the moved chart | `getActiveObject()` and `_hoveredTarget` both still pointed at it after the move; `canvas.remove` + `insertAt` releases both. The two paths' whole observable state now compares equal (**except** the disposal), which is the acceptance — the narrower "the fields I know about are cleared" is what let the disposal through |
| `outer[inner[a, b], peer]`, a root `loose` dropped on `a` | `inner`'s members came out fresh and `peer` kept a stale box, although the move never names the collection `peer` lives in — the refresh named the destination and the source, and the blast radius is nesting |

Also measured, and the reason `moveLayer` releases a multi-selection first: an
`ActiveSelection` member's `group` **is the selection**, so a `remove` issued against
the tree's own parent while the selection is live bakes against a matrix the object
no longer belongs to.

## Decision

`bridge.layerDrop(id, anchorId)` answers what a drop would do and
`bridge.moveLayer(id, anchorId)` performs it; both come from one plan, `layerMove`,
so a mark the panel draws is a drop the bridge takes — the failure `vg-099` is about.
`layerMove` resolves both objects, refuses a cycle (`pathTo(root, anchorId).includes(moved)`,
in the tree's own terms rather than Fabric's logged refusal), and computes the
destination and the index. The index arithmetic is the old `reorderLayer`'s, kept
where it was because a same-parent restack and a cross-parent reparent are one
question about an index in a destination.

**The anchor names the container when the anchor *is* the container.** It names the
anchor's parent — the sibling slot directly above it — everywhere else, which is what
makes dragging a row *out* of a group work. The one exception is a group with nothing
in it, and the discriminator is not that it draws no interior row: a **shut** group
draws none either — `layer-tree.ts:342` collapses every group with children by default,
and a group created later starts shut. It is that it has no rows to *open*: expanding
is the route to a group's interior, and a group with nothing in it has nothing to
expand, so its own row is the only thing that can ever name it as a destination.
Without that, a group emptied by dragging its last child out could never be refilled.
A group that has children keeps its row as a slot, and its interior is reached by
expanding it and aiming at a child row.

**What is written by hand is the root-side removal's, and only because that removal's
own event is what has to be suppressed.** The transform bake is not: it is
`Group._enterGroup`'s / `_exitGroup`'s, reached by the `insertAt`/`remove` pair.
`detachFromRoot` splices `canvas._objects` and reproduces what the removal hook does
with the object it hands
on — the cached render list, the active object's deselection, the hovered target's
release (`Canvas._onObjectRemoved`, `fabric/src/canvas/SelectableCanvas.ts:356`; the
splice is `Collection.remove`'s, the rest is the hook's, and the deselection is
delegated to Fabric's own `discardActiveObject`, so listeners hear what a real removal
fires). It does not fire `object:removed`, so the scene adapter does not dispose an
object that is about to be inserted. A group-side removal keeps Fabric's own
`Group.remove`: it fires the event on the group, which no adapter listens to, and it
is what bakes the child out of the plane it leaves.

**The move then recomputes the coordinate caches of everything under the root**,
deepest first, for the reason rung 3 records: the layout commit rebases the
destination's members but nothing cascades `setCoords` while `subTargetCheck` is false,
and `sceneBoxesOf` reads those caches. Naming the collections the move touches is not
enough, and round 3 corrected it: an ancestor's box is the fit of its subtree and its
other children read their box through that ancestor's matrix, so `outer[inner[a, b],
peer]` leaves `peer` stale although the move never names where `peer` lives. A walk
from the root is the one shape that does not depend on which collection the caller
happened to name — `ponytail:` O(objects) per drop, narrow it to the ancestors if a
document ever makes that measurable. It is `grouping-manager`'s idiom, widened.

**Two consequences worth naming.** A same-parent restack goes through `moveObjectTo`
on the collection the two objects share (Fabric's own `moveObjectTo` splices `_objects`
and nothing else needs to happen), while a reparent goes through the root detach or
`Group.remove` plus `insertAt`; neither touches a child's coordinates by hand. And the
pane's rule changed shape: it no longer asks "is this the same parent"
but "would this land", which is why the module that refuses is the module that is
asked.

**The specific reason:** the transform bake is the only part of this that is
expensive and invisible, and Fabric already owns it — correctly, symmetrically, and
in the code path its own `loadFromJSON` uses. A rebuilt group buys nothing except the
opportunity to be wrong in a way no test would see. The one splice this note does take
is not the one rung 5 rejected: rung 5's was an alternative to Fabric's *bake*, and
this one sits beside the bake, replacing only the event that tells a renderer the node
is gone.

## What this fix does not reach, and is filed instead

`grouping-manager.group()` removes each member from the canvas by the same
`canvas.remove` this note now avoids, so with the scene adapter installed a chart
in a grouping is disposed exactly as the reparented one was (measured in rung 6).
It is a different owner — the manager's own write, not this path's — so it is filed
rather than fixed here.

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
