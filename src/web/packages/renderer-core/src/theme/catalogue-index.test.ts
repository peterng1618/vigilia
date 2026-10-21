import { describe, expect, it } from "vitest";
import { parseCatalogueIndex } from "./catalogue-index.js";

/** The kinds this build ships; a `widget-preset` is a kind the catalogue may
    hold and this client cannot read. */
const KNOWN = ["dashboard-theme"];

/** The record the Action derives: every field a reader touches, which is the
    shallow check the parser makes and nothing more. */
function facets(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    author: "ada",
    colourMode: "dark",
    sensors: [],
    tags: ["ops"],
    orientation: "landscape",
    aspect: "16:9",
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

/** One wire entry, every field well-formed; a case states only the part it is
    about. */
function entry(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "acme-ops",
    kind: "dashboard-theme",
    name: "Acme Ops",
    version: "1.0.0",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-02T00:00:00Z",
    downloads: 12,
    favorites: 3,
    packageUrl: "https://example.test/acme-ops.json",
    thumbnail: "themes/acme-ops.png",
    facets: facets(),
    ...overrides,
  };
}

/** The entry `entry()` builds with a field actually absent, not present-and-empty. */
function without(field: string, overrides: Record<string, unknown> = {}) {
  const value = entry(overrides);
  delete value[field];
  return value;
}

/** The brief's "one entry missing `name`": it declares no `kind` either, which is
    why its refusal names nothing. An entry that is the wrong shape *and* declares
    a kind is named by that kind — the case below. */
function unreadable(id: string): Record<string, unknown> {
  const value = entry({ id });
  delete value.kind;
  delete value.name;
  return value;
}

function document(entries: readonly unknown[]): Record<string, unknown> {
  return { generatedAt: "2026-10-21T00:00:00Z", entries: [...entries] };
}

