import {
  type FabricThemeEnvelope,
  type FabricThemeEnvelopeInput,
  VIGILIA_GLASS_PROPERTY,
  VIGILIA_NAME_PROPERTY,
} from "@vigilia/renderer-core";
import {
  Circle,
  classRegistry,
  version as fabricVersion,
  type FabricObject,
  Group,
  Path,
  Rect,
  type StaticCanvas,
  Textbox,
} from "fabric/es";
// Ensures `VigiliaChart` is registered before `loadFromJSON` revives custom objects.
import { VigiliaChart } from "./chart-object.js";
import { VIGILIA_TEXT_PROPERTY } from "./fabric-text.js";
import {
  isFabricAssetReference,
  VIGILIA_ASSET_PROPERTY,
} from "./object-asset.js";
import { VIGILIA_PAINT_PROPERTY, refusesFill } from "./object-paint.js";

// `fabric/es` is selective: register every baseline scene class that v2 JSON
// may revive instead of relying on another renderer import to do it first.
classRegistry.setClass(Circle);
classRegistry.setClass(Path);
classRegistry.setClass(Rect);
classRegistry.setClass(Textbox);

/**
 * Single owner of Fabric scene serialization. Defaults are stripped so persisted
 * keys are authored deviations; `id` is explicitly included because Fabric omits it.
 *
 * The three interaction flags are authored state, not runtime state: the lock
 * manager writes them and saves, and a theme's own background is authored
 * non-selectable. Fabric omits all three from `toObject`, so without them here a
 * revived scene hands every object Fabric's `selectable: true` — an undo would
 * turn an authored background or a locked object back into an ordinary one.
 *
 * `subTargetCheck` and `interactive` are the contrast case: Fabric forces both
 * into every `Group.toObject`, and the grouping manager arms them only while an
 * author is inside a group. They are therefore stripped after serialization;
 * `includeDefaultValues = false` cannot do it, because an armed `true` differs
 * from Fabric's `false` default and an author never authors either key.
 */

export const SCENE_PERSISTED_PROPERTIES = [
  "id",
  // The display name an author reads; the id beside it stays the stable key.
  VIGILIA_NAME_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_ASSET_PROPERTY,
  VIGILIA_GLASS_PROPERTY,
  // Which unit an inserted card was copied from (§77). A fact about the
  // document's history, so it has to survive the save like every other
  // authored key — a copy whose origin is remembered only until the first
  // save is a copy whose origin nobody can state. The key is `WidgetProvenance`'s
  // own field name on a `ThemeNode`; there is no Fabric-side constant for it,
  // and one would have a single reader.
  "provenance",
  "selectable",
  "evented",
  "locked",
] as const;

export interface SerialisedScene {
  readonly version: string;
  readonly objects: readonly Readonly<Record<string, unknown>>[];
  readonly [key: string]: unknown;
}

/** Serialize all objects with identity and without Fabric defaults. */
export function serialiseScene(canvas: StaticCanvas): SerialisedScene {
  // Keep the canvas in the same mode so stray serialization cannot emit a different shape.
  canvas.includeDefaultValues = false;
  // Fabric gradients retain undefined transform entries in memory; JSON export
  // is canonical persisted state, so normalize through JSON before validation.
  const scene = JSON.parse(
    JSON.stringify(canvas.toObject([...SCENE_PERSISTED_PROPERTIES])),
  ) as SerialisedScene;
  removeRuntimeText(scene.objects);
  removeGroupEntryFlags(scene.objects);
  removeDerivedTextClips(scene.objects);
  removeResolvedAssetSources(scene.objects);
  return scene;
}

/** Save the product envelope and Fabric object tree through their single owners. */
export function serialiseThemeEnvelope(
  canvas: StaticCanvas,
  input: FabricThemeEnvelopeInput,
): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion,
    ...input,
    scene: serialiseScene(canvas),
  };
}

/** Release chart engines before Fabric replaces the current object graph. */
export function disposeScene(canvas: StaticCanvas): void {
  disposeObjects(canvas.getObjects());
}

