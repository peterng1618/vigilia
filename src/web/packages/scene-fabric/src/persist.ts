import type { StaticCanvas } from 'fabric/es';
// Ensures `VigiliaChart` is registered before `loadFromJSON` revives custom objects.
import './chart-object.js';

/**
 * Single owner of Fabric scene serialization. Defaults are stripped so persisted
 * keys are authored deviations; `id` is explicitly included because Fabric omits it.
 */

export const SCENE_PERSISTED_PROPERTIES = ['id'] as const;

export interface SerialisedScene {
  readonly version: string;
  readonly objects: readonly Readonly<Record<string, unknown>>[];
  readonly [key: string]: unknown;
}

/** Serialize all objects with identity and without Fabric defaults. */
export function serialiseScene(canvas: StaticCanvas): SerialisedScene {
  // Keep the canvas in the same mode so stray serialization cannot emit a different shape.
  canvas.includeDefaultValues = false;

  return canvas.toObject([...SCENE_PERSISTED_PROPERTIES]) as SerialisedScene;
}

/** Replace the canvas contents; image/clip-path enlivening makes this async. */
export async function reviveScene(canvas: StaticCanvas, scene: SerialisedScene): Promise<void> {
  await canvas.loadFromJSON(scene);
}
