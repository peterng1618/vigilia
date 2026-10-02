import { describe, expect, it } from "vitest";
import {
  MAX_FACET_OPTIONS,
  catalogFacets,
  queryFaces,
  queryTrios,
  type CatalogQuery,
} from "./font-catalog-query.js";
import {
  catalogFaces,
  fontTrio,
  fontTrios,
  type FontTrio,
} from "./font-catalog.js";

const none: CatalogQuery = {
  search: "",
  facet: undefined,
  favoritesFirst: false,
  sort: "name",
};

const FACET_FIELDS = ["mood", "useCase", "superfamily"] as const;

/** Recounts facet values straight from the trios, so the facet vocabulary is
 * checked against the data rather than against itself. */
function countsOf(
  trios: readonly FontTrio[],
  field: (typeof FACET_FIELDS)[number],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const trio of trios) {
    for (const value of field === "superfamily"
      ? [trio.superfamily]
      : trio[field]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

describe("catalogue query", () => {
  it("returns everything for an empty query", () => {
    expect(queryTrios(none, []).length).toBe(fontTrios().length);
    expect(queryFaces(none, []).length).toBe(catalogFaces().length);
  });

  it("narrows by a search term in a trio's name", () => {
    // "newspaper" is in exactly one trio's name and in no description and no
    // family, so this fails outright if the name stops being searched.
    const hits = queryTrios({ ...none, search: "newspaper" }, []);
    expect(hits.map((trio) => trio.id)).toEqual(["newspaper"]);
  });

  it("narrows by a search term in a trio's face families", () => {
    // `cormorant-garamond-proza-libre` is named "Cormorant Garamond Proza
    // Libre" and its description names both body families, so "jetbrains"
    // reaches it through JetBrains Mono and nothing else. It is the *only* trio
    // of 379 reachable by a face family alone — by 2 of the 164 family tokens,
    // "mono" and "jetbrains" — so this one assertion is the whole reason
    // `matches` reads faces at all.
    const hits = queryTrios({ ...none, search: "jetbrains" }, []);
    expect(hits.map((trio) => trio.id)).toContain(
      "cormorant-garamond-proza-libre",
    );
    const trio = fontTrio("cormorant-garamond-proza-libre")!;
    expect(`${trio.name} ${trio.description}`).not.toContain("JetBrains");
  });

  it("narrows by a search term in a trio's description", () => {
    // "dashboards" reaches three trios by description alone, one of them
    // `dashboard` by name too. The loop is the assertion: a hit that does not
    // carry the term in its own text means the match came from somewhere else.
    const hits = queryTrios({ ...none, search: "dashboards" }, []);
    expect(hits.map((trio) => trio.id).sort()).toEqual([
      "dashboard",
      "manifesto",
      "modern-clean",
    ]);
    for (const trio of hits) {
      expect(`${trio.name} ${trio.description}`.toLowerCase()).toContain(
        "dashboards",
      );
    }
  });

  it("finds a face through the trio that seeds it, case-insensitively", () => {
    // Every one of the 27 trios owning an Inter face says "inter" in its own
    // text, so this is the owner path: drop it and no face is reachable at all.
    const said = (trio: FontTrio) =>
      [trio.name, trio.description, ...trio.faces.map((face) => face.family)]
        .join(" ")
        .toLowerCase()
        .includes("inter");
    const expected = catalogFaces()
      .filter((face) =>
        fontTrios().some(
          (trio) => said(trio) && trio.faces.some((own) => own.id === face.id),
        ),
      )
      .map((face) => face.id);
    expect(expected.length).toBeGreaterThan(0);
    expect(
      queryFaces({ ...none, search: "INTER" }, [])
        .map((face) => face.id)
        .sort(),
    ).toEqual(expected.sort());
  });

  it("narrows to the entries a facet tags", () => {
    // superfamily is a single value per trio, so the count is exact in both
    // directions and an untagged trio is visibly gone.
    const hits = queryTrios(
      { ...none, facet: { field: "superfamily", value: "handwriting" } },
      [],
    );
    expect(hits.map((trio) => trio.id).sort()).toEqual([
      "yellowtail-lato",
      "yellowtail-nunito",
    ]);
  });

  it("reaches a face through the trio that seeds it, not its own first touch", () => {
    // `inconsolata-400` is first-touch Heading in catalogFaces() because some
    // pairing reached it first; only the seeding trio knows it is in a
    // handwriting pairing. Grouping by a standalone face's role files all 24
    // clamped faces under Heading, so this is the seededBy path or nothing.
    const hits = queryFaces(
      { ...none, facet: { field: "superfamily", value: "handwriting" } },
      [],
    );
    expect(hits.map((face) => face.id).sort()).toEqual([
      "inconsolata-400",
      "jetbrains-mono-400",
      "lato-400",
      "nunito-400",
      "yellowtail-400",
    ]);
    expect(hits.map((face) => face.id)).not.toContain("inter-400");
  });

  it("derives facet counts from the data and orders them by frequency", () => {
    const facets = catalogFacets();
    expect(facets.map((facet) => facet.field)).toEqual(FACET_FIELDS);
    for (const facet of facets) {
      const counts = countsOf(fontTrios(), facet.field);
      expect(facet.options.length).toBeGreaterThan(0);
      for (const option of facet.options) {
        expect(option.count).toBe(counts.get(option.value));
      }
      // Highest frequency first, and the list is capped at the exported width.
      expect(facet.options).toHaveLength(
        Math.min(MAX_FACET_OPTIONS, counts.size),
      );
      for (const [index, option] of facet.options.entries()) {
        const next = facet.options[index + 1];
        if (next === undefined) continue;
        expect(option.count).toBeGreaterThanOrEqual(next.count);
      }
    }

    // The length assertion above reads the width from the module, so it would
    // pass at any cap. `mood` and `useCase` both have more surviving values
    // than any cap worth having (37 and 38), so the only thing pinning the
    // truncation is the last option named being the cap-th, not the whole
    // vocabulary. The user found the cap widening to 20 while nothing went red.
    const mood = facets.find((facet) => facet.field === "mood")!;
    expect(mood.options).toHaveLength(MAX_FACET_OPTIONS);
    expect(mood.options.at(-1)!.value).toBe("friendly");
    expect(countsOf(fontTrios(), "mood").size).toBeGreaterThan(
      MAX_FACET_OPTIONS,
    );
  });

  it("keeps a superfamily value that only two trios carry", () => {
    // `handwriting` is 2, the lowest surviving count in the whole vocabulary,
    // so this pins the threshold at "> 1" rather than "> 2". It does not pin
    // the singleton filter against a MAX_OPTIONS change: `mood` and `useCase`
    // keep 37 and 38 values past the filter and the cap shows 14, so the filter
    // is not observable there, and `superfamily` has no singleton at all.
    const superfamily = catalogFacets().find(
      (facet) => facet.field === "superfamily",
    )!;
    expect(superfamily.options.map((option) => option.value)).toEqual([
      "sans-serif",
      "serif",
      "monospace",
      "display",
      "handwriting",
    ]);
  });

  it("puts favourites first without dropping anything else", () => {
    const all = queryTrios(none, []);
    const favourite = all[3]!;
    const sorted = queryTrios({ ...none, favoritesFirst: true }, [
      favourite.id,
    ]);
    expect(sorted.length).toBe(all.length);
    expect(sorted[0]!.id).toBe(favourite.id);
  });

  it("ignores a favourite naming an entry the catalogue does not have", () => {
    expect(
      queryTrios({ ...none, favoritesFirst: true }, ["no-such-trio"]).length,
    ).toBe(fontTrios().length);
    expect(
      queryFaces({ ...none, favoritesFirst: true }, ["no-such-trio"]).length,
    ).toBe(catalogFaces().length);
  });

  it("orders by the trio name, and by the leading family when asked", () => {
    // Both halves of `FontSort`, and they disagree: `agency` is second by name
    // and nowhere near second by family, because its leading family is
    // Schibsted Grotesk. The two orderings differ at 337 of 379 positions, so
    // an implementation that read `sort` and always used one key would still
    // produce a correctly-sorted list for whichever half it honoured — the
    // second element is what separates them.
    const byName = queryTrios({ ...none, sort: "name" }, []);
    expect(byName[0]!.id).toBe("abril-fatface-lato");
    expect(byName[1]!.id).toBe("agency");
    for (const [index, trio] of byName.entries()) {
      const next = byName[index + 1];
      if (next === undefined) continue;
      expect(trio.name.localeCompare(next.name)).toBeLessThanOrEqual(0);
    }

    const byFamily = queryTrios({ ...none, sort: "family" }, []);
    expect(byFamily[0]!.faces[0]!.family).toBe("Abril Fatface");
    expect(byFamily[1]!.id).toBe("albert-sans-barlow");
    for (const [index, trio] of byFamily.entries()) {
      const next = byFamily[index + 1];
      if (next === undefined) continue;
      expect(
        trio.faces[0]!.family.localeCompare(next.faces[0]!.family),
      ).toBeLessThanOrEqual(0);
    }
  });
});
