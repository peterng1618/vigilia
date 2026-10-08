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

/**
 * What a key prints, which is the platform's vocabulary and not the product's:
 * `⌘` is the Mac's own mark and `Ctrl` is the word every other keyboard prints
 * on the key, so the two sets are one field each rather than one set with a
 * substitution. Neither is translated, which is why they are here and not in
 * `ui-copy.ts` — a copy table holds the words a translator would change, and
 * every one of these is a glyph or a word that stays put in every language.
 */
const CAPS = {
  mac: { modifier: "⌘", shift: "⇧" },
  other: { modifier: "Ctrl", shift: "Shift" },
} as const;

/**
 * The same caps, in words, for the one reader who cannot see them.
 *
 * The printed cap is a glyph a sighted reader recognises from the key, and a
 * screen reader announces `⌘` as "place of interest sign" and `⇧` as "upwards
 * white arrow" — names of pictures, not of keys. `aria-label` carries these
 * instead, so the visible chip keeps the platform's own mark while what is
 * spoken is what the key does. `Esc` prints short and is spoken whole.
 */
const SPOKEN_CAPS = {
  mac: { modifier: "Command", shift: "Shift" },
  other: { modifier: "Control", shift: "Shift" },
} as const;

/** Keys whose name is a word or a mark rather than the character a reader would
 *  recognise from the cap. `event.key` is lowercased before lookup, which is
 *  the form this table stores.
 *
 *  The four arrows are `\p{S}` pictographs, which is the whole reason this
 *  table is not in `ui-copy.ts`: `ui-copy.test.ts` forbids one there, and it is
 *  right to — a glyph in the copy table is announced as a word of its own, it
 *  cannot inherit a shell colour, and it does not render like the icons beside
 *  it. A key cap escapes all three by being styled by its own `<kbd>` rule, but
 *  it does not escape the rule, so it moves rather than earning an exemption. */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  arrowdown: "↓",
  delete: "Delete",
  backspace: "Backspace",
  escape: "Esc",
};

/** What the four arrows and the shortened `Esc` are called out loud. Every other
 *  entry above is already a word and is spoken as printed. */
const SPOKEN_NAMED_KEYS: Readonly<Record<string, string>> = {
  arrowleft: "Left arrow",
  arrowright: "Right arrow",
  arrowup: "Up arrow",
  arrowdown: "Down arrow",
  escape: "Escape",
};

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
  return usesCommandKey() ? CAPS.mac : CAPS.other;
}

/** The cap a binding's key prints.
 *
 * A single letter is uppercased, because that is what is printed on it. Any
 * other single character is printed as the browser reports it and the Shift cap
 * is **omitted**: `index.ts:49-54` binds `{` and `}` because Shift is what makes
 * the browser report the shifted character, so `Ctrl+Shift+}` would name a key
 * that does not exist. Named keys come from `NAMED_KEYS`, and a key with no
 * entry and no character on it returns `undefined` rather than its own name —
 * the caller drops the action instead of printing `ctrl+f13`.
 */
function keyCap(key: string, spoken: boolean): string | undefined {
  const named =
    (spoken ? SPOKEN_NAMED_KEYS : NAMED_KEYS)[key] ?? NAMED_KEYS[key];
  if (named !== undefined) return named;
  if (key.length !== 1) return undefined;
  return /[a-z]/i.test(key) ? key.toUpperCase() : key;
}

function chord(binding: ShortcutBinding, spoken: boolean): string | undefined {
  const key = keyCap(binding.key, spoken);
  if (key === undefined) return undefined;
  const { modifier, shift } = spoken
    ? usesCommandKey()
      ? SPOKEN_CAPS.mac
      : SPOKEN_CAPS.other
    : caps();
  const parts: string[] = [];
  if (binding.modifier) parts.push(modifier);
  // A shifted *character* carries its own shift; a shifted *letter* does not.
  if (binding.shift === true && /[a-z]/i.test(binding.key)) parts.push(shift);
  parts.push(key);
  // The Mac prints its caps cheek by jowl (`⌘⇧Z`) because a glyph needs no
  // separator; every other keyboard prints `Ctrl+Shift+Z`. Spoken, every cap is
  // a word, so both become spaces.
  if (spoken) return parts.join(" ");
  return parts.join(usesCommandKey() ? "" : "+");
}

/** The same chords as `shortcutLabel`, in words: what the caps are *called*.
 *
 * `aria-label` on the `kbd` chips takes this, so a screen reader says "Command
 * Shift Z" where the visible mark is `⌘⇧Z`. Two chords are joined by "or"
 * rather than by the printed separator, which is punctuation and is read as a
 * pause or not at all.
 */
export function shortcutSpokenLabel(action: ProductShortcutId): string {
  const rendered = PRODUCT_SHORTCUTS.filter(
    (binding) => binding.action === action,
  )
    .map((binding) => chord(binding, true))
    .filter((value): value is string => value !== undefined);
  return rendered.join(" or ");
}

/**
 * Every chord this action answers to, in the table's own order, joined by the
 * product's own separator. An action the table does not bind returns `""`.
 */
export function shortcutLabel(action: ProductShortcutId): string {
  const rendered = PRODUCT_SHORTCUTS.filter(
    (binding) => binding.action === action,
  )
    .map((binding) => chord(binding, false))
    .filter((value): value is string => value !== undefined);
  return rendered.join(uiCopy.shortcuts.alternativeSeparator);
}
