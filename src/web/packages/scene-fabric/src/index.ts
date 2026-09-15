/**
 * Renders a `ScenePlan` onto a Fabric canvas.
 *
 * This package exists to keep Fabric **out** of `@vigilia/renderer-core`, whose
 * barrel the Node host imports runtime values from. The boundary is therefore
 * structural rather than a convention: the host has no dependency edge to here,
 * so a browser scene graph cannot reach its bundle however carelessly someone
 * imports.
 *
 * Two rules apply to everything in this package, both asserted by
 * `packages/player/src/boundaries.test.ts`:
 *
 * - Import Fabric from **`fabric/es`** only. The default entry is one
 *   pre-bundled file no tree-shaker can see into — 95.0 KB gzip against
 *   49.3 KB for the same imports, with identical types.
 * - Never the interactive **`Canvas`**. The adapter works against a
 *   `StaticCanvas`, and `@vigilia/editor` constructs the interactive one, so
 *   the player never pays for +31.0 KB of pointer handling it cannot use.
 *
 * Spec 0013 has the measurements and the staging.
 */

export type { ChartSerialisedKey, VigiliaChartOptions } from './chart-object.js';

export { CHART_SERIALISED_KEYS, VigiliaChart, withoutEngineAnimation } from './chart-object.js';

export type { SceneAdapter, SceneAdapterOptions } from './adapter.js';

export { createSceneAdapter } from './adapter.js';

export type { SerialisedScene } from './persist.js';

export { reviveScene, SCENE_PERSISTED_PROPERTIES, serialiseScene } from './persist.js';

export type { FabricSceneHandle, FabricSceneOptions } from './scene.js';

export { mountFabricScene } from './scene.js';

export type { UnsupportedReporter } from './fabric-nodes.js';

export {
  clampRenderScale,
  DEFAULT_RENDER_SCALE,
  MAX_BACKING_PIXELS,
  MAX_RENDER_SCALE,
} from './render-scale.js';
