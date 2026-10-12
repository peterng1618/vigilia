import type { FabricObject } from "fabric/es";

/**
 * Whether an object is locked.
 *
 * One predicate for a Fabric fact rather than lock policy: it belongs here, at
 * the shared fabric layer, so no manager above it owns the vocabulary and no
 * reader reaches up to `object-lock-manager` for it. `object.get("locked")` was
 * spelled at eleven sites, `=== true` at eight and `!== true` at three; they
 * agree on those two states and would not on a third.
 *
 * The polarity is positive and literal: only `true` locks, anything else — a
 * missing flag, a group whose members differ, a value that is neither `true` nor
 * `false` — does not. That is the majority spelling, and it fails open (an
 * unrecognised flag leaves the object editable rather than trapping it).
 */
export function isLocked(object: FabricObject): boolean {
  return object.get("locked") === true;
}
