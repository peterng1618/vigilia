// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLineOption,
  defaultLineSettings,
  type Sample,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";
import {
  Circle,
  Ellipse,
  FabricImage,
  FabricText,
  Group,
  Path,
  Rect,
  StaticCanvas,
  Textbox,
} from "fabric/es";
import { describe, expect, it } from "vitest";
import { VigiliaChart, type VigiliaChartOptions } from "./chart-object.js";
import { refreshBoundText, VIGILIA_TEXT_PROPERTY } from "./fabric-text.js";
import {
  objectAssetReference,
  setObjectAssetReference,
  VIGILIA_ASSET_PROPERTY,
} from "./object-asset.js";
import {
  applyObjectPalettePaints,
  VIGILIA_PAINT_PROPERTY,
} from "./object-paint.js";
import {
  applyObjectTypePresets,
  reassignObjectTypePresetReferences,
} from "./object-type.js";
import { reassignObjectPaletteReferences } from "./palette-references.js";
import type { SerialisedScene } from "./persist.js";
import {
  assertFabricThemeEnvelopeCompatible,
  reviveScene,
  reviveThemeEnvelope,
  SCENE_PERSISTED_PROPERTIES,
  serialiseScene,
  serialiseThemeEnvelope,
} from "./persist.js";

/**
 * What a saved scene contains, asserted exactly.
 *
 * Two things here are unusual on purpose.
 *
 * **The key sets are `toEqual`, never `toMatchObject`.** A subset match cannot
 * see a key that should *not* be there, and every key this format has had to
 * exclude — `subTargetCheck`, `interactive`, `layoutManager`, `renderScale`,
 * a built chart option carrying live samples — was a key nobody thought to look
 * for. The next Fabric minor adding one to `toObject` should fail here.
 *
 * **Identity is tested through a whole-canvas round trip**, not through one
 * object's `toObject`. `id` reaches the output as a `propertiesToInclude`
 * argument, so the interesting question is never "does `toObject` support it"
 * but "did the save path pass it" — and the failure when it did not is a
 * document full of anonymous objects that reports nothing.
 */

const NOW_MS = Date.UTC(2026, 8, 15, 12, 0, 0);

function sample(value: number): Sample {
  return {
    sensorId: "cpu.load",
    timestamp: new Date(NOW_MS).toISOString(),
    status: "ok",
    value,
  };
}

function chartOptions(
  overrides: Partial<VigiliaChartOptions> = {},
): VigiliaChartOptions {
  return {
    family: "line",
    settings: { ...defaultLineSettings },
    width: 300,
    height: 180,
    option: buildLineOption(
      defaultLineSettings,
      [{ sensorId: "cpu.load", samples: [sample(1)] }],
      NOW_MS,
      false,
    ),
    ...overrides,
  } as VigiliaChartOptions;
}

function canvasOf(...objects: readonly object[]): StaticCanvas {
  const canvas = new StaticCanvas(undefined, { width: 400, height: 300 });

  for (const object of objects) {
    canvas.add(object as Rect);
  }

  return canvas;
}

function keysOf(
  scene: { readonly objects: readonly Readonly<Record<string, unknown>>[] },
  index = 0,
): string[] {
  return Object.keys(scene.objects[index]!).sort();
}

/** A `FabricImage` with no source: enough to serialise, no decode in jsdom. */
function image(): FabricImage {
  return new FabricImage(null as unknown as HTMLImageElement, {
    width: 10,
    height: 10,
  });
}

