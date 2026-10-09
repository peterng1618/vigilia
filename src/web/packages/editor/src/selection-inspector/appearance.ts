import {
  chartPaintFieldsFor,
  type FabricGlobals,
  type FabricPalette,
  objectName,
  type TypePreset,
} from "@vigilia/renderer-core";
import { VigiliaChart } from "@vigilia/scene-fabric";
import type { FabricObject } from "fabric/es";
import type { EditorInteraction } from "../editor-interaction.js";
import { uiCopy } from "../ui-copy.js";
import { textRunsOf } from "./authored-text.js";
import type { FieldView } from "./view.js";

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
 * What a resolution line says after its label: `shown` is what the author reads
 * — the authored name where the document declares one, and the stored reference
 * where it does not (see `nameOfRef`) — or, absent, the `notSet` word.
 *
 * One owner for the sentence, because the selection's Spends rows and the
 * Document pane's list are two renderings of it: the `notSet` and `unresolved`
 * cases keep their full length in both, since "no longer resolves" is a fact
 * the author needs rather than a word to shorten.
 */
function resolutionValue(
  shown: string | undefined,
  resolved: string | undefined,
): string {
  if (shown === undefined) return uiCopy.inspectorFields.notSet;
  // An unresolvable reference is reported, never blanked: the author chose it,
  // so they must be told it no longer answers.
  return resolved === undefined
    ? `${shown} (${uiCopy.inspectorFields.unresolved})`
    : `${shown} → ${resolved}`;
}

/**
 * A read-only line naming a reference and what it resolves to, as the Document
 * pane mounts it. `label` is both the row's own name and its hook.
 */
export function createResolutionLine(
  label: string,
  shown: string | undefined,
  resolved: string | undefined,
): HTMLElement {
  const line = document.createElement("p");
  line.className = "vigilia-resolution";
  line.dataset["vigiliaResolution"] = label;
  line.textContent = `${label}: ${resolutionValue(shown, resolved)}`;
  return line;
}

/**
 * The selection's own resolution line as a **value**: the read-only row React
 * renders in Spends. A separate id from `label` because two rows can carry the
 * same label — a group whose children use two different paint tokens answers
 * with two `Paint` lines — and React keys, and the column's row identity, need
 * something that tells them apart.
 */
export function resolutionField(
  id: string,
  label: string,
  shown: string | undefined,
  resolved: string | undefined,
): FieldView {
  return {
    id,
    control: "readOnly",
    label,
    value: resolutionValue(shown, resolved),
    data: { "data-vigilia-resolution": label },
  };
}

/**
 * Opacity, shown as a percentage and stored as Fabric's 0–1.
 *
 * A bounded number — Fabric's own 0–1, projected here as 0–100 — so it is a
 * slider: bible §5's vocabulary says a bounded number gets a track, and
 * `inspector-controls.html` names opacity as its example. The glass blur drew
 * the same conclusion one directory away. The percentage conversion is the
 * projection's, so the number an author reads is the number the row commits,
 * and `writeOpacity` still refuses a value outside 0–100 before it writes — the
 * control's bounds stop the gesture, and the writer is the guard for a
 * bypassed commit.
 */
export function opacityField(object: FabricObject): FieldView {
  return {
    id: "opacity",
    control: "slider",
    label: uiCopy.inspectorFields.opacity,
    value: Math.round(object.opacity * 100),
    min: 0,
    max: 100,
    integer: true,
    data: { "data-vigilia-opacity": "" },
  };
}

/**
 * The object's display name — the one control that says what a layer is called,
 * as against the id every reference uses. An empty field clears the name rather
 * than storing a blank label, so the layer list falls back to the id exactly as
 * it does for a scene authored before the field existed.
 */
export function nameField(object: FabricObject): FieldView {
  return {
    id: "name",
    control: "text",
    label: uiCopy.inspectorFields.name,
    value: objectName(object) ?? "",
    data: { "data-vigilia-name": "" },
  };
}
