import {
  isBleedMark,
  objectBleeds,
  VIGILIA_BLEEDS_PROPERTY,
} from "@vigilia/renderer-core";
import type { FabricObject } from "fabric/es";
import { uiCopy } from "../ui-copy.js";
import type { FieldView } from "./view.js";

/**
 * The one control that says a crop is deliberate.
 *
 * It writes the same property the validator reads and `sceneBoxesOf` counts,
 * and it asks `isBleedMark` whether the value it wrote is one — so the control
 * is refused by the same rule that refuses it at import, rather than by a copy
 * of it. A control that wrote `false` instead of removing the key would leave
 * a document carrying the mark on every object in it, which is the shape the
 * flag's narrowness exists to prevent.
 *
 * The row is a value and the write is the funnel's: `writeMark` is the rule, and
 * `index.ts` calls it after its own revision and lock checks.
 */

/** Removes the property outright: an ordinary object carries no mark at all. */
export function clearMark(object: FabricObject): void {
  delete (object as unknown as Record<string, unknown>)[
    VIGILIA_BLEEDS_PROPERTY
  ];
}

/**
 * Writes the mark and asks `renderer-core`'s own guard whether it is one.
 * `false` means the object was left exactly as it was.
 */
export function writeMark(object: FabricObject, next: boolean): boolean {
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
export function bleedField(object: FabricObject): FieldView {
  return {
    id: "bleeds",
    control: "toggle",
    label: uiCopy.inspectorFields.bleeds,
    checked: objectBleeds(object),
    data: { "data-vigilia-bleeds": "" },
  };
}
