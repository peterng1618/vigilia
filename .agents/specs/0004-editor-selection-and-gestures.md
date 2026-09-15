# 0004 — Editor selection and transform gestures

- **Status:** implemented; the implementation is being retired — see
  [0013](0013-fabric-scene-migration.md)
- **Design document sections:** §31, §51, §57, §61, §67, §137
- **Specs superseded:** none

> **Amended by [0013](0013-fabric-scene-migration.md).** Fabric takes over hit
> testing, transform handles, rotation and marquee selection, so `geometry.ts`,
> `hit-test.ts`, `transform-gesture.ts` and `overlay.ts` are deleted rather than
> maintained. **The behaviour specified below is what Fabric must be verified
> against** — topmost-wins, exact rotated-corner hit-testing, locked and hidden
> rules, and one undo transaction per gesture. Read this as the acceptance
> criteria for the replacement, not as a description of code that will still
> exist.

## Problem

The renderer draws a theme; nothing let anyone *point at* one. Editing needs
answers the renderer never has to compute: where a node actually is on screen,
which node a click means, and what a drag does to a transform.

The renderer deliberately never composes transforms in code — it nests
absolutely positioned elements and lets the browser do it (§51, §57). That is
right for drawing and useless for editing, so the editor composes the same chain
explicitly. **The two must agree**; a handle 3 px from the thing it grabs is the
most obvious possible bug, and the drift is silent.

## Behaviour

### Everything is decided in pure code

`geometry.ts`, `hit-test.ts`, `selection.ts`, `transform-gesture.ts` and
`snapping.ts` contain no DOM. The overlay wires pointer events to them and
decides nothing — the same split as `plan.ts`/`mount.ts` in the renderer, for the
same reason: gesture maths in an event handler is untestable without a browser.

### Placement

`placeNodes` flattens the tree into world-space placements **in paint order**
(§137: parent before child, earlier sibling before later). Each placement
carries:

| Field | Why it exists |
|---|---|
| `matrix` | Document→node. Hit-testing inverse-transforms a point into node space |
| `parentMatrix` | The ancestors' composition *without* this node's own transform |
| `visible` | A hidden group hides its subtree regardless of what a child says |
| `locked` | §61 |

`parentMatrix` is the one that is easy to omit and expensive to be missing. A
node's `x`/`y` are expressed in its **parent's** space (§57), while a pointer
delta arrives in document space. They are equal for a translation-only ancestor
chain, which is every node in every fixture — so an editor can pass all its
tests and still drag a child of a rotated group sideways.

### Matrices, not rectangles

A rotated node has no axis-aligned box that is both tight and correct, so
hit-testing one against a rectangle is wrong at the corners. A point is tested by
inverse-transforming it into the node's own space and comparing against
`0,0 → width,height` — exact for any composition of translation, rotation and
scale, which is all the format allows.

`worldBounds` exists as well, and is deliberately **loose** for a rotated node.
It answers "what area does this cover" for marquee and alignment. It must never
be used for hit-testing.

Edge cases:

- A matrix with a zero determinant (reachable: `scaleX: 0` is legal) has no
  inverse. `invert` returns undefined and the hit-test fails closed, rather than
  producing infinities that make every subsequent test succeed.
- A zero-sized node is legal and gets **no** click target. Giving it one would
  let an invisible node steal every gesture over it.

### What a click selects

`hitTest` walks the placements backwards, so the **topmost** node in paint order
wins — not the smallest, and not the first. Then:

- A leaf inside a group selects **the outermost group**, not the leaf. Authors
  move panels far more often than they move a label inside one.
- Double-click **enters** a group; the next click selects a child directly.
  Entering is per-group and nests. Escape leaves one level and selects the group
  it left.
- Hidden nodes are skipped entirely, including all children of a hidden group.
- **A locked node is still selected** (§61). It is selectable and inspectable,
  and only transformation is refused. `hitTest` can be asked to skip locked
  nodes, but selection does not ask.

### Modifiers mean exactly one thing each

**Shift** toggles a node in or out of the selection; **ctrl/cmd** disables
snapping and never touches the selection.

Ctrl originally meant "toggle" *as well as* "disable snapping", so holding it to
avoid a snap silently changed what was being dragged — and in the observed case
it added an **ancestor** of the node under the cursor, which then moved the child
twice as far as the pointer.

`marqueeSelect` takes everything its rectangle *touches* by default, accepts a
rectangle dragged in any direction, and can be asked to require full
containment instead.

### Selection state

An ordered list plus an `anchor` plus `enteredGroups`. Order is preserved
because it is the order the author picked, and some future operations (align to
first) need it. `pruneSelection` drops ids that no longer exist and returns the
**same object** when nothing changed, so a caller can skip a redraw by identity.

### Gestures

`applyGesture(start, pointer, modifiers)` returns **only the transforms that
changed**, so a caller can write an undo entry containing exactly what moved.

- Locked nodes are filtered out before anything else (§61).
- **A node whose ancestor is also selected is dropped** (`outermostOnly`).
  Moving a group already moves its children, so transforming both applies the
  delta twice: a 100 px drag moves the child 200 px and slides it out of its own
  group. Reachable in three clicks — shift-click a group, enter it, shift-click a
  child — and it compounds with depth, so two selected ancestors sent a leaf
  three times as far.
