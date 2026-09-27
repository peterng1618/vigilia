// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateFabricThemeEnvelope } from "@vigilia/renderer-core";
import {
  reviveThemeEnvelope,
  serialiseThemeEnvelope,
  VigiliaChart,
} from "@vigilia/scene-fabric";
import { StaticCanvas } from "fabric/es";
import { describe, expect, it } from "vitest";
import { createNewFabricTheme } from "./new-fabric-theme.js";

describe("the new Fabric document", () => {
  it("starts with a validated v2 dashboard that includes the supported showcase surface", () => {
    const document_ = createNewFabricTheme();

    expect(validateFabricThemeEnvelope(document_)).toEqual({
      ok: true,
      envelope: document_,
    });
    expect(document_.scene.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "background" }),
        expect.objectContaining({ id: "weather-cloud-svg-path", type: "Path" }),
        expect.objectContaining({ id: "time", type: "Textbox" }),
        expect.objectContaining({
          id: "load-gauge",
          type: "VigiliaChart",
          family: "gauge",
        }),
        expect.objectContaining({
          id: "trend-line",
          type: "VigiliaChart",
          family: "line",
        }),
        expect.objectContaining({
          id: "thermal-bars",
          type: "VigiliaChart",
          family: "bar",
        }),
        expect.objectContaining({
          id: "resource-pie",
          type: "VigiliaChart",
          family: "pie",
        }),
      ]),
    );
    expect(document_.scene.objects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "background",
          originX: "left",
          originY: "top",
        }),
        expect.objectContaining({
          id: "trend-line",
          originX: "center",
          originY: "center",
        }),
      ]),
    );
    const objects = document_.scene.objects as readonly Readonly<
      Record<string, unknown>
    >[];
    expect(
      objects.find((object) => object["id"] === "background"),
    ).toMatchObject({ selectable: false, evented: false });
    expect(
      objects.find((object) => object["id"] === "load-gauge"),
    ).not.toMatchObject({ selectable: false });
    expect(document_.globals?.typePresets).toMatchObject({
      "32-500": { value: { trioRole: "heading" } },
      "36-600": { value: { trioRole: "heading" } },
      "70-300": { value: { trioRole: "heading" } },
      "14-400": { value: { trioRole: "body" } },
      mono: { value: { trioRole: "mono" } },
    });
  });

  it("starts a new theme in English, so it validates", () => {
    const theme = createNewFabricTheme();

    expect(theme.metadata?.locale).toBe("en");
    expect(validateFabricThemeEnvelope(theme).ok).toBe(true);
  });

  it("tracks only what the reference measures, and fits its boxes", async () => {
    // Typography, not a value dump. Two things an untracked starter gets wrong:
    // a wordmark reads as one grey run, and a tracked clock or reading does not
    // — a numeral's advance is a grid cell and opening it up breaks the column
    // it sits in.
    //
    // The section labels are untracked on purpose: the reference has no
    // all-caps section label, so there is nothing to measure a value against,
    // and at a measured ratio they overflow every box they are applied to. The
    // fit assertion below is what keeps that from coming back.
    const theme = createNewFabricTheme();
    const presets = theme.globals?.typePresets as Record<
      string,
      { value: Readonly<Record<string, unknown>> }
    >;
    const spacingOf = (id: string): number | undefined => {
      const value = presets[id]?.value["letterSpacing"];
      return typeof value === "number" ? value : undefined;
    };

    // Tracked: the wordmark and the strapline. The wordmark's value is measured
    // off the reference image, not judged by eye — see the note on the preset.
    expect(spacingOf("32-500")).toBeGreaterThan(0);
    expect(spacingOf("12-400")).toBeGreaterThan(0);

    // Untracked: the section labels (an unmeasured role, in boxes sized for one
    // line), and the readings.
    for (const id of ["13-600", "70-300", "36-600", "16-400", "17-500"]) {
      expect(spacingOf(id) ?? 0, id).toBe(0);
    }

    // And every value is a real number the converter can use, not a string
    // that would silently become no tracking at all.
    for (const value of Object.values(presets)) {
      const spacing = value.value["letterSpacing"];
      if (spacing === undefined) continue;
      expect(Number.isFinite(spacing)).toBe(true);
    }

    // Tracking widens a line, and a `Textbox` wraps rather than spills. A
    // tracked label that no longer fits its authored box silently becomes two
    // lines — invisible in the preset panel, and only on the canvas.
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);
    // Keyed off each object's own run reference, not its id: an object id is
    // `gauge-title`, and the preset it uses is `13-600`. Keying by id matches
    // nothing, and the loop would pass on an empty set.
    const tracked = canvas.getObjects().filter((object) => {
      const authored = object.get("vigiliaText") as
        | { readonly runs?: ReadonlyArray<{ typePreset?: string }> }
        | undefined;
      const ref = authored?.runs?.[0]?.typePreset;
      const preset = ref?.slice("typePresets.".length);
      return preset !== undefined && spacingOf(preset) !== undefined;
    });
    // The fit check first, so an overflow is reported as an overflow. A tracked
    // preset that outgrows its box must not be reported as "the tracked set
    // changed" — that is the wrong thing, and it is what a maintainer
    // re-tracking a label would be told.
    for (const object of tracked) {
      const id = String(object.get("id"));
      const lines = (object as { textLines?: string[] }).textLines;
      expect(lines, id).toBeDefined();
      expect(lines?.length, id).toBe(1);
    }
    // Then a floor against the empty set, which is the loop's one vacuous
    // mode. Which presets are tracked is not asserted here: that belongs to the
    // object-JSON test below, and pinning it here would put a set mismatch
    // between a maintainer and the failure they actually caused.
    expect(
      tracked.map((object) => object.get("id")),
      "no tracked object was found, so nothing was checked",
    ).not.toHaveLength(0);
    await canvas.dispose();
  });

  it("writes the resolved tracking into every tracked object's own JSON", async () => {
    // Every other preset-derived Fabric field is written into the object, so
    // the starter declares five of a preset's six and omits the one this task
    // is about. Not a live bug — the editor applies presets at mount — but the
    // starter is the document every other task copies from, and a reader
    // comparing an object against its preset would conclude the sixth field
    // does not exist.
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

    // Every text object, keyed off its own run reference: an object id is
    // `gauge-title` and the preset it uses is `13-600`, so id-keying matches
    // nothing and the loop would pass on an empty set.
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
      const authored0 = presets[presetId]?.value["letterSpacing"];
      if (typeof authored0 !== "number") continue;
      const id = String(object.get("id"));
      // 28px at 32px is Fabric's 1/1000 em: 875.
      const writtenValue = object.get("charSpacing") as number;
      if (typeof writtenValue === "number" && writtenValue !== 0) {
        written.push([id, writtenValue]);
      } else {
        absent.push(id);
      }
    }

    // Every tracked object carries its preset's converted value.
    expect(written).toEqual([
      ["wordmark", 875],
      ["strapline", (6.5 / 12) * 1000],
    ]);
    // So a preset that tracks and an object that does not is caught here, not
    // discovered by a reader.
    expect(absent).toEqual([]);
    await canvas.dispose();
  });

  it("gives every card the radius and border width measured off the reference", () => {
    const theme = createNewFabricTheme();
    // A card is a stroked Rect; the background and the header wash are Rects
    // too, so the match set is named rather than assumed.
    const cards = (
      theme.scene.objects as ReadonlyArray<Readonly<Record<string, unknown>>>
    ).filter(
      (object) => object["type"] === "Rect" && object["stroke"] !== undefined,
    );
    expect(cards.map((card) => card["id"])).toEqual([
      "time-card",
      "cpu-card",
      "weather-card",
      "gauge-card",
      "trend-card",
      "thermal-card",
      "resource-card",
      "status-card",
    ]);

    // Measured off docs/superpowers/specs/2026-09-26-reference-theme-target.png,
    // not judged by eye: the card's top border occupies rows 186-187 and its
    // left border columns 39-40 of the 1672-wide reference, so the border is
    // 2px; and the border first appears 10px in from the top-left corner on
    // both axes, so the corner radius is 10.
    for (const card of cards) {
      expect(card["strokeWidth"], String(card["id"])).toBe(2);
      expect(card["rx"], String(card["id"])).toBe(10);
      expect(card["ry"], String(card["id"])).toBe(10);
    }
  });

  it("ships a frosted CPU card whose value and sparkline read one live key", async () => {
    const theme = createNewFabricTheme();
    const object = (id: string): Record<string, unknown> =>
      (
        theme.scene.objects as ReadonlyArray<Readonly<Record<string, unknown>>>
      ).find((candidate) => candidate["id"] === id) ?? {};

    // The panel is an ordinary card rectangle carrying the treatment the
    // inspector's glass control reads and writes — not a bespoke object kind.
    const card = object("cpu-card");
    expect(card).toMatchObject({
      type: "Rect",
      vigiliaPaint: { fill: "palette.panel", stroke: "palette.panelStroke" },
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

    // The reading: a value run and a smaller literal unit on one text object,
    // bound to a key this document declares.
    const value = object("cpu-card-value");
    const runs = (
      value["vigiliaText"] as {
        runs: ReadonlyArray<Record<string, unknown>>;
      }
    ).runs;
    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({
      kind: "value",
      bindingId: "cpu-card-load",
      // Whole numbers: without the precision the renderer rounds to one decimal
      // and the card reads "36.0%", which is not what a usage figure says.
      precision: 0,
      unitDisplay: "none",
    });
    expect(runs[1]).toMatchObject({ kind: "literal", text: "%" });
    const valueBinding = theme.bindings?.["cpu-card-value"] ?? [];
    expect(valueBinding).toEqual([
      expect.objectContaining({ semanticKey: "cpu.load" }),
    ]);

    // The sparkline: the same line family the trend card already uses, on the
    // same key, with the area gradient that family already supports.
    expect(object("cpu-card-sparkline")).toMatchObject({
      type: "VigiliaChart",
      family: "line",
    });
    expect(theme.bindings?.["cpu-card-sparkline"]).toEqual([
      expect.objectContaining({ semanticKey: "cpu.load" }),
    ]);
    // Both halves read the same key, so a card cannot show a percentage and a
    // waveform for two different moments.
    const sparkline = object("cpu-card-sparkline") as {
      settings: Record<string, unknown>;
    };
    expect(sparkline.settings).toMatchObject({
      area: { ref: "palette.trendArea" },
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

    // The revived object carries what the document authored, which is the only
    // way the inspector can show and edit it before anything is saved.
    const revived = canvas
      .getObjects()
      .find((object) => object.get("id") === "cpu-card");
    expect(revived?.get("vigiliaGlass")).toEqual({ blurRadius: 16 });

    // And the re-serialised document is byte-identical on the property, so a
    // save/reopen/export/import cycle cannot quietly drop it.
    const saved = serialiseThemeEnvelope(canvas, theme);
    expect(
      (
        saved.scene.objects as ReadonlyArray<Readonly<Record<string, unknown>>>
      ).find((object) => object["id"] === "cpu-card")?.["vigiliaGlass"],
    ).toEqual({ blurRadius: 16 });
    expect(validateFabricThemeEnvelope(saved).ok).toBe(true);
    await canvas.dispose();
  });

  it("revives the gradient, SVG-derived paths, and every chart family", async () => {
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);

    expect(
      canvas.getObjects().find((object) => object.get("id") === "background")
        ?.fill,
    ).toMatchObject({ type: "linear" });
    // Five, not four: the CPU card's sparkline is a fifth line-family chart.
    expect(
      canvas.getObjects().filter((object) => object instanceof VigiliaChart),
    ).toHaveLength(5);
    const saved = serialiseThemeEnvelope(canvas, theme);
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
