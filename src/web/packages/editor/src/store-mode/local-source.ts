import type { FacetRecord, Orientation } from "@vigilia/renderer-core";
import type { ThemeLibraryClient } from "../theme-library-client.js";

/**
 * The local half's items, behind the one hop that makes a second kind cheap.
 *
 * The gallery reads `ItemSource` and never `ThemeLibraryClient` or the host's
 * store, so a second kind is a second source rather than a rewrite of this tab
 * (`2026-10-12-theme-store-design.md`, "Adding a kind"). `ThemeLibraryClient`
 * gains nothing here: the source wraps it.
 */

/** One item the gallery draws, whichever kind it is.
 *
 * `kind` is the **wire** value (`"dashboard-theme"`), never a word a person
 * reads: what a kind is called is `uiCopy`'s, and a client older than the kind
 * prints the identifier rather than inventing a name for it.
 *
 * `ground` is the theme's own artboard paint — a CSS paint string, a colour or a
 * `linear-gradient(...)` — and it arrives on the listing, derived by the host
 * from the envelope it already parsed. `FacetRecord` carries no paint, and the
 * cell draws the ground in place of a picture a theme does not have, so it is
 * read here rather than resolved: a reader that opened every listed theme to
 * find one paint string would be the second pass over the library the spec
 * refuses.
 */
export interface StoreItem {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly author: string | undefined;
  readonly updatedAt: string | undefined;
  readonly thumbnailUrl: string | undefined;
  readonly ground: string | undefined;
  readonly facets: FacetRecord;
}

/** One kind's list, as the gallery reads it. `kind` is on the source rather than
 *  on a request, so a surface cannot ask one source for another kind's items. */
export interface ItemSource {
  readonly kind: string;
  list(): Promise<readonly StoreItem[]>;
}

/**
 * The four things a cell can do, and the one callback they travel through.
 *
 * One callback rather than four props, and rather than an `onOpen`: the cell
 * draws four actions, so a callback per action would be four props a caller can
 * half-wire, and an `onOpen` alone cannot express the other three. The plan's
 * Step 3 requires all four, and the drawing's facts band carries all four.
 */
export type CellAction = "open" | "assign" | "export" | "delete";

/** What the facets are narrowed by: one facet id, and the values chosen in it.
 *  A facet that is absent, or present with nothing chosen, is "any". */
export type FacetSelection = Readonly<Record<string, readonly string[]>>;

/** The one kind v1 exchanges, and the value it is identified by on the wire
 *  (spec, "The three kinds"). What it is *called* is `uiCopy.store.cell.kinds`. */
export const DASHBOARD_THEME_KIND = "dashboard-theme";

/**
 * The host's own library as an `ItemSource`.
 *
 * **One listing, and no second read.** Everything a cell needs — the facets, the
 * author, the picture's address and the ground — is on the entry the host
 * derived from the document it already parsed, so `list()` maps what it is
 * handed and opens nothing.
 */
export function localThemeSource(client: ThemeLibraryClient): ItemSource {
  return {
    kind: DASHBOARD_THEME_KIND,
    async list(): Promise<readonly StoreItem[]> {
      const entries = await client.list();
      return entries.map((entry) => ({
        id: entry.id,
        kind: DASHBOARD_THEME_KIND,
        name: entry.name,
        author: entry.author,
        updatedAt: entry.updatedAt,
        thumbnailUrl: entry.thumbnailUrl,
        ground: entry.ground,
        facets: entry.facets,
      }));
    },
  };
}

/**
 * One facet's own rule, handed only the values chosen in that facet: the rules
 * differ per facet, and the difference is the spec's one deliberate exception
 * rather than a detail of the loop.
 */
type FacetMatcher = (item: StoreItem, chosen: readonly string[]) => boolean;

/**
 * Shape's three groups, in the order the drawing's Shape popover offers them.
 * Each is read off the item's own record, so a group's reading and the value a
 * person chooses come from one vocabulary.
 */
const SHAPE_GROUPS: readonly ((item: StoreItem) => string)[] = [
  (item) => item.facets.orientation,
  (item) => item.facets.aspect,
  (item) => `${item.facets.width}x${item.facets.height}`,
];

/** The orientation group's whole vocabulary, typed from the record's own union
 *  so the two cannot be spelled differently. */
