/** Responsibility: the reverse direction of the parity reader's property rule — a
 *  declaration a drawing makes that no `PARITY` row reads (`vg-419`). */
import {
  MOCKUP_PATH,
  mockupDeclaredProperties,
  type ParityRegion,
} from "./mockup-values.js";

/**
 * The direction `assertParityRowProperty` does not read (`vg-419`).
 *
 * `assertParityRowProperty` closes one way: a row naming a property its element
 * does not declare throws, and `mockupSilence` says when the drawing's silence
 * *is* the value. **The other way stayed open** — a property the drawing
 * *declares* that no row reads is inaudible to every instrument, so a drawing can
 * grow a declaration nobody compares. The class is real and the instrument's own
 * doc comment carries the case: the shell's eleventh token (`--hot`) arrived under
 * a brief that listed ten, which is why the set reader (`mockupDeclaredProperties`)
 * exists at all.
 *
 * **The shape taken is the second one the row names: a declared allow-list.**
 * The first — a rule that *every* property a row's selector declares is read by
 * some row — cannot be green today without writing a row per property per region
 * (123 of them), which is the table widened until it is a transcription of the
 * drawing. So the readings that are unread are *recorded* here, per drawing and
 * per selector, and the guard fails when the drawings and this table disagree in
 * **either** direction: a declaration that is neither read nor recorded is a
 * comparison nobody asked for, and a recorded one the drawing no longer makes is
 * an entry that has gone stale.
 *
 * **What this does not read.** A drawing that *no* `PARITY` row addresses is not
 * in this table at all, so a seventh drawing lands with nothing said about it —
 * `vg-296`'s enumeration and `vg-314`'s surface inventory are where that belongs.
 * And a property is unread *of one selector*: the same property on another
 * element is a different reading, which is why the keys below are per selector
 * rather than per property name.
 */

/** One selector a `PARITY` row addresses, and the properties of the element it
 *  addresses that no row of the table reads. */
export type UnreadDeclaration = {
  /** The drawing, by the checked-in name a failure has to name: a person has to
   *  be able to open the file the finding is about. */
  readonly drawing: string;
  readonly selector: string;
  readonly properties: readonly string[];
};

/** A drawing as the directory enumeration gives it, structurally rather than by
 *  import, so this module and `currentDrawings` cannot drift on the shape. */
export type Drawing = {
  readonly path: string;
  readonly name: string;
};

/** Every declaration a drawing's row-addressed elements make that no row reads,
 *  in the enumeration's order and the drawing's.
 *
 *  A selector is read as the reader reads it — through `mockupDeclaredProperties`
 *  — so a selector that addresses nothing or settles between two elements throws
 *  here exactly as it does for a value. */
export function unreadDeclarations(
  drawing: Drawing,
  mockupHtml: string,
  rows: readonly ParityRegion[],
): readonly UnreadDeclaration[] {
  const mine = rows.filter(
    (row) => (row.mockupPath ?? MOCKUP_PATH) === drawing.path,
  );
  const selectors = [
    ...new Set(
      mine
        .map((row) => row.mockupSelector)
        .filter((selector): selector is string => selector !== undefined),
    ),
  ];
  const found: UnreadDeclaration[] = [];
  for (const selector of selectors) {
    const read = new Set(
      mine
        .filter((row) => row.mockupSelector === selector)
        .map((row) => row.mockupProperty),
    );
    const unread = mockupDeclaredProperties(mockupHtml, selector).filter(
      (property) => !read.has(property),
    );
    if (unread.length === 0) continue;
    found.push({ drawing: drawing.name, selector, properties: unread });
  }
  return found;
}

/** A reading, as the one-line key the two sides are compared by. A property is
 *  unread *of one selector*, so the selector is part of the identity. */
function keys(entries: readonly UnreadDeclaration[]): readonly string[] {
  return entries.flatMap((entry) =>
    entry.properties.map(
      (property) => `${entry.drawing}|${entry.selector}|${property}`,
    ),
  );
}

