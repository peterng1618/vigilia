/** Fabric ScenePlan renderer. Keep Fabric out of renderer-core; player code uses `fabric/es` StaticCanvas only. */

export type { ChartSerialisedKey, VigiliaChartOptions } from './chart-object.js';

export { CHART_SERIALISED_KEYS, VigiliaChart, withoutEngineAnimation } from './chart-object.js';

export type { SceneAdapter, SceneAdapterOptions } from './adapter.js';

export { createSceneAdapter } from './adapter.js';

export type { SerialisedScene } from './persist.js';

export { disposeScene, reviveScene, SCENE_PERSISTED_PROPERTIES, serialiseScene } from './persist.js';

export type { FabricSceneHandle, FabricSceneOptions } from './scene.js';

export { mountFabricScene } from './scene.js';

export type { UnsupportedReporter } from './fabric-nodes.js';

export {
  clampRenderScale,
  DEFAULT_RENDER_SCALE,
  MAX_BACKING_PIXELS,
  MAX_RENDER_SCALE,
} from './render-scale.js';
