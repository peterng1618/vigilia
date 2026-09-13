/**
 * Desktop authoring: interaction and inspectors over the shared renderer.
 *
 * ADR-0005 settled the shape of this package. It does **not** render — it
 * consumes `@vigilia/renderer-core`'s plan/mount path, the same one the player
 * uses, and adds selection, gestures and inspector UI on top. §31 is then
 * satisfied by construction rather than by discipline, because there is only one
 * renderer to keep honest.
 *
 * Everything here is deliberately pure where it can be: geometry, hit-testing,
 * selection and (next) transform gestures are values and functions, unit-tested
 * in Node. The DOM layer turns pointer events into those calls and draws the
 * result. That is the same split `plan.ts` / `mount.ts` uses in the renderer,
 * for the same reason — a decision buried in an event handler is a decision
 * nobody can test.
 *
 * §47's bundle budget does **not** apply here. The editor is desktop-hosted and
 * unconstrained; the budget exists to keep the *player* small, which is why this
 * package may grow dependencies the player never sees.
 */

export type { Bounds, Matrix2D, PlacedNode, Point } from './geometry.js';

export {
  IDENTITY,
  applyMatrix,
  boundsContain,
  boundsIntersect,
  containsPoint,
  corners,
  invert,
  localMatrix,
  multiply,
  outermostOnly,
  placeNodes,
  unionBounds,
  worldBounds,
} from './geometry.js';

export type { HitTestOptions, MarqueeOptions } from './hit-test.js';

export { hitTest, hitTestDeep, hitTestInside, marqueeSelect, normalizeBounds } from './hit-test.js';

export type { GestureModifiers, GestureNode, GestureStart, Handle } from './transform-gesture.js';

export {
  MIN_SIZE,
  ROTATION_SNAP_DEGREES,
  applyGesture,
  handlePosition,
  normalizeDegrees,
  preserveAnchor,
  toLocalDelta,
  toLocalPoint,
  worldCentre,
} from './transform-gesture.js';

export type { SnapGuide, SnapOptions, SnapResult, SnapTarget } from './snapping.js';

export { collectSnapTargets, snapMove, thresholdInDocumentUnits } from './snapping.js';

export type { ReorderTarget } from './commands.js';

export {
  collectIds,
  deleteNodes,
  findNode,
  insertNodes,
  renameNode,
  reorderNode,
  setNodeFlags,
  updateStyle,
  updateTransforms,
} from './commands.js';

export type { History, HistoryEntry } from './history.js';

export {
  DEFAULT_HISTORY_LIMIT,
  canRedo,
  canUndo,
  cancelPreview,
  commit,
  createHistory,
  isDirty,
  markSaved,
  preview,
  redo,
  redoLabel,
  replaceDocument,
  undo,
  undoLabel,
  visibleDocument,
} from './history.js';

export type {
  FieldDescriptor,
  FieldKind,
  FieldOption,
  FieldSource,
  InspectorSection,
} from './inspector-model.js';

export { describeSelection, globalOptions } from './inspector-model.js';

export type { FieldChange } from './inspector-apply.js';

export { applyFieldChange, labelForField } from './inspector-apply.js';

export type { SelectionMode, SelectionState } from './selection.js';

export {
  addToSelection,
  applyClick,
  clearSelection,
  emptySelection,
  enterGroup,
  exitAllGroups,
  exitGroup,
  isSelected,
  pruneSelection,
  setSelection,
} from './selection.js';

export {
  addGlobal,
  collectGlobalUsage,
  deleteGlobal,
  isValidGlobalKey,
  nextGlobalKey,
  referencesTo,
  rekeyGlobal,
  renameGlobal,
  setGlobalValue,
  type GlobalReference,
  type GlobalUsage,
} from './globals-commands.js';

export { createGlobalsPanel, seedForGroup, type GlobalAction, type GlobalsPanel } from './globals-panel.js';

export {
  alignNodes,
  composeTransforms,
  describeRefusal,
  distributeNodes,
  freeGroupId,
  groupNodes,
  ungroupNodes,
  type AlignEdge,
  type ArrangeRefusal,
  type ArrangeResult,
} from './arrange.js';

export { nodeLabel } from './node-label.js';
export {
  buttonStyle,
  createButton,
  inputStyle,
  scrollAreaStyle,
  sectionHeadingStyle,
  type ButtonOptions,
} from './button.js';
export { buildLayerTree, type LayerRow } from './layers-model.js';
export {
  createLayersPanel,
  type LayerPanelAction,
  type LayersPanel,
  type LayersPanelCallbacks,
} from './layers-panel.js';