describe("the persisted key set, per class", () => {
  // Defaults are stripped, so each list is exactly what the author deviated
  // from plus Fabric's three unstrippable keys (`left`, `top`, `type`) and its
  // version stamp. Anything else appearing here is a format change.
  const CASES: readonly (readonly [string, () => object, readonly string[]])[] =
    [
      [
        "Rect",
        () => new Rect({ width: 10, height: 10 }),
        ["height", "id", "left", "top", "type", "version", "width"],
      ],
      [
        "Ellipse",
        () => new Ellipse({ rx: 5, ry: 4 }),
        ["height", "id", "left", "rx", "ry", "top", "type", "version", "width"],
      ],
      [
        "FabricText",
        () => new FabricText("hi"),
        [
          "height",
          "id",
          "left",
          "styles",
          "text",
          "top",
          "type",
          "version",
          "width",
        ],
      ],
      [
        "Textbox",
        () => new Textbox("hi", { width: 40 }),
        [
          "height",
          "id",
          "left",
          "styles",
          "text",
          "top",
          "type",
          "version",
          "width",
        ],
      ],
      [
        "FabricImage",
        image,
        [
          "crossOrigin",
          "filters",
          "height",
          "id",
          "left",
          "src",
          "top",
          "type",
          "version",
          "width",
        ],
      ],
      [
        "Group",
        () => new Group([new Rect({ width: 4, height: 4 })]),
        ["height", "id", "left", "objects", "top", "type", "version", "width"],
      ],
      [
        "VigiliaChart",
        () => new VigiliaChart(chartOptions()),
        [
          "family",
          "height",
          "id",
          "left",
          "settings",
          "top",
          "type",
          "version",
          "width",
        ],
      ],
    ];

  it.each(CASES)(
    "%s persists exactly its authored surface",
    (_name, make, expected) => {
      const object = make();
      (object as Rect).set("id", "node-1");

      expect(keysOf(serialiseScene(canvasOf(object)))).toEqual([...expected]);
    },
  );

  it("never persists the built chart option or the render scale", () => {
    // §67, structurally rather than by inspection: the built option holds live
    // samples in `series[].data`, and a guard on key *names* passed while they
    // sat there. `renderScale` is device state in a portable document.
    const chart = new VigiliaChart(chartOptions());
    chart.set("id", "chart-1");

    const keys = keysOf(serialiseScene(canvasOf(chart)));

    expect(keys).not.toContain("option");
    expect(keys).not.toContain("renderScale");
  });
});

describe("Fabric’s own keys are held to the same rule", () => {
  it("keeps editor interaction state and engine internals out of a display scene", () => {
    // `Group.toObject` forces `subTargetCheck` and `interactive` into its
    // output unconditionally, and emits `layoutManager` whenever defaults are
    // included. Stripping is what removes all three — there is no filter.
    const group = new Group([new Rect({ width: 4, height: 4 })]);
    group.set("id", "group-1");

    const keys = keysOf(serialiseScene(canvasOf(group)));

    expect(keys).not.toContain("subTargetCheck");
    expect(keys).not.toContain("interactive");
    expect(keys).not.toContain("layoutManager");
  });

  it("lets them straight back in once the editor enables group entry", () => {
    // Pinned rather than warned about. Spec 0013 stage 4 adopts
    // `subTargetCheck` + `interactive` for group entry/exit, which makes them
    // non-default and therefore persisted — editor state in a portable
    // document. This test is how that arrives: as a failure naming the keys,
    // in the commit that causes it, rather than as a surprise in a saved file.
    const group = new Group([new Rect({ width: 4, height: 4 })], {
      subTargetCheck: true,
      interactive: true,
    });
    group.set("id", "group-1");

    expect(keysOf(serialiseScene(canvasOf(group)))).toEqual([
      "height",
      "id",
      "interactive",
      "left",
      "objects",
      "subTargetCheck",
      "top",
      "type",
      "version",
      "width",
    ]);
  });
});

