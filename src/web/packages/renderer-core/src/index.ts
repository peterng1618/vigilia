/** Shared renderer/domain surface for editor and display. Keep it free of editor-only dependencies. */

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

export { reassignChartPaintReferences, resolveChartPaint } from './charts/chart-paint.js';

export {
  colorAt,
  normalizePosition,
  resolveFlatColor,
  resolveThresholdColor,
  toLinearGradient,
} from './charts/fill.js';

export type { ChartOption, ChartOptionByFamily } from './charts/engine-option.js';

export { toEngineOption } from './charts/engine-option.js';

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

export type { ChartPaintFieldDescriptor, SettingsFieldDescriptor, SettingsFieldKind } from './charts/settings-fields.js';

export {
  CHART_SETTINGS_FIELDS,
  CHART_PAINT_FIELDS,
  chartPaintFieldsFor,
  NON_SCALAR_SETTINGS,
  settingsFieldsFor,
  settingsKeyFor,
} from './charts/settings-fields.js';

export type {
  Artboard,
  BackgroundMedia,
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
  PalettePaint,
  ImageContent,
  NodeType,
  RectangleContent,
  StyleMap,
  StyleValue,
  TextContent,
  TextRun,
  TypePreset,
  ThemeDocument,
  ThemeMetadata,
  ThemeNode,
  Transform,
  VideoContent,
  WidgetProvenance,
} from './theme/document.js';

export {
  CHART_FAMILIES,
  GLOBAL_GROUPS,
  MAX_ARTBOARD_DIMENSION,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  NODE_TYPES,
  STABLE_ID_PATTERN,
  SUPPORTED_SCHEMA_VERSION,
  bumpSemanticVersion,
  isSemanticVersion,
  requiredSemanticKeys,
  walkBindings,
  walkNodes,
} from './theme/document.js';

export type { IssueCode, ValidationIssue, ValidationResult } from './theme/validate.js';

export { validateThemeDocument } from './theme/validate.js';

export { serializeThemeDocument } from './theme/serialize.js';

export type {
  FabricGlobals,
  FabricPalette,
  FabricPaletteEntry,
  FabricThemeEnvelope,
  FabricThemeEnvelopeInput,
} from './theme/fabric-envelope.js';

export { fabricEnvelopeInputFor } from './theme/fabric-envelope.js';

export type { FabricEnvelopeValidationResult } from './theme/fabric-envelope-validate.js';

export { validateFabricThemeEnvelope } from './theme/fabric-envelope-validate.js';

export type { AssetResolver, AssetResolverOptions } from './theme/assets.js';

export { createAssetResolver, isSafeAssetPath, noAssets } from './theme/assets.js';

export type {
  InstantiateWidgetOptions,
  InstantiateWidgetResult,
  WidgetIssue,
} from './theme/widget.js';

export { instantiateWidget } from './theme/widget.js';

export type { SampleSource } from './data/source.js';

export { emptySampleSource } from './data/source.js';

export type { SampleStoreOptions } from './data/store.js';

export { SampleStore, defaultSampleStoreOptions } from './data/store.js';

export type { DecodeResult, SampleBatch, SampleEntry } from './data/protocol.js';

export {
  PROTOCOL_VERSION,
  SAMPLE_EVENT,
  SAMPLE_STREAM_PATH,
  createBatch,
  decodeBatch,
  formatSseEvent,
} from './data/protocol.js';

export type {
  EventSourceLike,
  LiveSourceHandle,
  LiveSourceOptions,
  LiveSourceStatus,
} from './data/live-source.js';

export { createLiveSource } from './data/live-source.js';

export type { CapabilityGroup } from './theme/capabilities.js';

export {
  DERIVED_CAPABILITIES,
  NODE_CAPABILITIES,
  STYLE_PROPERTIES,
  STYLE_PROPERTIES_BY_GROUP,
  TRANSFORM_PROPERTIES_BY_GROUP,
  allowsStyleProperty,
  anyHasCapability,
  hasCapability,
  isDerivedCapability,
  isKnownStyleProperty,
  stylePropertiesFor,
  transformPropertiesFor,
} from './theme/capabilities.js';

export type {
  SemanticFamily,
  SemanticKeyDescriptor,
  SensorTier,
} from './data/semantic-keys.js';

export {
  SEMANTIC_KEYS,
  describeSemanticKey,
  isKnownSemanticKey,
  labelForSemanticKey,
  semanticKeysByFamily,
} from './data/semantic-keys.js';

export type {
  PlanBox,
  ChartPlanContext,
  PlanChart,
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
  buildChartPlan,
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
