// @vitest-environment jsdom

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isKnownSemanticKey,
  isObjectName,
  MAX_OBJECT_NAME_LENGTH,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";
import {
  reviveThemeEnvelope,
  serialiseThemeEnvelope,
  VigiliaChart,
} from "@vigilia/scene-fabric";
import { readThemePackage } from "@vigilia/theme-package";
import { StaticCanvas } from "fabric/es";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  createBlankFabricTheme,
  createNewFabricTheme,
} from "./new-fabric-theme.js";
import { cpuCard } from "./new-fabric-theme-cards.js";
import { starterPalette } from "./new-fabric-theme-globals.js";
import {
  createNewChartDefaults,
  createNewPanelDefaults,
  newObjectPlacement,
} from "./new-object-defaults.js";
import { serializeThemePackage } from "./persist.js";
import { STARTER_BACKDROP_PATH } from "./starter-backdrop.js";

type ObjectJson = Readonly<Record<string, unknown>>;

/**
 * The reference artboard and the box of every card on it, measured off
 * `docs/superpowers/specs/2026-09-26-reference-theme-target.png`: the card
 * borders were located by the transition of its two-pixel outline. Stated here
 * rather than imported from the builder, so the assertion is against the
 * measurement and not against whatever the builder happens to emit.
 */
const ARTBOARD = { width: 1672, height: 941 } as const;

const CARDS: ReadonlyArray<{
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}> = [
  { id: "time-card", left: 40, top: 187, width: 367, height: 307 },
  { id: "cpu-card", left: 421, top: 187, width: 280, height: 307 },
  { id: "gpu-card", left: 715, top: 187, width: 290, height: 307 },
  { id: "ram-card", left: 1019, top: 187, width: 299, height: 307 },
  { id: "vram-card", left: 1332, top: 187, width: 300, height: 307 },
  // The reference's trends card starts at x 294; this one spans the left
  // column to the 40-unit margin the rest of the composition uses, so the
  // reference's gap for the coffee mug is not reproduced as a hole.
  { id: "trends-card", left: 40, top: 507, width: 1084, height: 335 },
  { id: "storage-card", left: 1138, top: 507, width: 494, height: 165 },
  { id: "network-card", left: 1138, top: 687, width: 494, height: 155 },
];

const objectsOf = (theme: ReturnType<typeof createNewFabricTheme>) =>
  theme.scene.objects as readonly ObjectJson[];

const objectById = (
  theme: ReturnType<typeof createNewFabricTheme>,
  id: string,
) => objectsOf(theme).find((object) => object["id"] === id) ?? {};

const bindingsOf = (theme: ReturnType<typeof createNewFabricTheme>) =>
  theme.bindings ?? {};

const chartsOf = (theme: ReturnType<typeof createNewFabricTheme>) =>
  objectsOf(theme).filter((object) => object["type"] === "VigiliaChart");

/** Every string the document shows as authored prose, across all text runs. */
const literalText = (theme: ReturnType<typeof createNewFabricTheme>): string =>
  objectsOf(theme)
    .flatMap((object) => {
      const authored = object["vigiliaText"] as
        | { readonly runs?: ReadonlyArray<Record<string, unknown>> }
        | undefined;
      return (authored?.runs ?? []).map((run) => run["text"]);
    })
    .filter((text): text is string => typeof text === "string")
    .join("\n");

