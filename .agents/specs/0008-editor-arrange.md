# 0008 — Grouping, alignment and distribution

- **Status:** implemented
- **Design document sections:** §57, §61, §137, §159
- **Specs superseded:** none

## Problem

§159 lists "grouping/alignment and snapping" as Gate 2 acceptance. Snapping
existed; grouping and alignment did not, so an author could build a panel out of
five elements and had no way to keep them together or line them up.

Grouping is also the one operation that fights §57. Transforms **compose**
rather than being baked — except that moving a node between parents forces its
coordinates to be re-expressed, and for some ancestries the result is not
expressible at all.

## Behaviour

### Grouping

The new group takes the selection's bounding box **in the shared parent's
space**, and each child's coordinates become relative to it. World bounds would
offset the group by every ancestor's translation.

- Children keep their relative paint order, whatever order they were clicked.
- The group is inserted where the **topmost** member was, so grouping never
  changes what covers what (§137).
- A rotated member contributes its axis-aligned extent, so the group contains
  what the node actually covers rather than its unrotated width.
- Grouping is **structural, never visual**: every member stays on exactly the
  same pixels.

Refusals:

| Case | Reason |
|---|---|
| Fewer than two nodes | `needs-two` |
| Selection spans two parents | `mixed-parents` |

Cross-parent grouping is refused rather than implemented. It needs each node's
coordinates re-expressed in a different space — the shear problem below — and
"group these three, two of which live in another group" has no obvious right
answer.

A selection containing both a group and something inside it is reduced to the
group first (`outermostOnly`, spec 0004), so grouping a group with its own child
is not a case that arises.

### Ungrouping

Each child's transform absorbs the group's, so nothing moves. This is the only
place the editor bakes a transform, and it is unavoidable.

The format allows `translate × rotate(θ) × scale(sx, sy)` about a node's centre.
Composing two gives a linear part `R(a)·S(g) · R(b)·S(c)`, which collapses back
into that form only when

- **the group's scale is uniform** — then it commutes with the child's
  rotation — or
- **the child is unrotated** (0 mod 360).

Otherwise the product is a **shear**, and no `{rotation, scaleX, scaleY}`
expresses it. Ungrouping then **refuses** (`would-shear`) rather than baking an
approximation that would move the author's artwork. A group scaled on one axis
containing a rotated child is three clicks away, so this is not theoretical.

Where it is representable:

- The group's scale goes into each child's **size**, not its scale factors. A
  scaled group is usually a layout decision, and a baked size is what an author
  edits next. (The first implementation did both, so a 2× group made its child
  2× bigger *and* left it at scale 2 — 4× on screen. A unit test comparing world
  bounds caught it.)
- Rotations add, and `x`/`y` are **solved** rather than derived: `localMatrix`
  applies the translation last, so `x`/`y` are exactly the difference between
  where the rotate-scale part lands and where it must land.
- Children return to the group's own position in paint order.
- A locked group refuses (§61).

### Alignment

To the **selection's** bounds, never the artboard's: aligning two nodes to the
artboard's left edge stacks them in a corner, which is never what the gesture
means. Six edges — left, centre, right, top, middle, bottom.

The delta is measured between world bounds and written into the parent's space,
the same conversion a drag needs and wrong in the same invisible way if skipped:
a −200 world delta inside a 2× group is −100 locally.

Locked nodes are excluded (§61), which can make a two-node selection refuse as
`needs-two` — correct, because there is one movable node and nothing to align it
to.

### Distribution

Equalises the **gaps** between neighbours, not the spacing of their centres.
With mixed sizes the two differ, and equal gaps is what "distribute" means to
anyone looking at the result; equal centres leaves a wide element visually
crowding its neighbours.

- Sorted by position, not by selection order.
- The outermost two do not move — they define the span.
- Needs three. Two nodes are "distributed" at any spacing, so it would be a
  no-op that still wrote an undo entry.

### Refusals are spoken, not silent

Every refusal returns the document unchanged, so the caller skips the undo entry
by identity, and the reason is put in the status bar. An author cannot see from
a selection that two nodes are in different groups, so a shortcut that silently
does nothing reads as broken.

The toolbar disables what is unusable (align needs two, distribute needs three),
so the common cases are visible before they are attempted rather than explained
afterwards.

## Out of scope

- **Undo does not restore the selection.** History stores documents, not
  selections, so undoing a group leaves nothing selected — the group it held no
  longer exists and `pruneSelection` drops it. Asserted in a browser test so it
  is a recorded decision rather than a surprise. Restoring it means storing a
  selection per history entry, which is worth doing when there is a reason
  stronger than symmetry.
- **Align and distribute relative to the artboard**, or to a chosen "key"
  object. Both are common and neither is needed to satisfy §159.
- **Distributing by equal centres.** Named here only so the difference from the
  implemented rule is on record.
- **Moving a node between parents by dragging.** Grouping and ungrouping are the
  only re-parenting operations; a drag never changes a node's parent.
- Multi-node **resize**, which remains refused (spec 0004).

## Acceptance

| Behaviour | Test |
|---|---|
| Group box is the members' bounds in the parent's space | `arrange.test.ts` — "wraps the selection in a group whose box is their bounds", "groups inside a group, relative to that group" |
| Grouping moves nothing | "leaves every member exactly where it was on screen" |
| Paint order and stacking position preserved | "keeps the members in paint order…", "puts the group where the topmost member was…" |
| A rotated member is contained by its real extent | "includes a rotated member by its axis-aligned extent" |
| Cross-parent grouping refuses, untouched | "refuses a selection spanning two parents" |
| Ungrouping is exact for translation, rotation and uniform scale | "absorbs a translation-only group…", "absorbs a rotated group into a rotated child, exactly", "absorbs a uniformly scaled group by baking the size" |
| A shearing composition refuses | "refuses when the composition would be a shear"; `composeTransforms` returns undefined |
| 360° is not a rotation | "treats a 360° child rotation as unrotated" |
| Align uses selection bounds, and writes parent-space deltas | "aligns right to the rightmost member", "writes into the parent space when the parent is transformed" |
| Distribute equalises gaps, sorts by position, fixes the ends | "equalises the gaps, not the centres", "sorts by position rather than by selection order", "leaves the outermost two alone" |
| The shortcuts and toolbar reach all of it | `tests/e2e/editor.spec.ts` — `grouping and alignment` |

Not verified: no browser test ungroups a **rotated** group — the demo theme's
panels are translation-only, and the rotated cases are unit-tested only. The
`would-shear` refusal has likewise never been triggered through the UI, because
no fixture has a non-uniformly scaled group containing a rotated child; the
stress theme's `nest-3` is uniformly scaled.
