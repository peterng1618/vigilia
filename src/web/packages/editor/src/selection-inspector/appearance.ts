import type {
  FabricGlobals,
  FabricPalette,
  TypePreset,
} from "@vigilia/renderer-core";
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

/** The object's own palette reference, if it carries one. */
export function paintReferenceOf(
  object: FabricObject,
): `palette.${string}` | undefined {
  const paint = object.get(PAINT_PROPERTY) as
    | { readonly fill?: unknown; readonly stroke?: unknown }
    | undefined;
  const ref = paint?.fill ?? paint?.stroke;

  return typeof ref === "string" && ref.startsWith("palette.")
    ? (ref as `palette.${string}`)
    : undefined;
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

/** A read-only line naming a token and what it resolves to. */
export function createResolutionLine(
  label: string,
  ref: string | undefined,
  resolved: string | undefined,
): HTMLElement {
  const line = document.createElement("p");
  line.className = "vigilia-resolution";
  line.dataset["vigiliaResolution"] = label;

  if (ref === undefined) {
    line.textContent = `${label}: ${uiCopy.inspectorFields.notSet}`;
    return line;
  }

  // An unresolvable reference is reported, never blanked: the author chose it,
  // so they must be told it no longer answers.
  line.textContent =
    resolved === undefined
      ? `${label}: ${ref} (${uiCopy.inspectorFields.unresolved})`
      : `${label}: ${ref} → ${resolved}`;
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
 */
export function createOpacityField(
  context: AppearanceContext,
  object: FabricObject,
  onChange: () => void,
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

    object.set({ opacity: percent / 100 });
    object.setCoords();
    context.editor.canvas.requestRenderAll();
    context.editor.historyManager.saveState();
    onChange();
  });

  label.append(input);
  return label;
}
