/** Shared renderer/domain surface for editor and display. Keep it free of editor-only dependencies. */

export type {
  ArtboardBars,
  ArtboardCrop,
  ArtboardSize,
  ArtboardTransform,
  ComputeArtboardTransformInput,
  FitMode,
  Point,
  ViewportSize,
} from "./artboard.js";
export {
  computeArtboardTransform,
  documentToViewport,
  isFullyVisible,
  toCssTransform,
  viewportToDocument,
} from "./artboard.js";
export type {
  BarDataItem,
  BarInput,
  BarOption,
  BarOrientation,
  BarSettings,
} from "./charts/bar.js";
export {
  buildBarOption,
  defaultBarSettings,
  toBarColor,
  toBarDataItem,
} from "./charts/bar.js";
export {
  reassignChartPaintReferences,
  resolveChartPaint,
} from "./charts/chart-paint.js";
export type {
  ChartOption,
  ChartOptionByFamily,
} from "./charts/engine-option.js";
export { toEngineOption } from "./charts/engine-option.js";
export type {
  EngineColor,
  GradientDirection,
  LinearGradientColor,
} from "./charts/fill.js";
export {
  colorAt,
  normalizePosition,
  resolveFlatColor,
  resolveThresholdColor,
  toLinearGradient,
} from "./charts/fill.js";

export type { GaugeOption } from "./charts/gauge.js";

export {
  approximateGradient,
  buildGaugeOption,
  mixHex,
  toColorSegments,
} from "./charts/gauge.js";

export type {
  Interpolation,
  LineOption,
  LineSettings,
  SeriesInput,
  SeriesPoint,
} from "./charts/line.js";