/** Replace the canvas contents; image/clip-path enlivening makes this async. */
export async function reviveScene(
  canvas: StaticCanvas,
  scene: SerialisedScene,
  resolveAsset?: (assetId: string) => string | undefined,
): Promise<void> {
  disposeScene(canvas);
  // `loadFromJSON` assigns every canvas-level property the document omits, so
  // the artboard clip and paint the mount installed are replaced with
  // `undefined`. Both are artboard state rather than scene state, so a scene
  // document never carries them and a revived display has no boundary at all:
  // an object outside the artboard paints over the letterbox bars. Restored
  // after the load, from the canvas's own pre-revival values.
  const clipPath = canvas.clipPath;
  const backgroundColor = canvas.backgroundColor;
  await canvas.loadFromJSON(resolveAssetSources(scene, resolveAsset));
  if (clipPath !== undefined) canvas.clipPath = clipPath;
  if (backgroundColor !== undefined) canvas.backgroundColor = backgroundColor;
  refuseUndrawablePaint(canvas.getObjects());
}

/**
 * Withholds paint the product will not draw, on **every** surface.
 *
 * Here rather than in the editor's paint pass because Fabric restores a serialised
 * fill inside `loadFromJSON`, and the player resolves no palette paints at all —
 * so a theme carrying a hand-authored filled arc reached a phone as the chord its
 * own curve is not, while the editor that authored it showed the curve. The device
 * is a lens on the document only if the two agree what the document says, and this
 * is the one function both surfaces traverse.
 *
 * The authored reference is kept, so refusing on a display does not quietly
 * rewrite the author's theme. `refusesFill` is the one answer to which kind this
 * is; nothing here restates it.
 */
function refuseUndrawablePaint(objects: readonly FabricObject[]): void {
  for (const object of objects) {
    if (object instanceof Group) refuseUndrawablePaint(object.getObjects());
    else if (refusesFill(object)) object.set("fill", "");
  }
}

/** Refuse a different Fabric runtime instead of guessing its serialization semantics. */
export async function reviveThemeEnvelope(
  canvas: StaticCanvas,
  envelope: FabricThemeEnvelope,
  resolveAsset?: (assetId: string) => string | undefined,
): Promise<void> {
  assertFabricThemeEnvelopeCompatible(envelope);
  await reviveScene(canvas, envelope.scene as SerialisedScene, resolveAsset);
}

/**
 * The scene as Fabric should load it, with every asset reference turned into
 * the URL that asset resolves to.
 *
 * `vigiliaAsset` is the authored truth and `src` is whatever the session that
 * decoded the image happened to hold — for a pasted image, a `blob:` URL that
 * means nothing in another tab, another browser, or on a phone. Fabric
 * enlivens an image from `src` alone, so resolving here rather than after the
 * load is what makes the declared bytes travel: a second load would first fail
 * on the stale URL and then flash. An asset the resolver cannot name keeps its
 * own `src`, which fails visibly rather than painting the wrong picture.
 */
function resolveAssetSources(
  scene: SerialisedScene,
  resolveAsset: ((assetId: string) => string | undefined) | undefined,
): SerialisedScene {
  if (resolveAsset === undefined) return scene;
  return {
    ...scene,
    objects: scene.objects.map((object) =>
      resolveObjectAsset(object, resolveAsset),
    ),
  };
}

function resolveObjectAsset(
  object: Readonly<Record<string, unknown>>,
  resolveAsset: (assetId: string) => string | undefined,
): Readonly<Record<string, unknown>> {
  const children = object["objects"];
  const reference = object[VIGILIA_ASSET_PROPERTY];
  const url = isFabricAssetReference(reference)
    ? resolveAsset(reference.assetId)
    : undefined;
  return {
    ...object,
    ...(url === undefined ? {} : { src: url }),
    ...(Array.isArray(children)
      ? {
          objects: children
            .filter(isRecord)
            .map((child) => resolveObjectAsset(child, resolveAsset)),
        }
      : {}),
  };
}

/** Checks compatibility before a caller replaces an already-mounted scene. */
export function assertFabricThemeEnvelopeCompatible(
  envelope: FabricThemeEnvelope,
): void {
  if (envelope.fabricVersion !== fabricVersion) {
    throw new Error(
      `Fabric ${envelope.fabricVersion} is incompatible with this Fabric ${fabricVersion} runtime.`,
    );
  }
}

