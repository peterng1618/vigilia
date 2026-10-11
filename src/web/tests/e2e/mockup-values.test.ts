import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import {
  CONTROLS_LIGHT_MOCKUP_PATH,
  CONTROLS_MOCKUP_PATH,
  colourValue,
  currentDrawings,
  drawingTexts,
  lengthInPx,
  MOCKUP_PATH,
  mockupDeclared,
  mockupDeclaredOrNull,
  mockupDeclaredProperties,
  PARITY,
  readMockup,
  rowDrawing,
  SETTINGS_MOCKUP_PATH,
  SHELL_ROLES,
  SHELL_TOKEN_SELECTOR,
  trackCount,
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

/** The modal's regions, as `current/settings.html` is addressed — the same
 *  selectors `PARITY`'s settings rows name, so a row whose address moved fails
 *  here as well as in the browser run. */
const NAV = '[style*="width:150px"]';
const GRID = '[style*="display:grid"]';
const CARD =
  '[style*="border:1px solid var(--edge);border-radius:8px;padding:8px;background:var(--panel2)"]';
const SWATCH_BAR =
  '[style*="flex:1;height:16px;border-radius:4px;background:#fffdf7"]';

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
  //
  // **The inset in this address is Task 6's `8px`, not the `9px` it was
  // written with.** The drawing's `9px` was off §3's scale and the drawing was
  // the stale side (`vg-303`), so the declaration changed under the address
  // while the row's own subject — the radius and the gap below — did not.
  const BOXED_ROW =
    '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]';
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

test("the settings drawing declares the modal's regions, each read by the row that names it", () => {
  // The four settings-surface rows that read this drawing rather than the scale:
  // the nav column, the palette grid's tracks, the card and the swatch bar. Plan
  // 7 left this file's rows scale-owned; plan 8 Task 1 gives it rows of its own,
  // and these are their addresses.
  expect(mockupDeclared(settings, NAV, "width")).toBe("150px");
  expect(
    trackCount(mockupDeclared(settings, GRID, "grid-template-columns")),
  ).toBe(3);
  expect(mockupDeclared(settings, CARD, "border-radius")).toBe("8px");
  expect(mockupDeclared(settings, CARD, "padding")).toBe("8px");
  expect(mockupDeclared(settings, SWATCH_BAR, "height")).toBe("16px");

  // Five of the six cards carry this declaration byte for byte and the sixth is
  // the chosen card, told apart by its accent border — so a selector naming the
  // shared form addresses **one** element form to this reader rather than five
  // elements, which is the rule that lets the row read it at all.
  expect(mockupDeclared(settings, CARD, "background")).toBe("var(--panel2)");
  expect(
    mockupDeclared(
      settings,
      '[style*="border:1px solid var(--accent);border-radius:8px;padding:8px;background:var(--panel2)"]',
      "background",
    ),
    "the chosen card is not drawn where the row's address would read it",
  ).toBe("var(--panel2)");
  // The negative half: the shorter address the row must **not** take, because
  // twelve bars carry it and the reader refuses to pick one.
  expect(() =>
    mockupDeclared(
      settings,
      '[style*="flex:1;height:16px;border-radius:4px"]',
      "height",
    ),
  ).toThrow(/addresses 12 elements/);
});

test("a row is read from the drawing it names, and a path the reader was not given fails loudly", () => {
  // **The silent default.** `undefined` means the shell drawing — every plan 7
  // row — and must keep meaning it; a row that names a file must read *that* file;
  // and a row naming a file the reader was not given is a broken row, not a shell
  // reading. Without the throw, a settings row that lost its `mockupPath` would
  // read `current/shell.html` and could pass on a value the shell declares where
  // `current/settings.html` declares something else — the "a real value on the
  // wrong element reads as a pass" failure this module exists to end, one level
  // up. (The other half of that pair is proved above: the settings nav's
  // `width:150px` selector addresses nothing in the shell drawing and throws.)
  const known = drawingTexts();
  expect(known.size).toBe(currentDrawings().length);
  expect(rowDrawing(undefined, known)).toBe(drawing);
  expect(rowDrawing(SETTINGS_MOCKUP_PATH, known)).toBe(settings);
  expect(rowDrawing(CONTROLS_MOCKUP_PATH, known)).toBe(
    readMockup(CONTROLS_MOCKUP_PATH),
  );

  // The exact case the fallback hid: a map holding the shell drawing and not the
  // settings one. A fallback would answer the shell's text and the row would
  // compare against the wrong file.
  expect(() =>
    rowDrawing(SETTINGS_MOCKUP_PATH, new Map([[MOCKUP_PATH, drawing]])),
  ).toThrow(/was not given/);
  expect(() => rowDrawing("/nowhere/missing.html", known)).toThrow(
    /was not given/,
  );

  // And every row in the table resolves, so a `mockupPath` typo reddens here in
  // the fast suite rather than reading another file in the browser run.
  for (const row of PARITY) {
    expect(
      () => rowDrawing(row.mockupPath, known),
      `${row.region}: the reader was not given the drawing this row names`,
    ).not.toThrow();
  }
});

test("the drawing's own token table is read, and all eleven tokens with it", () => {
  // The drawing declares its shell tokens on the outermost element rather than
  // in a `:root` rule, so this is a reading of an inline `style` attribute —
  // `docs/design/mockups/current/shell.html:17-18`.
  expect(SHELL_ROLES).toHaveLength(11);
  for (const role of SHELL_ROLES) {
    expect(
      mockupDeclared(drawing, SHELL_TOKEN_SELECTOR, role.drawingToken),
      `${role.drawingToken} is not declared by the drawing's token table`,
    ).toMatch(/^#[0-9a-f]{6}$/);
  }
  // The two the brief's list of ten omitted and the drawing's own spellings.
  expect(mockupDeclared(drawing, SHELL_TOKEN_SELECTOR, "--hot")).toBe(
    "#ff7e6e",
  );
  expect(mockupDeclared(drawing, SHELL_TOKEN_SELECTOR, "--panel2")).toBe(
    "#171c23",
  );
  expect(mockupDeclared(drawing, SHELL_TOKEN_SELECTOR, "--edge2")).toBe(
    "#1b212a",
  );

  // The check the three above cannot make: a reader answering a constant would
  // pass them all. A token moved in the file must come back moved.
  const changed = drawing.replace("--hot:#ff7e6e", "--hot:#012345");
  expect(changed).not.toBe(drawing);
  expect(mockupDeclared(changed, SHELL_TOKEN_SELECTOR, "--hot")).toBe(
    "#012345",
  );

  // A token the table does not declare is a broken row, not a silence.
  expect(() => mockupDeclared(drawing, SHELL_TOKEN_SELECTOR, "--nope")).toThrow(
    /declares no `--nope`/,
  );
});

test("the drawing's token table declares the eleven mapped tokens and no twelfth", () => {
  // Every assertion above reads the table **row by row**, and that is the shape
  // `--hot` walked through: the brief scoped this task against a table of ten,
  // the drawing had carried eleven, and nothing reddened, because a token nobody
  // maps is a token nobody asks for. So the *set* is asserted too — a twelfth
  // added to `current/shell.html:17-18` fails here and has to be given an owner
  // deliberately.
  //
  // The element carries its layout declarations (`width`, `display`, …) as well
  // as its tokens, so the reading is filtered to custom properties rather than
  // the reader knowing what a token is.
  const tokens = (html: string): string[] =>
    mockupDeclaredProperties(html, SHELL_TOKEN_SELECTOR)
      .filter((property) => property.startsWith("--"))
      .sort();

  expect(tokens(drawing)).toEqual(
    [...new Set(SHELL_ROLES.map((role) => role.drawingToken))].sort(),
  );

  // The check the line above cannot make: a reader answering a constant set
  // passes it. A twelfth token in the file must come back as one.
  const twelfth = drawing.replace(
    "--hot:#ff7e6e;",
    "--hot:#ff7e6e;--new:#123456;",
  );
  expect(twelfth).not.toBe(drawing);
  expect(tokens(twelfth)).toHaveLength(SHELL_ROLES.length + 1);
  expect(tokens(twelfth)).toContain("--new");

  // And the eleven are named, not merely counted: a token renamed in the table
  // with a row left behind is a different set, not the same size.
  const renamed = drawing.replace("--panel2:#171c23;", "--panel-2:#171c23;");
  expect(renamed).not.toBe(drawing);
  expect(tokens(renamed)).not.toEqual(tokens(drawing));
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

test("a shorthand for a property a row reads fails loudly rather than reading as silence", () => {
  // The third reading, and the one that inverted a row: `lookup` matches
  // property names exactly, so a shorthand is invisible to a row reading its
  // longhand — and a body row reads the drawing's silence as `0`. The body
  // element the row addresses declares no `padding`, and that silence is its
  // value; `padding:8px` on it is a declaration the row cannot see, so the
  // reader refuses rather than reporting the drawing as flush.
  const BODY = '[style*="flex:1;min-height:0"]';
  const BODY_STYLE = 'style="display:flex;flex:1;min-height:0"';
  const padded = drawing.replace(
    BODY_STYLE,
    'style="display:flex;flex:1;min-height:0;padding:8px"',
  );
  expect(padded).not.toBe(drawing);
  expect(() => mockupDeclaredOrNull(padded, BODY, "padding-top")).toThrow(
    /shorthand that sets `padding-top`/,
  );
  // The other half of the same row: `gap` sets `column-gap`.
  const gapped = drawing.replace(
    BODY_STYLE,
    'style="display:flex;flex:1;min-height:0;gap:8px"',
  );
  expect(gapped).not.toBe(drawing);
  expect(() => mockupDeclaredOrNull(gapped, BODY, "column-gap")).toThrow(
    /shorthand that sets `column-gap`/,
  );
  // The silence the map must not touch: the unmutated drawing still reads null,
  // because it declares neither a shorthand nor the longhand.
  expect(mockupDeclaredOrNull(drawing, BODY, "padding-top")).toBeNull();
  expect(mockupDeclaredOrNull(drawing, BODY, "column-gap")).toBeNull();
});

test("the current set is enumerated by directory, and every drawing in it reads", () => {
  // The radii gate reads every drawing in `docs/design/mockups/current/` from
  // this enumeration, so a directory read that stopped seeing one of the four
  // has dropped a drawing the suite claims to check.
  const drawings = currentDrawings();
  const names = drawings.map((drawing) => drawing.name);
  for (const known of [
    "docs/design/mockups/current/shell.html",
    "docs/design/mockups/current/settings.html",
    "docs/design/mockups/current/controls.html",
    "docs/design/mockups/current/controls-light.html",
  ]) {
    expect(
      names,
      `${known} is not enumerated by the current-set reading`,
    ).toContain(known);
  }
  // The negative half: a reader that returned four names and read nothing from
  // disk passes the loop above, so each path is opened and read.
  for (const drawing of drawings) {
    expect(
      readMockup(drawing.path),
      `${drawing.name} did not read back as a drawing`,
    ).toContain("<!doctype html>");
  }
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

test("the comparator holds every token of a value, and reads one value as one length", () => {
  // The regression this pins, in the comparator's own words: reading only the
  // first token made `border-radius: 8px 8px 0 0` on `.editor-shell-dialog`
  // read as `8`, so a square-bottomed modal passed both dialog rows. A
  // non-uniform value has no single length it means, so it is `null` — a loud
  // failure — and never the first corner.
  expect(lengthInPx("8px 8px 0 0")).toBeNull();
  expect(lengthInPx("8px 10px")).toBeNull();
  expect(lengthInPx("6px/8px")).toBeNull();
  // The spellings that must keep meaning their own length, or the fix would
  // have traded a false pass for a false failure on every row it guards.
  expect(lengthInPx("8px")).toBe(8);
  expect(lengthInPx("8px 8px 8px 8px")).toBe(8);
  // A bare `0` is the one length CSS lets a drawing write without a unit, so a
  // flush row that says `padding-top: 0` reads as flush rather than as a value
  // this table cannot read — the false failure the `px`-only read would give it.
  expect(lengthInPx("0")).toBe(0);
  expect(lengthInPx("0px")).toBe(0);
  // A unitless non-zero is not a length, and must not be read as one.
  expect(lengthInPx("5")).toBeNull();
  expect(lengthInPx("1.5px")).toBe(1.5);
  // `gap`'s own word for no gap, and the values this table cannot read at all.
  expect(lengthInPx("normal")).toBe(0);
  expect(lengthInPx("")).toBeNull();
  expect(lengthInPx("50%")).toBeNull();
  expect(lengthInPx("auto")).toBeNull();
});

test("every row names a comparator, and each row's drawing value is one it reads", () => {
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
    // A **colour** row is the one kind whose scale token is read as a colour:
    // `--elev-scrim` is `#00000073`, which no length reading has an answer for.
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
    // **value** is still read, though: a licence quotes a declaration, and one
    // nobody reads licenses whatever is there now, including a region the drawing
    // stopped drawing. `mockupDeclaredOrNull` throws when the selector addresses
    // nothing, so reaching the assertion is itself the proof that the licence's
    // region is still drawn; the value only has to be one the drawing still
    // declares. (The stage ground's licence is additionally about its *texture* —
    // that reading lives in the row's own licence text, not in a substring every
    // full-time licensed row would have to share.)
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
    // **Read through the row's own comparator, not through `lengthInPx`.** The
    // palette grid's declared value is `repeat(3,1fr)` and the drawing declares no
    // colour any row reads, so a length-only check here would red on the count
    // row's own drawing — and, worse, would let a count row be *given* a px value
    // and pass.
    const reads =
      row.comparator === "count"
        ? trackCount(declared) !== null
        : row.comparator === "colour"
          ? colourValue(declared) !== null
          : isLength(declared);
    expect(
      reads,
      `${row.region}: the drawing declares \`${declared}\`, which is not a ${row.comparator ?? "length"} this table can compare`,
    ).toBe(true);
  }
});

test("a track count is read, and a value that is not one is null", () => {
  // The count comparator, and the reason it is not `lengthInPx`: the drawing's
  // declared value and the product's computed one are the *same property* in two
  // forms, `repeat(3,1fr)` and a serialised track list, and a px reading answers
  // `null` for both.
  expect(trackCount("repeat(3,1fr)")).toBe(3);
  expect(trackCount("repeat( 2 , 1fr )")).toBe(2);
  expect(trackCount("146px 146px")).toBe(2);
  expect(trackCount("146px 146.5px 146px")).toBe(3);
  // A track that carries its own whitespace is one track, not two, and a line
  // name is not a track at all.
  expect(trackCount("minmax(0px, 1fr) 1fr 1fr")).toBe(3);
  expect(trackCount("[full-start] 1fr [full-end]")).toBe(1);
  expect(trackCount("[a] 1fr [b] 2fr [c]")).toBe(2);
  // The values this comparator has no count for — and `repeat(auto-fill, …)` is
  // the one that matters: it is a bound, not a count, so it must not be read as
  // the drawing's number.
  expect(trackCount("none")).toBeNull();
  expect(trackCount("subgrid")).toBeNull();
  expect(trackCount("")).toBeNull();
  expect(trackCount("repeat(auto-fill, minmax(80px, 1fr))")).toBeNull();
  // The check the assertions above cannot make: a comparator answering a
  // constant passes them. A drawing moved to three columns must come back as
  // three.
  const three = settings.replace("repeat(3,1fr)", "repeat(4,1fr)");
  expect(three).not.toBe(settings);
  expect(trackCount(mockupDeclared(three, GRID, "grid-template-columns"))).toBe(
    4,
  );
  expect(
    trackCount(mockupDeclared(settings, GRID, "grid-template-columns")),
  ).toBe(3);
});

test("a colour is read as a resolved value, so one colour's spellings are equal", () => {
  // The colour comparator, and the reason it is not a string comparison: the
  // bible writes the modal's scrim `#00000073` and a browser computes the same
  // colour as `rgba(0, 0, 0, 0.451)`, so the two sides of a colour row are never
  // the same text.
  expect(colourValue("#00000073")).toBe("rgba(0, 0, 0, 115)");
  expect(colourValue("rgba(0, 0, 0, 0.451)")).toBe(colourValue("#00000073"));
  expect(colourValue("rgb(0 0 0 / 45.1%)")).toBe(colourValue("#00000073"));
  expect(colourValue("#0009")).toBe("rgba(0, 0, 0, 153)");
  expect(colourValue("rgba(0, 0, 0, 0.6)")).toBe(colourValue("#0009"));
  expect(colourValue("#fff")).toBe("rgba(255, 255, 255, 255)");
  expect(colourValue("#12161c")).toBe("rgba(18, 22, 28, 255)");
  expect(colourValue("transparent")).toBe("rgba(0, 0, 0, 0)");
  expect(colourValue("rgba(0,0,0,0)")).toBe(colourValue("transparent"));
  // **The difference the row is for.** 60% black is not 45% black, and a
  // comparator that answered `true` here would pass the product's `#0009` row.
  expect(colourValue("#0009")).not.toBe(colourValue("#00000073"));
  expect(colourValue("#0b1419a8")).not.toBe(colourValue("#12161c"));
  // The values this comparator has no colour for. `color-mix(…)` is the one that
  // matters: `--edge-2` and `--faint` are written that way, so a row that named
  // one is `null` rather than a guess at the mix.
  expect(colourValue("color-mix(in srgb, red, blue)")).toBeNull();
  expect(colourValue("linear-gradient(145deg,#101923,#071116)")).toBeNull();
  expect(colourValue("")).toBeNull();
  expect(colourValue("rgba(0, 0)")).toBeNull();
  expect(colourValue("#12345")).toBeNull();
});
