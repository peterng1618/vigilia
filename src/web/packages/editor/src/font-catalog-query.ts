import {
  catalogFaces,
  type CuratedFontFace,
  type FontTrio,
  fontTrios,
} from "./font-catalog.js";

export type FontSort = "name" | "family";

export interface CatalogQuery {
  readonly search: string;
  readonly facet:
    | {
        readonly field: "mood" | "useCase" | "superfamily";
        readonly value: string;
      }
    | undefined;
  readonly favoritesFirst: boolean;
  readonly sort: FontSort;
}

export interface FacetOption {
  readonly value: string;
  readonly count: number;
}

export interface FacetField {
  readonly field: "mood" | "useCase" | "superfamily";
  readonly options: readonly FacetOption[];
}

/** Upstream tags are freeform and long-tailed — 59 moods and 76 use-cases over
 * 379 trios — so the vocabulary is taken from the data rather than written by
 * hand, capped at the values worth a chip. */
const FACET_FIELDS = ["mood", "useCase", "superfamily"] as const;

/** How many facet values are worth a chip. Exported because it is a property of
 * the vocabulary the picker shows, and a test that hardcodes the number instead
 * would drift from it silently. */
export const MAX_FACET_OPTIONS = 14;

let facets: readonly FacetField[] | undefined;

export function catalogFacets(): readonly FacetField[] {
  if (facets !== undefined) return facets;
  const trios = fontTrios();
  facets = FACET_FIELDS.map((field) => {
    const counts = new Map<string, number>();
    for (const trio of trios) {
      const values = field === "superfamily" ? [trio.superfamily] : trio[field];
      for (const value of values)
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return {
      field,
      options: [...counts]
        .filter(([, count]) => count > 1)
        .sort(
          (left, right) =>
            right[1] - left[1] || left[0].localeCompare(right[0]),
        )
        .slice(0, MAX_FACET_OPTIONS)
        .map(([value, count]) => ({ value, count })),
    };
  });
  return facets;
}

function matches(trio: FontTrio, term: string): boolean {
  return `${trio.name} ${trio.description} ${trio.faces.map((face) => face.family).join(" ")}`
    .toLowerCase()
    .includes(term);
}

function matchesFacet(trio: FontTrio, facet: CatalogQuery["facet"]): boolean {
  if (facet === undefined) return true;
  const values =
    facet.field === "superfamily" ? [trio.superfamily] : trio[facet.field];
  return values.includes(facet.value);
}

function order<T extends { readonly id: string }>(
  entries: readonly T[],
  query: CatalogQuery,
  favorites: readonly string[],
  key: (entry: T) => string,
): readonly T[] {
  const favourite = new Set(favorites);
  return [...entries].sort((left, right) => {
    if (query.favoritesFirst) {
      const rank =
        Number(favourite.has(right.id)) - Number(favourite.has(left.id));
      if (rank !== 0) return rank;
    }
    return key(left).localeCompare(key(right));
  });
}

export function queryTrios(
  query: CatalogQuery,
  favorites: readonly string[],
): readonly FontTrio[] {
  const term = query.search.trim().toLowerCase();
  return order(
    fontTrios().filter(
      (trio) =>
        matchesFacet(trio, query.facet) && (term === "" || matches(trio, term)),
    ),
    query,
    favorites,
    (trio) =>
      query.sort === "family"
        ? (trio.faces[0]?.family ?? trio.name)
        : trio.name,
  );
}

let seededBy: Map<string, readonly FontTrio[]> | undefined;

/** A standalone face's `role` and `clamped` are first-touch artefacts: all 24
 * clamped entries are `role: "heading"` because some pairing reached them
 * first. The seeding trios are what actually know where a face is used. */
function seedingTrios(): Map<string, readonly FontTrio[]> {
  if (seededBy !== undefined) return seededBy;
  seededBy = new Map();
  for (const trio of fontTrios()) {
    for (const face of trio.faces) {
      seededBy.set(face.id, [...(seededBy.get(face.id) ?? []), trio]);
    }
  }
  return seededBy;
}

export function queryFaces(
  query: CatalogQuery,
  favorites: readonly string[],
): readonly CuratedFontFace[] {
  const term = query.search.trim().toLowerCase();
  const seeded = seedingTrios();
  // A face is reachable by the same terms as the trio that seeds it, so an
  // author searching "dashboard" finds the faces that dashboard uses.
  return order(
    catalogFaces().filter((face) => {
      const owners = seeded.get(face.id) ?? [];
      const facetOk = owners.some((trio) => matchesFacet(trio, query.facet));
      if (!facetOk) return false;
      if (term === "") return true;
      return owners.some((trio) => matches(trio, term));
    }),
    query,
    favorites,
    (face) => face.family,
  );
}
