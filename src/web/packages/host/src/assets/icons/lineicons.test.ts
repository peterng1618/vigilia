import type { AssetResult } from "@yunari/renderer-core";
import { describe, expect, it } from "vitest";
import {
  LINEICONS_ICONS,
  lineiconsSource,
  searchLineicons,
} from "./lineicons.js";

const context = {
  credential: () => undefined,
  signal: new AbortController().signal,
  fetch: globalThis.fetch,
};

const result = (name: string): AssetResult => ({
  id: name,
  name,
  kind: "icon",
  preview: "",
  subtitle: undefined,
  licence: "MIT",
  sourceUrl: `https://lineicons.com/icons/${name}`,
});

describe("the Lineicons manifest", () => {
  it("is generated as plain SVG data", () => {
    expect(LINEICONS_ICONS.length).toBeGreaterThan(500);

    for (const icon of LINEICONS_ICONS) {
      expect(icon.svg.startsWith("<svg")).toBe(true);
      expect(icon.svg).not.toContain("script");
    }
  });
});

describe("searchLineicons", () => {
  it("treats a space and a hyphen as one separator", () => {
    expect(
      searchLineicons("arrow down", undefined).results.map((entry) => entry.id),
    ).toContain("arrow-downward");
  });

  it("pages by offset and never repeats a page", () => {
    const first = searchLineicons("", undefined);
    expect(first.results).toHaveLength(40);
    expect(first.next).toBe("40");

    const second = searchLineicons("", first.next);
    expect(second.results).toHaveLength(40);
    expect(
      second.results.some((entry) =>
        first.results.some((previous) => previous.id === entry.id),
      ),
    ).toBe(false);
  });

  it("answers the first page for a cursor that is not an offset", () => {
    expect(searchLineicons("", "nope").results).toEqual(
      searchLineicons("", undefined).results,
    );
  });
});

describe("the Lineicons source", () => {
  it("declares a grid body and no credential", () => {
    expect(lineiconsSource).toMatchObject({
      id: "lineicons",
      category: "icon",
      body: "grid",
      requires: undefined,
      configurable: true,
    });
  });

  it("answers an icon's SVG as its bytes", async () => {
    const bytes = await lineiconsSource.bytesOf("arrow-downward", context);

    expect(bytes?.contentType).toBe("image/svg+xml");
    expect(bytes?.filename).toBe("arrow-downward.svg");
    expect(new TextDecoder().decode(bytes?.bytes)).toContain("<svg");
  });

  it("answers nothing for an icon it does not know", async () => {
    expect(
      await lineiconsSource.bytesOf("not-an-icon", context),
    ).toBeUndefined();
  });

  it("credits the icon set and its licence", () => {
    expect(lineiconsSource.creditsOf(result("arrow-downward"))).toMatchObject({
      kind: "icon",
      title: "arrow-downward",
      license: "MIT",
    });
    expect(
      lineiconsSource.creditsOf(result("arrow-downward")).source?.url,
    ).toContain("lineicons.com");
  });
});
