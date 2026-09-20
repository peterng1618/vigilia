import { describe, expect, it } from "vitest";
import { serializeThemeDocument } from "./serialize.js";
import { validateThemeDocument } from "./validate.js";
import type { ThemeDocument } from "./document.js";

const minimal: ThemeDocument = {
  schemaVersion: 1,
  id: "round-trip",
  artboard: { width: 800, height: 480 },
  nodes: [
    {
      id: "group-1",
      type: "group",
      children: [
        {
          id: "rect-1",
          type: "rectangle",
          transform: { x: 10, y: 20, width: 30, height: 40 },
        },
        { id: "ellipse-1", type: "ellipse" },
      ],
    },
  ],
};

describe("serializeThemeDocument", () => {
  it("is idempotent", () => {
    // The property "save marks history clean" depends on: serialising the same
    // document twice must give the same bytes, or a no-op edit looks dirty.
    const once = serializeThemeDocument(minimal);
    const twice = serializeThemeDocument(JSON.parse(once) as ThemeDocument);

    expect(twice).toBe(once);
  });

  it("does not depend on the key order of the input object", () => {
    // The editor builds objects in whatever order its code runs; a document
    // loaded from disk has the file's order. Both must save identically.
    const shuffled = {
      nodes: minimal.nodes,
      artboard: minimal.artboard,
      id: minimal.id,
      schemaVersion: minimal.schemaVersion,
    } as ThemeDocument;

    expect(serializeThemeDocument(shuffled)).toBe(
      serializeThemeDocument(minimal),
    );
  });

  it("puts the documented keys first, in schema order", () => {
    const lines = serializeThemeDocument(minimal).split("\n");

    expect(lines[1]).toContain('"schemaVersion"');
    expect(lines[2]).toContain('"id"');
    expect(lines[3]).toContain('"artboard"');
  });

  it("orders node keys so a file reads like the format is documented", () => {
    const json = serializeThemeDocument({
      ...minimal,
      nodes: [
        {
          id: "r",
          type: "rectangle",
          style: { fill: { value: "#fff" } },
          name: "Panel",
          visible: true,
        },
      ],
    });

    const idAt = json.indexOf('"id"');
    const typeAt = json.indexOf('"type"');
    const nameAt = json.indexOf('"name"');
    const styleAt = json.indexOf('"style"');

    expect(idAt).toBeLessThan(typeAt);
    expect(typeAt).toBeLessThan(nameAt);
    expect(nameAt).toBeLessThan(styleAt);
  });

  it("sorts unknown keys alphabetically, after the known ones", () => {
    // A field a newer build wrote must survive a load-and-save; dropping it
    // would turn a forward-compatible document into a lossy one.
    const withExtra = {
      ...minimal,
      editorMetadata: { zoom: 1, guides: [], alpha: true },
    } as ThemeDocument;

    const json = serializeThemeDocument(withExtra);

    expect(json).toContain('"alpha"');
    expect(json.indexOf('"alpha"')).toBeLessThan(json.indexOf('"guides"'));
    expect(json.indexOf('"guides"')).toBeLessThan(json.indexOf('"zoom"'));
  });

  it("preserves array order, which is meaning in this format", () => {
    // Node order is paint order (§137). Sorting it would change the document.
    const json = serializeThemeDocument(minimal);
    expect(json.indexOf('"rect-1"')).toBeLessThan(json.indexOf('"ellipse-1"'));
  });

  it("drops a key explicitly set to undefined rather than emitting it", () => {
    // `exactOptionalPropertyTypes` makes this unconstructible in typed code —
    // which is the point of the double cast: the guard exists for values that
    // arrive from JavaScript or from JSON.parse, where the type system was
    // never involved.
    const withUndefined = {
      ...minimal,
      metadata: undefined,
    } as unknown as ThemeDocument;
    expect(serializeThemeDocument(withUndefined)).toBe(
      serializeThemeDocument(minimal),
    );
  });

  it("keeps a falsy value", () => {
    const json = serializeThemeDocument({
      ...minimal,
      nodes: [
        { id: "r", type: "rectangle", visible: false, transform: { x: 0 } },
      ],
    });

    expect(json).toContain('"visible": false');
    expect(json).toContain('"x": 0');
  });

  it("ends with a newline, so a saved file is well-formed for text tools", () => {
    expect(serializeThemeDocument(minimal).endsWith("}\n")).toBe(true);
  });

  it("can emit a compact form", () => {
    expect(serializeThemeDocument(minimal, 0)).not.toContain("\n  ");
  });
});

describe("round trip", () => {
  it("re-validates after a save and load", () => {
    const reloaded = validateThemeDocument(
      JSON.parse(serializeThemeDocument(minimal)),
    );

    expect(reloaded.ok).toBe(true);
  });

  it("is byte-stable across a validate → serialise cycle", () => {
    // This is the Gate 0 "JSON round-trip" property, asserted as bytes rather
    // than deep equality — stricter, and it catches a field being dropped.
    const first = serializeThemeDocument(minimal);
    const validated = validateThemeDocument(JSON.parse(first));

    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(serializeThemeDocument(validated.document)).toBe(first);
    }
  });
});
