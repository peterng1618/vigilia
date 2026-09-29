import {
  isObjectName,
  VIGILIA_GLASS_PROPERTY,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";
import {
  SCENE_PERSISTED_PROPERTIES,
  VIGILIA_PAINT_PROPERTY,
  VIGILIA_TEXT_PROPERTY,
} from "@vigilia/scene-fabric";
import { classRegistry, type FabricObject } from "fabric/es";
import { describe, expect, it } from "vitest";
import {
  createNewChartDefaults,
  createNewPaintDefaults,
  createNewPanelDefaults,
  createNewShape,
  createNewTextDefaults,
  NEW_OBJECT_INSET,
  newObjectName,
  SHAPE_KINDS,
  type ShapeKind,
} from "./new-object-defaults.js";
import { uiCopy } from "./ui-copy.js";

const globals = {
  palette: {
    none: {
      name: "None",
      value: { kind: "solid" as const, color: "transparent" },
    },
    background: {
      name: "Background",
      value: { kind: "solid" as const, color: "#0c0e13" },
    },
    ink: { name: "Ink", value: { kind: "solid" as const, color: "#102030" } },
  },
  typePresets: {
    body: {
      name: "Body",
      value: { family: "Inter", size: 16, weight: 500, lineHeight: 1.2 },
    },
  },
};

/** The shape of a real palette: a scene backdrop, a card surface and a content
    token. A shape the author draws has to be legible against the first and
    usable on the second, so all three have to be present for the rule to bite. */
const cardGlobals = {
  ...globals,
  palette: {
    ...globals.palette,
    panel: {
      name: "Panel",
      value: { kind: "solid" as const, color: "#081523d9" },
    },
    text: { name: "Text", value: { kind: "solid" as const, color: "#ecf5ff" } },
  },
};

/** A shape that is drawn rather than stroked: the ones an author fills. */
const CLOSED_KINDS = SHAPE_KINDS.filter(
  (kind) => kind !== "polyline" && kind !== "line",
);

describe("new object defaults", () => {
  it("derives a non-transparent palette reference for a new paintable object", () => {
    const defaults = createNewPaintDefaults(globals);

    expect(defaults.fill).toBe("#102030");
    expect(defaults[VIGILIA_PAINT_PROPERTY]).toEqual({ fill: "palette.ink" });
  });

  it("places new text by its edges, as it places every other object", () => {
    // Measured on the surface: a text inserted from the Add pane arrived with
    // Fabric's centre origin, so the inspector's X and Y were the middle of the
    // object. A card is placed by its left edge, and a label that cannot be
    // placed by the same edge cannot be lined up with one.
    const defaults = createNewTextDefaults(globals, "New text");

    expect(defaults).toMatchObject({ originX: "left", originY: "top" });
  });

  it("derives per-run palette and type-preset references for new text", () => {
    const defaults = createNewTextDefaults(globals, "New text");

    expect(defaults).toMatchObject({
      fill: "#102030",
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 500,
      lineHeight: 1.2,
      [VIGILIA_PAINT_PROPERTY]: { fill: "palette.ink" },
      [VIGILIA_TEXT_PROPERTY]: {
        runs: [
          {
            text: "New text",
            typePreset: "typePresets.body",
            style: { color: { ref: "palette.ink" } },
          },
        ],
      },
    });
  });

  it("refuses to invent local paint or type values when references are unavailable", () => {
    expect(() => createNewPaintDefaults(undefined)).toThrow("palette token");
    expect(() =>
      createNewTextDefaults({ palette: globals.palette }, "New text"),
    ).toThrow("type preset");
  });

  it.each(["gauge", "line", "bar", "pie"] as const)(
    "derives %s settings using only existing palette references",
    (family) => {
      const settings = createNewChartDefaults(globals, family);

      expect(JSON.stringify(settings)).toContain("palette.ink");
      expect(JSON.stringify(settings)).not.toContain('"color"');
    },
  );

  it("refuses chart creation without a non-transparent palette token", () => {
    expect(() => createNewChartDefaults(undefined, "gauge")).toThrow(
      "palette token",
    );
  });

  it("names a new object after the button that made it", () => {
    // The Add pane's own labels are the naming this repo already has; a new
    // object that shows its id instead would be a wall of uuids from the first
    // click, and the author would have nothing to tell two panels apart.
    expect(createNewPanelDefaults(globals).name).toBe(uiCopy.panels.panel);
    expect(createNewTextDefaults(globals, "New text").name).toBe(
      uiCopy.panels.text,
    );
  });

  it("names a new chart after the family the author chose", () => {
    for (const family of ["gauge", "line", "bar", "pie"] as const) {
      expect(newObjectName(family)).toBe(uiCopy.chartFamilies[family]);
    }
  });

  it("keeps every default name inside the published bound", () => {
    // The envelope refuses a longer name, so a default that broke the bound
    // would make a newly inserted object unsaveable.
    for (const name of [
      newObjectName("panel"),
      newObjectName("text"),
      newObjectName("gauge"),
    ]) {
      expect(isObjectName(name)).toBe(true);
    }
  });

  it("names every insertable shape after the button that made it", () => {
    // A shape the Add pane can insert but cannot name would arrive as a bare
    // uuid, which is the exact gap F1.8 exists to close.
    for (const kind of SHAPE_KINDS) {
      expect(newObjectName(kind)).toBe(uiCopy.shapeKinds[kind]);
    }
  });

  it("gives a newly built shape the name its kind implies", () => {
    for (const kind of SHAPE_KINDS) {
      const shape = createNewShape(`panel-1`, globals, kind);
      expect(shape.get("name")).toBe(newObjectName(kind));
    }
  });

  it("derives a new panel from a surface token, not a content one", () => {
    const defaults = createNewPanelDefaults(globals);

    // A panel is a surface. `ink` is the token a new *text* object takes, and
    // painting a whole card in it would hide every label the author puts on it.
    expect(defaults.fill).toBe("#0c0e13");
    expect(defaults[VIGILIA_PAINT_PROPERTY]).toEqual({
      fill: "palette.background",
    });
  });

  it("places a new panel inset, at artboard coordinates, sized and rounded", () => {
    const defaults = createNewPanelDefaults(globals);

    expect(defaults.left).toBe(NEW_OBJECT_INSET);
    expect(defaults.top).toBe(NEW_OBJECT_INSET);
    // Fabric's own origin is the centre, which would put a new panel half off
    // the corner the author cannot easily click.
    expect(defaults.originX).toBe("left");
    expect(defaults.originY).toBe("top");
    expect(defaults.width).toBeGreaterThan(0);
    expect(defaults.height).toBeGreaterThan(0);
    expect(defaults.rx).toBe(defaults.ry);
    expect(defaults.rx).toBeGreaterThan(0);
  });

  it("refuses a new panel without a palette token", () => {
    expect(() => createNewPanelDefaults(undefined)).toThrow("palette token");
  });
});

/** What a saved document holds for one object: Fabric's own serialization,
    through the same property list the scene's owner uses. */
function saved(object: FabricObject): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(object.toObject([...SCENE_PERSISTED_PROPERTIES])),
  ) as Record<string, unknown>;
}

