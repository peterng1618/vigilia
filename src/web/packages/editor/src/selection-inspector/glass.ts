import {
  type GlassTreatment,
  glassTreatment,
  MAX_GLASS_BLUR_RADIUS,
  supportsGlass,
  VIGILIA_GLASS_PROPERTY,
} from "@vigilia/renderer-core";
import { applyObjectPalettePaints } from "@vigilia/scene-fabric";
import { type FabricObject, Group } from "fabric/es";
import { numberField } from "../editor-shell/controls/number-field.js";
import { tooltip, type Tooltip } from "../editor-shell/controls/tooltip.js";
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
 * The reason, as the shell's one tooltip.
 *
 * At most one handle is kept: the tooltip is a singleton by design, and the
 * inspector rebuilds its whole subtree on every render, so a handle left on a
 * detached trigger would keep a `document` listener alive with nothing to
 * dismiss.
 */
let glassReason: Tooltip | undefined;

function attachReason(trigger: HTMLElement, text: string): void {
  glassReason?.destroy();
  glassReason = tooltip({ trigger, text });
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
 */
export function createGlassFields(
  context: AppearanceContext,
  object: FabricObject,
  hooks: GlassFieldHooks,
): HTMLElement {
  const refusal = refusalOf(object);
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
  if (refusal !== undefined) {
    // `aria-disabled`, not `disabled`. A disabled checkbox is out of the tab
    // order, so the tooltip below would reach nobody who is not holding a
    // mouse — the same disclosure-for-the-mouse-only defect as the absence this
    // replaces, in a form that now looks deliberate. This stays focusable and
    // keeps its place in the tab order; the click is refused in the change
    // handler below instead, because a browser still toggles an
    // `aria-disabled` checkbox.
    enabled.setAttribute("aria-disabled", "true");
    attachReason(enabled, refusal);
  }
  enabled.addEventListener("change", () => {
    // The refused edit is the one thing this control must not take: it writes a
    // property the validator would refuse at import, on a shape the renderer
    // would never composite.
    if (refusal !== undefined) {
      enabled.checked = treatmentOf(object) !== undefined;
      return;
    }
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

  // The ceiling is asked of the owner, not restated here: `MAX_GLASS_BLUR_RADIUS`
  // is the measured bound the validator enforces, and a 48 typed into this file
  // would agree with it only until the sweep moved it. Naming it is also what
  // gives the field its other two affordances — the range appears only when both
  // bounds are present, and there is nothing to clamp onto with only a floor, so
  // an author typing 60 was refused instead of landing on the maximum.
  const blur = numberField({
    label: uiCopy.inspectorFields.glassBlur,
    value: treatment.blurRadius,
    min: 0,
    max: MAX_GLASS_BLUR_RADIUS,
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