describe("identity survives a round trip", () => {
  it("retains an image asset reference without serialising its preview URL", async () => {
    const source = image();
    setObjectAssetReference(source, { assetId: "logo", kind: "svg" });
    const scene = serialiseScene(canvasOf(source));
    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });

    await reviveScene(revived, scene);

    expect(scene.objects[0]![VIGILIA_ASSET_PROPERTY]).toEqual({
      assetId: "logo",
      kind: "svg",
    });
    expect(objectAssetReference(revived.getObjects()[0]!)).toEqual({
      assetId: "logo",
      kind: "svg",
    });
  });

  it("persists palette references and reapplies their resolved paint", async () => {
    const rect = new Rect({ width: 10, height: 10, fill: "#000" });
    rect.set("id", "panel");
    rect.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.panel" });
    const scene = serialiseScene(canvasOf(rect));
    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });
    await reviveScene(revived, scene);

    applyObjectPalettePaints(revived, {
      palette: { panel: { name: "Panel", value: "#123456" } },
    });

    expect(scene.objects[0]![VIGILIA_PAINT_PROPERTY]).toEqual({
      fill: "palette.panel",
    });
    expect(revived.getObjects()[0]!.fill).toBe("#123456");
  });

  it("reapplies a persisted text run type preset", () => {
    const text = new Textbox("CPU", { fontFamily: "Old", fontSize: 10 });
    text.set(VIGILIA_TEXT_PROPERTY, {
      runs: [
        { kind: "literal", text: "CPU", typePreset: "typePresets.metric" },
      ],
    });
    const canvas = canvasOf(text);

    applyObjectTypePresets(canvas, {
      typePresets: {
        metric: {
          name: "Metric",
          value: { family: "Inter", size: 32, weight: 700, lineHeight: 1.1 },
        },
      },
    });

    expect(text).toMatchObject({
      fontFamily: "Inter",
      fontSize: 32,
      fontWeight: 700,
      lineHeight: 1.1,
    });
  });

  it("reassigns object paint and authored text references before token deletion", () => {
    const text = new Textbox("CPU");
    text.set(VIGILIA_PAINT_PROPERTY, { fill: "palette.old" });
    text.set(VIGILIA_TEXT_PROPERTY, {
      runs: [
        {
          kind: "literal",
          text: "CPU",
          style: { color: { ref: "palette.old" } },
        },
      ],
    });
    const canvas = canvasOf(text);

    expect(
      reassignObjectPaletteReferences(canvas, "palette.old", "palette.new"),
    ).toBe(2);
    expect(text.get(VIGILIA_PAINT_PROPERTY)).toEqual({ fill: "palette.new" });
    expect(text.get(VIGILIA_TEXT_PROPERTY)).toMatchObject({
      runs: [{ style: { color: { ref: "palette.new" } } }],
    });
  });

  it("reassigns every authored text-run type preset before deletion", () => {
    const text = new Textbox("CPU 42%");
    text.set(VIGILIA_TEXT_PROPERTY, {
      runs: [
        { kind: "literal", text: "CPU ", typePreset: "typePresets.old" },
        { kind: "literal", text: "42%", typePreset: "typePresets.old" },
      ],
    });
    const canvas = canvasOf(text);

    expect(
      reassignObjectTypePresetReferences(
        canvas,
        "typePresets.old",
        "typePresets.new",
      ),
    ).toBe(2);
    expect(text.get(VIGILIA_TEXT_PROPERTY)).toMatchObject({
      runs: [
        { typePreset: "typePresets.new" },
        { typePreset: "typePresets.new" },
      ],
    });
  });

  it("keeps authored text runs available after Fabric revival", async () => {
    const authored = {
      runs: [
        { kind: "literal" as const, text: "CPU " },
        { kind: "value" as const, bindingId: "load" },
      ],
    };
    const text = new FabricText("CPU 48%");
    text.set("id", "readout");
    text.set(VIGILIA_TEXT_PROPERTY, authored);

    const scene = serialiseScene(canvasOf(text));
    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });
    await reviveScene(revived, scene);

    expect(scene.objects[0]![VIGILIA_TEXT_PROPERTY]).toEqual(authored);
    expect(revived.getObjects()[0]!.get(VIGILIA_TEXT_PROPERTY)).toEqual(
      authored,
    );
  });

  it("does not save a runtime text value", () => {
    const text = new FabricText("CPU --");
    text.set("id", "readout");
    text.set(VIGILIA_TEXT_PROPERTY, {
      runs: [
        { kind: "literal", text: "CPU " },
        { kind: "value", bindingId: "load" },
      ],
    });
    const canvas = canvasOf(text);

    refreshBoundText(
      canvas,
      { readout: [{ id: "load", semanticKey: "cpu.load" }] },
      {
        latest: () => sample(48),
        history: () => [],
      },
      undefined,
    );

    expect(text.text).toBe("CPU 48");
    expect(serialiseScene(canvas).objects[0]!.text).toBe("CPU —");
  });

  it("carries an id on every object, nested ones included", async () => {
    const child = new FabricText("inner");
    child.set("id", "child");
    const group = new Group([child]);
    group.set("id", "group");
    const rect = new Rect({ width: 10, height: 10 });
    rect.set("id", "rect");

    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });
    await reviveScene(revived, serialiseScene(canvasOf(rect, group)));

    const objects = revived.getObjects();

    expect(objects.map((object) => object.get("id"))).toEqual([
      "rect",
      "group",
    ]);
    expect(
      (objects[1] as Group).getObjects().map((object) => object.get("id")),
    ).toEqual(["child"]);
  });

  it("matches by id and never by position", async () => {
    // The failure this prevents is silent: with position matching, inserting
    // one object at index 0 shifts every binding by one node and each id still
    // resolves to *some* object, so nothing raises an issue and every readout
    // is simply on the wrong node.
    const first = new Rect({ width: 10, height: 10 });
    first.set("id", "bound-chart");
    const second = new Rect({ width: 20, height: 20 });
    second.set("id", "other");

    const scene = serialiseScene(canvasOf(first, second));
    const inserted = new Rect({ width: 5, height: 5 });
    inserted.set("id", "inserted");

    const revived = new StaticCanvas(undefined, { width: 400, height: 300 });
    await reviveScene(revived, scene);
    revived.insertAt(0, inserted);

    const found = revived
      .getObjects()
      .find((object) => object.get("id") === "bound-chart");

    expect(found).toBeDefined();
    expect(revived.getObjects().indexOf(found!)).toBe(1);
  });

  it("emits no id at all when the argument is not passed", () => {
    // The reason this module exists. `canvas.toObject()` is a perfectly
    // ordinary call that silently produces an anonymous document, and nothing
    // downstream reports it until a binding fails to resolve.
    const rect = new Rect({ width: 10, height: 10 });
    rect.set("id", "rect");
    const canvas = canvasOf(rect);

    expect(keysOf(serialiseScene(canvas))).toContain("id");
    expect(
      Object.keys(canvas.toObject()["objects"][0] as object),
    ).not.toContain("id");
  });
});

