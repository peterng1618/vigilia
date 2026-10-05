import {
  isBleedMark,
  objectBleeds,
  VIGILIA_BLEEDS_PROPERTY,
} from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import { uiCopy } from "../ui-copy.js";
import type { AppearanceContext } from "./appearance.js";

/**
 * The one control that says a crop is deliberate.
 *
 * It writes the same property the validator reads and `sceneBoxesOf` counts,
 * and it asks `isBleedMark` whether the value it wrote is one — so the control
 * is refused by the same rule that refuses it at import, rather than by a copy
 * of it. A control that wrote `false` instead of removing the key would leave
 * a document carrying the mark on every object in it, which is the shape the
 * flag's narrowness exists to prevent.
 */

let bleedSeq = 0;

export interface BleedHooks {
  /** False once the field describes a different object; the edit is refused. */
  readonly stillTarget: () => boolean;
  /** One history entry per committed edit. */
  readonly commit: () => void;
  /** Re-reads the object, so the field shows what was just written. */
  readonly onChange: () => void;
}

/** Removes the property outright: an ordinary object carries no mark at all. */
function clearMark(object: FabricObject): void {
  delete (object as unknown as Record<string, unknown>)[
    VIGILIA_BLEEDS_PROPERTY
  ];
}

/**
 * Writes the mark and asks `renderer-core`'s own guard whether it is one.
 * `false` means the object was left exactly as it was.
 */
function writeMark(object: FabricObject, next: boolean): boolean {
  if (!next) {
    clearMark(object);
    return true;
  }
  object.set(VIGILIA_BLEEDS_PROPERTY, true);
  if (isBleedMark(object.get(VIGILIA_BLEEDS_PROPERTY))) return true;
  clearMark(object);
  return false;
}

/**
 * Offered for every selection, because every Fabric object can bleed — the
 * question is about an object's overhang, not about what kind of object it is.
 *
 * It sits with the geometry it changes rather than with the appearance fields,
 * because what it alters is the crop notice both surfaces print, not how the
 * object paints.
 */
export function createBleedField(
  context: AppearanceContext,
  object: FabricObject,
  hooks: BleedHooks,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "vigilia-field";
  const label = document.createElement("label");
  label.htmlFor = `vigilia-bleeds-${++bleedSeq}`;
  label.textContent = uiCopy.inspectorFields.bleeds;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = label.htmlFor;
  input.dataset["vigiliaBleeds"] = "";
  input.checked = objectBleeds(object);

  input.addEventListener("change", () => {
    if (!hooks.stillTarget()) return;
    // The refusal restores the box rather than only reporting it, so the field
    // never shows a mark the object does not carry.
    if (!writeMark(object, input.checked)) {
      input.checked = objectBleeds(object);
      context.editor.errorManager.warn(
        "controls",
        uiCopy.inspectorFields.invalidValue,
      );
      return;
    }
    // The count both surfaces print is derived from the scene, so the artboard
    // panel has to be told the scene moved — it reads the figure on render and
    // would otherwise keep showing the number from before the mark.
    context.editor.canvas.fire(
      "object:modified" as never,
      {
        target: object,
      } as never,
    );
    hooks.commit();
    hooks.onChange();
  });

  row.append(label, input);
  return row;
}