function disposeObjects(objects: readonly object[]): void {
  for (const object of objects) {
    if (object instanceof VigiliaChart) {
      object.dispose();
    } else if (object instanceof Group) {
      disposeObjects(object.getObjects());
    }
  }
}

/** Fabric serializes its display cache; replace sampled text with a data-free fallback. */
function removeRuntimeText(
  objects: readonly Readonly<Record<string, unknown>>[],
): void {
  for (const object of objects) {
    const runs = valueRuns(object[VIGILIA_TEXT_PROPERTY]);
    if (runs !== undefined) {
      (object as Record<string, unknown>)["text"] = runs
        .map((run) => (run.kind === "literal" ? run.text : "—"))
        .join("");
    }
    const children = object["objects"];
    if (Array.isArray(children)) removeRuntimeText(children.filter(isRecord));
  }
}

/**
 * A text object's clip rect and its own `height` are caches of its authored
 * box, not authored state.
 *
 * Fabric serialises both, and the clip is the only thing clipping a text object
 * no refresh pass visits — an unbound label is never re-resolved, so a stale
 * rect from an earlier layout would be what a reader sees. `height` is the
 * sharper of the two: `Textbox.initDimensions` derives it from the wrapped text
 * on construction and every pass puts it back at the box, so a file that
 * carried it would show a different number the moment the document opened and
 * the editor would report the author's own document as edited (§67).
 * `vigiliaText.box` is the owner; `applyClip` and `assertBoxHeight` rebuild
 * these from it on the first refresh after revival.
 */
function removeDerivedTextClips(
  objects: readonly Readonly<Record<string, unknown>>[],
): void {
  for (const object of objects) {
    if (isRecord(object[VIGILIA_TEXT_PROPERTY])) {
      delete (object as Record<string, unknown>)["clipPath"];
      delete (object as Record<string, unknown>)["height"];
    }
    const children = object["objects"];
    if (Array.isArray(children))
      removeDerivedTextClips(children.filter(isRecord));
  }
}

/**
 * An image that names its asset does not also carry a URL.
 *
 * Fabric writes `src` on every image regardless of what the caller asked to be
 * serialised, and what it wrote is whatever session happened to decode it — for
 * a pasted image, a `blob:` handle that means nothing to the next reader. The
 * reference is the authored truth and every reader resolves it before the load,
 * so persisting the URL ships a dead handle beside the live thing.
 *
 * Only where the reference is. An image with no `vigiliaAsset` has nothing to
 * resolve, and dropping its `src` would leave a picture no one can load.
 */
function removeResolvedAssetSources(
  objects: readonly Readonly<Record<string, unknown>>[],
): void {
  for (const object of objects) {
    if (isFabricAssetReference(object[VIGILIA_ASSET_PROPERTY])) {
      delete (object as Record<string, unknown>)["src"];
    }
    const children = object["objects"];
    if (Array.isArray(children))
      removeResolvedAssetSources(children.filter(isRecord));
  }
}

/** Fabric forces both keys into `Group.toObject`; the grouping manager is their only writer. */
function removeGroupEntryFlags(
  objects: readonly Readonly<Record<string, unknown>>[],
): void {
  for (const object of objects) {
    delete (object as Record<string, unknown>)["subTargetCheck"];
    delete (object as Record<string, unknown>)["interactive"];
    const children = object["objects"];
    if (Array.isArray(children))
      removeGroupEntryFlags(children.filter(isRecord));
  }
}

function valueRuns(
  value: unknown,
):
  | readonly (
      | { readonly kind: "literal"; readonly text: string }
      | { readonly kind: "value" }
    )[]
  | undefined {
  if (!isRecord(value) || !Array.isArray(value["runs"])) return undefined;
  const runs = value["runs"];
  if (!runs.some((run) => isRecord(run) && run["kind"] === "value"))
    return undefined;
  if (
    !runs.every(
      (run) =>
        isRecord(run) &&
        ((run["kind"] === "literal" && typeof run["text"] === "string") ||
          run["kind"] === "value"),
    )
  )
    return undefined;
  return runs as readonly (
    | { readonly kind: "literal"; readonly text: string }
    | { readonly kind: "value" }
  )[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}
