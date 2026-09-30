import {
  type GlassTreatment,
  glassTreatment,
  VIGILIA_GLASS_PROPERTY,
} from "@vigilia/renderer-core";
import { applyObjectPalettePaints } from "@vigilia/scene-fabric";
import {
  Circle,
  Ellipse,
  type FabricObject,
  Polygon,
  Rect,
  Triangle,
} from "fabric/es";
import { numberField } from "../editor-shell/controls/number-field.js";
import { frostedShapeFill } from "../new-object-defaults.js";
import { uiCopy } from "../ui-copy.js";
import type { AppearanceContext } from "./appearance.js";
import { paintRefs, writeRef } from "./panel.js";

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

let glassSeq = 0;

export interface GlassFieldHooks {
  /** False once the fields describe a different object; the edit is refused. */
  readonly stillTarget: () => boolean;
  /** Repaints and records: one history entry per committed edit. */
  readonly commit: () => void;
  /** Re-reads the object, so the fields show what was just written. */
  readonly onChange: () => void;
  /**
   * Re-resolves the glass lifecycle. The handle re-resolves when the canvas
   * gains or loses an object, and a property written on a panel that is already
   * there is neither — so the control that changes it is what has to ask.
   * Without this the blur appears only after an undo.
   */
  readonly refreshGlass: () => void;
}

/**
 * Whether these controls apply at all. The question is whether the object's
 * backdrop can be sampled through a closed path, and the kinds that qualify
 * are the closed primitives plus a group — `Group` is here only because
 * `renderer-core` admits it and `scene-fabric` refuses it loudly at attach,
 * since Fabric replaces `drawObject` and a group never fires `before:render`.
 *
 * Widened from `instanceof Rect` with the treatment itself: the frosted
 * surface needs a closed path to sample through, and `Circle`, `Ellipse`,
 * `Triangle` and `Polygon` all have one. A control that refused them would
 * have accepted the ruling's premise — the shapes are frostable — and then
 * given the author no way to say so. See
 * `docs/decisions/0015-glass-clips-any-closed-path-not-only-rects.md`.
 *
 * Kept apart from `panel.ts`'s `supportsPanelFields` on purpose. That answers
 * "may these fields write this object's material?" — a group has no own fill,
 * radius or border. This answers "may its backdrop be sampled?", and the two
 * differ on `Polyline`, `Line` and `Path`: those have material and no closed
 * area. `glass.dom.test.ts` names every kind the published schema allows that
 * this one leaves un-authorable, so widening that schema cannot reopen the
 * gap silently.
 */
export function supportsGlassControl(object: FabricObject): boolean {
  return (
    object instanceof Rect ||
    object instanceof Circle ||
    object instanceof Ellipse ||
    object instanceof Triangle ||
    object instanceof Polygon
  );
}

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
 * The bound is deliberately not exported from that package, so the control is
 * refused by the same code that refuses it at import rather than by a number
 * copied here. `false` means the object was left exactly as it was.
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
  applyObjectPalettePaints(context.editor.canvas, context.globals);
}

/** The panel's glass fields, or nothing when it cannot carry a treatment. */
export function createGlassFields(
  context: AppearanceContext,
  object: FabricObject,
  hooks: GlassFieldHooks,
): HTMLElement | undefined {
  if (!supportsGlassControl(object)) return undefined;

  const root = document.createElement("div");

  /** A refused edit restores the field itself; this only reports it. */
  const refused = (): void =>
    context.editor.errorManager.warn(
      "controls",
      uiCopy.inspectorFields.invalidValue,
    );

  /** One committed edit: refuse a stale one, then repaint and record once. */
  const commit = (write: () => boolean): boolean => {
    if (!hooks.stillTarget()) return false;
    if (!write()) return false;
    hooks.refreshGlass();
    hooks.commit();
    hooks.onChange();
    return true;
  };

  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.htmlFor = `vigilia-glass-${++glassSeq}`;
  label.textContent = uiCopy.inspectorFields.glassEnabled;
  const enabled = document.createElement("input");
  enabled.type = "checkbox";
  enabled.id = label.htmlFor;
  enabled.dataset["vigiliaGlassEnabled"] = "";
  enabled.checked = treatmentOf(object) !== undefined;
  enabled.addEventListener("change", () => {
    commit(() => {
      if (
        !writeTreatment(
          object,
          enabled.checked ? DEFAULT_GLASS_BLUR_RADIUS : undefined,
        )
      )
        return false;
      // Turning glass **on** also puts the frosted surface on the card. The
      // treatment and the surface are one decision — a blur under a fill this
      // opaque is a blur of nothing, and the card reads as a tint rather than
      // as glass — and a default follows the treatment while a fill the author
      // chose is left alone. Turning it off restores nothing: what it would
      // restore is the author's own default, and overwriting that is the same
      // edit in reverse.
      if (enabled.checked) frostTheSurface(context, object);
      return true;
    });
  });
  row.append(label, enabled);
  root.append(row);

  // Only offered when there is a treatment for it to change: a radius box over
  // a panel with no glass accepts an edit and applies none.
  const treatment = treatmentOf(object);
  if (treatment === undefined) return root;

  const blur = numberField({
    label: uiCopy.inspectorFields.glassBlur,
    value: treatment.blurRadius,
    min: 0,
    data: "vigiliaGlassBlur",
    invalidMessage: uiCopy.inspectorFields.invalidValue,
    onReject: refused,
    onCommit: (value) => {
      if (!hooks.stillTarget()) return;
      // `numberField` accepted the value and already moved `last`, so refusing
      // through the field is what puts the box and the alert line back — the
      // same path an empty or negative value takes, rather than a second kind
      // of feedback the author has to learn separately.
      if (!writeTreatment(object, value))
        blur.refuse(treatmentOf(object)?.blurRadius ?? 0);
      else {
        hooks.refreshGlass();
        hooks.commit();
        hooks.onChange();
      }
    },
  });
  root.append(blur.row);

  return root;
}
