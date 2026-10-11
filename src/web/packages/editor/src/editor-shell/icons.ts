import {
  ChartColumn,
  ChartLine,
  ChartPie,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Image as ImageIcon,
  Info,
  Keyboard,
  Layers2,
  Lock,
  LogIn,
  LogOut,
  type LucideIcon,
  Minus,
  OctagonAlert,
  Palette,
  Pencil,
  Plus,
  Scan,
  Settings,
  Shapes,
  Star,
  TriangleAlert,
  Type,
  Unlock,
} from "lucide-react";
import type * as React from "react";
import { createElement } from "react";
import type { LayerKind } from "./layer-tree.js";
import type { RailSlot } from "./rail.js";

/** The glyph component type, re-exported so a surface that holds a glyph in a
 *  prop — `Pane`'s title icon, the domain maps — names it without reaching for
 *  `lucide-react`, which only this module may read. */
export type { LucideIcon };

/**
 * The chrome's one icon vocabulary (DESIGN.md §6): one family (lucide), one weight
 * rule, and one place that decides either.
 *
 * **This is the only chrome module that reads `lucide-react`.** A surface that
 * named a lucide glyph itself would be a second owner of "which family and
 * which weight", and two of those is how the shell grew four weights. The
 * domain maps that name a *set* — severities, chart families, settings tabs —
 * keep their shape and draw their members from here, so the vocabulary stays
 * one and the meaning of each set stays with the surface that has it.
 *
 * Authored scene icon generation (`new-fabric-theme-icons.ts`) is deliberately
 * outside this: it converts lucide geometry into path commands for the Fabric
 * scene, which is data rather than chrome, and it reads the per-icon modules
 * rather than the React components.
 */

/** §6's weight rule: the stroke rises as the glyph shrinks, so the rendered
 *  weight stays optically even. The tiers are the drawing's own. */
export function glyphStrokeWidth(size: number): number {
  if (size <= 10) return 2;
  if (size <= 13) return 1.8;
  return 1.7;
}

/**
 * A chrome glyph, and the one place its weight is set.
 *
 * `filled` carries **two** things §6 separates, and neither is a stroke weight:
 * §6's own escape where a stroke would be illegible at 12px (the record dot, the
 * live check), and the **on/off channel of a binary state** — the font
 * picker's favourited star, the layer row's locked lock (`vg-024`, "locked is a
 * filled lock"). The second is not a licence to fill a glyph for looks; it is
 * the one place a two-valued control can say which of the two it is without a
 * second glyph or a second weight.
 *
 * Every glyph is `aria-hidden`: an icon-only control carries its name on the
 * button (§6), and a decorative mark beside a word is not read twice.
 */
export function Glyph(props: {
  readonly icon: LucideIcon;
  readonly size: number;
  readonly filled?: boolean;
}): React.JSX.Element {
  const { icon, size, filled = false } = props;
  return createElement(icon, {
    "aria-hidden": true,
    size,
    strokeWidth: glyphStrokeWidth(size),
    ...(filled ? { fill: "currentColor" } : {}),
  });
}

/** DESIGN.md §7.2's stack: a card on the canvas is an arbitrary group of elements,
 *  so its row cannot depict it and gets the stack glyph and its name. One glyph
 *  in one place — the rail's Composition slot, the layer row's group mark and
 *  Task 3's `KIND_GLYPHS.group` are all this constant. `Layers2`, not `Layers`:
 *  three planes smudge at 13px, the layer row's size, and the drawing stacks
 *  two. */
export const STACK_GLYPH: LucideIcon = Layers2;

/** §7.2's page, the Document slot. */
export const PAGE_GLYPH: LucideIcon = FileText;
/** The tokens palette — the rail's slot and the settings Appearance tab. */
export const PALETTE_GLYPH: LucideIcon = Palette;
/** The Add slot's plus, and the camera cluster's zoom-in. */
export const PLUS_GLYPH: LucideIcon = Plus;
/** The camera cluster's zoom-out. */
export const MINUS_GLYPH: LucideIcon = Minus;
/** The camera cluster's fit. */
export const FIT_GLYPH: LucideIcon = Scan;
/** The settings gear, the rail's one modal trigger. */
export const SETTINGS_GLYPH: LucideIcon = Settings;
/** A menu's tick. */
export const CHECK_GLYPH: LucideIcon = Check;