export {
  buildLineOption,
  defaultLineSettings,
  linePlaybackDelayMs,
  toEngineColor,
  toSeriesPoints,
} from "./charts/line.js";
export type {
  PieComposition,
  PieDataItem,
  PieOption,
  PieSettings,
  PieSlice,
  PieSliceInput,
  PieTotal,
} from "./charts/pie.js";
export {
  buildPieOption,
  computeComposition,
  defaultPieSettings,
} from "./charts/pie.js";
export type {
  ChartPaintFieldDescriptor,
  SettingsFieldDescriptor,
  SettingsFieldKind,
} from "./charts/settings-fields.js";
export {
  CHART_PAINT_FIELDS,
  CHART_SETTINGS_FIELDS,
  chartPaintFieldsFor,
  NON_SCALAR_SETTINGS,
  settingsFieldsFor,
  settingsKeyFor,
} from "./charts/settings-fields.js";
export type {
  EventSourceLike,
  LiveSourceHandle,
  LiveSourceOptions,
  LiveSourceStatus,
} from "./data/live-source.js";
export {
  createLiveSource,
  LIVE_SOURCE_CHART_PLAYBACK_DELAY_MS,
} from "./data/live-source.js";
export type {
  DecodeResult,
  SampleBatch,
  SampleEntry,
} from "./data/protocol.js";
export {
  createBatch,
  decodeBatch,
  formatSseEvent,
  PROTOCOL_VERSION,
  SAMPLE_EVENT,
  SAMPLE_STREAM_PATH,
} from "./data/protocol.js";
export type {
  SemanticFamily,
  SemanticKeyDescriptor,
  SensorTier,
} from "./data/semantic-keys.js";
export {
  DISK_DEVICE_QUANTITIES,
  type DiskDeviceQuantity,
  type DiskKeyDescriptor,
  describeDiskKey,
  describeSemanticKey,
  diskDeviceId,
  diskDeviceOf,
  isKnownSemanticKey,
  labelForSemanticKey,
  SEMANTIC_KEYS,
  semanticKeysByFamily,
} from "./data/semantic-keys.js";
export type { SampleSource } from "./data/source.js";
export { emptySampleSource } from "./data/source.js";
export type { SampleStoreOptions } from "./data/store.js";
export { defaultSampleStoreOptions, SampleStore } from "./data/store.js";
export {
  GENERIC_FAMILIES,
  isGenericFamily,
  missingFontFamilies,
  parseFontStack,
  requestedFontFamilies,
  unavailableFontFamilies,
} from "./scene/fonts.js";
export type { MountOptions, SceneHandle } from "./scene/mount.js";
export { mountScene } from "./scene/mount.js";
export type {
  ChartPlanContext,
  PlanBox,
  PlanChart,
  PlanContent,
  PlanContext,
  PlanIssue,
  PlanNode,
  PlanTextLayout,
  PlanTextSegment,
  ResolvedStyle,
  ScenePlan,
} from "./scene/plan.js";
export {
  buildChartPlan,
  buildScenePlan,
  computeMaxLines,
  formatNumber,
  formatUnit,
  MISSING_VALUE_TEXT,
  resolveStyleValue,
  resolveTextSegments,
} from "./scene/plan.js";
export type { AssetResolver, AssetResolverOptions } from "./theme/assets.js";
export {
  createAssetResolver,
  isSafeAssetPath,
  noAssets,
} from "./theme/assets.js";
export type { CapabilityGroup } from "./theme/capabilities.js";
export {
  allowsStyleProperty,
  anyHasCapability,
  DERIVED_CAPABILITIES,
  hasCapability,
  isDerivedCapability,
  isKnownStyleProperty,
  NODE_CAPABILITIES,
  STYLE_PROPERTIES,
  STYLE_PROPERTIES_BY_GROUP,
  stylePropertiesFor,
  TRANSFORM_PROPERTIES_BY_GROUP,
  transformPropertiesFor,
} from "./theme/capabilities.js";
export type {
  Artboard,
  AssetLicense,
  AssetReference,
  BackgroundMedia,
  Binding,
  ChartContent,
  ChartFamily,
  FontAssetReference,
  GlobalEntry,
  GlobalGroup,
  GlobalGroupName,
  GlobalRef,
  Globals,
  ImageContent,
  NodeType,
  PalettePaint,
  RectangleContent,
  StyleMap,
  StyleValue,
  TextContent,
  TextRun,
  ThemeDocument,
  ThemeMetadata,
  ThemeNode,
  Transform,
  TypePreset,
  VideoContent,
  WidgetProvenance,
} from "./theme/document.js";
export {
  bumpSemanticVersion,
  CHART_FAMILIES,
  GLOBAL_GROUPS,
  isSemanticVersion,
  MAX_ARTBOARD_DIMENSION,
  MAX_NODE_COUNT,
  MAX_NODE_DEPTH,
  NODE_TYPES,
  requiredSemanticKeys,
  STABLE_ID_PATTERN,
  SUPPORTED_SCHEMA_VERSION,
  walkBindings,
  walkNodes,
} from "./theme/document.js";
export type {
  FabricGlobals,
  FabricPalette,
  FabricPaletteEntry,
  FabricThemeEnvelope,
  FabricThemeEnvelopeInput,
} from "./theme/fabric-envelope.js";
export { fabricEnvelopeInputFor } from "./theme/fabric-envelope.js";
export type { FabricEnvelopeValidationResult } from "./theme/fabric-envelope-validate.js";
export { validateFabricThemeEnvelope } from "./theme/fabric-envelope-validate.js";
export { serializeThemeDocument } from "./theme/serialize.js";
export type {
  IssueCode,
  ValidationIssue,
  ValidationResult,
} from "./theme/validate.js";
export { validateThemeDocument } from "./theme/validate.js";
export type {
  InstantiateWidgetOptions,
  InstantiateWidgetResult,
  WidgetIssue,
} from "./theme/widget.js";
export { instantiateWidget } from "./theme/widget.js";
export type {
  Fill,
  GaugeSettings,
  GradientStop,
  Sample,
  SensorStatus,
} from "./types.js";
export { defaultGaugeSettings, hasPlottableValue } from "./types.js";
