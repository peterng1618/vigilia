import { describe, expect, it } from "vitest";
import { applyFontTrio, faceForRole, fontTrio } from "./font-catalog.js";

describe("curated font trios", () => {
  it("provides three distinct pinned Fontsource WOFF2 faces", () => {
    const trio = fontTrio("minimal");

    expect(trio?.faces).toHaveLength(3);
    expect(new Set(trio?.faces.map((face) => face.id)).size).toBe(3);
    for (const face of trio?.faces ?? []) {
      expect(face.sourceUrl).toMatch(
        /^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/.+@\d+\.\d+\.\d+\/.+\.woff2$/,
      );
      expect(face.sourceUrl).not.toContain("latest");
      expect(face.format).toBe("woff2");
    }
  });

  it("selects the nearest available role face weight", () => {
    const trio = fontTrio("minimal")!;

    expect(faceForRole(trio, "heading", 300)?.weight).toBe(700);
    expect(faceForRole(trio, "body", 600)?.weight).toBe(400);
  });

  it("updates every role preset without changing its treatment or custom presets", () => {
    const trio = fontTrio("minimal")!;
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
      metric: {
        name: "Metric",
        value: {
          family: "Segoe UI",
          size: 70,
          weight: "300",
          letterSpacing: 2,
          trioRole: "heading" as const,
        },
      },
      body: {
        name: "Body",
        value: {
          family: "Segoe UI",
          size: 14,
          weight: "600",
          trioRole: "body" as const,
        },
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
          family: "Inter",
          size: 32,
          weight: 700,
          lineHeight: 1.2,
          trioRole: "heading",
          face: { assetId: "inter-700" },
        },
      },
      metric: {
        name: "Metric",
        value: {
          family: "Inter",
          size: 70,
          weight: 700,
          letterSpacing: 2,
          trioRole: "heading",
          face: { assetId: "inter-700" },
        },
      },
      body: {
        name: "Body",
        value: {
          family: "Inter",
          size: 14,
          weight: 400,
          trioRole: "body",
          face: { assetId: "inter-400" },
        },
      },
      mono: {
        name: "Code",
        value: {
          family: "JetBrains Mono",
          size: 12,
          weight: 400,
          trioRole: "mono",
          face: { assetId: "jetbrains-mono-400" },
        },
      },
      custom: { name: "Custom", value: { family: "Georgia", size: 19 } },
    });
  });
});
