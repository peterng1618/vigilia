import {
  glassTreatment,
  type GlassTreatment,
  VIGILIA_GLASS_PROPERTY,
} from "@vigilia/renderer-core";
import { type FabricObject, Rect } from "fabric/es";
import { numberField } from "../editor-shell/controls/number-field.js";
import { uiCopy } from "../ui-copy.js";
import type { AppearanceContext } from "./appearance.js";

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
 * Whether these controls apply at all. A rectangle is the only kind Fabric
 * gives a `before:render` boundary a backdrop can be sampled at: `Group`
 * replaces `drawObject`, so a group's treatment never composites and
 * `scene-fabric`'s `glass.ts` refuses it loudly. A control there would accept an
 * edit and apply none.
 *
 * Kept apart from `panel.ts`'s `supportsPanelFields` on purpose. That answers
 * "may these fields write this object's material?" — a group has no own fill,
 * radius or border. This answers "may its backdrop be sampled?", and the two
 * agree today for different reasons. `glass.dom.test.ts` names every kind the
 * published schema allows that this one leaves un-authorable, so widening that
 * schema cannot reopen the gap silently.
 */
export function supportsGlassControl(object: FabricObject): boolean {
  return object instanceof Rect;
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
    commit(() =>
      writeTreatment(
        object,
        enabled.checked ? DEFAULT_GLASS_BLUR_RADIUS : undefined,
      ),
    );
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
      // A refused value has to be put back on the box as well as on the object,
      // or the field would show a radius the document does not carry.
      if (commit(() => writeTreatment(object, value))) return;
      if (treatmentOf(object) === undefined) return;
      blur.setValue(treatmentOf(object)?.blurRadius ?? 0);
      refused();
    },
  });
  root.append(blur.row);

  return root;
}
