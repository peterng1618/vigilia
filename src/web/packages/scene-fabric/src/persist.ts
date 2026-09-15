import type { StaticCanvas } from 'fabric/es';
// Side-effect import, not a convenience: `chart-object.ts` ends with
// `classRegistry.setClass(VigiliaChart)`, and without that having run,
// `loadFromJSON` revives a saved chart as a plain object with no `_render`.
// Importing it here means the revival path cannot be reached without the
// registration, however the module graph is later rearranged.
import './chart-object.js';

/**
 * The one owner of scene ⇄ JSON.
 *
 * Everything about *what a saved scene contains* is decided here rather than at
 * a call site, because both of the decisions below fail silently at a call site
 * that gets them wrong.
 *
 * ## Defaults are stripped
 *
 * `includeDefaultValues` defaults to `true`, which emits **33 keys for a
 * `Rect`** against 7 with stripping on. Turning it off is not a size
 * optimisation; it is what makes three other rules hold at once:
 *
 * - Every persisted key is an **authored deviation**, and every absent key
 *   means "the default of the Fabric major the envelope records". §134 asks
 *   that geometry is never reinterpreted under a default that moved, and this
 *   plus a major-version refusal gives that for all 33 keys. Stage 1 gave it
 *   for two, by re-adding `originX`/`originY` in a `toObject` override; that
 *   override is withdrawn, and this is what replaced it.
 * - `subTargetCheck`, `interactive` and `layoutManager` — editor interaction
 *   state and engine internals that `Group.toObject` forces into its output
 *   unconditionally — are all at their defaults in a display scene, so they
 *   vanish without a hand-maintained allow-list. **They come back the moment
 *   the editor enables group entry** (spec 0013 stage 4), and `persist.test.ts`
 *   pins both halves so that arrives as a failing test rather than as a
 *   surprise in a saved document.
 * - The document is roughly a third the size, which is the least of it.
 *
 * ## Identity is an argument, and that is the hazard
 *
 * Fabric persists no `id`. Measured: `canvas.toObject(['id'])` propagates the
 * request down through `__serializeObjects` into every nested group's children,
 * and `loadFromJSON` revives it as an own property — so identity costs no
 * subclassing and no `customProperties` on six built-in classes.
 *
 * What it costs instead is that **`canvas.toObject()` without the argument
 * emits no `id` at all, and reports nothing**. A saved scene with no ids loses
 * every binding, every plan-to-object match and the whole layer tree, and looks
 * fine until something tries to resolve one. That is why this module exists as
 * a module: there is one call, and `persist.test.ts` fails if a second appears.
 */

/**
 * Object keys Vigilia adds to Fabric's own persisted surface.
 *
 * `id` only. It is neither authored configuration nor derived state — the two
 * categories the custom-property rule is written around — but **identity**:
 * generated once, never edited, and required, because matching a plan node to
 * its object by position in `_objects` breaks silently on the first insert.
 */
export const SCENE_PERSISTED_PROPERTIES = ['id'] as const;

/**
 * A serialised canvas, as `toObject` emits it.
 *
 * `version` is Fabric's own stamp — the string the envelope's recorded major
 * is asserted against, rather than stated a second time beside it.
 */
export interface SerialisedScene {
  readonly version: string;
  readonly objects: readonly Readonly<Record<string, unknown>>[];
  readonly [key: string]: unknown;
}

/** Serialises every object on the canvas, with identity and without defaults. */
export function serialiseScene(canvas: StaticCanvas): SerialisedScene {
  // Set rather than saved-and-restored. Restoring would leave the canvas in a
  // state where a stray `toObject` elsewhere emits a different document, which
  // is exactly the divergence this module exists to make impossible.
  canvas.includeDefaultValues = false;

  return canvas.toObject([...SCENE_PERSISTED_PROPERTIES]) as SerialisedScene;
}

/**
 * Revives a serialised scene onto a canvas, replacing whatever it held.
 *
 * The adapter then *configures* these objects rather than recreating them —
 * `adoptExisting` indexes them by the `id` this carries back. Async because
 * `loadFromJSON` enlivens images and clip paths.
 */
export async function reviveScene(canvas: StaticCanvas, scene: SerialisedScene): Promise<void> {
  await canvas.loadFromJSON(scene);
}