- The pointer delta is converted into each node's parent space **per node** — a
  multi-selection can span groups with different ancestors, so one pointer delta
  is several different local deltas.
- Rotation converts the *pointer* instead, because the centre it measures
  against comes from the transform and is therefore already in parent space.
- Shift constrains: aspect ratio while resizing, one axis while moving, 15°
  steps while rotating. The move axis is chosen from the current delta on every
  call rather than latched at the start — latching means a gesture that begins
  with a 2 px wobble is stuck on the wrong axis for its whole duration.
- Alt resizes about the centre instead of the opposite handle.
- Rotation **wraps** into −180…180 rather than clamping. A clamp makes a node
  stop rotating after a few turns, which reads as broken.
- Resize stops at `MIN_SIZE = 1`, not 0. The schema permits a zero-sized node,
  but a gesture that produces one leaves nothing to grab and no way back except
  undo. There is no negative-size representation to flip through.

#### Resizing a rotated node

Two things must both hold, and naive implementations get one:

1. The east handle widens the node along **its own** axis, not the screen's. So
   the delta is rotated into local space before it becomes a size change.
2. The handle opposite the one being dragged must not move. This does **not**
   follow from changing the size: the format rotates about the node's centre
   (matching `transform-origin: 50% 50%` in the renderer), so growing the width
   moves the centre, which swings the anchor corner around it. The size is
   computed first, then `x`/`y` are placed so the anchor's *world* position is
   exactly what it was.

Without (2) a rotated node slides away while being resized.

### Handles

Handle positions come from the **placement**, never from a bare transform. Both
forms exist — `handlePosition` for a single transform, `placedHandlePosition`
for a placement — and the former delegates to the latter so they cannot drift.

The rotate handle is offset outside the top edge along the node's own rotated
"up", so it stays above the shape rather than above the screen.

### Snapping

Every node contributes six targets: start, centre and end on each axis, from its
`worldBounds`. The dragged set is excluded — a node must not snap to itself, and
a multi-selection must not fight its own alignment.

- Snapping is **per axis**. One axis snapping does not prevent the other.
- On a tie, **centre wins**, because centre alignment is the one an author is
  least likely to achieve by accident.
- The threshold is in **document units**, converted from screen pixels via the
  artboard scale (`thresholdInDocumentUnits`). A fixed document threshold would
  snap from half a screen away when zoomed out.
- Ctrl disables it.

## Out of scope

- **Resizing several nodes at once.** Refused, not approximated: a proportional
  box scale is not expressible as a per-node width/height change for rotated
  children, so attempting it would silently distort them. Move and rotate work
  for a multi-selection.
- Snapping to guides an author places by hand, and to distribution spacing.
  Node-to-node alignment only.
- Mobile or touch input. The editor is a desktop surface; the browser specs skip
  every non-desktop project deliberately.

## Acceptance

| Behaviour | Test |
|---|---|
| Composed placement matches the DOM | `geometry.test.ts` — `localMatrix`, `placeNodes` |
| Rotated hit-test is exact at the corners | `hit-test.test.ts` — "hits a rotated node only where the shape actually is" |
| Topmost wins, not smallest | `hit-test.test.ts` — "picks the topmost node, not the smallest" |
| Group selected, not leaf; entering reverses it | `hit-test.test.ts` — "selects the outermost group…", "selects a child directly once its group is entered" |
| Hidden skipped, locked selectable (§61) | `hit-test.test.ts` — "ignores hidden nodes entirely", "selects a locked node by default (§61)" |
| Rotated resize keeps the opposite handle | `transform-gesture.test.ts` — anchor preservation cases |
| Group-relative handles land on the shape | `transform-gesture.test.ts` — "places handles from the composed matrix…"; asserted again in the browser before the capture is saved |
| A drag inside a rotated group follows the pointer | `transform-gesture.test.ts` — "converts a document-space drag into the parent space of a rotated group" |
| Translation-only chains are unchanged by that conversion | `transform-gesture.test.ts` — "leaves a translation-only ancestor chain unchanged" |
| Pointer input reaches all of the above correctly | `tests/e2e/editor.spec.ts` — `selection` and `gestures` |

| A drag inside a transformed group tracks the pointer, in a browser | `tests/e2e/editor.spec.ts` — "follows the pointer exactly, despite a scaled and rotated ancestry" |
| An ancestor plus its descendant moves the child once | `tests/e2e/editor.spec.ts` — "a selection holding a group and its child moves the child once" |

The stress fixture's `nest-leaf` sits inside a group scaled to 0.9 inside a group
rotated 4°, which is what makes the browser assertions above meaningful: screen
pixels in, screen pixels out, so the unconverted implementation moves the node
0.9 × the pointer delta and drifts off-axis. Both tests hold ctrl, because a snap
correction is correct behaviour that ruins the measurement — the first run came
back 1.73 px off on y for exactly that reason.

Not verified: the zero-sized `nest-2` and `nest-3` groups in that fixture are
**not clickable** (a zero-sized node gets no hit target, by design), so entering
them is impossible and the selection reaches the leaf directly. Whether a group
should be hittable by its children's extent is an open question, not a decided
behaviour.
