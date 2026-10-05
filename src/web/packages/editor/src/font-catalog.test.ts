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
    // one face per role, so an unbounded lookup still satisfies a definedness
    // or weight assertion while returning the wrong face. That bug is silent in
    // a unit test and loud in a shipped theme, because `applyFontTrio` writes
    // whatever comes back into every preset holding that role.
    const heading = trio.faces.find((face) => face.role === "heading")!;
    const body = trio.faces.find((face) => face.role === "body")!;
    expect(faceForRole(trio, "heading", heading.weight)).toBe(heading);
    // 9999 is past every weight in the trio, so the nearest face is the role's
    // own whatever the sort compares. This pins the role filter alone.
    expect(faceForRole(trio, "body", 9999)).toBe(body);
    // The heading's own weight, asked of the body role. Filtered, the body face
    // is the only candidate and this passes; unfiltered, the heading face is
    // nearer to its own weight than the body face is, so it returns that
    // instead. This catches the same missing filter as 9999 does, at a weight
    // where the face that leaks in is the heading's own.
    //
    // A low weight does not work here: body and mono are both 400 on this trio,
    // so the nearest-weight sort ties and stable order returns body regardless —
    // 326 of the 379 trios answer a weight-1 lookup with body either way.
    //
    // Neither assertion can catch a broken comparator, and no assertion in this
    // file could: a trio holds one face per role, so the filtered array has one
    // element and the sort is a no-op on it. The comparator is only observable
    // once the filter is already gone.
    expect(faceForRole(trio, "body", heading.weight)).toBe(body);
  });

  it("exposes each distinct face once for the picker", () => {
    const faces = catalogFaces();
    expect(new Set(faces.map((face) => face.id)).size).toBe(faces.length);
    // 261, not the design doc's measured 238. That count came from clamping
    // every heading to a uniform 700, which overwrites the pairing's own `h1`
    // recommendation for the 146 pairings whose heading is not a 700, and marks
    // the result `clamped` when it is in fact the author's choice. Clamping to
    // the recommendation keeps those extra faces, so the list is longer.
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
