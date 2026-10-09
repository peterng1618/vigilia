import {
  type GlassTreatment,
  glassTreatment,
  MAX_GLASS_BLUR_RADIUS,
  supportsGlass,
  VIGILIA_GLASS_PROPERTY,
} from "@vigilia/renderer-core";
import { applyObjectPalettePaints } from "@vigilia/scene-fabric";
import { type FabricObject, Group } from "fabric/es";
import { frostedShapeFill } from "../new-object-defaults.js";
import { uiCopy } from "../ui-copy.js";
import type { AppearanceContext } from "./appearance.js";
import { paintRefs, writeRef } from "./panel.js";
import type { FieldView } from "./view.js";

/**
 * The authored frosted-glass treatment: an enable and a blur radius, both on
 * the existing `vigiliaGlass` property. Nothing here invents a scene model —
 * the property is `renderer-core`'s, the lifecycle is `scene-fabric`'s, and this
 * is the control that writes one and tells the other.
 */

/**
 * The radius a panel gets when the author turns the treatment on.
 *
 * A value to move, not a rule: a treatment with no blur is valid and shows
 * nothing, so enabling one has to leave something visible. It sits inside the
 * band Task 1 measured flat, and it is **not** measured off the reference image
 * — that image is a design mockup over a photograph, not a rendering whose
 * radius can be read back.
 */
const DEFAULT_GLASS_BLUR_RADIUS = 16;

/**
 * The kind name the treatment is written in. Fabric lowercases the instance's
 * `type`, so the class's own static is the spelling the envelope, the published
 * schema and `supportsGlass` all use — and therefore the one to ask with.
 */
function kindOf(object: FabricObject): string {
  return (object.constructor as { readonly type?: string }).type ?? object.type;
}

/**
 * Whether the control is offered enabled. The membership is the owner's and is
 * asked, never restated: a copy of `GLASS_OBJECT_TYPES` here would agree with it
 * only until someone added a kind there and forgot this file, and then a shape
 * would be frostable in a theme and un-authorable in the editor with no error
 * anywhere.
 *
 * `Group` is the one subtraction, and it is a different fact from membership
 * rather than a second copy of it — checked on the live class, because that is
 * what Fabric's overridden `drawObject` is. Fabric renders a group's children
 * directly, so a group never fires `before:render` and there is no boundary to
 * sample its backdrop through; `scene-fabric/src/glass.ts` refuses the
 * treatment there. Enabling it would take an edit that paints nothing, so the
 * author is told in this control's own reason instead.
 *
 * Kept apart from `panel.ts`'s `supportsPanelFields` on purpose. That answers
 * "may these fields write this object's material?" — a group has no own fill,
 * radius or border. This answers "may its backdrop be sampled?", and the two
 * differ on `Polyline`, `Line` and `Path`: those have material and no closed
 * area. `glass.dom.test.ts` checks this against `supportsGlass` for every kind
 * Fabric ships, so widening either set cannot reopen the gap silently.
 */
export function supportsGlassControl(object: FabricObject): boolean {
  return supportsGlass(kindOf(object)) && !(object instanceof Group);
}

/**
 * Why this control is refused, in the selected shape's own terms, or
 * `undefined` when it is offered. One function, so "offered enabled" and "why
 * not" cannot drift into answering two different questions.
 */
function refusalOf(object: FabricObject): string | undefined {
  return supportsGlassControl(object)
    ? undefined
    : uiCopy.inspectorFields.glassRefused(kindOf(object));
}

/**
 * The reason, and where it is carried.
 *
 * It is **not** a tooltip any more. Bible §5.3 has a refused control render in
 * the row with its reason readable by everyone, and plan 1's `refused` prop is
 * that: `aria-disabled` plus the reason as visible words, so a keyboard user who
 * never sees a hover still reads it. `ControlRow` is the one owner of that
 * treatment, and `tooltip.ts` the one owner of what a tooltip is — this module
 * builds neither.
 */

/** The panel's authored treatment, or none. */
function treatmentOf(object: FabricObject): GlassTreatment | undefined {
  return glassTreatment(object);
}

/** Removes the property outright: an ordinary panel carries no treatment at all. */
function clearTreatment(object: FabricObject): void {
  delete (object as unknown as Record<string, unknown>)[VIGILIA_GLASS_PROPERTY];
}

/**
 * Writes the treatment and asks `renderer-core`'s own reader whether it is one.
 *
 * The reader, not a check of its own, is what accepts the value — so the
 * control is refused by the same code that refuses it at import. `false` means
 * the object was left exactly as it was.
 */