/** The two diagnostic severities (§6's icon-only rule does not apply — the word
 *  follows the glyph, so this is a mark beside a sentence). */
export const ERROR_GLYPH: LucideIcon = OctagonAlert;
export const WARNING_GLYPH: LucideIcon = TriangleAlert;

/** The four chart families the document can name. */
export const CHART_GAUGE_GLYPH: LucideIcon = Gauge;
export const CHART_LINE_GLYPH: LucideIcon = ChartLine;
export const CHART_BAR_GLYPH: LucideIcon = ChartColumn;
export const CHART_PIE_GLYPH: LucideIcon = ChartPie;

/** The settings column's other two tabs. */
export const KEYBOARD_GLYPH: LucideIcon = Keyboard;
export const INFO_GLYPH: LucideIcon = Info;

/** One-off chrome marks: the row's rename and the keyboard row's rebind, the
 *  font picker's favourite, a group's enter/leave, a row's eye. */
export const PENCIL_GLYPH: LucideIcon = Pencil;
export const STAR_GLYPH: LucideIcon = Star;
export const ENTER_GLYPH: LucideIcon = LogIn;
export const LEAVE_GLYPH: LucideIcon = LogOut;
export const VISIBLE_GLYPH: LucideIcon = Eye;
export const HIDDEN_GLYPH: LucideIcon = EyeOff;

/** The rail's four slot glyphs, from §7.2's table. Keyed by the rail's own slot
 *  union so a fifth slot is a compile error here rather than a slot with no
 *  mark. Exported because the pane each slot opens wears the same glyph in its
 *  title bar — two owners of "which glyph names this pane" would be two places
 *  for them to disagree. */
export const RAIL_GLYPHS: Readonly<Record<RailSlot, LucideIcon>> = {
  composition: STACK_GLYPH,
  add: PLUS_GLYPH,
  tokens: PALETTE_GLYPH,
  document: PAGE_GLYPH,
};

/**
 * Exactly one glyph per object kind, and the compile-time half of the closure:
 * a new `LayerKind` with no glyph here does not build. The runtime half is
 * `icons.test.tsx`'s comparison against `uiCopy.panels.layerKinds`, and neither
 * half sees the other's failure — a type-level totality is invisible to a
 * focused run, which is what a plan executes.
 *
 * **§6's own rule for the group arm**: a group is an arbitrary set of elements,
 * so it cannot be depicted — it gets the stack glyph and its name. That is why
 * `group` is `STACK_GLYPH` and nothing else, and why no entry here may be
 * derived from what a row happens to hold.
 *
 * **This is the vocabulary, not the layer row's drawing.** The row reads it
 * nowhere, deliberately: §6 and §5.1 leave four of its five arms as
 * *treatments* — a text sample in the object's own face, a chart family icon, a
 * paint swatch, an image thumbnail — because each carries a fact a glyph cannot
 * (`kind-mark.tsx` records which arm is which). `chart` here is the kind's
 * generic mark; the row's chart arm answers a different question, the *family*.
 */
export const KIND_GLYPHS = {
  text: Type,
  shape: Shapes,
  chart: CHART_BAR_GLYPH,
  group: STACK_GLYPH,
  image: ImageIcon,
} satisfies Readonly<Record<LayerKind, LucideIcon>>;

/** The tree's open/closed chevrons. Each points the way the press goes, and the
 *  state itself stays on `aria-expanded`. */
export const TWISTY_GLYPHS: Readonly<
  Record<"collapsed" | "expanded", LucideIcon>
> = {
  collapsed: ChevronRight,
  expanded: ChevronDown,
};

/** Locked is a filled lock, unlocked an outline one: at this size the outlines
 *  differ only by a gap in the shackle, so the state rides the fill (§6) rather
 *  than a second glyph or a second weight. */
export const LOCK_GLYPH: Readonly<
  Record<
    "locked" | "unlocked",
    { readonly icon: LucideIcon; readonly filled?: true }
  >
> = {
  locked: { icon: Lock, filled: true },
  unlocked: { icon: Unlock },
};
