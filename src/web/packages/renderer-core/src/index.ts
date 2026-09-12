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

export type { GaugeOption } from './charts/gauge.js';

export {
  approximateGradient,
  buildGaugeOption,
  mixHex,
  toColorSegments,
} from './charts/gauge.js';