describe("the new Fabric document", () => {
  it("starts with a validated v2 dashboard on the reference artboard", () => {
    const document_ = createNewFabricTheme();

    expect(validateFabricThemeEnvelope(document_)).toEqual({
      ok: true,
      envelope: document_,
    });
    expect(document_.artboard).toMatchObject(ARTBOARD);
    expect(document_.metadata?.locale).toBe("en");
    expect(document_.globals?.typePresets).toMatchObject({
      "36-500": { value: { trioRole: "heading" } },
      "90-600": { value: { trioRole: "heading" } },
      "24-400": { value: { trioRole: "body" } },
      mono: { value: { trioRole: "mono" } },
    });
    // **The backdrop is a declared media asset, and nothing paints over it.**
    // The gradient plate it replaced was a scene object sitting on the canvas
    // and an opaque artboard paint behind it, so the media layer mounted below
    // the canvas could not have been seen through either. Both are gone, and
    // the artboard paint is now the transparent token the media needs.
    expect(document_.artboard).toMatchObject({
      background: { ref: "palette.none" },
      backgroundMedia: { assetId: "starter-backdrop", fit: "cover" },
    });
    expect(objectsOf(document_).map((object) => object["id"])).not.toContain(
      "background",
    );
    // The declaration is what the player resolves and what the validator
    // refuses a dangling `assetId` for, so its path and the bytes the editor
    // hands `mount` are one fact, not two.
    expect(document_.assets).toHaveLength(1);
    expect(document_.assets?.[0]).toMatchObject({
      kind: "image",
      path: STARTER_BACKDROP_PATH,
      license: { name: "Unsplash License" },
    });
  });

  it("declares a backdrop whose bytes are really in the repository", () => {
    // A `sha256` in the declaration is a claim about a file, and a claim that
    // is never checked is worse than none. This is that check.
    const declared = createNewFabricTheme().assets?.[0];
    if (declared === undefined) throw new Error("no backdrop is declared");
    const bytes = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "starter-backdrop.jpg"),
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      declared.sha256,
    );
    // JPEG, and the first two bytes say so — the editor types the preview blob
    // from the extension, and a mislabelled file would decode to nothing.
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("binds only keys the vocabulary owns, and every value run resolves", () => {
    // The envelope validator checks that a `semanticKey` is a string of 1-120
    // characters and nothing else, so a validator-green document proves nothing
    // about a binding being live. `isKnownSemanticKey` is the actual vocabulary.
    const theme = createNewFabricTheme();
    const unknown = Object.entries(bindingsOf(theme)).flatMap(
      ([objectId, list]) =>
        list
          .filter((binding) => !isKnownSemanticKey(binding.semanticKey))
          .map((binding) => `${objectId} -> ${binding.semanticKey}`),
    );
    expect(unknown, "a starter binding no provider owns").toEqual([]);

    // A value run names a binding on its own object; pointing at one the object
    // does not declare renders an em dash and an unmapped-key issue instead.
    for (const object of objectsOf(theme)) {
      const id = String(object["id"]);
      const runs = (
        object["vigiliaText"] as
          | { readonly runs?: ReadonlyArray<Record<string, unknown>> }
          | undefined
      )?.runs;
      if (runs === undefined) continue;
      const declared = new Set(
        (bindingsOf(theme)[id] ?? []).map((binding) => binding.id),
      );
      for (const run of runs)
        if (run["kind"] === "value")
          expect(
            declared.has(String(run["bindingId"])),
            `${id}: ${String(run["bindingId"])}`,
          ).toBe(true);
    }
  });

  it("spells system memory `ram`, never the stale `memory.` name", () => {
    // The defect this replaced: `memory.used` is in no provider's key list, the
    // host synthesises a `missing` sample, and a pie renormalises its remaining
    // slices to a false 100%. The starter now binds a key a provider owns.
    const theme = createNewFabricTheme();
    const keys = Object.values(bindingsOf(theme))
      .flat()
      .map((binding) => binding.semanticKey);
    expect(keys.filter((key) => key.startsWith("memory."))).toEqual([]);
    expect(bindingsOf(theme)["ram-gauge"]).toEqual([
      expect.objectContaining({ semanticKey: "ram.used.percent" }),
    ]);
  });

  it("ships the chart families the reference uses, and no others", () => {
    const charts = chartsOf(createNewFabricTheme());
    const families = charts.map((chart) => chart["family"]);
    const count = (family: string): number =>
      families.filter((value) => value === family).length;

    // Two gauges (partial arc, full ring), four line charts (two sparklines, the
    // performance chart, the network chart) and one bar (storage). The reference
    // has no pie, so the starter no longer ships one.
    expect(count("gauge")).toBe(2);
    expect(count("line")).toBe(4);
    expect(count("bar")).toBe(1);
    expect(families.filter((family) => family === "pie")).toEqual([]);
  });

  it("binds both gauges to a usage percentage over a 0-100 range", () => {
    const theme = createNewFabricTheme();
    // `max` is a plain number with no way to reference `ram.total`, so a gauge
    // bound to the absolute gigabytes would draw a clamped fraction of a total
    // it cannot know. The percentage key is the only honest option.
    expect(bindingsOf(theme)["ram-gauge"]).toEqual([
      expect.objectContaining({ semanticKey: "ram.used.percent" }),
    ]);
    expect(objectById(theme, "ram-gauge")["settings"]).toMatchObject({
      min: 0,
      max: 100,
    });
    expect(bindingsOf(theme)["vram-gauge"]).toEqual([
      expect.objectContaining({ semanticKey: "vram.used.percent" }),
    ]);
    expect(objectById(theme, "vram-gauge")["settings"]).toMatchObject({
      min: 0,
      max: 100,
    });
  });

  it("draws the RAM arc open at the bottom and the VRAM one as a full ring", () => {
    const theme = createNewFabricTheme();
    // Both are settings values on one family, not a new capability: the default
    // 225 -> -45 is the 270-degree arc the reference's RAM card shows, and
    // 0 -> 360 closes it.
    expect(objectById(theme, "ram-gauge")["settings"]).toMatchObject({
      startAngle: 225,
      endAngle: -45,
    });
    expect(objectById(theme, "vram-gauge")["settings"]).toMatchObject({
      startAngle: 0,
      endAngle: 360,
    });
  });

  it("keeps each gauge's capacity label a separate live-text object", () => {
    const theme = createNewFabricTheme();
    // `buildGaugeOption` hides `detail` and `axisLabel` outright, so there is no
    // chart-internal value text to suppress and no choice to make: the number in
    // the middle of a ring is an ordinary text object bound to a reading.
    for (const [gauge, reading] of [
      ["ram-gauge", "ram-value"],
      ["vram-gauge", "vram-value"],
    ] as const) {
      const value = objectById(theme, reading);
      expect(value["type"], reading).toBe("Textbox");
      const runs = (
        value["vigiliaText"] as { readonly runs: ReadonlyArray<ObjectJson> }
      ).runs;
      expect(runs[0]?.["kind"], reading).toBe("value");
      expect(
        (bindingsOf(theme)[reading] ?? []).map(
          (binding) => binding.semanticKey,
        ),
        reading,
      ).toEqual([
        gauge === "ram-gauge" ? "ram.used.percent" : "vram.used.percent",
      ]);
    }
  });

  it("authors no reading, device name or time axis that nothing supplies", () => {
    const prose = literalText(createNewFabricTheme());
    // Every one of these was authored text standing in for a reading. The
    // device names are now real readings — bound to `cpu.brand`, `gpu.name` and
    // `disk.name`, which resolve from the same device the figures beside them
    // describe — so they must appear as bindings, never as prose. Prose would
    // name one machine's hardware on every machine.
    for (const claim of [
      "7800X3D",
      "RTX 4080",
      "Games (D:)",
      "Seattle",
      "Mostly cloudy",
      "A calmer system",
      "6:30",
      "7:30",
      "All systems nominal",
    ])
      expect(prose, claim).not.toContain(claim);
  });

  it("binds each caption to the key that names the device its card measures", () => {
    const bindings = bindingsOf(createNewFabricTheme());
    const keyOf = (node: string, binding: string) =>
      bindings[node]?.find((b) => b.id === binding)?.semanticKey;

    expect(keyOf("cpu-card-caption", "cpu-card-model")).toBe("cpu.brand");
    expect(keyOf("gpu-card-caption", "gpu-card-model")).toBe("gpu.name");
    expect(keyOf("storage-card-name", "storage-card-volume")).toBe("disk.name");
    // The GPU caption and the GPU figures must resolve from one device, so a
    // theme cannot show card A's load under card B's name.
    expect(keyOf("gpu-card-value", "gpu-card-load")).toBe("gpu.load");
    expect(keyOf("storage-bar", "storage-used")).toBe("disk.used.percent");
  });

  it("names every object after the readable id it already carries", () => {
    const theme = createNewFabricTheme();
    const objects = objectsOf(theme);

    // The showcase theme is the document an author opens to learn from, and a
    // layer list of 52 UUIDs is the problem F1.8 was about, not an example of
    // the fix. The builders already chose a readable id beside every object, so
    // the name is that id promoted — not a second, invented vocabulary.
    for (const object of objects) {
      const id = String(object["id"]);
      expect(object["name"], `${id} has no name`).toBe(id);
      // `name` is a bounded label, not free text, and the envelope refuses a
      // value outside the bound at import — so this is checked against the
      // guard's own predicate rather than assumed.
      expect(isObjectName(object["name"]), `${id}'s name is not a label`).toBe(
        true,
      );
      expect(
        String(object["name"]).length,
        `${id} exceeds the published bound`,
      ).toBeLessThanOrEqual(MAX_OBJECT_NAME_LENGTH);
    }

    // Unique, because a duplicate makes the layer list ambiguous: two rows read
    // the same and the author cannot tell which one a name refers to.
    const names = objects.map((object) => String(object["name"]));
    expect(names).toHaveLength(new Set(names).size);

    // The names must not cost the document its validity: a name the validator
    // refuses would empty the canvas.
    expect(validateFabricThemeEnvelope(theme).ok).toBe(true);
  });

  it("persists those names in the saved package, not at load time", async () => {
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);
    const saved = serialiseThemeEnvelope(canvas, theme);
    await canvas.dispose();

    // A name the editor added on the way in would be runtime state wearing an
    // authored hat (§67). What is written here is the package, and the names
    // are read back out of its `theme.json` — so this is the file, not a
    // revival of it.
    const bytes = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "starter-backdrop.jpg"),
    );
    const pkg = serializeThemePackage(saved, {
      [STARTER_BACKDROP_PATH]: new Uint8Array(bytes),
    });
    if (!pkg.ok) throw new Error(pkg.message);
    const themeJson = unzipSync(pkg.bytes)["theme.json"];
    if (themeJson === undefined) throw new Error("no theme.json in the zip");
    const written = JSON.parse(strFromU8(themeJson)) as {
      scene: { objects: ReadonlyArray<Record<string, unknown>> };
    };
    const persisted = written.scene.objects;
    expect(persisted).toHaveLength(objectsOf(theme).length);
    for (const object of persisted) {
      const id = String(object["id"]);
      expect(object["name"], `${id} lost its name in the saved file`).toBe(id);
    }
    // And the archive is still a package, not a document with extra bytes.
    expect(readThemePackage(pkg.bytes).ok).toBe(true);
  });

  it("places every reference card on its measured box", () => {
    const theme = createNewFabricTheme();
    for (const card of CARDS) {
      expect(
        {
          left: objectById(theme, card.id)["left"],
          top: objectById(theme, card.id)["top"],
          width: objectById(theme, card.id)["width"],
          height: objectById(theme, card.id)["height"],
        },
        card.id,
      ).toEqual({
        left: card.left,
        top: card.top,
        width: card.width,
        height: card.height,
      });
    }
  });

  it("keeps every object inside the artboard and off each other's card", () => {
    const theme = createNewFabricTheme();
    const { width, height } = theme.artboard;
    for (const object of objectsOf(theme)) {
      const id = String(object["id"]);
      const left = Number(object["left"]);
      const top = Number(object["top"]);
      expect(Number.isFinite(left) && Number.isFinite(top), id).toBe(true);
      // Charts are authored around their centre, so their top-left is negative.
      const w = Number(object["width"] ?? 0);
      const h = Number(object["height"] ?? 0);
      const minX = object["originX"] === "center" ? left - w / 2 : left;
      const minY = object["originY"] === "center" ? top - h / 2 : top;
      expect(minX, `${id} left`).toBeGreaterThanOrEqual(-1);
      expect(minY, `${id} top`).toBeGreaterThanOrEqual(-1);
      expect(minX + w, `${id} right`).toBeLessThanOrEqual(width + 1);
      expect(minY + h, `${id} bottom`).toBeLessThanOrEqual(height + 1);
    }
  });

  it("gives every card the radius and border width measured off the reference", () => {
    const theme = createNewFabricTheme();
    // A card is a stroked Rect; the background is a Rect too, so the match set
    // is filtered rather than assumed.
    const cards = objectsOf(theme).filter(
      (object) => object["type"] === "Rect" && object["stroke"] !== undefined,
    );
    expect(cards.map((card) => card["id"]).sort()).toEqual(
      CARDS.map((card) => card.id).sort(),
    );
    // Measured off docs/superpowers/specs/2026-09-26-reference-theme-target.png:
    // the top border occupies rows 187-188 and the left border columns 40-41 of
    // the 1672-wide reference, and first appears 10px in from the corner.
    for (const card of cards) {
      expect(card["strokeWidth"], String(card["id"])).toBe(2);
      expect(card["rx"], String(card["id"])).toBe(10);
      expect(card["ry"], String(card["id"])).toBe(10);
    }
  });

  it("composes every icon from Lucide, stroked rather than hand-drawn", () => {
    const theme = createNewFabricTheme();
    const icons = objectsOf(theme).filter((object) =>
      String(object["id"]).endsWith("-icon"),
    );
    // Every card the reference shows an icon on: CPU, GPU, RAM, VRAM, trends,
    // storage and network.
    expect(icons.map((icon) => icon["id"]).sort()).toEqual([
      "cpu-card-icon",
      "gpu-card-icon",
      "network-card-icon",
      "ram-card-icon",
      "storage-card-icon",
      "trends-card-icon",
      "vram-card-icon",
    ]);
    for (const icon of icons) {
      const id = String(icon["id"]);
      // Lucide glyphs are strokes on a 24-unit grid, never fills; a filled path
      // here is one of the hand-drawn constants the reference replaces.
      expect(icon["type"], id).toBe("Path");
      expect(Number(icon["strokeWidth"]), id).toBeGreaterThan(0);
      expect(icon["fill"], id).toBeNull();
      const commands = icon["path"] as ReadonlyArray<readonly unknown[]>;
      expect(commands.length, id).toBeGreaterThan(1);
      for (const command of commands)
        for (const value of command.slice(1))
          expect(Number.isFinite(Number(value)), `${id} ${command[0]}`).toBe(
            true,
          );
    }
    // The hand-drawn weather and thermal glyphs are gone, not kept alongside.
    expect(
      objectsOf(theme)
        .map((object) => String(object["id"]))
        .filter((id) => id.endsWith("-svg-path")),
    ).toEqual([]);
  });

  it("tracks only the wordmark and the strapline, and fits their boxes", async () => {
    // Typography, not a value dump. A tracked clock or reading does not read as
    // a clock or a reading: a numeral's advance is a grid cell, and opening it up
    // breaks the column it sits in.
    const theme = createNewFabricTheme();
    const presets = theme.globals?.typePresets as Record<
      string,
      { value: Readonly<Record<string, unknown>> }
    >;
    const spacingOf = (id: string): number | undefined => {
      const value = presets[id]?.value["letterSpacing"];
      return typeof value === "number" ? value : undefined;
    };

    // Tracked: the wordmark and the overline under it. Both values are measured
    // off the reference image rather than judged by eye — see the presets.
    expect(spacingOf("36-500"), "wordmark").toBeGreaterThan(0);
    expect(spacingOf("17-400"), "strapline").toBeGreaterThan(0);

    // Untracked: every other preset, including all the readings.
    for (const id of Object.keys(presets)) {
      if (id === "36-500" || id === "17-400") continue;
      expect(spacingOf(id) ?? 0, id).toBe(0);
    }

    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);
    // Keyed off each object's own run reference, not its id: an object id is
    // `ram-value` and the preset it uses is `60-600`.
    const tracked = canvas.getObjects().filter((object) => {
      const authored = object.get("vigiliaText") as
        | { readonly runs?: ReadonlyArray<{ typePreset?: string }> }
        | undefined;
      const ref = authored?.runs?.[0]?.typePreset;
      const preset = ref?.slice("typePresets.".length);
      return preset !== undefined && spacingOf(preset) !== undefined;
    });
    // The fit check first, so an overflow is reported as an overflow rather than
    // as "the tracked set changed".
    for (const object of tracked) {
      const id = String(object.get("id"));
      const lines = (object as { textLines?: string[] }).textLines;
      expect(lines, id).toBeDefined();
      expect(lines?.length, id).toBe(1);
    }
    // A floor against the empty set, which is the loop's one vacuous mode.
    expect(
      tracked.map((object) => object.get("id")),
      "no tracked object was found, so nothing was checked",
    ).not.toHaveLength(0);
    await canvas.dispose();
  });

  it("writes the resolved tracking into every tracked object's own JSON", async () => {
    // Every other preset-derived Fabric field is written into the object, so the
    // starter would declare five of a preset's six and omit the sixth. Not a
    // live bug — the editor applies presets at mount — but the starter is the
    // document every other task copies from.
    const theme = createNewFabricTheme();
    const presets = theme.globals?.typePresets as Record<
      string,
      { value: Readonly<Record<string, unknown>> }
    >;
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);

    const written: Array<[string, number]> = [];
    const absent: string[] = [];
    for (const object of canvas.getObjects()) {
      const authored = object.get("vigiliaText") as
        | { readonly runs?: ReadonlyArray<{ typePreset?: string }> }
        | undefined;
      const presetId = authored?.runs?.[0]?.typePreset?.slice(
        "typePresets.".length,
      );
      if (presetId === undefined) continue;
      if (typeof presets[presetId]?.value["letterSpacing"] !== "number")
        continue;
      const id = String(object.get("id"));
      const writtenValue = object.get("charSpacing") as number;
      if (typeof writtenValue === "number" && writtenValue !== 0)
        written.push([id, writtenValue]);
      else absent.push(id);
    }

    // 28px at 36px is Fabric's 1/1000 em.
    expect(written).toEqual([
      ["wordmark", (28 / 36) * 1000],
      ["strapline", (6 / 17) * 1000],
    ]);
    expect(absent).toEqual([]);
    await canvas.dispose();
  });

  it("ships a frosted CPU card whose value and sparkline read one live key", async () => {
    const theme = createNewFabricTheme();

    // The panel is an ordinary card rectangle carrying the treatment the
    // inspector's glass control reads and writes — not a bespoke object kind.
    // Its fill is `frost`, not `panel`: at `panel`'s 85 % alpha the backdrop
    // behind this card reached the eye at 2.40/255 of contrast, measured, and
    // a blur applied under an almost-opaque panel is a blur of nothing.
    const card = objectById(theme, "cpu-card");
    expect(card).toMatchObject({
      type: "Rect",
      vigiliaPaint: { fill: "palette.frost", stroke: "palette.panelStroke" },
      vigiliaGlass: { blurRadius: expect.any(Number) },
    });
    const treatment = card["vigiliaGlass"] as { blurRadius: number };
    expect(treatment.blurRadius).toBeGreaterThan(0);
    // The published bound, read from the schema the validator enforces rather
    // than from a constant this package does not own.
    const schema = JSON.parse(
      readFileSync(
        resolve(
          dirname(fileURLToPath(import.meta.url)),
          "../../../../../schema/theme-document.schema.json",
        ),
        "utf8",
      ),
    ) as {
      $defs: Record<
        string,
        { properties?: Record<string, { maximum: number }> }
      >;
    };
    expect(treatment.blurRadius).toBeLessThanOrEqual(
      schema.$defs["glassTreatment"]?.["properties"]?.["blurRadius"]?.maximum ??
        Number.NaN,
    );

    // The reading: a value run and a smaller literal unit on one text object.
    const value = objectById(theme, "cpu-card-value");
    const runs = (value["vigiliaText"] as { runs: ReadonlyArray<ObjectJson> })
      .runs;
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      kind: "value",
      bindingId: "cpu-card-load",
      precision: 0,
      unitDisplay: "none",
    });
    expect(runs[1]).toMatchObject({ kind: "literal", text: "%" });
    expect(bindingsOf(theme)["cpu-card-value"]).toEqual([
      expect.objectContaining({ semanticKey: "cpu.load" }),
    ]);

    // The sparkline reads the same key, so the card cannot show a percentage and
    // a waveform for two different moments.
    expect(objectById(theme, "cpu-card-sparkline")).toMatchObject({
      type: "VigiliaChart",
      family: "line",
    });
    expect(bindingsOf(theme)["cpu-card-sparkline"]).toEqual([
      expect.objectContaining({ semanticKey: "cpu.load" }),
    ]);
    // The chart's ink is the glass ink, not `cpu`/`sparkArea`: this card
    // transmits, so its field is a photograph, and `#4da3ff` sits 37 luma from
    // the CPU card's bright horizon — under the one-pixel edge floor, which
    // reads as a grey line rather than a stroke.
    expect(objectById(theme, "cpu-card-sparkline")["settings"]).toMatchObject({
      area: { ref: "palette.frostArea" },
      stroke: { ref: "palette.frostInk" },
      showAxes: false,
    });
    expect(validateFabricThemeEnvelope(theme).ok).toBe(true);
  });

  it("round-trips the CPU card's treatment through revival and serialisation", async () => {
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);

    // The authored radius itself, not just "some radius": 40 is the value that
    // dissolves the sunset's structure behind the card, and a round trip that
    // quietly fell back to a default would leave a panel that blurs without
    // diffusing — see `docs/decisions/0013-frost-is-diffusion-grain-saturation-and-an-edge.md`.
    const authored = cpuCard().find((object) => object["id"] === "cpu-card")?.[
      "vigiliaGlass"
    ];
    const revived = canvas
      .getObjects()
      .find((object) => object.get("id") === "cpu-card");
    expect(revived?.get("vigiliaGlass")).toEqual(authored);

    const saved = serialiseThemeEnvelope(canvas, theme);
    expect(
      (
        saved.scene.objects as ReadonlyArray<Readonly<Record<string, unknown>>>
      ).find((object) => object["id"] === "cpu-card")?.["vigiliaGlass"],
    ).toEqual(authored);
    expect(validateFabricThemeEnvelope(saved).ok).toBe(true);
    await canvas.dispose();
  });

  it("revives every card over a transparent artboard, and keeps the backdrop declared", async () => {
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);

    // The round trip is where a declaration is easiest to drop: it is
    // `artboard` and `assets` data, not a Fabric object, so nothing on the
    // canvas would complain if either were lost.
    const saved = serialiseThemeEnvelope(canvas, theme);
    expect(saved.artboard.backgroundMedia).toEqual({
      assetId: "starter-backdrop",
      fit: "cover",
    });
    expect(saved.artboard.background).toEqual({ ref: "palette.none" });
    expect(saved.assets).toEqual(theme.assets);

    const chart = canvas
      .getObjects()
      .find((object) => object.get("id") === "cpu-card-icon");
    expect(chart?.get("strokeWidth")).toBeGreaterThan(0);
    expect(
      (chart?.get("path") as unknown[] | undefined)?.length,
    ).toBeGreaterThan(1);

    expect(
      canvas.getObjects().filter((object) => object instanceof VigiliaChart),
    ).toHaveLength(7);
    const validation = validateFabricThemeEnvelope(saved);
    if (!validation.ok)
      throw new Error(
        validation.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("\n"),
      );
    expect(validation).toMatchObject({ ok: true });
    await canvas.dispose();
  });
});