describe("the Fabric theme envelope", () => {
  it("revives every baseline class used by the v2 demo fixture", async () => {
    const target = canvasOf();
    const envelope = {
      schemaVersion: 2,
      fabricVersion: "7.4.0",
      id: "demo",
      artboard: { width: 1, height: 1 },
      scene: {
        version: "7.4.0",
        objects: [
          { type: "Circle", radius: 1 },
          {
            type: "Path",
            path: [
              ["M", 0, 0],
              ["L", 1, 1],
            ],
          },
          { type: "Rect", width: 1, height: 1 },
          { type: "Textbox", text: "demo" },
        ],
      },
    } as const;

    await reviveThemeEnvelope(target, envelope);

    expect(target.getObjects()).toEqual([
      expect.any(Circle),
      expect.any(Path),
      expect.any(Rect),
      expect.any(Textbox),
    ]);
  });

  it("records this Fabric version and only authored scene state", () => {
    const rect = new Rect({ width: 10, height: 10 });
    rect.set("id", "rect");

    const envelope = serialiseThemeEnvelope(canvasOf(rect), {
      id: "theme",
      artboard: { width: 400, height: 300 },
      bindings: { rect: [] },
    });

    expect(envelope).toMatchObject({
      schemaVersion: 2,
      id: "theme",
      fabricVersion: "7.4.0",
    });
    expect((envelope.scene as SerialisedScene).objects[0]).toMatchObject({
      id: "rect",
      type: "Rect",
    });
    expect(validateFabricThemeEnvelope(envelope)).toMatchObject({ ok: true });
  });

  it("refuses a different Fabric version before replacing the scene", async () => {
    const target = canvasOf(new Rect({ width: 5, height: 5 }));
    const envelope = serialiseThemeEnvelope(
      canvasOf(new Rect({ width: 10, height: 10 })),
      {
        id: "theme",
        artboard: { width: 400, height: 300 },
      },
    );
    const incompatible = { ...envelope, fabricVersion: "7.5.0" };

    expect(() => assertFabricThemeEnvelopeCompatible(incompatible)).toThrow(
      "incompatible",
    );
    await expect(reviveThemeEnvelope(target, incompatible)).rejects.toThrow(
      "incompatible",
    );
    expect(target.getObjects()).toHaveLength(1);
  });
});

