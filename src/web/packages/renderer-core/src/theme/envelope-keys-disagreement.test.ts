import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateFabricThemeEnvelope } from "./fabric-envelope-validate.js";
import {
  type EnvelopeKeyBag,
  envelopeKeyBags,
  envelopeKeysFor,
  type KnownKeyShape,
  knownKeyShapes,
  knownKeysFor,
} from "./validate.js";

/**
 * The two registries, asked the same question about the same document.
 *
 * `validate.ts` decides (docs/decisions/0023); `schema/theme-document.schema.json`
 * is published for tools outside this repo. Nothing generates either from the
 * other, so the two can drift — and the schema is the stricter reader, so a
 * drift is a theme the editor opens and every published tool refuses, silently
 * until somebody else opens the file. These are the tests that notice.
 */

const SCHEMA_PATH = fileURLToPath(
  new URL(
    "../../../../../../schema/theme-document.schema.json",
    import.meta.url,
  ),
);

type Node = Record<string, unknown>;

function schema(): Node {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Node;
}

/** `additionalProperties: false` publishes exactly the keys in `properties`. */
function publishedKeys(node: Node): readonly string[] {
  expect(
    node["additionalProperties"],
    "a compared bag must close itself, or it publishes no key set",
  ).toBe(false);
  return Object.keys(node["properties"] as Node);
}

/** Walks from the schema root; `[]` is the root itself. */
function at(path: readonly string[]): Node {
  let node = schema();
  for (const step of path) node = node[step] as Node;
  return node;
}

function union(paths: readonly (readonly string[])[]): readonly string[] {
  return [...new Set(paths.flatMap((path) => publishedKeys(at(path))))].sort();
}

/** Where the schema publishes each bag `validate.ts` decides; `[]` is the root. */
const KNOWN_KEY_SHAPES: Partial<Record<KnownKeyShape, readonly string[][]>> = {
  metadata: [["$defs", "metadata"]],
  artboard: [["$defs", "artboard"]],
  binding: [["$defs", "binding"]],
  typePreset: [["$defs", "typePreset"]],
  fontFaceReference: [["$defs", "fontFaceReference"]],
  // One bag in code, two in the schema: a font asset declares the non-font
  // keys plus its own, so the merged list is the union of both.
  assetReference: [
    ["$defs", "nonFontAssetReference"],
    ["$defs", "fontAssetReference"],
  ],
  globalEntry: [
    ["$defs", "paletteGroup", "additionalProperties"],
    ["$defs", "typePresetGroup", "additionalProperties"],
  ],
};

/**
 * Shapes the v2 schema deliberately does not publish. In v2 these live inside
 * Fabric JSON, which the schema validates as opaque `jsonValue`; adding one to
 * the published contract would describe a document that does not exist. Listed
 * so that adding a shape to `KNOWN_KEYS` is a decision, not a silence.
 */
const NOT_PUBLISHED: readonly KnownKeyShape[] = [
  "document",
  "transform",
  "node",
  "textContent",
  "textBox",
  "literalRun",
  "valueRun",
  "chartContent",
  "rectangleContent",
  "imageContent",
  "videoContent",
  "widgetProvenance",
  "gaugeSettings",
  "lineSettings",
  "barSettings",
  "pieSettings",
];

const ENVELOPE_BAGS: Record<EnvelopeKeyBag, readonly string[][]> = {
  envelope: [[]],
  globals: [["$defs", "globals"]],
  backgroundMedia: [["$defs", "backgroundMedia"]],
};

function envelope(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "theme",
    metadata: { themeLanguage: "en" },
    artboard: { width: 400, height: 300 },
    bindings: { chart: [{ id: "cpu", semanticKey: "cpu.load", precision: 0 }] },
    scene: {
      version: "7.4.0",
      objects: [
        {
          type: "VigiliaChart",
          id: "chart",
          objects: [{ type: "Rect", id: "child" }],
        },
      ],
    },
  };
}

/** Keys the validator refused as unknown, so the two registries can be compared. */
function refusedByCode(document: Record<string, unknown>): readonly string[] {
  const result = validateFabricThemeEnvelope(document);
  return result.ok
    ? []
    : result.issues
        .filter((issue) => issue.code === "unknown-field")
        .map((issue) => issue.path);
}

describe("the envelope's key bags, answered twice", () => {
  it("publishes exactly the keys the validator accepts, for every shared bag", () => {
    for (const [shape, paths] of Object.entries(KNOWN_KEY_SHAPES)) {
      expect(
        union(paths),
        `schema/${paths.join("+")} against KNOWN_KEYS.${shape}`,
      ).toEqual([...knownKeysFor(shape as KnownKeyShape)].sort());
    }
  });

  it("publishes exactly the keys the v2 validator accepts", () => {
    for (const bag of envelopeKeyBags()) {
      expect(
        union(ENVELOPE_BAGS[bag]),
        `schema against ENVELOPE_KEYS.${bag}`,
      ).toEqual([...envelopeKeysFor(bag)].sort());
    }
  });

  it("decides every shape it declares, published or explicitly not", () => {
    const shapes = knownKeyShapes();

    expect(shapes).toHaveLength(
      Object.keys(KNOWN_KEY_SHAPES).length + NOT_PUBLISHED.length,
    );
    expect([...shapes].sort()).toEqual(
      [...Object.keys(KNOWN_KEY_SHAPES), ...NOT_PUBLISHED].sort(),
    );
  });

  it("does not publish a shape it says it does not publish", () => {
    const defs = Object.keys(schema()["$defs"] as Node);

    for (const shape of NOT_PUBLISHED) {
      expect(defs).not.toContain(shape);
    }
  });
});

describe("one document, two registries, one answer", () => {
  it("agrees about the persisted language key on both sides of the rename", () => {
    // The rename that found this row. One-sided, the schema would accept the
    // new key and the validator refuse it, and nothing throws until a theme is
    // opened.
    const current = envelope();
    expect(refusedByCode(current)).toEqual([]);
    expect(publishedKeys(at(["$defs", "metadata"]))).toContain("themeLanguage");

    const stale = {
      ...current,
      metadata: { themeLanguage: "en", locale: "en" },
    };
    expect(refusedByCode(stale)).toContain("/metadata/locale");
    expect(publishedKeys(at(["$defs", "metadata"]))).not.toContain("locale");
  });

  it("agrees about a binding's format and time zone", () => {
    // Not a rename. The editor's runs panel authors `timeZone` and the
    // serializer persists it; the schema published neither it nor `format`.
    const pinned = {
      ...envelope(),
      bindings: {
        chart: [
          {
            id: "cpu",
            semanticKey: "cpu.load",
            timeZone: "UTC",
            format: "HH:mm",
          },
        ],
      },
    };

    expect(refusedByCode(pinned)).toEqual([]);
    expect(publishedKeys(at(["$defs", "binding"]))).toEqual(
      expect.arrayContaining(["format", "timeZone"]),
    );
  });

  it("refuses the same stale key in the artboard media bag", () => {
    const stale = {
      ...envelope(),
      artboard: {
        width: 400,
        height: 300,
        backgroundMedia: { assetId: "backdrop", fit: "cover", scale: 2 },
      },
    };

    expect(refusedByCode(stale)).toContain("/artboard/backgroundMedia/scale");
    expect(publishedKeys(at(["$defs", "backgroundMedia"]))).not.toContain(
      "scale",
    );
  });
});
