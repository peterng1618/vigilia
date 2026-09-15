/**
 * Shared renderer — the single rendering path used by both the editor and the
 * display-only player.
 *
 * §31: shared rendering prevents editor/display drift. Anything exported here is
 * available to the player, so it must stay free of editor UI, inspectors and
 * component-framework dependencies (§47).
 *
 * The scene path is migrating from the DOM applier to Fabric (spec 0013), and
 * §47 gets sharper rather than looser as a result: the player may import
 * `StaticCanvas` and object classes from `fabric/es`, never the interactive
 * `Canvas`, and never bare `fabric` — which is a pre-bundled entry no
 * tree-shaker can see into. An import-boundary test enforces both, because the
 * size gate has enough slack to miss them.
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

// Which settings each chart family accepts — the one owner of that question,
// consumed by the editor's inspector. Previously it had four encodings (the
// settings interfaces, the defaults, the validator, the schema) and the editor
// had a fifth: none, which is why no chart setting was editable.
export type { SettingsFieldDescriptor, SettingsFieldKind } from './charts/settings-fields.js';

export {
  CHART_SETTINGS_FIELDS,
  NON_SCALAR_SETTINGS,
  settingsFieldsFor,
  settingsKeyFor,
} from './charts/settings-fields.js';

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
  requiredSemanticKeys,
  walkBindings,
  walkNodes,
} from './theme/document.js';

export type { IssueCode, ValidationIssue, ValidationResult } from './theme/validate.js';

export { validateThemeDocument } from './theme/validate.js';

export { serializeThemeDocument } from './theme/serialize.js';

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

// The host↔display wire contract. Exported from the shared library because
// both ends import it — one definition, compiler-checked on both sides, rather
// than the hand-mirrored pair ADR-0007 replaced.
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

// The capability matrix (spec 0011) — which entity may carry which property,
// and the single owner of the style property vocabulary. Shared because the
// renderer paints these properties and the editor offers them, and the list
// previously had five homes with nothing relating them.
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

// The semantic key vocabulary (§93). Shared for the same reason the wire
// contract is: the host declares which keys it can read and the editor offers
// them to an author, so the spelling must have one owner.
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
