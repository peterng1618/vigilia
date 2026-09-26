// @vitest-environment jsdom

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

  it("tracks its wordmark and section labels, and leaves its readings alone", () => {
    // Typography, not a value dump. Two things an untracked starter gets wrong:
    // a wordmark and a set of all-caps section labels read as one grey run, and
    // a tracked clock or reading does not — a numeral's advance is a grid cell
    // and opening it up breaks the column it sits in. So tracking is asserted
    // for the display and label presets and refused for the reading ones.
    const presets = createNewFabricTheme().globals?.typePresets as Record<
      string,
      { value: Readonly<Record<string, unknown>> }
    >;
    const spacingOf = (id: string): number | undefined => {
      const value = presets[id]?.value["letterSpacing"];
      return typeof value === "number" ? value : undefined;
    };

    // Tracked: the wordmark, the strapline and the all-caps section labels.
    // The wordmark's value is measured off the reference image, not judged by
    // eye — see the note on the preset itself.
    expect(spacingOf("32-500")).toBeGreaterThan(0);
    expect(spacingOf("12-400")).toBeGreaterThan(0);
    expect(spacingOf("13-600")).toBeGreaterThan(0);

    // Untracked: the clock, the metric, the date and the period.
    for (const id of ["70-300", "36-600", "16-400", "17-500"]) {
      expect(spacingOf(id) ?? 0, id).toBe(0);
    }

    // And every value is a real number the converter can use, not a string
    // that would silently become no tracking at all.
    for (const value of Object.values(presets)) {
      const spacing = value.value["letterSpacing"];
      if (spacing === undefined) continue;
      expect(Number.isFinite(spacing)).toBe(true);
    }
  });

  it("writes the resolved tracking into each object's own JSON", async () => {
    // Every other preset-derived Fabric field is written into the object, so
    // the starter declares five of a preset's six and omits the one this task
    // is about. Not a live bug — the editor applies presets at mount — but the
    // starter is the document every other task copies from, and a reader
    // comparing an object against its preset would conclude the sixth field
    // does not exist.
    const theme = createNewFabricTheme();
    const canvas = new StaticCanvas(undefined, {
      width: theme.artboard.width,
      height: theme.artboard.height,
    });
    await reviveThemeEnvelope(canvas, theme);

    const object = canvas
      .getObjects()
      .find((it) => it.get("id") === "wordmark");
    // 28px at 32px is Fabric's 1/1000 em: 875.
    expect(object?.get("charSpacing")).toBe(875);

    // An untracked object writes nothing rather than a zero Fabric would then
    // have to be told to ignore.
    const clock = canvas.getObjects().find((it) => it.get("id") === "time");
    expect(clock?.get("charSpacing")).toBe(0);
    await canvas.dispose();
  });

  it("revives the gradient, SVG-derived paths, and all four chart families", async () => {
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
    expect(
      canvas.getObjects().filter((object) => object instanceof VigiliaChart),
    ).toHaveLength(4);
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
