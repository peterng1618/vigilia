# BR-002 — A text box's side handle gets no edge snapping

- **Status:** open. Found by the Task 9 behaviour matrix, not repaired.
- **Impact:** resizing a text box by its `ml`/`mr` handle never snaps to a
  neighbour's edge, while the same drag on a shape or a group does. Users get
  two different resize behaviours from the same handle.
- **Evidence:** `src/web/tests/e2e/snapping.spec.ts` drives the resize matrix
  through the `br` corner for all three active target kinds, because a
  Textbox's `ml`/`mr` is not a scale action. Fabric replaces those two controls
  with `changeWidth`/`changeHeight`, so
  `isScaleAction` in
  `packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts`
  rejects the step and no plan is ever made. A drag of the same handle to a
  landing 2 units short of a neighbour's edge left the width raw at every
  target tried.
- **Pickup:** decide whether a text side handle should snap. Either extend the
  scale path to own `changeWidth` steps, or rule that text boxes resize without
  snapping and record the ruling where the other snapping decisions live. The
  matrix's `mr` case should follow whichever is chosen.
