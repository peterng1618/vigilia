import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import {
  MOCKUP_PATH,
  mockupDeclared,
  mockupDeclaredOrNull,
  PARITY,
  readMockup,
} from "./mockup-values.js";

/**
 * The reader's own proof, and the reason it is a unit test rather than an
 * assertion in the browser spec.
 *
 * A parity gate that compares a *copy* of the drawing's value passes whatever
 * the drawing does, which is the contradiction Task 1 exists to remove. So the
 * reader is proved against the drawing's text directly — including against a
 * mutated copy of it, which is the one check a reader returning a constant
 * cannot survive.
 *
 * Run: `cd src/web && npm run test -- tests/e2e/mockup-values`
 * (the brief's `…/tests/e2e/mockup-values.ts` filter matches no file — vitest
 * matches a CLI filter as a **path substring**, and the test is
 * `mockup-values.test.ts`).
 */

const drawing = readMockup();

test("the drawing is the checked-in file, read from disk", () => {
  expect(existsSync(MOCKUP_PATH)).toBe(true);
  // Normalised, because a Windows path separates with `\` and this is the one
  // assertion that says the reader's target is the checked-in drawing.
  expect(MOCKUP_PATH.replace(/\\/g, "/")).toContain(
    "docs/design/mockups/editor-shell.html",
  );
});

test("the frame rule's radius is read out of the drawing's own stylesheet", () => {
  expect(mockupDeclared(drawing, ".mockup", "border-radius")).toBe("10px");
});

test("the shell's inline frame is read too, by its own style attribute", () => {
  // The shell the drawing draws is an anonymous inline-styled div — it has no
  // class to name it by, which is why the reader addresses inline declarations
  // as well as `<style>` rules.
  expect(
    mockupDeclared(drawing, '[style*="width:1180px"]', "border-radius"),
  ).toBe("10px");
});

test("a property the rule does not declare throws, naming both", () => {
  expect(() => mockupDeclared(drawing, ".mockup", "padding")).toThrow(
    /declares no `padding` for `\.mockup`/,
  );
});

test("a selector the drawing addresses nothing with throws", () => {
  expect(() =>
    mockupDeclared(drawing, ".editor-shell-frame", "border-radius"),
  ).toThrow(/addresses nothing with `\.editor-shell-frame`/);
});

test("silence is null, and a broken selector still throws", () => {
  // The two are different readings and must stay different: the body row the
  // drawing draws flush declares no padding, but a selector that matches no
  // declaration is a typo in a row, not a flush region.
  expect(
    mockupDeclaredOrNull(drawing, '[style*="height:568px"]', "padding-top"),
  ).toBeNull();
  expect(() =>
    mockupDeclaredOrNull(drawing, ".does-not-exist", "border-radius"),
  ).toThrow(/addresses nothing/);
});

test("the reader returns what the text says, not a constant", () => {
  // The check the three above cannot make. A reader that answered "10px"
  // unconditionally passes every one of them; it cannot pass this.
  const changed = drawing.replace("border-radius: 10px", "border-radius: 7px");
  expect(changed).not.toBe(drawing);
  expect(mockupDeclared(changed, ".mockup", "border-radius")).toBe("7px");
  // And a different rule, so one lucky literal is not the whole mechanism.
  const restyled = drawing.replace("width:46px", "width:52px");
  expect(mockupDeclared(restyled, '[style*="width:52px"]', "background")).toBe(
    "#0e1217",
  );
  expect(() =>
    mockupDeclared(restyled, '[style*="width:46px"]', "background"),
  ).toThrow(/addresses nothing/);
});

test("the last declaration in document order wins", () => {
  // A later `<style>` block, or a later rule for the same selector, overrides:
  // the reading a person gets from opening the file, and the cascade's rule for
  // equal specificity. Specificity is not weighed — this reader has no cascade.
  const twice = `${drawing}<style>.mockup { border-radius: 3px; }</style>`;
  expect(mockupDeclared(twice, ".mockup", "border-radius")).toBe("3px");
});

test("every row names a comparator, and a drawing row declares a length", () => {
  expect(PARITY.length).toBeGreaterThan(0);
  /** A length, or `normal` — `gap`'s word for no gap. */
  const isLength = (value: string): boolean => {
    const first = value.trim().split(/[\s/]+/)[0] ?? "";
    return first === "normal" || /^-?[\d.]+px$/.test(first);
  };
  for (const row of PARITY) {
    // Every row names at least one source, and a row that names none is a row
    // with nothing to compare it against — the shape the shell's own frame had,
    // and the reason it left the table (the census records it `no-counterpart`).
    const owners = [
      row.licensed !== undefined,
      row.scaleToken !== undefined,
      row.mockupSelector !== undefined,
    ].filter(Boolean).length;
    expect(
      owners,
      `${row.region}: the row names no licence, no scale token and no drawing selector, so nothing governs it`,
    ).toBeGreaterThan(0);
    // A licence and a scale token are two different answers to "what governs
    // this", and a row cannot be owned by both. A `licensed` row *may* also name
    // the drawing's selector — that is the declaration the licence is about.
    expect(
      row.licensed === undefined || row.scaleToken === undefined,
      `${row.region}: a row names both a licence and a scale token`,
    ).toBe(true);
    // A scale-owned row must not also carry a drawing selector: the selector it
    // would name is a window's wrapper, which is what withdrew the comparator.
    if (row.scaleToken !== undefined) {
      expect(
        row.mockupSelector,
        `${row.region}: a scale-owned row must not name a drawing selector`,
      ).toBeUndefined();
      continue;
    }
    // A licensed row is recorded, not asserted, so its declared value need not
    // be a length this file could compare — the stage ground is a gradient.
    if (row.licensed !== undefined) continue;
    // Throws when the selector addresses nothing, which is the failure this
    // loop is for: a row whose selector went stale must red here, not read as a
    // region the drawing draws flush.
    const declared = mockupDeclaredOrNull(
      drawing,
      row.mockupSelector ?? "",
      row.mockupProperty,
    );
    // `null` is a legitimate reading — the four body regions are exactly the
    // rows the drawing is silent about, and the spec reads that silence as `0`.
    if (declared === null) continue;
    expect(
      isLength(declared),
      `${row.region}: the drawing declares \`${declared}\`, which is not a length the spec can compare`,
    ).toBe(true);
  }
});
