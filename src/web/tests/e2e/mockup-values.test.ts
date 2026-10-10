import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import {
  CONTROLS_LIGHT_MOCKUP_PATH,
  CONTROLS_MOCKUP_PATH,
  MOCKUP_PATH,
  mockupDeclared,
  mockupDeclaredOrNull,
  PARITY,
  readMockup,
  SETTINGS_MOCKUP_PATH,
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
const settings = readMockup(SETTINGS_MOCKUP_PATH);

test("the drawing is the checked-in file, read from disk", () => {
  expect(existsSync(MOCKUP_PATH)).toBe(true);
  expect(existsSync(SETTINGS_MOCKUP_PATH)).toBe(true);
  expect(existsSync(CONTROLS_MOCKUP_PATH)).toBe(true);
  expect(existsSync(CONTROLS_LIGHT_MOCKUP_PATH)).toBe(true);
  // Normalised, because a Windows path separates with `\` and this is the one
  // assertion that says the reader's target is the checked-in drawing.
  expect(MOCKUP_PATH.replace(/\\/g, "/")).toContain(
    "docs/design/mockups/current/shell.html",
  );
  expect(SETTINGS_MOCKUP_PATH.replace(/\\/g, "/")).toContain(
    "docs/design/mockups/current/settings.html",
  );
  expect(CONTROLS_MOCKUP_PATH.replace(/\\/g, "/")).toContain(
    "docs/design/mockups/current/controls.html",
  );
  expect(CONTROLS_LIGHT_MOCKUP_PATH.replace(/\\/g, "/")).toContain(
    "docs/design/mockups/current/controls-light.html",
  );
  // The frozen originals are provenance, and the target is never one of them:
  // reading one to decide a value is the drift this plan exists to end.
  for (const path of [CONTROLS_MOCKUP_PATH, CONTROLS_LIGHT_MOCKUP_PATH]) {
    expect(path.replace(/\\/g, "/")).toContain("/current/");
  }
});

test("the two control drawings declare the one field row a row reads", () => {
  // The label column, addressed by the one label that settles which element is
  // meant: the eleven short labels carry the same declaration and the twelfth —
  // the long-copy label — carries it plus `padding-top:5px`, so every shorter
  // substring matches twelve elements and the reader refuses to choose. The
  // twelfth declares the same `width:74px;flex:0 0 auto`.
  const LABELS =
    '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11.5px;padding-top:5px"]';
  // The other half of the same row: the value cell the drawing stretches. Two
  // elements carry it and their `style` attributes are identical, which is one
  // element form to this reader — the narrower prefix also matches the
  // multi-line well and would address two different elements.
  const CELL =
    '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--well)"]';
  for (const path of [CONTROLS_MOCKUP_PATH, CONTROLS_LIGHT_MOCKUP_PATH]) {
    const html = readMockup(path);
    expect(html).not.toBe(drawing);
    expect(mockupDeclared(html, LABELS, "width")).toBe("74px");
    expect(mockupDeclared(html, LABELS, "flex")).toBe("0 0 auto");
    expect(mockupDeclared(html, CELL, "flex")).toBe("1");
    // Reading one file for the other would pass every assertion above, so the
    // two are told apart by what each declares and the other does not.
    expect(mockupDeclared(html, "body", "background")).toBe(
      path === CONTROLS_MOCKUP_PATH ? "#0b0e12" : "#fffdf7",
    );
  }
});

test("the two shapes the field row is not are read from the drawing that draws each", () => {
  // The settings modal's switch row, addressed by the box it is: the label at
  // `flex:1` inside a `--panel-2` panel at `--radius-lg`, with no label column.
  // That absence is the reading — a row that took the field row's 74px column
  // wrapped "Follow the system" onto a second line.
  const BOXED_ROW =
    '[style*="display:flex;align-items:center;gap:10px;padding:9px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]';
  expect(mockupDeclared(settings, BOXED_ROW, "border-radius")).toBe("8px");
  expect(mockupDeclared(settings, BOXED_ROW, "gap")).toBe("10px");

  // The Add pane's asset trigger. The drawing writes the trigger declaration
  // twice more, identically, on the inspector's own select triggers, and the
  // picker's element is that declaration as a *suffix* of theirs — so the reader
  // settles the shared form and cannot settle the picker alone. Asserted here
  // rather than left implicit: the duplication is why this row's selector names
  // the second form, and a reader that started guessing between them would make
  // this row a comparison of whichever element the document lists last.
  const ASSET_TRIGGER =
    '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:5px 8px"]';
  expect(mockupDeclared(drawing, ASSET_TRIGGER, "border-radius")).toBe("6px");
  expect(mockupDeclared(drawing, ASSET_TRIGGER, "gap")).toBe("6px");
  // The picker's own element addresses two forms, and that is the reason the
  // row names the shared one rather than the picker's: a selector that matched
  // both throws instead of picking whichever the document lists last.
  expect(() =>
    mockupDeclared(
      drawing,
      '[style*="display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:5px 8px"]',
      "border-radius",
    ),
  ).toThrow(/does not settle which one it means/);
});

test("the page rule is read out of the drawing's own stylesheet", () => {
  // `current/shell.html` draws the editor as the window, so its `<style>` block
  // is a page reset rather than a card: `body` is the rule the reader reaches.
  expect(mockupDeclared(drawing, "body", "background")).toBe("#0b0e12");
});

test("the shell's inline regions are read too, by their style attributes", () => {
  // The shell the drawing draws is built from anonymous inline-styled divs — no
  // class to name them by, which is why the reader addresses inline declarations
  // as well as `<style>` rules. `height:42px` is the header, and the row PARITY
  // measures.
  expect(mockupDeclared(drawing, '[style*="height:42px"]', "height")).toBe(
    "42px",
  );
});

test("a property the rule does not declare throws, naming both", () => {
  expect(() => mockupDeclared(drawing, "body", "padding")).toThrow(
    /declares no `padding` for `body`/,
  );
});

test("a selector the drawing addresses nothing with throws", () => {
  expect(() =>
    mockupDeclared(drawing, ".editor-shell-frame", "border-radius"),
  ).toThrow(/addresses nothing with `\.editor-shell-frame`/);
});

test("an inline selector that matches twice throws rather than picking one", () => {
  // `[style*="…"]` matches every element carrying the substring, so a second
  // match is a different element, not a later rule for the same one. Picking the
  // last in document order would be silent, and — because a real value on the
  // wrong element reads as `8px`, not `null` — it can read as a **pass**.
  const twice = `${drawing}<div style="width:46px"></div>`;
  expect(() =>
    mockupDeclared(twice, '[style*="width:46px"]', "background"),
  ).toThrow(/addresses 2 elements/);
  // One match still reads: the guard is for ambiguity, not for attribute
  // selectors as a form.
  expect(mockupDeclared(drawing, '[style*="width:46px"]', "background")).toBe(
    "#0e1217",
  );
});

test("silence is null, and a broken selector still throws", () => {
  // The two are different readings and must stay different: the body row the
  // drawing draws flush declares no padding, but a selector that matches no
  // declaration is a typo in a row, not a flush region.
  expect(
    mockupDeclaredOrNull(
      drawing,
      '[style*="flex:1;min-height:0"]',
      "padding-top",
    ),
  ).toBeNull();
  expect(() =>
    mockupDeclaredOrNull(drawing, ".does-not-exist", "border-radius"),
  ).toThrow(/addresses nothing/);
});

test("the reader returns what the text says, not a constant", () => {
  // The check the three above cannot make. A reader that answered "#0b0e12"
  // unconditionally passes every one of them; it cannot pass this.
  const changed = drawing.replace("background: #0b0e12", "background: #101418");
  expect(changed).not.toBe(drawing);
  expect(mockupDeclared(changed, "body", "background")).toBe("#101418");
  // And a different declaration site, so one lucky literal is not the whole
  // mechanism.
  const restyled = drawing.replace("width:46px", "width:52px");
  expect(mockupDeclared(restyled, '[style*="width:52px"]', "background")).toBe(
    "#0e1217",
  );
  expect(() =>
    mockupDeclared(restyled, '[style*="width:46px"]', "background"),
  ).toThrow(/addresses nothing/);
});

test("the reader reads the path it is given", () => {
  // Two drawings, one reader. A `readMockup` that closed over `MOCKUP_PATH`
  // would read the shell for the settings rows and pass anything; a selector
  // that resolves in one file and addresses nothing in the other is what tells
  // the two apart without printing either.
  const settings = readMockup(SETTINGS_MOCKUP_PATH);
  expect(settings).not.toBe(drawing);
  expect(mockupDeclared(settings, '[style*="width:150px"]', "background")).toBe(
    "#0e1217",
  );
  expect(() =>
    mockupDeclared(drawing, '[style*="width:150px"]', "background"),
  ).toThrow(/addresses nothing/);
});

test("the last declaration in document order wins", () => {
  // A later `<style>` block, or a later rule for the same selector, overrides:
  // the reading a person gets from opening the file, and the cascade's rule for
  // equal specificity. Specificity is not weighed — this reader has no cascade.
  const twice = `${drawing}<style>body { border-radius: 3px; }</style>`;
  expect(mockupDeclared(twice, "body", "border-radius")).toBe("3px");
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
    // The row's own drawing: the shell's unless the row names another, so a
    // surface drawn on its own file is read from that file rather than from
    // whichever one this loop happened to open first.
    const source =
      row.mockupPath === undefined ? drawing : readMockup(row.mockupPath);
    // A licensed row is recorded, not asserted, so its declared value need not
    // be a length this file could compare — the stage ground is a gradient. The
    // **value** is still read, though, and matched to the treatment the licence
    // names: a licence quotes a declaration, and one nobody reads licenses
    // whatever is there now, including a region the drawing stopped drawing.
    if (row.licensed !== undefined) {
      const declared = mockupDeclaredOrNull(
        source,
        row.mockupSelector ?? "",
        row.mockupProperty,
      );
      expect(
        declared,
        `${row.region}: the licensed row's selector reads nothing, so its licence quotes a region the drawing no longer draws`,
      ).not.toBeNull();
      expect(
        declared,
        `${row.region}: the licence is about the drawing's diagonal texture, and the declaration is not one`,
      ).toContain("repeating-linear-gradient(45deg");
      continue;
    }
    // Throws when the selector addresses nothing, which is the failure this
    // loop is for: a row whose selector went stale must red here, not read as a
    // region the drawing draws flush.
    const declared = mockupDeclaredOrNull(
      source,
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
