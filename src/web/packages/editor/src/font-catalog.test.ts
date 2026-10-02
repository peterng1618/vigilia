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

  it("selects the face for a role, and the nearest weight within it", () => {
    // Identity, not a field comparison, on both halves: a trio holds exactly
    // one face per role, so an unbounded lookup returns the heading face for
    // every role and still satisfies a definedness or weight assertion. That
    // bug is silent in a unit test and loud in a shipped theme, because
    // `applyFontTrio` writes whatever comes back into the body and mono
    // presets. 9999 is past every weight here, so it selects the whole role.
    const heading = trio.faces.find((face) => face.role === "heading")!;
    const body = trio.faces.find((face) => face.role === "body")!;
    expect(faceForRole(trio, "heading", heading.weight)).toBe(heading);
    expect(faceForRole(trio, "body", 9999)).toBe(body);
    // Nearest within the role: the only body face is nearest to every weight,
    // so this pins that the sort runs over the role and not over the trio.
    expect(faceForRole(trio, "body", 1)).toBe(body);
  });

  it("exposes each distinct face once for the picker", () => {
    const faces = catalogFaces();
    expect(new Set(faces.map((face) => face.id)).size).toBe(faces.length);
    // 261, not the design doc's measured 238. That count came from clamping
    // every heading to a uniform 700, which discards the pairing's own `h1`
    // recommendation for 141 of the 379 pairings and marks the result
    // `clamped` when it is in fact the author's choice. Clamping to the
    // recommendation keeps those extra faces, so the list is longer.
    expect(faces).toHaveLength(261);
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
      // A second heading preset, distinguished only by its tracking. Two
      // presets sharing one role is what exercises per-preset spread: the face
      // is replaced for both, and every other authored value survives.
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
      metric: {
        name: "Metric",
        value: {
          family: heading.family,
          size: 70,
          weight: heading.weight,
          letterSpacing: 2,
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
