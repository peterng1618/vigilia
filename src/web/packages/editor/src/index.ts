/** Desktop authoring over the shared renderer; generic editor mechanics are migration targets. */

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

export type { HitTestOptions, MarqueeOptions } from './selection/domain/hit-test.js';

export { hitTest, hitTestDeep, hitTestInside, marqueeSelect, normalizeBounds } from './selection/domain/hit-test.js';

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

export type { SnapGuide, SnapOptions, SnapResult, SnapTarget } from './snapping/resolver.js';
export { SnappingManager } from './snapping/index.js';

export { collectSnapTargets, snapMove, thresholdInDocumentUnits } from './snapping/resolver.js';

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

export type { History, HistoryEntry } from './document/history.js';

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
} from './document/history.js';

export type {
  FieldDescriptor,
  FieldKind,
  FieldOption,
  FieldSource,
  InspectorSection,
} from './inspector/model.js';

export { describeSelection, globalOptions } from './inspector/model.js';

export type { FieldChange } from './inspector/apply.js';

export { applyFieldChange, labelForField } from './inspector/apply.js';

export type { SelectionMode, SelectionState } from './selection/domain/selection-state.js';

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
} from './selection/domain/selection-state.js';

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
} from './globals/commands.js';

export { createGlobalsPanel, type GlobalsPanel } from './globals-panel.js';
export { GlobalsManager } from './globals/index.js';
export type { GlobalAction } from './globals/domain/global-action.js';
export { GLOBAL_GROUP_META, seedForGroup } from './globals/domain/groups.js';

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
} from './arrange/commands.js';
export { ArrangeManager } from './arrange/index.js';

export { nodeLabel } from './node-label.js';
export {
  buttonStyle,
  createButton,
  inputStyle,
  scrollAreaStyle,
  sectionHeadingStyle,
  type ButtonOptions,
} from './button.js';
export { buildLayerTree, type LayerRow } from './layers/tree.js';
export { LayersManager } from './layers/index.js';
export {
  createLayersPanel,
  type LayerPanelAction,
  type LayersPanel,
  type LayersPanelCallbacks,
} from './layers-panel.js';

