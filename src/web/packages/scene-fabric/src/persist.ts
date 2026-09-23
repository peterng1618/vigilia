import type {
  FabricThemeEnvelope,
  FabricThemeEnvelopeInput,
} from "@vigilia/renderer-core";
import {
  Circle,
  classRegistry,
  version as fabricVersion,
  Group,
  Path,
  Rect,
  type StaticCanvas,
  Textbox,
} from "fabric/es";
// Ensures `VigiliaChart` is registered before `loadFromJSON` revives custom objects.
import { VigiliaChart } from "./chart-object.js";
import { VIGILIA_TEXT_PROPERTY } from "./fabric-text.js";
import { VIGILIA_ASSET_PROPERTY } from "./object-asset.js";
import { VIGILIA_PAINT_PROPERTY } from "./object-paint.js";

// `fabric/es` is selective: register every baseline scene class that v2 JSON
// may revive instead of relying on another renderer import to do it first.
classRegistry.setClass(Circle);
classRegistry.setClass(Path);
classRegistry.setClass(Rect);
classRegistry.setClass(Textbox);

/**
 * Single owner of Fabric scene serialization. Defaults are stripped so persisted
 * keys are authored deviations; `id` is explicitly included because Fabric omits it.
 */

export const SCENE_PERSISTED_PROPERTIES = [
  "id",
  VIGILIA_TEXT_PROPERTY,
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_ASSET_PROPERTY,
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
): Promise<void> {
  disposeScene(canvas);
  await canvas.loadFromJSON(scene);
}

/** Refuse a different Fabric runtime instead of guessing its serialization semantics. */
export async function reviveThemeEnvelope(
  canvas: StaticCanvas,
  envelope: FabricThemeEnvelope,
): Promise<void> {
  assertFabricThemeEnvelopeCompatible(envelope);
  await reviveScene(canvas, envelope.scene as SerialisedScene);
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
