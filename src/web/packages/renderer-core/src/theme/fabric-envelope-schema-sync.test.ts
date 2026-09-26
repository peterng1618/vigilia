import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_GLASS_BLUR_RADIUS } from "./glass.js";

const SCHEMA_PATH = fileURLToPath(
  new URL(
    "../../../../../../schema/theme-document.schema.json",
    import.meta.url,
  ),
);

interface SchemaShape {
  readonly $id: string;
  readonly required: readonly string[];
  readonly properties: Record<string, Record<string, unknown>>;
  readonly $defs: Record<string, Record<string, unknown>>;
}

function schema(): SchemaShape {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as SchemaShape;
}

describe("published Fabric theme schema", () => {
  it("publishes the v2 envelope rather than the obsolete node tree", () => {
    const document = schema();

    expect(document.$id).toContain("/2.json");
    expect(document.required).toEqual([
      "schemaVersion",
      "fabricVersion",
      "id",
      "artboard",
      "scene",
    ]);
    expect(document.properties["nodes"]).toBeUndefined();
    expect(document.properties["scene"]).toBeDefined();
  });

  it("keeps envelope bindings and assets explicit while dropping GIF assets", () => {
    const document = schema();
    const asset = document.$defs["nonFontAssetReference"]![
      "properties"
    ] as Record<string, Record<string, unknown>>;
    const binding = document.$defs["binding"]!;

    expect(asset["kind"]!["enum"]).toEqual(["image", "svg", "video"]);
    expect(binding["required"]).toContain("id");
    expect(document.properties["bindings"]).toBeDefined();
  });

  it("publishes structured palette paints while allowing CSS-compatible colours", () => {
    const document = schema();
    const palette = document.$defs["paletteGroup"]!;
    const paint = document.$defs["palettePaint"]!;

    expect(palette["required"]).toEqual(["none"]);
    expect(palette["additionalProperties"]).toMatchObject({
      properties: { value: { $ref: "#/$defs/palettePaint" } },
    });
    expect(paint["oneOf"]).toHaveLength(2);
  });

  it("publishes only v2 palette/type-preset globals and palette artboard paint", () => {
    const document = schema();
    const globals = document.$defs["globals"]!["properties"] as Record<
      string,
      Record<string, unknown>
    >;
    const preset = document.$defs["typePreset"]!;
    const artboard = document.$defs["artboard"]!["properties"] as Record<
      string,
      Record<string, unknown>
    >;

    expect(Object.keys(globals)).toEqual(["palette", "typePresets"]);
    expect(globals["typePresets"]).toEqual({ $ref: "#/$defs/typePresetGroup" });
    expect(preset["required"]).toEqual(["family", "size", "face"]);
    expect(preset["properties"]).toMatchObject({
      face: { $ref: "#/$defs/fontFaceReference" },
      trioRole: { enum: ["heading", "body", "mono"] },
    });
    expect(artboard["background"]).toEqual({
      $ref: "#/$defs/paletteReference",
    });
    expect(artboard["barColor"]).toEqual({ $ref: "#/$defs/paletteReference" });
    expect(artboard["backgroundMedia"]).toEqual({
      $ref: "#/$defs/backgroundMedia",
    });
    expect(document.$defs["metadata"]?.["properties"]).toMatchObject({
      version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+$" },
    });
    expect(document.$defs["styleValue"]).toBeUndefined();
    expect(document.$defs["globalGroup"]).toBeUndefined();
  });

  it("publishes the glass treatment at the bound the runtime enforces", () => {
    // The measured cap is a renderer budget, so the published maximum is
    // compared against the same constant the validator refuses against. A
    // copied literal here would let the two drift silently, and a theme
    // accepted by one would be rejected by the other.
    const document = schema();
    const treatment = document.$defs["glassTreatment"]!;
    const radius = (
      treatment["properties"] as Record<string, Record<string, unknown>>
    )["blurRadius"]!;

    expect(treatment["required"]).toEqual(["blurRadius"]);
    expect(treatment["additionalProperties"]).toBe(false);
    expect(radius).toEqual({
      type: "number",
      minimum: 0,
      maximum: MAX_GLASS_BLUR_RADIUS,
    });
    expect(
      (
        document.$defs["fabricObject"]!["properties"] as Record<
          string,
          Record<string, unknown>
        >
      )["vigiliaGlass"],
    ).toEqual({ $ref: "#/$defs/glassTreatment" });
  });

  it("discriminates fully declared WOFF2 font assets from other assets", () => {
    const document = schema();
    const asset = document.$defs["assetReference"]!;
    const font = document.$defs["fontAssetReference"]!;

    expect(asset["oneOf"]).toHaveLength(2);
    expect(font["required"]).toEqual([
      "id",
      "kind",
      "path",
      "family",
      "weight",
      "style",
      "format",
      "sourceUrl",
      "license",
    ]);
    expect(font["properties"]).toMatchObject({
      kind: { const: "font" },
      format: { const: "woff2" },
    });
  });
});
