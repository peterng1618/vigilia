import {
  type FabricThemeEnvelope,
  facetRecordOf,
} from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import type {
  ThemeLibraryClient,
  ThemeLibraryEntry,
} from "../theme-library-client.js";
import {
  DASHBOARD_THEME_KIND,
  localThemeSource,
  matchesFacets,
  type StoreItem,
} from "./local-source.js";

/**
 * The local half's item source: what one item is, and what narrows the list.
 *
 * The gallery reads this and never the host, so everything the cell needs — the
 * kind, the facets and the theme's own ground — is settled here rather than in
 * the drawing.
 */

/** A stored theme, with a document a cell has something to draw from: a named
 *  author, a bound sensor and a 1920×1080 board. */
function envelope(
  overrides: Partial<FabricThemeEnvelope> = {},
): FabricThemeEnvelope {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "living-room",
    artboard: {
      width: 1920,
      height: 1080,
      background: { value: { kind: "solid", color: "midnightblue" } },
    },
    metadata: {
      name: "Living room",
      themeLanguage: "en",
      author: "mira-k",
    },
    scene: { version: "7.4.0", objects: [] },
    bindings: { "cpu-label": [{ id: "cpu", semanticKey: "cpu.load" }] },
    ...overrides,
  };
}

/** The listing entry the host derives for a document — the record through
 *  `facetRecordOf`, so the fixture is the derivation rather than a transcription
 *  of it (A.4a put that derivation in the host). */
function entry(document: FabricThemeEnvelope): ThemeLibraryEntry {
  return {
    id: document.id,
    name: document.metadata?.name ?? document.id,
    ...(document.metadata?.author === undefined
      ? {}
      : { author: document.metadata.author }),
    updatedAt: "2026-10-15T09:31:00.000Z",
    thumbnailUrl: `/api/themes/${document.id}/thumbnail`,
    facets: facetRecordOf(document),
  };
}

/** A client whose listing and whose documents are the fixtures, so a case reads
 *  what the source made of them rather than what a stub was told to answer. */
function clientOf(
  documents: readonly FabricThemeEnvelope[],
): ThemeLibraryClient {
  const byId = new Map(documents.map((one) => [one.id, one]));
  return {
    list: vi.fn(async () => documents.map(entry)),
    open: vi.fn(async (id: string) => ({
      envelope: byId.get(id) as FabricThemeEnvelope,
      assets: {},
    })),
    save: vi.fn(async () => "base-after-save"),
    assign: vi.fn(async () => undefined),
    listDisplays: vi.fn(async () => ({ default: null, displays: [] })),
  };
}

describe("the local half's items", () => {
  it("labels every item with the kind it is", async () => {
    const source = localThemeSource(clientOf([envelope()]));

    const items = await source.list();

    // The wire value, not a display word: `Dashboard theme` is `uiCopy`'s to
    // word and may change without a format change, while this may not.
    expect(items.map((item) => item.kind)).toEqual(["dashboard-theme"]);
    expect(source.kind).toBe(DASHBOARD_THEME_KIND);
  });

  it("derives each item's facets from its envelope", async () => {
    const document = envelope();
    const source = localThemeSource(clientOf([document]));

    const items = await source.list();

    expect(items[0]?.facets.sensors.map((sensor) => sensor.key)).toEqual([
      "cpu.load",
    ]);
    expect(items[0]?.facets.width).toBe(1920);
    expect(items[0]?.facets.height).toBe(1080);
    expect(items[0]?.facets.aspect).toBe("16:9");
    expect(items[0]?.facets.orientation).toBe("landscape");
    expect(items[0]?.facets.author).toBe("mira-k");
    expect(items[0]?.author).toBe("mira-k");
  });

  it("carries the theme's own artboard paint as its ground", async () => {
    // The record carries no paint, so the cell's fallback picture can only come
    // from the document — and a reference resolves through the document's own
    // resolver rather than a second one.
    const source = localThemeSource(
      clientOf([
        envelope({
          artboard: {
            width: 1920,
            height: 1080,
            background: { ref: "palette.ink" },
          },
          globals: {
            typePresets: {},
            palette: {
              ink: { name: "Ink", value: { kind: "solid", color: "black" } },
            },
          },
        }),
      ]),
    );

    const items = await source.list();

    expect(items[0]?.ground).toBe("black");
  });

  it("has no ground for a document that resolves to no paint", async () => {
    // A reference nothing declares is the same absence as no paint at all: the
    // box draws nothing rather than a colour invented to fill it.
    const source = localThemeSource(
      clientOf([
        envelope({
          artboard: {
            width: 1920,
            height: 1080,
            background: { ref: "palette.missing" },
          },
        }),
      ]),
    );

    const items = await source.list();

    expect(items[0]?.ground).toBeUndefined();
  });
});

