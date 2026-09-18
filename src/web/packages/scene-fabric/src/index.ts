/** Fabric ScenePlan renderer. Keep Fabric out of renderer-core; player code uses `fabric/es` StaticCanvas only. */

export type { ChartSerialisedKey, VigiliaChartOptions } from './chart-object.js';

export { CHART_SERIALISED_KEYS, VigiliaChart, withoutEngineAnimation } from './chart-object.js';

export type { SceneAdapter, SceneAdapterOptions } from './adapter.js';

export { createSceneAdapter } from './adapter.js';
export { cssArtboardPaint, fabricArtboardPaint } from './artboard-paint.js';
export { applyObjectPalettePaints, VIGILIA_PAINT_PROPERTY, type FabricPaintRefs } from './object-paint.js';
export { applyObjectTypePresets, reassignObjectTypePresetReferences } from './object-type.js';
export { reassignObjectPaletteReferences } from './palette-references.js';

export type { SerialisedScene } from './persist.js';

export type { FabricThemeEnvelope, FabricThemeEnvelopeInput } from '@vigilia/renderer-core';

export {
  assertFabricThemeEnvelopeCompatible,
  disposeScene,
  reviveScene,
  reviveThemeEnvelope,
  SCENE_PERSISTED_PROPERTIES,
  serialiseScene,
  serialiseThemeEnvelope,
} from './persist.js';

export type { FabricSceneHandle, FabricSceneOptions } from './scene.js';

export { mountFabricScene } from './scene.js';

export type { UnsupportedReporter } from './fabric-nodes.js';

export {
  clampRenderScale,
  DEFAULT_RENDER_SCALE,
  MAX_BACKING_PIXELS,
  MAX_RENDER_SCALE,
} from './render-scale.js';
