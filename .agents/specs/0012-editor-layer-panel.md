# 0012 — Editor layers and tree navigation

- **Status:** behaviour retained; implementation may move into the image-editor fork under [0013](0013-fabric-scene-migration.md)
- **Design sections:** §31, §61, §137

## Requirements

- Layer rows follow scene hierarchy and show topmost siblings first.
- Hidden nodes remain listed/selectable even though canvas hit-testing ignores
  them.
- Rows show selection, local/effective visibility and lock state.
- Layer selection can reach objects/groups independently of canvas hit-testing.
- Visibility and lock can be toggled from the tree.
- Reordering changes sibling paint order: forward/back/front/back.
- Group entry/child navigation remains available.
- Ungrouping a hidden group must not unexpectedly reveal its children.

Prefer the source fork's layer/z-order mechanisms where available; do not keep a
parallel Vigilia layer model merely to preserve existing implementation.

## Layout direction

Exact panel placement is not architectural. The chosen editor foundation may
restructure the UI as long as layers and property editing stay easily reachable.
Do not preserve the legacy left/right panel layout solely for compatibility.

## Acceptance

Browser tests should prove:

- hidden objects can be selected and restored through layers;
- visibility/lock toggles affect the scene;
- reorder changes paint order;
- group hierarchy/navigation is represented correctly;
- ungroup preserves effective hidden appearance.