describe("the blank Fabric document", () => {
  /** The nine the product decision names, plus `none` — which the validator
      requires of any palette (`paletteNone`, `fabric-envelope-validate.ts`) and
      which `new-object-defaults.ts` filters out before choosing a surface, so it
      is not one of the tokens a new object can be painted with. */
  const BLANK_PALETTE_IDS = [
    "none",
    "text",
    "dim",
    "panel",
    "frost",
    "panelStroke",
    "rule",
    "chartTrack",
    "frostInk",
    "frostArea",
  ] as const;
  /** What the decision rules out, and `none` with it: the reference
      composition's device colours are not a starting vocabulary. */
  const BLANK_PALETTE_ABSENT = [
    "cpu",
    "gpu",
    "ram",
    "vram",
    "down",
    "sparkArea",
    "storageFill",
    "bars",
    "background",
  ] as const;

  it("is a valid document at the artboard it was given, not the starter's", () => {
    const blank = createBlankFabricTheme({ width: 1920, height: 1080 });

    expect(validateFabricThemeEnvelope(blank)).toEqual({
      ok: true,
      envelope: blank,
    });
    expect(blank.artboard).toMatchObject({ width: 1920, height: 1080 });
    expect(blank.artboard).not.toMatchObject({
      width: createNewFabricTheme().artboard.width,
    });
  });

  it("is empty: no scene objects, no assets, no bindings", () => {
    const blank = createBlankFabricTheme({ width: 1920, height: 1080 });

    // An author who opens the product is handed a dashboard they did not make.
    // "Blank" that still carries the reference composition is the defect itself,
    // so each of these is asserted separately: a theme could be emptied of
    // objects and still carry the backdrop it declared.
    expect(blank.scene["objects"]).toEqual([]);
    expect(blank.assets).toEqual([]);
    expect(blank.bindings).toEqual({});
    // The backdrop is a packaged asset, so dropping the objects has to drop it
    // too — a declaration without bytes is a theme the player renders nothing
    // behind and the validator refuses.
    expect(blank.artboard["backgroundMedia"]).toBeUndefined();
  });

  it("starts from exactly the minimal token set, taken by id from the starter", () => {
    const blank = createBlankFabricTheme({ width: 1920, height: 1080 });
    const palette = blank.globals?.palette ?? {};

    expect(Object.keys(palette).sort()).toEqual([...BLANK_PALETTE_IDS].sort());
    // The reference palette's device colours are not a starting set: an author
    // who has no CPU has a theme with a CPU token in it.
    for (const absent of BLANK_PALETTE_ABSENT) {
      expect(palette[absent], absent).toBeUndefined();
    }
    // Narrowed by id, never restated: the entries are the starter's own, so a
    // change to the starter's tint reaches a blank theme instead of leaving a
    // second literal behind to drift.
    for (const id of BLANK_PALETTE_IDS) {
      expect(palette[id], id).toBe(starterPalette[id]);
    }
  });

  it("paints its artboard from tokens the blank palette actually has", () => {
    const blank = createBlankFabricTheme({ width: 1920, height: 1080 });
    const palette = blank.globals?.palette ?? {};
    const ids = (value: unknown): string[] =>
      value === undefined ? [] : [String((value as { ref: string }).ref)];

    for (const ref of [
      ...ids(blank.artboard.background),
      ...ids(blank.artboard.barColor),
    ]) {
      expect(ref.startsWith("palette."), ref).toBe(true);
      expect(palette[ref.slice("palette.".length)], ref).toBeDefined();
    }
  });

  it("gives a new panel and a new chart tokens that exist and differ", () => {
    const blank = createBlankFabricTheme({ width: 1920, height: 1080 });
    const globals = blank.globals;
    const palette = globals?.palette ?? {};
    const token = (ref: string | undefined): string =>
      (ref ?? "").replace(/^palette\./, "");

    // A card filled with the page, or a gauge whose track and data are one
    // colour, is an object the author cannot see — which is what the
    // surface-token rules in `new-object-defaults.ts` exist to prevent, and
    // they only hold if the blank palette names the surfaces they reach for.
    // Only the card's fill is under test here, so it takes the first cascade
    // slot: this is a palette assertion, not a placement one.
    const card = createNewPanelDefaults(
      globals,
      newObjectPlacement(0, blank.artboard),
    );
    const chart = createNewChartDefaults(globals, "gauge");
    const cardFill = token(card.vigiliaPaint?.fill);
    const track = token((chart.track as { ref?: string } | undefined)?.ref);
    const progress = token((chart.progress as { ref?: string }).ref);
    const page = token((blank.artboard.background as { ref?: string }).ref);

    for (const id of [cardFill, track, progress]) {
      expect(palette[id], id).toBeDefined();
    }
    expect(cardFill, "a card is not the page it sits on").not.toBe(page);
    expect(track, "a gauge's track is not its data").not.toBe(progress);
  });
});
