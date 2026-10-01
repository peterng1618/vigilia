import {
  chartPaintFieldsFor,
  type FabricGlobals,
  type FabricPalette,
  isObjectName,
  objectName,
  type TypePreset,
} from "@vigilia/renderer-core";
import { VigiliaChart } from "@vigilia/scene-fabric";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";
import { textRunsOf } from "./runs.js";

/**
 * Appearance of the selected object: its opacity and what its paint and type
 * references resolve to. An author picks a token by name today and cannot see
 * what it means, which is the difference between guessing and choosing.
 *
 * Resolution uses the existing owners — `resolveStyleValue` for style values and
 * the palette entry for a token — never a second resolver.
 */

const PAINT_PROPERTY = "vigiliaPaint";

export interface AppearanceContext {
  readonly editor: EditorInteraction;
  readonly globals: FabricGlobals | undefined;
}

/** A palette reference, and the name its own owner gives that paint. */
export interface PaintReference {
  readonly label: string;
  readonly ref: `palette.${string}`;
}

/**
 * Every palette reference the selection is painted with.
 *
 * A box or a text run keeps one, in `vigiliaPaint`. A chart keeps its paint in
 * the settings its family owns, so it is read from there under the field
 * descriptor's own name — otherwise the resolution line reported every chart in
 * every theme as unpainted while it was painted.
 */
export function paintReferencesOf(
  object: FabricObject,
): readonly PaintReference[] {
  if (object instanceof VigiliaChart) {
    return chartPaintReferencesOf(object);
  }

  const paint = object.get(PAINT_PROPERTY) as
    | { readonly fill?: unknown; readonly stroke?: unknown }
    | undefined;
  const ref = paletteRef(paint?.fill ?? paint?.stroke);

  return ref === undefined
    ? []
    : [{ label: uiCopy.inspectorFields.paint, ref }];
}

function chartPaintReferencesOf(
  chart: VigiliaChart,
): readonly PaintReference[] {
  const settings = chart.settings as unknown as Record<string, unknown>;
  const references: PaintReference[] = [];

  for (const field of chartPaintFieldsFor(chart.family)) {
    const declared = settings[field.property];
    const entries = Array.isArray(declared)
      ? declared
      : declared === undefined
        ? []
        : [declared];

    for (const [index, entry] of entries.entries()) {
      const ref = paletteRef(paintRef(entry));
      if (ref !== undefined) {
        references.push({
          label:
            field.multiple === true
              ? `${field.label} ${index + 1}`
              : field.label,
          ref,
        });
      }
    }
  }

  return references;
}

/** A chart's persisted paint is a `ChartPaint`: a reference or a literal fill. */
function paintRef(paint: unknown): unknown {
  return typeof paint === "object" && paint !== null
    ? (paint as { readonly ref?: unknown }).ref
    : undefined;
}

function paletteRef(value: unknown): `palette.${string}` | undefined {
  return typeof value === "string" && value.startsWith("palette.")
    ? (value as `palette.${string}`)
    : undefined;
}

/**
 * What the author calls the thing a reference points at, or the reference itself
 * when the document no longer declares it.
 *
 * The name, because every surface that offers a reference names what it offers
 * — the palette panel, the run editor, the preset panel — and a line that prints
 * `typePresets.24-400` beside a dropdown printing `Card title` reads as two
 * different things. The ref is the fallback, not the label, because a token the
 * author has deleted has no name left and its reference is then the only thing
 * that identifies the dangling use.
 */
export function nameOfRef(
  globals: FabricGlobals | undefined,
  ref: string | undefined,
): string | undefined {
  if (ref === undefined) {
    return undefined;
  }

  if (ref.startsWith("palette.")) {
    const palette = globals?.palette as FabricPalette | undefined;
    return palette?.[ref.slice("palette.".length)]?.name ?? ref;
  }

  if (ref.startsWith("typePresets.")) {
    return (
      globals?.typePresets?.[ref.slice("typePresets.".length)]?.name ?? ref
    );
  }

  return ref;
}

/** What a palette token currently resolves to, for display. */
export function resolveToken(
  globals: FabricGlobals | undefined,
  ref: string | undefined,
): string | undefined {
  if (ref === undefined || !ref.startsWith("palette.")) {
    return undefined;
  }

  const palette = globals?.palette as FabricPalette | undefined;
  const entry = palette?.[ref.slice("palette.".length)];
  if (entry === undefined) {
    return undefined;
  }

  const value = entry.value as
    | { readonly kind?: string; readonly color?: string }
    | string;

  if (typeof value === "string") {
    return value;
  }

  return value.kind === "gradient" ? "gradient" : value.color;
}

/**
 * The type preset a text object is set in. The model names a preset per *run*,
 * and `applyObjectTypePresets` paints the object from its first run, so the
 * object's own type is that same run's reference — one owner, not a second rule.
 */
export function typePresetOf(
  object: FabricObject,
): `typePresets.${string}` | undefined {
  const ref = textRunsOf(object)[0]?.typePreset;
  return ref === undefined ? undefined : ref;
}