describe("parseCatalogueIndex", () => {
  it("keeps the readable entries and reports each refusal once, in order", () => {
    const parsed = parseCatalogueIndex(
      document([
        entry(),
        entry({ id: "beta" }),
        entry({ id: "w1", kind: "widget-preset" }),
        entry({ id: "w2", kind: "widget-preset" }),
        unreadable("nameless"),
      ]),
      KNOWN,
    );

    expect(parsed.entries.length).toBe(2);
    expect(parsed.entries.map((item) => item.id)).toEqual(["acme-ops", "beta"]);
    expect(parsed.refused).toStrictEqual([
      { kind: "widget-preset", reason: "unknown-kind", count: 2 },
      { kind: undefined, reason: "malformed", count: 1 },
    ]);
  });

  it("orders the refusals by first appearance in the document", () => {
    const parsed = parseCatalogueIndex(
      document([
        unreadable("nameless"),
        entry({ id: "w1", kind: "widget-preset" }),
      ]),
      KNOWN,
    );

    expect(parsed.refused.map((row) => row.reason)).toEqual([
      "malformed",
      "unknown-kind",
    ]);
  });

  it("keeps two unknown kinds in the order each first appeared", () => {
    const parsed = parseCatalogueIndex(
      document([
        entry({ id: "w1", kind: "widget-preset" }),
        entry({ id: "s1", kind: "sprite-pack" }),
        entry({ id: "w2", kind: "widget-preset" }),
      ]),
      KNOWN,
    );

    expect(parsed.refused).toStrictEqual([
      { kind: "widget-preset", reason: "unknown-kind", count: 2 },
      { kind: "sprite-pack", reason: "unknown-kind", count: 1 },
    ]);
  });

  it("refuses a malformed entry by its own kind, not as an unknown kind", () => {
    const parsed = parseCatalogueIndex(
      document([without("name", { id: "nameless", kind: "widget-preset" })]),
      KNOWN,
    );

    expect(parsed.entries).toStrictEqual([]);
    expect(parsed.refused).toStrictEqual([
      { kind: "widget-preset", reason: "malformed", count: 1 },
    ]);
  });

  it("refuses a document that is not an object", () => {
    const whole = {
      entries: [],
      refused: [{ kind: undefined, reason: "malformed", count: 1 }],
    };

    expect(parseCatalogueIndex("nope", KNOWN)).toStrictEqual(whole);
    expect(parseCatalogueIndex(null, KNOWN)).toStrictEqual(whole);
    expect(parseCatalogueIndex([entry()], KNOWN)).toStrictEqual(whole);
  });

  it("refuses a document with no generatedAt", () => {
    expect(parseCatalogueIndex({ entries: [entry()] }, KNOWN)).toStrictEqual({
      entries: [],
      refused: [{ kind: undefined, reason: "malformed", count: 1 }],
    });
  });

  it("refuses a document whose generatedAt is not a string, counting its entries", () => {
    const parsed = parseCatalogueIndex(
      { generatedAt: 21, entries: [entry(), entry({ id: "beta" })] },
      KNOWN,
    );

    expect(parsed).toStrictEqual({
      entries: [],
      refused: [{ kind: undefined, reason: "malformed", count: 2 }],
    });
  });

  it("refuses a document whose entries is not an array", () => {
    expect(
      parseCatalogueIndex(
        { generatedAt: "2026-10-21T00:00:00Z", entries: "nope" },
        KNOWN,
      ),
    ).toStrictEqual({
      entries: [],
      refused: [{ kind: undefined, reason: "malformed", count: 1 }],
    });
  });

  it("refuses an entry whose facets is not a record", () => {
    const parsed = parseCatalogueIndex(
      document([
        entry({ id: "null-facets", facets: null }),
        entry({ id: "array-facets", facets: [] }),
        without("facets", { id: "absent-facets" }),
      ]),
      KNOWN,
    );

    expect(parsed.entries).toStrictEqual([]);
    expect(parsed.refused).toStrictEqual([
      { kind: "dashboard-theme", reason: "malformed", count: 3 },
    ]);
  });

  it("refuses an entry whose facets record is missing a field a reader needs", () => {
    const withoutTags = facets();
    delete withoutTags.tags;

    const parsed = parseCatalogueIndex(
      document([
        entry({ id: "empty-facets", facets: {} }),
        entry({ id: "no-tags", facets: withoutTags }),
        entry({ id: "zero-width", facets: facets({ width: 0 }) }),
        entry({ id: "nan-height", facets: facets({ height: Number.NaN }) }),
      ]),
      KNOWN,
    );

    expect(parsed.entries).toStrictEqual([]);
    expect(parsed.refused).toStrictEqual([
      { kind: "dashboard-theme", reason: "malformed", count: 4 },
    ]);
  });

  it("refuses an entry whose counts are not counts", () => {
    const parsed = parseCatalogueIndex(
      document([
        entry({ id: "string-downloads", downloads: "12" }),
        entry({ id: "negative-downloads", downloads: -1 }),
        entry({ id: "nan-favorites", favorites: Number.NaN }),
        entry({
          id: "infinite-favorites",
          favorites: Number.POSITIVE_INFINITY,
        }),
      ]),
      KNOWN,
    );

    expect(parsed.entries).toStrictEqual([]);
    expect(parsed.refused).toStrictEqual([
      { kind: "dashboard-theme", reason: "malformed", count: 4 },
    ]);
  });

  it("refuses an entry whose fields are inherited rather than its own", () => {
    // What a bare `record[key]` read would accept: no own field at all, every
    // field resolved off the prototype. `JSON.parse` cannot produce one, which is
    // why the reader's check has to be constructed here.
    const inherited = Object.create(entry());

    const parsed = parseCatalogueIndex(document([inherited]), KNOWN);

    expect(parsed.entries).toStrictEqual([]);
    expect(parsed.refused).toStrictEqual([
      { kind: undefined, reason: "malformed", count: 1 },
    ]);
  });

  it("reads an entry whose id is __proto__", () => {
    const parsed = parseCatalogueIndex(
      document([entry({ id: "__proto__" })]),
      KNOWN,
    );

    expect(parsed.refused).toStrictEqual([]);
    expect(parsed.entries.map((item) => item.id)).toEqual(["__proto__"]);
  });

  it("carries the entry's fields through unchanged", () => {
    const derived = facets({ width: 1920 });
    const parsed = parseCatalogueIndex(
      document([entry({ facets: derived })]),
      KNOWN,
    );

    expect(parsed.entries[0]).toStrictEqual({
      id: "acme-ops",
      kind: "dashboard-theme",
      name: "Acme Ops",
      version: "1.0.0",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
      downloads: 12,
      favorites: 3,
      packageUrl: "https://example.test/acme-ops.json",
      thumbnail: "themes/acme-ops.png",
      facets: derived,
    });
  });
});