describe("reviving replaces chart resources", () => {
  it("disposes existing charts, including charts nested in groups", async () => {
    const chart = new VigiliaChart(chartOptions());
    const existing = canvasOf(new Group([chart]));
    const replacement = serialiseScene(
      canvasOf(new Rect({ width: 10, height: 10 })),
    );

    await reviveScene(existing, replacement);

    expect(chart.disposed).toBe(true);
    expect(existing.getObjects()).toHaveLength(1);
    expect(existing.getObjects()[0]).toBeInstanceOf(Rect);
  });
});

describe("a settings object cannot be mutated in place", () => {
  it("freezes what it was given, deeply", () => {
    const settings = { ...defaultLineSettings };
    const chart = new VigiliaChart(
      chartOptions({ settings } as Partial<VigiliaChartOptions>),
    );

    expect(Object.isFrozen(chart.settings)).toBe(true);
    // Fabric copies custom properties by reference, so the snapshot *is* the
    // live object — which is fine precisely because neither can be written.
    expect(() => {
      (chart.settings as unknown as Record<string, unknown>)["unit"] =
        "changed";
    }).toThrow(TypeError);
  });

  it("leaves an earlier snapshot unchanged when settings are replaced", () => {
    const chart = new VigiliaChart(chartOptions());
    chart.set("id", "chart-1");

    const before = serialiseScene(canvasOf(chart)).objects[0]!["settings"];

    chart.set("settings", { ...defaultLineSettings, unit: "replaced" });

    expect(chart.settings).not.toBe(before);
    expect((before as Record<string, unknown>)["unit"]).not.toBe("replaced");
  });
});

describe("there is exactly one owner of scene serialisation", () => {
  it("is the only module in the package that calls toObject", () => {
    // A grep, not a judgement. The rule it enforces — every save passes
    // `['id']` and strips defaults — is unenforceable by any test of
    // `persist.ts` itself, because the way to break it is to not call it.
    const root = dirname(fileURLToPath(import.meta.url));

    const walk = (directory: string): string[] =>
      readdirSync(directory).flatMap((entry) => {
        const full = join(directory, entry);

        if (statSync(full).isDirectory()) {
          return walk(full);
        }

        return entry.endsWith(".ts") && !entry.endsWith(".test.ts")
          ? [full]
          : [];
      });

    // Comment lines are dropped first, crudely but on purpose: `adapter.ts`
    // documents the save path as `canvas.toObject() -> envelope.scene`, and a
    // scan that cannot tell prose from a call would force the one module that
    // explains this rule to stop explaining it. A call hidden after code on the
    // same line as a `//` is not caught; that is a worse way to break the rule
    // than any this is likely to meet.
    const code = (file: string): string =>
      readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(?:\/\/|\/?\*)/.test(line))
        .join("\n");

    const offenders = walk(root)
      .filter((file) => !file.endsWith("persist.ts"))
      .filter((file) => /\.toObject\s*\(/.test(code(file)))
      .map((file) => relative(root, file).replaceAll("\\", "/"));

    expect(
      offenders,
      `serialise through persist.ts — a bare toObject() drops every id and strips nothing:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("scans real sources", () => {
    // The guard on the guard: the scan above passes forever if it walks
    // nothing, and it walks a directory by path.
    const root = dirname(fileURLToPath(import.meta.url));

    expect(
      readdirSync(root).filter((entry: string) => entry.endsWith(".ts")).length,
    ).toBeGreaterThan(10);
    expect(SCENE_PERSISTED_PROPERTIES).toEqual([
      "id",
      VIGILIA_TEXT_PROPERTY,
      VIGILIA_PAINT_PROPERTY,
      VIGILIA_ASSET_PROPERTY,
    ]);
  });
});
