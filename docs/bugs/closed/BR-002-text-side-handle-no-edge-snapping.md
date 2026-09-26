# BR-002 — A text box's side handle gets no edge snapping

- **Status:** resolved.
- **Impact:** resizing a text box by its `ml`/`mr` handle never snapped to a
  neighbour's edge, while the same drag on a shape or a group did. Users got
  two different resize behaviours from the same handle.
- **Evidence:** the Task 9 matrix drove the resize half through the `br` corner
  for all three active target kinds, because a Textbox's `ml`/`mr` is not a scale
  action. Fabric gives a text box `changeWidth` side controls
  (`createResizeControls`, `actionName: RESIZING`), so the gesture fires
  `object:resizing` with `transform.action === "resizing"` and mutates canonical
  `width` — it never reaches `object:scaling`, where `isScaleAction` in
  `scale-snapping-controller.ts` is the only gate. A drag 2 units short of a
  neighbour's edge left the width raw at every target tried.
- **Ruling:** a text side handle **does** snap. The source of truth already
  implements it — the fork carries `text-width-resize-projection.ts` and
  `text-width-resize-interaction-controller.ts` for exactly `ml`/`mr` — and
  §175 requires the resulting behaviour to match the source in practice. Ruling
  it out would be a documented regression against the plan this bug was deferred
  from, and would keep the two handles disagreeing, which is the impact above.
- **Resolution:** a fourth module under `snap-manager/scaling/`. The canonical
  variable is the Textbox's **width**, not a scale multiplier, because
  `changeWidth` exists so the text re-wraps instead of stretching.
  `object:resizing` is now bound beside `object:scaling`, and the gesture runs on
  the shared `ScaleSnappingRuntime`, so hold, release and the Ctrl escape hatch
  are the same code the scale path uses. The fork's fork-specific coupling is
  stripped: it read `EditorTextbox`/`BackgroundTextbox` (`autoExpand`,
  `dynamicMinWidth`, padding and corner radii) and published guides through
  `editor.snappingManager`, where Vigilia has plain `fabric/es` `Textbox` and
  returns them. `applyEditorControls` hides `mt`/`mb`, so `ml`/`mr` are the whole
  of the gap.
- **Verification:** 6 dom cases pass
  (`packages/editor/src/snap-manager/text-width-resize.dom.test.ts`), asserting
  the resolved width rather than a count. Commenting out the `object:resizing`
  binding turns 3 of the 6 red. Two browser cases in `snapping.spec.ts` drive the
  `mr` handle — geometry and Ctrl — and the file's 36 cases pass; with the
  binding removed and the editor rebuilt, the geometry case fails.
