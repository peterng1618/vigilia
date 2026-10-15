/** Responsibility: the proof of the parity instrument's reverse direction — the
 *  declarations a drawing makes that no `PARITY` row reads (`vg-419`). */
import { expect, test } from "vitest";
import { currentDrawings, PARITY, readMockup } from "./mockup-values.js";
import {
  type Drawing,
  UNREAD_DECLARATIONS,
  type UnreadDeclaration,
  unreadDeclarationFindings,
  unreadDeclarations,
} from "./parity-unread-declarations.js";

/** The checked drawing a case names, or a throw: a case that silently found no
 *  drawing would assert nothing. */
function drawing(name: string): Drawing {
  const found = currentDrawings().find((one) => one.name.endsWith(`/${name}`));
  if (found === undefined) {
    throw new Error(`no checked drawing named \`${name}\``);
  }
  return found;
}

/** The unread properties recorded for one drawing's selector, or a throw for the
 *  same reason. */
function recordedFor(
  entries: readonly UnreadDeclaration[],
  drawingName: string,
  selector: string,
): readonly string[] {
  const found = entries.find(
    (entry) => entry.drawing === drawingName && entry.selector === selector,
  );
  if (found === undefined) {
    throw new Error(
      `no entry records \`${selector}\` in \`${drawingName}\`: the case names a reading the table does not carry`,
    );
  }
  return found.properties;
}

/** The real measurement, over the checked drawings and the real table. */
const measured = currentDrawings().flatMap((one) =>
  unreadDeclarations(one, readMockup(one.path), PARITY),
);

test("every declaration a checked drawing makes is read by a row or recorded as unread", () => {
  // **The empty-read control.** A guard over two empty sets passes, and this one
  // would pass over a reader that returned nothing — so both sides have to be
  // shown non-empty before their agreement means anything.
  expect(
    measured.length,
    "no drawing declares a property no row reads, so this guard proves nothing",
  ).toBeGreaterThan(0);
  expect(
    UNREAD_DECLARATIONS.length,
    "the allow-list is empty, so it records nothing",
  ).toBeGreaterThan(0);
  // The findings ride in the message as well as in the diff: a failure over 123
  // readings elides to `[ Array(1) ]`, which says that something moved and not
  // what.
  const findings = unreadDeclarationFindings(measured, UNREAD_DECLARATIONS);
  expect(findings, findings.join("\n")).toEqual([]);
});

test("a declaration the drawing grows is a finding, and an entry it drops is one too", () => {
  // Both directions, on the drawing the class was measured in: the rail's
  // `[style*="width:46px"]` element declares ten properties and one row reads its
  // radius. The mutations are one property each, and both are read back through
  // the real reader rather than through a fixture.
  const shell = drawing("shell.html");
  const RAIL = '[style*="width:46px"]';
  const html = readMockup(shell.path);
  // The recorded side is scoped to the drawing the mutations are made in: the
  // other five drawings are not re-measured here, and their entries would answer
  // every finding as an entry the drawing had dropped.
  const recorded = UNREAD_DECLARATIONS.filter(
    (entry) => entry.drawing === shell.name,
  );
  expect(recordedFor(recorded, shell.name, RAIL)).toContain("background");

  // **Grown.** A declaration the drawing makes that nothing reads and nothing
  // records — `vg-419`'s own failure, which was silent before this guard.
  const grown = html.replace(
    'style="width:46px;box-sizing:border-box',
    'style="width:46px;opacity:.5;box-sizing:border-box',
  );
  expect(grown).not.toBe(html);
  const grownFindings = unreadDeclarationFindings(
    unreadDeclarations(shell, grown, PARITY),
    recorded,
  );
  expect(grownFindings).toHaveLength(1);
  expect(grownFindings[0]).toMatch(/declares `opacity`/);

  // **Dropped.** An entry the drawing no longer makes is a claim about a file
  // that has moved, and it has to be loud for the same reason: a list nobody has
  // to keep current is a list that stops describing the drawings.
  const dropped = html.replace(
    "background:#0e1217;border-right:1px solid var(--edge)",
    "border-right:1px solid var(--edge)",
  );
  expect(dropped).not.toBe(html);
  const droppedFindings = unreadDeclarationFindings(
    unreadDeclarations(shell, dropped, PARITY),
    recorded,
  );
  expect(droppedFindings).toHaveLength(1);
  expect(droppedFindings[0]).toMatch(/records `background` as unread/);
});

test("a property a row reads is not unread, so the list follows the table rather than the file", () => {
  // The reading the guard is *for*: the set is `declared − read`, so adding a row
  // takes a property out of it. A guard that only diffed the drawing against a
  // frozen list would pass this test and still be blind to a row that started
  // reading something — the two directions have to come from the same reading.
  const shell = drawing("shell.html");
  const RAIL = '[style*="width:46px"]';
  const html = readMockup(shell.path);
  const before = recordedFor(UNREAD_DECLARATIONS, shell.name, RAIL);
  const withTheRailRead = [
    ...PARITY,
    {
      region: "the rail's ground — read by this case only",
      mockupSelector: RAIL,
      mockupProperty: "background",
      productSelector: ".editor-shell-rail",
      designLanguageSection: "§7.1",
    },
  ];
  const after = recordedFor(
    unreadDeclarations(shell, html, withTheRailRead),
    shell.name,
    RAIL,
  );
  expect(before).toContain("background");
  expect(after).not.toContain("background");
  expect(after).toHaveLength(before.length - 1);
});