/** What the drawings and the recorded allow-list disagree about, one line per
 *  property; an empty list is a table whose silence is entirely recorded.
 *
 *  Both directions are findings, and neither is silence: a declaration the
 *  drawing grew and nothing records is the defect this module exists for, and a
 *  recorded entry the drawing no longer makes is a claim about a file that has
 *  moved — the row that reads the property now, or a selector whose element went
 *  with it. */
export function unreadDeclarationFindings(
  measured: readonly UnreadDeclaration[],
  recorded: readonly UnreadDeclaration[],
): readonly string[] {
  const findings: string[] = [];
  const recordedKeys = new Set(keys(recorded));
  for (const entry of measured) {
    for (const property of entry.properties) {
      if (recordedKeys.has(`${entry.drawing}|${entry.selector}|${property}`)) {
        continue;
      }
      findings.push(
        `${entry.drawing} \`${entry.selector}\` declares \`${property}\`, which no \`PARITY\` row reads and no entry below records: compare it with a row, or record it as a declaration this instrument does not compare`,
      );
    }
  }
  const measuredKeys = new Set(keys(measured));
  for (const entry of recorded) {
    for (const property of entry.properties) {
      if (measuredKeys.has(`${entry.drawing}|${entry.selector}|${property}`)) {
        continue;
      }
      findings.push(
        `${entry.drawing} \`${entry.selector}\`: this table records \`${property}\` as unread and the drawing no longer reads it that way — a row reads it now, the drawing dropped it, or the selector moved. Delete the entry`,
      );
    }
  }
  return findings;
}

/** Every declaration the checked drawings make that no `PARITY` row reads,
 *  measured at `da6f1f31` on 2026-10-16: **26 selectors, 123 properties**, of
 *  which `current/shell.html` holds 49 across its 8 row-addressed selectors.
 *
 *  **Read this as a decision, not a fixture.** Each entry is a declaration a
 *  person looked at and decided the instrument does not compare — a layout
 *  property the drawing needs to draw the region at all (`display`, `flex`,
 *  `align-items`), a treatment a *different* instrument owns (the rail's
 *  `background`, `border-right` and `flex-direction` are `COPIED_ELEMENTS`', the
 *  drawings' radii are the radii gate's), or a value no comparator can read (the
 *  chord chip's `font`, a shorthand no row's longhand has). A new declaration
 *  lands here only by being written down, and writing it down is the moment the
 *  decision is made — which is the whole of what `vg-419` asks for. */
