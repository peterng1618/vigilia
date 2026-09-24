import type { FabricPalette, Globals } from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";

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
  readonly globals: Globals | undefined;
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
  globals: Globals | undefined,
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
