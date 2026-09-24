/** Fabric ScenePlan renderer. Keep Fabric out of renderer-core; player code uses `fabric/es` StaticCanvas only. */

export type {
  FabricThemeEnvelope,
  FabricThemeEnvelopeInput,
} from "@vigilia/renderer-core";
export type { SceneAdapter, SceneAdapterOptions } from "./adapter.js";
export { createSceneAdapter } from "./adapter.js";
export {
  artboardPaintKey,
  cssArtboardPaint,
  fabricArtboardPaint,
} from "./artboard-paint.js";
export {
  type BackgroundMediaHandle,
  type BackgroundMediaOptions,
  type BackgroundMediaSource,
  mountBackgroundMedia,
} from "./background-media.js";
export type {
  ChartSerialisedKey,
  VigiliaChartOptions,
} from "./chart-object.js";
export {
  CHART_SERIALISED_KEYS,
  VigiliaChart,
  withoutEngineAnimation,
} from "./chart-object.js";
export { type ChartRefreshRate, startChartRefresh } from "./chart-refresh.js";
export type { UnsupportedReporter } from "./fabric-nodes.js";
export {
  applyAuthoredText,
  refreshBoundText,
  VIGILIA_TEXT_PROPERTY,
} from "./fabric-text.js";
export { type FontAssetLoadOptions, loadFontAssets } from "./font-assets.js";
export {
  type FabricAssetReference,
  objectAssetReference,
  setObjectAssetReference,
  VIGILIA_ASSET_PROPERTY,
} from "./object-asset.js";
export {
  applyObjectPalettePaints,
  type FabricPaintRefs,
  VIGILIA_PAINT_PROPERTY,
} from "./object-paint.js";
export {
  applyObjectTypePresets,
  reassignObjectTypePresetReferences,
} from "./object-type.js";
export { reassignObjectPaletteReferences } from "./palette-references.js";
export type { SerialisedScene } from "./persist.js";
export {
  assertFabricThemeEnvelopeCompatible,
  disposeScene,
  reviveScene,
  reviveThemeEnvelope,
  SCENE_PERSISTED_PROPERTIES,
  serialiseScene,
  serialiseThemeEnvelope,
} from "./persist.js";
export {
  clampRenderScale,
  DEFAULT_RENDER_SCALE,
  MAX_BACKING_PIXELS,
  MAX_RENDER_SCALE,
} from "./render-scale.js";
export type { FabricSceneHandle, FabricSceneOptions } from "./scene.js";
export { mountFabricScene } from "./scene.js";
