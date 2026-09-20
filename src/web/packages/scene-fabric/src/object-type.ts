import { Group, type StaticCanvas } from "fabric/es";
import type { Globals } from "@vigilia/renderer-core";
import { VIGILIA_TEXT_PROPERTY } from "./fabric-text.js";

/** Reapply the first authored run's type preset to its Fabric text-object cache. */
export function applyObjectTypePresets(
  canvas: StaticCanvas,
  globals: Globals | undefined,
): void {
  if (
    typeof (canvas as unknown as { getObjects?: unknown }).getObjects !==
    "function"
  )
    return;
  applyTypes(canvas.getObjects(), globals);
  canvas.requestRenderAll();
}

/** Rewrite persisted text-run preset references before a preset is removed. */
export function reassignObjectTypePresetReferences(
  canvas: StaticCanvas,
  from: `typePresets.${string}`,
  to: `typePresets.${string}`,
): number {
  let changes = 0;
  const visit = (objects: readonly ReassignableObject[]): void => {
    for (const object of objects) {
      const text = object.get(VIGILIA_TEXT_PROPERTY);
      if (isAuthoredText(text)) {
        const runs = text.runs.map((run) => {
          if (run.typePreset !== from) return run;
          changes += 1;
          return { ...run, typePreset: to };
        });
        object.set(VIGILIA_TEXT_PROPERTY, { ...text, runs });
      }
      if (object instanceof Group) visit(object.getObjects());
    }
  };
  visit(canvas.getObjects());
  return changes;
}

function applyTypes(
  objects: readonly PaintableObject[],
  globals: Globals | undefined,
): void {
  for (const object of objects) {
    const run = firstRun(object.get(VIGILIA_TEXT_PROPERTY));
    const ref = run?.["typePreset"];
    const value =
      typeof ref === "string" && ref.startsWith("typePresets.")
        ? globals?.typePresets?.[ref.slice("typePresets.".length)]?.value
        : undefined;
    if (isPreset(value)) {
      object.set({
        fontFamily: value.family,
        fontSize: value.size,
        ...(value.weight === undefined ? {} : { fontWeight: value.weight }),
        ...(value.lineHeight === undefined
          ? {}
          : { lineHeight: value.lineHeight }),
      });
    }
    if (object instanceof Group) applyTypes(object.getObjects(), globals);
  }
}

type PaintableObject = {
  get(name: string): unknown;
  set(value: Record<string, unknown>): unknown;
};
type ReassignableObject = {
  get(name: string): unknown;
  set(name: string, value: unknown): unknown;
};

type AuthoredRun = {
  readonly typePreset?: string;
  readonly [key: string]: unknown;
};
type AuthoredText = {
  readonly runs: readonly AuthoredRun[];
  readonly [key: string]: unknown;
};

function firstRun(value: unknown): Record<string, unknown> | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as Record<string, unknown>)["runs"])
  )
    return undefined;
  const run = (value as { runs: unknown[] }).runs[0];
  return typeof run === "object" && run !== null
    ? (run as Record<string, unknown>)
    : undefined;
}

function isAuthoredText(value: unknown): value is AuthoredText {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Record<string, unknown>)["runs"])
  );
}

function isPreset(value: unknown): value is {
  family: string;
  size: number;
  weight?: string | number;
  letterSpacing?: number;
  lineHeight?: number;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["family"] === "string" &&
    typeof (value as Record<string, unknown>)["size"] === "number"
  );
}