function writeTreatment(
  object: FabricObject,
  next: number | undefined,
): boolean {
  const before = object.get(VIGILIA_GLASS_PROPERTY);
  if (next === undefined) {
    clearTreatment(object);
    return true;
  }
  object.set(VIGILIA_GLASS_PROPERTY, { blurRadius: next });
  if (treatmentOf(object) !== undefined) return true;
  if (before === undefined) clearTreatment(object);
  else object.set(VIGILIA_GLASS_PROPERTY, before);
  return false;
}

/**
 * Puts the frosted surface on a card that is carrying the default one, and
 * resolves the paint so the canvas shows it this frame rather than the next.
 *
 * Nothing here is a second copy of the surface rule: `new-object-defaults`
 * wrote the default this is compared against, and `panel.ts` owns both how a
 * paint reference is read and how it is written. What is left is the decision
 * to apply the answer, which belongs to the control the author used.
 */
function frostTheSurface(
  context: AppearanceContext,
  object: FabricObject,
): void {
  const frost = frostedShapeFill(context.globals, paintRefs(object).fill);
  if (frost === undefined) return;
  writeRef(object, "fill", frost);
  // The shell's own channel, for the same reason `panel.ts` passes it: this is a
  // whole-canvas pass, so an arc elsewhere in the scene is refused by it too and
  // must not do so in silence.
  applyObjectPalettePaints(context.editor.canvas, context.globals, {
    onRefusedPaint: (message) =>
      context.editor.errorManager.warn("paint", message),
  });
}

/**
 * The glass fields for any selection, offered enabled or refused with a reason.
 *
 * The control used to be withheld from a shape that could not carry the
 * treatment, which left nothing anywhere saying so: an author who inserted a
 * `Line` and found no frosted-glass control could only infer the rule from its
 * absence, and could not tell a deliberate rule from a shape the editor had not
 * caught up with. It is always here now, and says the shape's own reason.
 *
 * Values, not controls: React renders them through the control set and
 * `index.ts` writes them through {@link writeGlassField}. The reason rides
 * `FieldBase.refused`, so plan 1's `ControlRow` renders it as words in the row
 * rather than a tooltip only a pointer could reach — the reason is a refusal and
 * §5.3 keeps refusals out of tooltips.
 */
export function glassFields(object: FabricObject): readonly FieldView[] {
  const refusal = refusalOf(object);
  const fields: FieldView[] = [
    {
      id: "glass-enabled",
      control: "toggle",
      label: uiCopy.inspectorFields.glassEnabled,
      checked: treatmentOf(object) !== undefined,
      data: { "data-vigilia-glass-enabled": "" },
      ...(refusal === undefined ? {} : { refused: refusal }),
    },
  ];

  // Only offered when there is a treatment for it to change: a blur box over a
  // panel with no glass accepts an edit and applies none.
  const treatment = treatmentOf(object);
  if (treatment !== undefined) {
    fields.push({
      id: "glass-blur",
      control: "number",
      label: uiCopy.inspectorFields.glassBlur,
      value: treatment.blurRadius,
      // The pre-plan field refused a fraction unconditionally; the boundary
      // re-checks it. See `panelMaterialFields`.
      integer: true,
      data: { "data-vigilia-glass-blur": "" },
    });
  }

  return fields;
}

/**
 * Writes one of the glass fields and hands back whether the edit applied.
 *
 * `supportsGlassControl` is re-checked here rather than trusted to the control:
 * a bypassed toggle must not write a treatment the renderer would never
 * composite, which is the same rule the predicate states.
 *
 * The blur lands on the ceiling rather than being refused: `MAX_GLASS_BLUR_RADIUS`
 * is the validator's bound, asked of the owner, and the pre-plan field taught it
 * by landing on it. Turning the treatment on also puts the frosted surface on
 * the card; see {@link frostTheSurface}.
 */
export function writeGlassField(
  object: FabricObject,
  context: AppearanceContext,
  fieldId: string,
  value: string | number | boolean,
): boolean {
  if (fieldId === "glass-enabled") {
    if (!supportsGlassControl(object)) return false;
    if (value === true) {
      if (!writeTreatment(object, DEFAULT_GLASS_BLUR_RADIUS)) return false;
      frostTheSurface(context, object);
      return true;
    }
    // Turning it off restores nothing: what it would restore is the author's own
    // default, and overwriting that is the same edit in reverse.
    clearTreatment(object);
    return true;
  }

  if (fieldId === "glass-blur" && typeof value === "number") {
    return writeTreatment(
      object,
      Math.min(Math.max(value, 0), MAX_GLASS_BLUR_RADIUS),
    );
  }

  return false;
}
