import { describe, expect, it } from "vitest";
import {
  GENERATED_FACES,
  GENERATED_SOURCE_REVISION,
  GENERATED_TRIOS,
} from "./font-trios.generated.js";

const PINNED =
  /^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/[a-z0-9-]+@\d+\.\d+\.\d+\/latin-\d+-normal\.woff2$/;

/**
 * Fontsource's licence codes, named. A face is not OFL by default: at the
 * pinned revision 10 of the faces are Ubuntu's UFL-1.0 or Apache-2.0, and
 * they reach 15 pairings, so a generator that assumed OFL would misdeclare
 * them.
 */
const LICENSE_URLS = {
  "SIL Open Font License 1.1": "https://openfontlicense.org/",
  "Ubuntu Font Licence 1.0": "https://ubuntu.com/legal/font-licence",
  "Apache License 2.0": "https://www.apache.org/licenses/LICENSE-2.0",
} as const;

/**
 * A face's `role` in `GENERATED_FACES` is the role it was first requested
 * under and is arbitrary, so role assertions read the trios, where position
 * is the role by construction.
 */
function faceInRole(fontId: string, role: 0 | 1 | 2) {
  return GENERATED_TRIOS.find((trio) => trio.faces[role].fontId === fontId)
    ?.faces[role];
}

describe("generated font catalogue", () => {
  it("carries every pairing from the pinned upstream revision", () => {
    expect(GENERATED_TRIOS).toHaveLength(380);
    expect(GENERATED_SOURCE_REVISION).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gives every trio exactly one heading, body and mono face", () => {
    for (const trio of GENERATED_TRIOS) {
      expect(trio.faces.map((face) => face.role)).toEqual([
        "heading",
        "body",
        "mono",
      ]);
      for (const face of trio.faces) {
        expect(face.subset).toBe("latin");
        expect(face.format).toBe("woff2");
      }
    }
  });

  it("carries each face's own licence name and URL", () => {
    for (const face of GENERATED_FACES) {
      const url = LICENSE_URLS[face.license.name as keyof typeof LICENSE_URLS];
      expect(url, `unmapped licence "${face.license.name}"`).toBeDefined();
      expect(face.license.url).toBe(url);
    }
    // The set, not just the mapping: a fourth licence upstream must fail here
    // rather than quietly join the catalogue.
    expect(
      [...new Set(GENERATED_FACES.map((f) => f.license.name))].sort(),
    ).toEqual(Object.keys(LICENSE_URLS).sort());
  });

  it("pins every face to a version and never to latest", () => {
    for (const face of GENERATED_FACES) {
      expect(face.sourceUrl).toMatch(PINNED);
      expect(face.sourceUrl).not.toContain("latest");
    }
  });

  it("deduplicates faces so one family appears once", () => {
    expect(new Set(GENERATED_FACES.map((face) => face.id)).size).toBe(
      GENERATED_FACES.length,
    );
    // 261, not the design doc's measured 238. That count came from clamping
    // every heading to a uniform 700, which discards the pairing's own `h1`
    // recommendation for 142 of the 380 pairings and then marks the result
    // `clamped` when it is in fact the author's choice. Clamping to the
    // recommendation keeps the extra faces and mislabels fewer.
    expect(GENERATED_FACES).toHaveLength(261);
  });

  it("clamps a heading to a weight its family actually ships", () => {
    // Anton ships only 400. Upstream recommends 700 for the `headline`
    // pairing, so that face must be the 400 cut and marked clamped.
    const anton = faceInRole("anton", 0);
    expect(anton?.weight).toBe(400);
    expect(anton?.clamped).toBe(true);
  });

  it("does not mark a face clamped when the family ships the weight", () => {
    const inter = faceInRole("inter", 0);
    expect(inter?.weight).toBe(700);
    expect(inter?.clamped).toBe(false);
  });
});
