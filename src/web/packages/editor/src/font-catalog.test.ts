import { describe, expect, it } from "vitest";
import {
  applyFontTrio,
  catalogFaces,
  faceForRole,
  fontTrio,
  fontTrios,
} from "./font-catalog.js";

/** A real trio with three distinct families, so a test cannot pass on a
 * fixture whose three roles happen to share one family. */
const trio = fontTrios().find(
  (candidate) => new Set(candidate.faces.map((face) => face.family)).size === 3,
)!;

describe("curated font trios", () => {
  it("serves every generated trio through one owner", () => {
    expect(fontTrios().length).toBeGreaterThan(1);
    expect(fontTrio(trio.id)).toBe(trio);
    expect(fontTrio("no-such-trio")).toBeUndefined();
  });

  it("selects the nearest available role face weight", () => {
    const heading = trio.faces.find((face) => face.role === "heading")!;
    expect(faceForRole(trio, "heading", heading.weight)?.weight).toBe(
      heading.weight,
    );
    expect(faceForRole(trio, "body", 9999)).toBeDefined();
  });

  it("exposes each distinct face once for the picker", () => {
    const faces = catalogFaces();
    expect(new Set(faces.map((face) => face.id)).size).toBe(faces.length);
    expect(faces.length).toBeGreaterThan(100);
  });

  it("updates every role preset without changing its treatment or custom presets", () => {
    const heading = trio.faces.find((face) => face.role === "heading")!;
    const body = trio.faces.find((face) => face.role === "body")!;
    const mono = trio.faces.find((face) => face.role === "mono")!;
    const presets = {
      heading: {
        name: "Heading",
        value: {
          family: "Segoe UI",
          size: 32,
          weight: "500",
          lineHeight: 1.2,
          trioRole: "heading" as const,
        },
      },
      body: {
        name: "Body",
        value: { family: "Segoe UI", size: 14, trioRole: "body" as const },
      },
      mono: {
        name: "Code",
        value: { family: "Segoe UI", size: 12, trioRole: "mono" as const },
      },
      custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
    };

    expect(applyFontTrio(presets, trio)).toEqual({
      heading: {
        name: "Heading",
        value: {
          family: heading.family,
          size: 32,
          weight: heading.weight,
          lineHeight: 1.2,
          trioRole: "heading",
          face: { assetId: heading.id },
        },
      },
      body: {
        name: "Body",
        value: {
          family: body.family,
          size: 14,
          weight: body.weight,
          trioRole: "body",
          face: { assetId: body.id },
        },
      },
      mono: {
        name: "Code",
        value: {
          family: mono.family,
          size: 12,
          weight: mono.weight,
          trioRole: "mono",
          face: { assetId: mono.id },
        },
      },
      custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
    });
  });

  it("leaves a preset with no trio role untouched", () => {
    const custom = {
      only: { name: "Only", value: { family: "Georgia", size: 19 } },
    };
    expect(applyFontTrio(custom, trio)).toEqual(custom);
  });
});