const SHAPE_ORIENTATIONS: readonly Orientation[] = [
  "landscape",
  "portrait",
  "square",
];

/** A bucket's form — `16:9`, `1:1`, `32:9` — and the one bucket that is a word
 *  rather than a ratio. Recognised by form rather than by a second copy of the
 *  record's bucket list, which would be a list to keep in step for no gain. */
const SHAPE_RATIO = /^\d+:\d+$/;

/** An exact size's form: `1920x1080`. */
const SHAPE_SIZE = /^\d+x\d+$/;

/**
 * Which of the three groups a chosen shape value names, or `undefined` for a
 * value that names none — and a value naming no group can be satisfied by no
 * theme, so it is not a value that simply fails to match.
 */
function shapeGroupOf(value: string): number | undefined {
  if (SHAPE_ORIENTATIONS.some((orientation) => orientation === value)) return 0;
  if (value === "other" || SHAPE_RATIO.test(value)) return 1;
  if (SHAPE_SIZE.test(value)) return 2;
  return undefined;
}

/**
 * Shape is the one facet with groups inside it: **every group the selection
 * names has to hold, and within one group the values are alternatives** — the
 * ordinary rule one level down. So `landscape 16:9` is one shape, not three
 * alternatives, and a portrait board cannot answer a landscape selection just
 * because the bucket it reads (`16:9`) is also the one chosen.
 */
function matchesShape(item: StoreItem, chosen: readonly string[]): boolean {
  const groups: string[][] = [[], [], []];
  for (const value of chosen) {
    const group = shapeGroupOf(value);
    if (group === undefined) return false;
    groups[group]?.push(value);
  }

  return groups.every((values, index) => {
    if (values.length === 0) return true;
    const reading = SHAPE_GROUPS[index]?.(item);
    return reading !== undefined && values.includes(reading);
  });
}

/**
 * One rule per facet, keyed by the facet ids the region's row draws.
 *
 * **Within a facet the values are OR, across facets they are AND — except
 * Sensors and Shape, where they are AND** (spec, "Finding a theme: the five
 * facets"). Two facets ask a question only *all* of a selection can answer: a
 * theme must read every sensor asked for, so "CPU and GPU" cannot answer with a
 * CPU-only theme, and it must have every shape property asked for, which
 * `matchesShape` holds a level down.
 */
const FACET_MATCHERS: Readonly<Record<string, FacetMatcher>> = {
  author: (item, chosen) => chosen.some((value) => value === item.author),
  // **An unclassified theme carries no colour-mode value.** `unclassified` is
  // the absence of an answer rather than one a person can ask for — a mid-grey
  // ground, or a picture behind the board — so it is reachable under "any" and
  // under no other value, including a selection naming it (spec, "Finding a
  // theme"). Reading it as a value would let the facet hide a theme from
  // someone who never asked it to.
  "colour-mode": (item, chosen) =>
    item.facets.colourMode !== "unclassified" &&
    chosen.includes(item.facets.colourMode),
  sensors: (item, chosen) =>
    chosen.every((value) =>
      item.facets.sensors.some((sensor) => sensor.key === value),
    ),
  shape: matchesShape,
  // No values this phase: the record carries no tags until phase G, so a style
  // selection matches nothing rather than everything.
  style: () => false,
};

/**
 * Whether an item survives what is chosen, and it is pure so a page can narrow a
 * list it already holds without asking a source again.
 *
 * A facet with nothing chosen is "any" and matches everything, which is what
 * keeps a theme that binds no sensor reachable: nothing is asked of a facet
 * nobody chose in, so a theme with an empty answer is excluded by a sensor
 * selection and kept by no selection at all — never by a facet that silently
 * treats it as matching.
 *
 * A facet id this build does not know has no rule, so a selection in one matches
 * nothing. That is the same answer `style` gives, and for the same reason: a
 * filter over a vocabulary nothing populates cannot be satisfied.
 */
export function matchesFacets(
  item: StoreItem,
  chosen: FacetSelection,
): boolean {
  for (const [facet, values] of Object.entries(chosen)) {
    if (values.length === 0) continue;
    const matcher = FACET_MATCHERS[facet];
    if (matcher === undefined || !matcher(item, values)) return false;
  }
  return true;
}
