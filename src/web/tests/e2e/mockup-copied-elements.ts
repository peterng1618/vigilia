import {
  MOCKUP_PATH,
  mockupDeclared,
  SETTINGS_KEYBOARD_MOCKUP_PATH,
  SETTINGS_MOCKUP_PATH,
} from "./mockup-values.js";

/** Responsibility: the copied-element drift — whether a current drawing's element still declares the frozen original's treatment. */

/** One element the current set **copies** from the original drawing, with the
 *  treatment values the copy is held to. */
export type CopiedElement = {
  /** Names the element for a failure message. */
  readonly region: string;
  /** The current drawing the element is drawn in. */
  readonly drawing: string;
  /** The element's address *in that drawing*. */
  readonly selector: string;
  /** The same element's address in `ORIGINAL_MOCKUP_PATH`. */
  readonly originalSelector: string;
  /** The properties copied unchanged — the treatment, not the layout. */
  readonly properties: readonly string[];
};

/** What a copied element declares that its original does not, one line per
 *  drifted property (`vg-320`).
 *
 *  **A copied value is not a scale question.** The drawings gate asks whether a
 *  value is one §3 has, and the keyboard drawing shipped a `4px` row container
 *  where the original draws `6px` with every gate green: 4px *is* `--radius-sm`.
 *  So this reads the pair the doctrine makes — README: "Colour, spacing,
 *  radii, type, elevation, hairlines ... are copied from the original
 *  drawings" — and an empty answer is the reading that the copy is intact.
 *
 *  Read through `mockupDeclared` on **both** sides, so a stale address or a
 *  property the element stopped declaring throws rather than comparing an
 *  empty string against a real value. */
export function copiedElementDrift(
  currentHtml: string,
  originalHtml: string,
  entry: CopiedElement,
): readonly string[] {
  const drift: string[] = [];
  for (const property of entry.properties) {
    const copied = mockupDeclared(currentHtml, entry.selector, property);
    const original = mockupDeclared(
      originalHtml,
      entry.originalSelector,
      property,
    );
    if (copied !== original) {
      drift.push(
        `${property}: the drawing declares \`${copied}\`, the original \`${original}\``,
      );
    }
  }
  return drift;
}

/** The elements the current set copies from the original, and the values a copy
 *  is held to.
 *
 *  **A named list, because a file diff is noise.** The current drawings are
 *  redrawn with the product's real content, and the original's off-scale values
 *  — its `gap:3px`, its `padding:7px 8px`, the chord chip's `border-radius:5px`
 *  — are normalised onto §3's closed scale on the way across, so comparing
 *  whole elements reports the normalisation as drift and is turned off within a
 *  week. Each entry therefore names the properties copied *unchanged*, and the
 *  row container's `gap` (16px here against the original's 10px) is
 *  deliberately not one of them: it is the current set's own density, already
 *  read by a `PARITY` row.
 *
 *  **A `selector` must avoid every property the entry compares**, which is the
 *  same rule `SHELL_TOKEN_SELECTOR` follows for the opposite reason. An address
 *  carrying the compared value is read by the drawing *only while that value
 *  holds*: the value drifts, the address stops matching, and — where the
 *  element's declaration is what several elements share — the elements that did
 *  not drift answer for the ones that did. So the compared properties are the
 *  ones the address leaves out, and a drift in a property the address *does*
 *  carry is loud too: the address matches nothing and `mockupDeclared` throws.
 *  The rail's slot is the one copied element this cannot be written for —
 *  every address that settles its plain form carries the size and the radius it
 *  would be compared on — and it is left out rather than read through an address
 *  that goes stale the moment either moves.
 *
 *  **Every address must settle one element form**, the rule a row is held to.
 *  The original's shortcut rows declare their container as a *prefix* of the
 *  armed row's declaration, so the plain form cannot be addressed alone — the
 *  entry names the armed row, whose radius is the container's either way. */
export const COPIED_ELEMENTS: readonly CopiedElement[] = [
  {
    region: "shell — the rail",
    drawing: MOCKUP_PATH,
    selector: '[style*="width:46px"]',
    originalSelector: '[style*="width:46px"]',
    properties: ["background", "border-right", "display", "flex-direction"],
  },
  {
    region: "shell — the header",
    drawing: MOCKUP_PATH,
    selector: '[style*="height:42px"]',
    originalSelector: '[style*="height:42px"]',
    properties: ["gap", "padding", "background", "border-bottom"],
  },
  {
    region: "settings — the navigation's active row",
    drawing: SETTINGS_MOCKUP_PATH,
    selector:
      '[style*="background:#1d2733;box-shadow:inset 2px 0 0 var(--accent)"]',
    originalSelector:
      '[style*="background:#1d2733;box-shadow:inset 2px 0 0 #72e0c0"]',
    properties: ["border-radius"],
  },
  {
    region: "settings — the chosen palette card",
    drawing: SETTINGS_MOCKUP_PATH,
    selector: '[style*="border:1px solid var(--accent)"]',
    originalSelector: '[style*="border:1px solid #72e0c0;border-radius:8px"]',
    properties: ["border-radius", "padding"],
  },
  {
    region: "settings — the switch row's box",
    drawing: SETTINGS_MOCKUP_PATH,
    selector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2)"]',
    originalSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:9px 10px;background:#171c23"]',
    properties: ["margin-top", "border-radius"],
  },
  {
    region: "keyboard — the shortcut row container",
    drawing: SETTINGS_KEYBOARD_MOCKUP_PATH,
    selector:
      '[style*="display:flex;align-items:center;gap:16px;padding:4px 6px"]',
    originalSelector:
      '[style*="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:6px;background:#171c23;border:1px solid #72e0c0"]',
    properties: ["border-radius"],
  },
];