describe("narrowing by a facet", () => {
  /** One item, built through the source so the case reads the record the source
   *  actually hands the predicate. */
  async function item(document: FabricThemeEnvelope): Promise<StoreItem> {
    const items = await localThemeSource(clientOf([document])).list();
    const first = items[0];
    if (first === undefined) throw new Error("the source listed nothing");
    return first;
  }

  it("narrows by a facet, and matches nothing for a theme that binds nothing", async () => {
    const bound = await item(envelope());
    const bindsNothing = await item(
      envelope({
        id: "bare",
        metadata: { name: "Bare", themeLanguage: "en" },
        bindings: {},
      }),
    );

    expect(matchesFacets(bound, { sensors: ["cpu.load"] })).toBe(true);
    expect(matchesFacets(bound, { sensors: ["gpu.load"] })).toBe(false);
    // The theme that binds nothing: no sensor selection matches it...
    expect(matchesFacets(bindsNothing, { sensors: ["cpu.load"] })).toBe(false);
    // ...and "any" — nothing chosen — still reaches it.
    expect(matchesFacets(bindsNothing, { sensors: [] })).toBe(true);
    expect(matchesFacets(bindsNothing, {})).toBe(true);
  });

  it("holds the chosen values within a facet as alternatives and across them as one answer", async () => {
    const one = await item(envelope());

    expect(
      matchesFacets(one, { "colour-mode": ["dark", "unclassified"] }),
    ).toBe(true);
    expect(
      matchesFacets(one, { author: ["mira-k"], sensors: ["cpu.load"] }),
    ).toBe(true);
    expect(
      matchesFacets(one, { author: ["someone-else"], sensors: ["cpu.load"] }),
    ).toBe(false);
  });

  it("matches nothing on a facet no theme carries a value for", async () => {
    // Style's values arrive with the tags in phase G. Until then a selection in
    // it matches nothing rather than everything, which is what an empty set
    // means.
    const one = await item(envelope());

    expect(matchesFacets(one, { style: ["calm"] })).toBe(false);
  });

  it("matches a shape by any of its three groups, and never confuses a bucket with an orientation", async () => {
    const one = await item(envelope());
    // A portrait board reads its landscape inversion's bucket — 1080×1920 is
    // 16:9 — so `orientation` is the reading that separates the two, and a
    // selection in one group must not answer for another.
    const upright = await item(
      envelope({
        id: "upright",
        artboard: { width: 1080, height: 1920 },
      }),
    );

    expect(matchesFacets(one, { shape: ["landscape"] })).toBe(true);
    expect(matchesFacets(one, { shape: ["16:9"] })).toBe(true);
    expect(matchesFacets(one, { shape: ["1920x1080"] })).toBe(true);
    expect(matchesFacets(one, { shape: ["portrait"] })).toBe(false);

    expect(upright.facets.aspect).toBe("16:9");
    expect(upright.facets.orientation).toBe("portrait");
    expect(matchesFacets(upright, { shape: ["16:9"] })).toBe(true);
    expect(matchesFacets(upright, { shape: ["portrait"] })).toBe(true);
    expect(matchesFacets(upright, { shape: ["landscape"] })).toBe(false);
    expect(matchesFacets(upright, { shape: ["1080x1920"] })).toBe(true);
  });
});