/** What a type preset resolves to, in the terms the author chose it by. */
export function resolveTypePreset(
  globals: FabricGlobals | undefined,
  ref: string | undefined,
): string | undefined {
  if (ref === undefined || !ref.startsWith("typePresets.")) {
    return undefined;
  }

  const preset = globals?.typePresets?.[ref.slice("typePresets.".length)] as
    | { readonly value?: TypePreset }
    | undefined;
  const value = preset?.value;
  if (value === undefined) {
    return undefined;
  }

  // "Inter 600 16px" — the family, weight and size the author would see in the
  // preset panel, without duplicating its fields.
  return [value.family, value.weight, `${value.size}px`]
    .filter((part) => part !== undefined && part !== "")
    .join(" ");
}

/**
 * A read-only line naming a reference and what it resolves to. `shown` is what
 * the author reads — the authored name where the document declares one, and the
 * stored reference where it does not. See `nameOfRef`.
 */
export function createResolutionLine(
  label: string,
  shown: string | undefined,
  resolved: string | undefined,
): HTMLElement {
  const line = document.createElement("p");
  line.className = "vigilia-resolution";
  line.dataset["vigiliaResolution"] = label;

  if (shown === undefined) {
    line.textContent = `${label}: ${uiCopy.inspectorFields.notSet}`;
    return line;
  }

  // An unresolvable reference is reported, never blanked: the author chose it,
  // so they must be told it no longer answers.
  line.textContent =
    resolved === undefined
      ? `${label}: ${shown} (${uiCopy.inspectorFields.unresolved})`
      : `${label}: ${shown} → ${resolved}`;
  return line;
}

/**
 * Reveals the type-preset panel. The panel already owns a preset's fields, so
 * the inspector links to it rather than growing a second set that could drift.
 */
export function createTypePresetReveal(onReveal: () => void): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset["vigiliaRevealTypePresets"] = "";
  button.textContent = uiCopy.inspectorFields.editTypePresets;
  button.addEventListener("click", onReveal);
  return button;
}

/**
 * Opacity, shown as a percentage and stored as Fabric's 0–1, saving history once
 * per committed edit.
 *
 * `stillTarget` is asked before the write: a field that held focus across a
 * selection change belongs to the object it was built for, not to the one now
 * selected.
 */
export function createOpacityField(
  context: AppearanceContext,
  object: FabricObject,
  stillTarget: (object: FabricObject) => boolean,
): HTMLElement {
  const label = document.createElement("label");
  label.textContent = uiCopy.inspectorFields.opacity;

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "100";
  input.step = "1";
  input.dataset["vigiliaOpacity"] = "";
  input.value = String(Math.round(object.opacity * 100));

  input.addEventListener("change", () => {
    const percent = Number(input.value);

    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      // Refuse rather than clamp: the author must see their input rejected.
      input.value = String(Math.round(object.opacity * 100));
      context.editor.errorManager.warn(
        "controls",
        uiCopy.inspectorFields.invalidValue,
      );
      return;
    }

    if (!stillTarget(object)) return;
    object.set({ opacity: percent / 100 });
    object.setCoords();
    context.editor.canvas.requestRenderAll();
    context.editor.historyManager.saveState();
  });

  label.append(input);
  return label;
}

let nameSeq = 0;

/**
 * The object's display name — the one control that says what a layer is called,
 * as against the id every reference uses. An empty field clears the name rather
 * than storing a blank label, so the layer list falls back to the id exactly as
 * it does for a scene authored before the field existed.
 */
export function createNameField(
  context: AppearanceContext,
  object: FabricObject,
  stillTarget: (object: FabricObject) => boolean,
): HTMLElement {
  const authored = objectName(object);
  const label = document.createElement("label");
  label.textContent = uiCopy.inspectorFields.name;
  const input = document.createElement("input");
  input.type = "text";
  input.dataset["vigiliaName"] = "";
  input.value = authored ?? "";
  label.htmlFor = input.id = `vigilia-name-${++nameSeq}`;

  const refuse = (): void => {
    input.value = authored ?? "";
    context.editor.errorManager.warn(
      "controls",
      uiCopy.inspectorFields.invalidName,
    );
  };

  // `change`, not per keystroke: a half-typed name is not an edit, and this
  // writes history.
  input.addEventListener("change", () => {
    const trimmed = input.value.trim();
    if (trimmed !== "" && !isObjectName(trimmed)) {
      refuse();
      return;
    }
    if (!stillTarget(object)) return;
    // Removing the key, not storing blank: the id is what the projection falls
    // back to, so an emptied field must leave the object exactly as an
    // unnamed one is.
    object.set("name", trimmed === "" ? undefined : trimmed);
    object.setCoords();
    context.editor.canvas.requestRenderAll();
    // The layer row prints this name, so the layer panel has to be told. It
    // subscribes to the same signal a drag reports, which is why this fires it
    // rather than holding a second path to the projection.
    context.editor.canvas.fire(
      "object:modified" as never,
      {
        target: object,
      } as never,
    );
    context.editor.historyManager.saveState();
  });

  return row(label, input);
}

/** The inspector's own field row: a label and its control on one line. */
function row(label: HTMLLabelElement, input: HTMLInputElement): HTMLElement {
  const host = document.createElement("div");
  host.className = "vigilia-field";
  host.append(label, input);
  return host;
}