/** The smallest envelope the published validator accepts, around one object. */
function envelopeWith(object: Record<string, unknown>): unknown {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "theme",
    metadata: { locale: "en" },
    artboard: { width: 1920, height: 1080 },
    globals,
    scene: { version: "7.4.0", objects: [object] },
  };
}

/** The revival the editor's own save/open path performs, through the registry
    `loadFromJSON` reads. A shape the runtime cannot revive is a shape that does
    not survive a reload, whatever the author typed into it. */
async function revive(object: Record<string, unknown>): Promise<FabricObject> {
  const type = object["type"];
  if (typeof type !== "string") throw new Error("A scene object needs a type.");
  const revived = classRegistry.getClass(type) as {
    fromObject(json: unknown): Promise<FabricObject>;
  };
  return revived.fromObject(object);
}

describe("new shape defaults", () => {
  it.each(CLOSED_KINDS)(
    "fills a new %s as a card, not as the scene's own backdrop",
    (kind) => {
      const shape = createNewShape(`shape-${kind}`, cardGlobals, kind);

      // A shape the author draws is a surface they will put something on, and
      // `background` is what is painted behind it. Filling a whole shape with
      // the colour it sits on is not a card, it is nothing at all — and an
      // invisible object cannot be selected or edited.
      expect(shape.get(VIGILIA_PAINT_PROPERTY), kind).toEqual({
        fill: "palette.panel",
      });
      expect(shape.fill, kind).toBe("#081523d9");
    },
  );

  it("keeps a new closed shape legible when the palette has no card token", () => {
    // A palette without a card surface still has to get a fill. `background` is
    // then the best surface it has, which is the fallback the surface list was
    // always for.
    for (const kind of CLOSED_KINDS) {
      const shape = createNewShape(`shape-${kind}`, globals, kind);
      expect(shape.get(VIGILIA_PAINT_PROPERTY), kind).toEqual({
        fill: "palette.background",
      });
    }
  });

  it.each(["polyline", "line"] as const)(
    "strokes an open %s with a content token rather than a surface",
    (kind) => {
      // The other half of the same rule: an open shape is stroked, and a
      // stroke in a surface colour is as invisible as a fill in one.
      const shape = createNewShape(`shape-${kind}`, cardGlobals, kind);

      expect(shape.get(VIGILIA_PAINT_PROPERTY)).toEqual({
        stroke: "palette.text",
      });
      expect(shape.stroke, kind).toBe("#ecf5ff");
    },
  );

  it.each(SHAPE_KINDS)(
    "places a new %s inset, at artboard coordinates",
    (kind) => {
      const shape = createNewShape(`shape-${kind}`, globals, kind);

      expect(shape.left).toBe(NEW_OBJECT_INSET);
      expect(shape.top).toBe(NEW_OBJECT_INSET);
      // Fabric's own origin is the centre, which would put every new shape half
      // off the corner the author cannot easily click.
      expect(shape.get("originX")).toBe("left");
      expect(shape.get("originY")).toBe("top");
      expect(shape.get("id")).toBe(`shape-${kind}`);
    },
  );

  it.each(SHAPE_KINDS)("gives a new %s a visible size", (kind) => {
    const shape = createNewShape(`shape-${kind}`, globals, kind);

    expect(shape.width).toBeGreaterThan(0);
    expect(shape.height).toBeGreaterThan(0);
  });

  it.each(SHAPE_KINDS)(
    "gives a new %s a palette reference, not a literal",
    (kind) => {
      const shape = createNewShape(`shape-${kind}`, globals, kind);

      // The saved document is only palette-reassignable if the shape carries its
      // own reference. An open shape is stroked, so it references a stroke.
      const stroked = kind === "polyline" || kind === "line";
      expect(shape.get(VIGILIA_PAINT_PROPERTY)).toEqual({
        [stroked ? "stroke" : "fill"]: stroked
          ? "palette.ink"
          : "palette.background",
      });
    },
  );

  it("refuses a new shape without a palette token", () => {
    for (const kind of SHAPE_KINDS) {
      expect(() => createNewShape(`shape-${kind}`, undefined, kind)).toThrow(
        "palette token",
      );
    }
  });
});

