/**
 * Shared renderer — the single rendering path used by both the editor and the
 * display-only player.
 *
 * §31: shared rendering prevents editor/display drift. Anything exported here is
 * available to the player, so it must stay free of editor UI, inspectors and
 * component-framework dependencies (§47).
 */

export type {
  Fill,
  GaugeSettings,
  GradientStop,
  Sample,
  SensorStatus,
} from './types.js';

export { defaultGaugeSettings, hasPlottableValue } from './types.js';

export type {
  ArtboardBars,
  ArtboardCrop,
  ArtboardSize,
  ArtboardTransform,
  ComputeArtboardTransformInput,
  FitMode,
  Point,
  ViewportSize,
} from './artboard.js';

export {
  computeArtboardTransform,
  documentToViewport,
  isFullyVisible,
  toCssTransform,
  viewportToDocument,
} from './artboard.js';

export type {
  EngineColor,
  GradientDirection,
  LinearGradientColor,
} from './charts/fill.js';

export {
  colorAt,
  normalizePosition,
  resolveFlatColor,
  resolveThresholdColor,
  toLinearGradient,
} from './charts/fill.js';

export type { GaugeOption } from './charts/gauge.js';

export {
  approximateGradient,
  buildGaugeOption,
  mixHex,
  toColorSegments,
} from './charts/gauge.js';

export type {
  Interpolation,
  LineOption,
  LineSettings,
  SeriesInput,
  SeriesPoint,
} from './charts/line.js';

export {
  buildLineOption,
  defaultLineSettings,
  toEngineColor,
  toSeriesPoints,
} from './charts/line.js';

export type {
  BarDataItem,
  BarInput,
  BarOption,
  BarOrientation,
  BarSettings,
} from './charts/bar.js';

export { buildBarOption, defaultBarSettings, toBarColor, toBarDataItem } from './charts/bar.js';

export type {
  PieComposition,
  PieDataItem,
  PieOption,
  PieSettings,
  PieSlice,
  PieSliceInput,
  PieTotal,
} from './charts/pie.js';

export { buildPieOption, computeComposition, defaultPieSettings } from './charts/pie.js';

export type {
  Artboard,
  AssetLicense,
  AssetReference,
  Binding,
  ChartContent,
  ChartFamily,
  GlobalEntry,
  GlobalGroup,
  GlobalGroupName,
  GlobalRef,
  Globals,
  ImageContent,
  NodeType,
  RectangleContent,
  StyleMap,
  StyleValue,
  TextContent,
  TextRun,
  ThemeDocument,
  ThemeMetadata,
  ThemeNode,
  Transform,
  VideoContent,
} from './theme/document.js';

export {
  CHART_FAMILIES,
  GLOBAL_GROUPS,
  MAX_ARTBOARD_DIMENSION,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  NODE_TYPES,
  SUPPORTED_SCHEMA_VERSION,
  requiredSemanticKeys,
  walkBindings,
  walkNodes,
} from './theme/document.js';

export type { IssueCode, ValidationIssue, ValidationResult } from './theme/validate.js';

export { validateThemeDocument } from './theme/validate.js';

export { serializeThemeDocument } from './theme/serialize.js';

export type { SampleSource } from './data/source.js';

export { emptySampleSource } from './data/source.js';

export type { SampleStoreOptions } from './data/store.js';

export { SampleStore, defaultSampleStoreOptions } from './data/store.js';

export type {
  PlanBox,
  PlanContent,
  PlanContext,
  PlanIssue,
  PlanNode,
  PlanTextLayout,
  PlanTextSegment,
  ResolvedStyle,
  ScenePlan,
} from './scene/plan.js';

export {
  MISSING_VALUE_TEXT,
  buildScenePlan,
  computeMaxLines,
  formatNumber,
  formatUnit,
  resolveStyleValue,
} from './scene/plan.js';

export {
  GENERIC_FAMILIES,
  isGenericFamily,
  missingFontFamilies,
  parseFontStack,
  requestedFontFamilies,
  unavailableFontFamilies,
} from './scene/fonts.js';

export type { MountOptions, SceneHandle } from './scene/mount.js';

export { mountScene } from './scene/mount.js';