export const UNREAD_DECLARATIONS: readonly UnreadDeclaration[] = [
  // docs/design/mockups/current/controls-editorial.html
  {
    drawing: "docs/design/mockups/current/controls-editorial.html",
    selector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11px;padding-top:4px"]',
    properties: ["flex", "color", "font-size", "padding-top"],
  },
  // docs/design/mockups/current/controls.html
  {
    drawing: "docs/design/mockups/current/controls.html",
    selector:
      '[style*="width:74px;flex:0 0 auto;color:var(--muted);font-size:11px;padding-top:4px"]',
    properties: ["flex", "color", "font-size", "padding-top"],
  },
  // docs/design/mockups/current/settings-about.html
  {
    drawing: "docs/design/mockups/current/settings-about.html",
    selector:
      '[style*="display:flex;align-items:baseline;justify-content:space-between;gap:16px;padding:4px 0"]',
    properties: ["display", "align-items", "justify-content", "padding"],
  },
  // docs/design/mockups/current/settings-keyboard.html
  {
    drawing: "docs/design/mockups/current/settings-keyboard.html",
    selector:
      '[style*="border:1px solid var(--edge);border-radius:4px;padding:4px;font:400 11px/1.2 ui-monospace,Menlo,monospace;color:var(--muted)"]',
    properties: ["border", "font", "color"],
  },
  {
    drawing: "docs/design/mockups/current/settings-keyboard.html",
    selector:
      '[style*="display:flex;align-items:center;gap:16px;padding:4px 6px;border-radius:6px"]',
    properties: ["display", "align-items", "gap", "padding"],
  },
  {
    drawing: "docs/design/mockups/current/settings-keyboard.html",
    selector:
      '[style*="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px"]',
    properties: [
      "display",
      "align-items",
      "justify-content",
      "width",
      "height",
      "border",
      "color",
    ],
  },
  {
    drawing: "docs/design/mockups/current/settings-keyboard.html",
    selector:
      '[style*="flex:0 0 auto;border:1px solid var(--edge);border-radius:6px"]',
    properties: ["flex", "border", "background", "font", "padding", "color"],
  },
  {
    drawing: "docs/design/mockups/current/settings-keyboard.html",
    selector:
      '[style*="margin-left:auto;border:1px solid var(--edge);border-radius:6px"]',
    properties: [
      "margin-left",
      "border",
      "background",
      "font",
      "padding",
      "color",
    ],
  },
  // docs/design/mockups/current/settings.html
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="border:1px solid var(--edge);border-radius:8px;padding:8px;background:var(--panel2)"]',
    properties: ["border", "padding", "background"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--panel2);border:1px solid var(--edge);border-radius:8px"]',
    properties: [
      "margin-top",
      "display",
      "align-items",
      "padding",
      "background",
      "border",
    ],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector: '[style*="display:grid"]',
    properties: ["display", "gap"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#0b0e12"]',
    properties: ["flex", "height", "border-radius", "border"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#cfe0bb"]',
    properties: ["flex", "height", "border-radius", "border"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#dccdef"]',
    properties: ["flex", "height", "border-radius", "border"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#e9cdb4"]',
    properties: ["flex", "height", "border-radius", "border"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector:
      '[style*="flex:1;height:16px;border-radius:4px;background-color:#f5f1e8"]',
    properties: ["flex", "border-radius", "border"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector: '[style*="flex:1;min-width:0;padding:14px 16px"]',
    properties: ["flex", "min-width"],
  },
  {
    drawing: "docs/design/mockups/current/settings.html",
    selector: '[style*="width:150px"]',
    properties: ["flex", "background", "border-right", "padding"],
  },
  // docs/design/mockups/current/shell.html
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector:
      '[style*="flex:1;display:flex;align-items:center;gap:6px;background:var(--panel2);border:1px solid var(--edge);border-radius:6px;padding:4px 8px"]',
    properties: [
      "flex",
      "display",
      "align-items",
      "background",
      "border",
      "padding",
    ],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector: '[style*="flex:1;min-height:0"]',
    properties: ["display", "flex", "min-height"],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector:
      '[style*="height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center"]',
    properties: ["border-radius", "display", "align-items", "justify-content"],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector: '[style*="height:42px"]',
    properties: [
      "flex",
      "display",
      "align-items",
      "gap",
      "padding",
      "background",
      "border-bottom",
    ],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector: '[style*="repeating-linear-gradient(45deg"]',
    properties: [
      "flex",
      "position",
      "min-width",
      "display",
      "align-items",
      "justify-content",
      "padding",
    ],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector: '[style*="width:246px"]',
    properties: [
      "width",
      "flex",
      "background",
      "border-right",
      "display",
      "flex-direction",
      "min-height",
    ],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector: '[style*="width:276px"]',
    properties: ["width", "flex", "border-left", "background", "overflow"],
  },
  {
    drawing: "docs/design/mockups/current/shell.html",
    selector: '[style*="width:46px"]',
    properties: [
      "width",
      "box-sizing",
      "flex",
      "background",
      "border-right",
      "display",
      "flex-direction",
      "align-items",
      "padding",
      "gap",
    ],
  },
];