describe("a new shape through the persisted envelope", () => {
  it.each(SHAPE_KINDS)("the validator accepts a saved %s", (kind) => {
    const result = validateFabricThemeEnvelope(
      envelopeWith(saved(createNewShape(`shape-${kind}`, globals, kind))),
    );

    expect(result.ok, kind).toBe(true);
  });

  it.each(SHAPE_KINDS)(
    "a saved %s keeps its own property through revival",
    async (kind) => {
      const before = saved(createNewShape(`shape-${kind}`, globals, kind));
      const revived = await revive(before);
      const after = saved(revived);

      // Position and size are the general fields' job; this is the property that
      // belongs to this kind alone, and it is the one a reload would lose. Both
      // sides are compared as saved, because Fabric rounds on export.
      expect(after["left"], kind).toBe(before["left"]);
      expect(after["top"], kind).toBe(before["top"]);
      expect(after["width"], kind).toBe(before["width"]);
      expect(after["height"], kind).toBe(before["height"]);
      expect((revived as { type?: string }).type, kind).toBe(kind);
      expect(after[ownPropertyOf(kind)], kind).toEqual(
        before[ownPropertyOf(kind)],
      );
    },
  );

  it.each(SHAPE_KINDS)(
    "the validator refuses a glass treatment on a %s",
    (kind) => {
      const object = {
        ...saved(createNewShape(`shape-${kind}`, globals, kind)),
        [VIGILIA_GLASS_PROPERTY]: { blurRadius: 16 },
      };

      const result = validateFabricThemeEnvelope(envelopeWith(object));

      // Glass is not widened with the shapes: `localPath` draws `ctx.rect` and a
      // rounded rect and nothing else, so a treatment on any other kind would
      // validate here and then render nothing. A rectangle is the exception.
      expect(result.ok, kind).toBe(kind === "rect");
    },
  );

  it.each(SHAPE_KINDS)("the validator refuses a %s with no type", (kind) => {
    const object = saved(createNewShape(`shape-${kind}`, globals, kind));
    delete object["type"];

    expect(validateFabricThemeEnvelope(envelopeWith(object)).ok).toBe(false);
  });
});

/** The one property a kind owns that no other kind has. A triangle owns none —
    it is width and height like a rectangle — so its kind is what is checked. */
function ownPropertyOf(kind: ShapeKind): string {
  switch (kind) {
    case "rect":
      return "rx";
    case "circle":
      return "radius";
    case "ellipse":
      return "ry";
    case "triangle":
      return "type";
    case "polygon":
    case "polyline":
      return "points";
    case "line":
      return "x2";
    case "path":
      return "path";
  }
}
