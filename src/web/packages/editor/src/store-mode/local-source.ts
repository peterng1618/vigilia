import {
  type FabricThemeEnvelope,
  type FacetRecord,
  resolveStyleValue,
} from "@vigilia/renderer-core";
import { cssArtboardPaint } from "@vigilia/scene-fabric";
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
 * `ground` is the theme's own artboard paint, resolved here because
 * `FacetRecord` carries no paint and the cell draws it in place of a picture a
 * theme does not have. It is a CSS paint string — a colour, or a
 * `linear-gradient(...)` — or `undefined` when the document resolves to no
 * paint at all.
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
 * **The listing carries the facets; the ground needs the document.** A.4a's
 * `ThemeLibraryEntry` derives `facets` in the host from the envelope it already
 * parsed, so filtering never opens a theme — but the artboard's paint is not on
 * that record, so `list()` opens each theme once to resolve it. A theme whose
 * open fails fails the listing rather than arriving with a picture box nothing
 * can fill: the host answered a listing naming it, so a document it will not
 * hand back is a fault, not a theme without a ground.
 */
export function localThemeSource(client: ThemeLibraryClient): ItemSource {
  return {
    kind: DASHBOARD_THEME_KIND,
    async list(): Promise<readonly StoreItem[]> {
      const entries = await client.list();
      return Promise.all(
        entries.map(async (entry) => {
          const { envelope } = await client.open(entry.id);
          return {
            id: entry.id,
            kind: DASHBOARD_THEME_KIND,
            name: entry.name,
            author: entry.author,
            updatedAt: entry.updatedAt,
            thumbnailUrl: entry.thumbnailUrl,
            ground: groundOf(envelope),
            facets: entry.facets,
          };
        }),
      );
    },
  };
}

/**
 * The artboard's paint, read the document's own way and converted at the CSS
 * boundary. `resolveStyleValue` is the resolver the plan and the player both
 * read, so a reference is resolved here exactly as it is on the artboard; a
 * reference nothing declares resolves to `undefined`, which is the same absence
 * as no paint at all.
 */
function groundOf(envelope: FabricThemeEnvelope): string | undefined {
  return cssArtboardPaint(
    resolveStyleValue(
      envelope.artboard.background,
      envelope.globals ?? {},
      "artboard",
      [],
    ),
  );
}

/**
 * The values a facet may be chosen by, read off one item. The ids are the
 * record's own readings, so there is no second vocabulary to keep in step: an
 * author is the author string, a colour mode is the record's word, a sensor is
 * a `semanticKey`, and a shape is three groups in one facet — the orientation,
 * the aspect bucket and the exact size — which is the drawing's own three-group
 * Shape popover.
 *
 * **`style` carries no values this phase.** The record holds no tags until
 * phase G, so a style selection matches nothing rather than everything: an
 * empty set is the truth about a facet nothing has been tagged for.
 */
const FACET_VALUES: Readonly<
  Record<string, (item: StoreItem) => readonly string[]>
> = {
  author: (item) => (item.author === undefined ? [] : [item.author]),
  "colour-mode": (item) => [item.facets.colourMode],
  sensors: (item) => item.facets.sensors.map((sensor) => sensor.key),
  shape: (item) => [
    item.facets.orientation,
    item.facets.aspect,
    `${item.facets.width}x${item.facets.height}`,
  ],
  style: () => [],
};

/**
 * Whether an item survives what is chosen, and it is pure so a page can narrow a
 * list it already holds without asking a source again.
 *
 * **Within a facet the chosen values are alternatives; across facets they all
 * have to hold.** A facet with nothing chosen is "any" and matches everything,
 * which is what keeps a theme that binds no sensor reachable: nothing is asked
 * of a facet nobody chose in, so a theme with an empty answer is excluded by a
 * sensor selection and kept by no selection at all — never by a facet that
 * silently treats it as matching.
 *
 * A facet id this build does not know carries no values, so a selection in one
 * matches nothing. That is the same answer `style` gives, and for the same
 * reason: a filter over a vocabulary nothing populates cannot be satisfied.
 */
export function matchesFacets(
  item: StoreItem,
  chosen: FacetSelection,
): boolean {
  for (const [facet, values] of Object.entries(chosen)) {
    if (values.length === 0) continue;
    const carried = FACET_VALUES[facet]?.(item) ?? [];
    if (!values.some((value) => carried.includes(value))) return false;
  }
  return true;
}
