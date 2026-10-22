import type { FabricGlobals } from "@yunari/renderer-core";
import { describe, expect, it } from "vitest";
import { backgroundColumn } from "./background-column.js";

/**
 * The background's column, as values. The background is not a Fabric object and
 * never reaches `perKindColumn`, so its two sections are asserted here rather
 * than through the per-kind examples.
 */

describe("backgroundColumn", () => {
  it("asks Content for colour and media, and Position for bounds, fit, scale and offsets", () => {
    const sections = backgroundColumn({
      background: undefined,
      assets: [],
      globals: undefined,
    });

    expect(sections.map((section) => section.id)).toEqual([
      "content",
      "position",
    ]);
    expect(sections[0]?.fields.map((field) => field.id)).toEqual([
      "background.color",
      "background.media",
    ]);
    expect(sections[1]?.fields.map((field) => field.id)).toEqual([
      "background.bounds",
      "background.fit",
      "background.scale",
      "background.offsetX-offsetY",
    ]);
    expect(
      sections[1]?.fields.find(
        (field) => field.id === "background.offsetX-offsetY",
      ),
    ).toMatchObject({
      control: "pair",
      halves: [{ id: "background.offsetX" }, { id: "background.offsetY" }],
    });
  });

  it("shows scale and offsets as percentages", () => {
    const sections = backgroundColumn({
      background: {
        media: { assetId: "a", bounds: "theme", scale: 1.4, offsetX: 0.25 },
      },
      assets: [],
      globals: undefined,
    });

    const scale = sections[1]?.fields.find(
      (field) => field.id === "background.scale",
    );
    expect(scale).toMatchObject({
      control: "number",
      value: 1.4,
      percent: true,
    });

    const offsets = sections[1]?.fields.find(
      (field) => field.id === "background.offsetX-offsetY",
    );
    expect(offsets).toMatchObject({
      control: "pair",
      halves: [
        { id: "background.offsetX", value: 0.25, percent: true },
        { id: "background.offsetY", value: 0, percent: true },
      ],
    });
  });

  it("reads an unset background as the model's defaults", () => {
    const sections = backgroundColumn({
      background: undefined,
      assets: [],
      globals: undefined,
    });
    const field = (id: string) =>
      [...(sections[0]?.fields ?? []), ...(sections[1]?.fields ?? [])].find(
        (entry) => entry.id === id,
      );

    expect(field("background.color")).toMatchObject({
      value: "",
      colour: "transparent",
    });
    expect(field("background.media")).toMatchObject({
      control: "select",
      value: "",
    });
    expect(field("background.bounds")).toMatchObject({ value: "theme" });
    expect(field("background.fit")).toMatchObject({ value: "cover" });
    expect(field("background.scale")).toMatchObject({
      value: 1,
      min: 10,
      max: 1000,
    });
  });

  it("paints the stored palette reference and offers the document's tokens", () => {
    const globals = {
      palette: {
        ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
      },
    } as unknown as FabricGlobals;
    const sections = backgroundColumn({
      background: { color: { ref: "palette.ink" } },
      assets: [],
      globals,
    });

    expect(
      sections[0]?.fields.find((field) => field.id === "background.color"),
    ).toMatchObject({
      control: "swatch",
      value: "palette.ink",
      colour: "#e8ecf3",
      options: [
        { id: "", name: "not set" },
        { id: "palette.ink", name: "Ink" },
      ],
    });
  });

  it("offers only the assets a background can be", () => {
    const sections = backgroundColumn({
      background: undefined,
      assets: [
        { id: "photo", kind: "image", path: "assets/photo.png" },
        { id: "mark", kind: "svg", path: "assets/mark.svg" },
        { id: "loop", kind: "video", path: "assets/loop.mp4" },
        { id: "body", kind: "font", path: "assets/body.woff2" },
      ],
      globals: undefined,
    });

    expect(
      sections[0]?.fields.find((field) => field.id === "background.media"),
    ).toMatchObject({
      options: [
        { id: "", name: "None" },
        { id: "photo", name: "photo" },
        { id: "mark", name: "mark" },
        { id: "loop", name: "loop" },
      ],
    });
  });
});
