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
 *
 * Looked up with `Object.hasOwn` and never with a truthiness test: this is a
 * bare object, so `LICENSE_URLS["constructor"]` is `Object` and would sail
 * through a guard whose only job is to be loud.
 */
const LICENSE_URLS = {
  "SIL Open Font License 1.1": "https://openfontlicense.org/",
  "Ubuntu Font Licence 1.0": "https://ubuntu.com/legal/font-licence",
  "Apache License 2.0": "https://www.apache.org/licenses/LICENSE-2.0",
} as const;

/**
 * Role and `clamped` are properties of a pairing's *request*, so every
 * assertion about them reads a trio, where position is the role and the flag
 * was computed against this pairing's own recommendation. A standalone face in
 * `GENERATED_FACES` carries whichever pairing reached it first and is not
 * safe to ask either question of.
 */
function trioById(id: string) {
  return GENERATED_TRIOS.find((trio) => trio.id === id);
}

/**
 * The one upstream title that does not name the families it seeds. Upstream
 * writes `Lead — Heading + Body + Mono` and 15 of the 379 drop the lead, but
 * `cormorant-garamond-proza-libre` is titled "Cormorant Garamond Proza
 * Libre" over Proza Libre + Cormorant Garamond + JetBrains Mono — two of the
 * three run together and the mono is absent.
 *
 * Listed rather than waved through, and asserted as an exact set, so a second
 * offender is red here and a fixed one is red too.
 */
const TITLES_THAT_DO_NOT_NAME_THEIR_FAMILIES = [
  "cormorant-garamond-proza-libre",
];

describe("generated font catalogue", () => {
  it("carries every pairing from the pinned upstream revision", () => {
    // 379, not the 380 registry entries. Upstream's index lists
    // `playfair-display-roboto` twice — once titled for Inter, once for
    // Roboto — and both entries point at one pairing document, which names
    // Roboto. The document is the authority on which entry is true, so the
    // generator keeps the entry whose title matches it and the other never
    // reaches the catalogue. vg-116 is the upstream half of this.
    expect(GENERATED_TRIOS).toHaveLength(379);
    expect(GENERATED_SOURCE_REVISION).toMatch(/^[0-9a-f]{40}$/);
  });

  it("gives every trio its own id", () => {
    // A duplicate id would collapse in the picker's `Map` and hide the
    // second record rather than show the conflict.
    const ids = GENERATED_TRIOS.map((trio) => trio.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("titles every trio with the families it seeds", () => {
    // The duplicate above shipped "Playfair Display Inter" over Roboto faces:
    // a title naming a family the record does not carry, which an author
    // applying it would see as Inter.
    const unnamed = GENERATED_TRIOS.filter(
      (trio) =>
        !trio.name.endsWith(trio.faces.map((face) => face.family).join(" + ")),
    ).map((trio) => trio.id);
    expect(unnamed.sort()).toEqual(TITLES_THAT_DO_NOT_NAME_THEIR_FAMILIES);
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
      expect(
        Object.hasOwn(LICENSE_URLS, face.license.name),
        `unmapped licence "${face.license.name}"`,
      ).toBe(true);
      expect(face.license.url).toBe(
        LICENSE_URLS[face.license.name as keyof typeof LICENSE_URLS],
      );
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

  it("records a heading's clamp per pairing, not per face", () => {
    // Both faces below are shared by three pairings, and for the pairing
    // that reaches each face first the answer is the opposite of what it is
    // here. A flag cached on first touch therefore gets both wrong, in both
    // directions, and neither direction throws.
    //
    // pt-sans-700: pt-sans-nunito recommends 700, which PT Sans ships;
    // pt-sans-lora recommends 600, which it does not. Only the second clamps.
    expect(trioById("pt-sans-lora")?.faces[0]).toMatchObject({
      id: "pt-sans-700",
      weight: 700,
      clamped: true,
    });
    // lato-700: lato-merriweather recommends 600, which Lato does not ship;
    // lato-roboto recommends 700, which it does. Only the first clamps.
    expect(trioById("lato-roboto")?.faces[0]).toMatchObject({
      id: "lato-700",
      weight: 700,
      clamped: false,
    });
  });

  it("never marks a body or mono face as a clamp", () => {
    // gloock-400 is a clamped heading in gloock-instrument-sans, and this was
    // the one body face in the catalogue that inherited that flag. Only a
    // heading ever makes a clamp request, so no body or mono face may carry
    // one however the face was first reached.
    for (const trio of GENERATED_TRIOS) {
      expect(trio.faces[1].clamped, trio.id).toBe(false);
      expect(trio.faces[2].clamped, trio.id).toBe(false);
    }
  });

  it("clamps the 49 headings whose family does not ship the recommended weight", () => {
    // 49 of the 380 pairings recommend an `h1` weight their heading family
    // does not publish, and 20 of those families ship no 700 at all. Anton is
    // one of them, so every trio that wants it as a heading is clamped onto
    // the 400 cut.
    expect(
      GENERATED_TRIOS.filter((trio) => trio.faces[0].clamped),
    ).toHaveLength(49);
    for (const trio of GENERATED_TRIOS) {
      if (trio.faces[0].fontId !== "anton") continue;
      expect(trio.faces[0]).toMatchObject({ weight: 400, clamped: true });
    }
  });
});
