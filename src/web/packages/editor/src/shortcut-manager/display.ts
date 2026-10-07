/**
 * How a shortcut reads: the platform's caps, the words for the keys that have
 * none, and the projection §7's tooltips and its `?` sheet both render.
 *
 * The table's *membership* is `index.ts`'s and stays there. This module only
 * reads it, which is why nothing here re-spells a `ProductShortcutId` — a
 * second table would agree until someone added a binding to one of them.
 */
import { uiCopy } from "../ui-copy.js";
import {
  PRODUCT_SHORTCUTS,
  type ProductShortcutId,
  type ShortcutBinding,
} from "./index.js";

/** The part of an action id before its first dot: the group an action lives in.
 *
 * A *reading* of `ProductShortcutId` rather than a second copy of it, so the id
 * union keeps one owner (`index.ts`). It is proved total by the `satisfies` on
 * `uiCopy.shortcuts.groups`: a prefix with no group word is a compile error, and
 * a group word for a prefix no action carries is one too.
 */
export type ShortcutPrefix = ProductShortcutId extends `${infer P}.${string}`
  ? P
  : never;

/** The caps in force on this platform.
 *
 * `navigator.userAgent` is the only platform signal universally available;
 * `navigator.platform` is deprecated and `userAgentData` is Chromium-only, so
 * neither is a better answer. `ponytail:` the ceiling is a UA sniff — it is
 * wrong for a spoofed UA and for an iPad that reports itself as a Macintosh,
 * and the upgrade path is `navigator.userAgentData.platform` behind this same
 * function once the browser floor allows it.
 */
export function usesCommandKey(): boolean {
  return /mac|iphone|ipad/i.test(navigator.userAgent);
}

function caps(): { readonly modifier: string; readonly shift: string } {
  return usesCommandKey() ? uiCopy.shortcuts.mac : uiCopy.shortcuts.other;
}

/** The cap a binding's key prints.
 *
 * A single letter is uppercased, because that is what is printed on it. Any
 * other single character is printed as the browser reports it and the Shift cap
 * is **omitted**: `index.ts:49-54` binds `{` and `}` because Shift is what makes
 * the browser report the shifted character, so `Ctrl+Shift+}` would name a key
 * that does not exist. Named keys come from `uiCopy.shortcuts.named`, and a key
 * with no entry and no character on it returns `undefined` rather than its own
 * name — the caller drops the action instead of printing `ctrl+f13`.
 */
function keyCap(key: string): string | undefined {
  const named = (uiCopy.shortcuts.named as Record<string, string>)[key];
  if (named !== undefined) return named;
  if (key.length !== 1) return undefined;
  return /[a-z]/i.test(key) ? key.toUpperCase() : key;
}

function chord(binding: ShortcutBinding): string | undefined {
  const key = keyCap(binding.key);
  if (key === undefined) return undefined;
  const { modifier, shift } = caps();
  const parts: string[] = [];
  if (binding.modifier) parts.push(modifier);
  // A shifted *character* carries its own shift; a shifted *letter* does not.
  if (binding.shift === true && /[a-z]/i.test(binding.key)) parts.push(shift);
  parts.push(key);
  return parts.join(usesCommandKey() ? "" : "+");
}

/**
 * Every chord this action answers to, in the table's own order, joined by the
 * product's own separator. An action the table does not bind returns `""`.
 */
export function shortcutLabel(action: ProductShortcutId): string {
  const rendered = PRODUCT_SHORTCUTS.filter(
    (binding) => binding.action === action,
  )
    .map(chord)
    .filter((value): value is string => value !== undefined);
  return rendered.join(uiCopy.shortcuts.alternativeSeparator);
}
