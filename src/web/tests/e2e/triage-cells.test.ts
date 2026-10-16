import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/**
 * Every `--grep` a triage cell records must collect a case — or say it does not.
 *
 * `vg-398`: a cell names the command that is supposed to reproduce its row, and
 * a value matching no case title exits non-zero with "No tests found" while the
 * cell still reads as a repro. The reader is static rather than a Playwright
 * `--list` run, because a unit test that shells out per cell would put 27
 * subprocesses in the fast suite; it was checked against `--list` when written
 * (2026-10-16) and agreed on every cell, the three misses below included.
 *
 * **The flag is matched against case titles, not assertion messages**, which is
 * the trap this exists for: `vg-259`'s value occurred in its spec only as an
 * expectation's message, so it collected nothing while looking like a repro.
 * Playwright compiles the value as `new RegExp(value, "gi")`, and so does this.
 *
 * A cell whose command genuinely collects nothing carries the note
 * `collects nothing` (or a placeholder in angle brackets); the rule is that the
 * cell has to say so, which is what `vg-398`'s close asks for.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const TRIAGE_DIR = path.join(
  here,
  "..",
  "..",
  "..",
  "..",
  "docs",
  "product",
  "triage",
);

/** The titles a spec file declares as literals. A title built from a variable
 *  would not be seen here — none of the cells' own specs build one. */
const TITLE =
  /\btest(?:\.describe)?\(\s*(?:"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`)/g;

function titlesOf(file: string): readonly string[] {
  const found: string[] = [];
  let match: RegExpExecArray | null;
  TITLE.lastIndex = 0;
  while ((match = TITLE.exec(readFileSync(file, "utf8"))) !== null) {
    found.push((match[1] ?? match[2] ?? "").replace(/\\"/g, '"'));
  }
  return found;
}

const SPECS = readdirSync(here)
  .filter((file) => file.endsWith(".spec.ts"))
  .sort();
const TITLES = new Map(
  SPECS.map((file) => [file, titlesOf(path.join(here, file))]),
);

/** Whether the value collects a case, in the file the command names — or in any
 *  spec when it names none (`--project=` and `--config` cells). */
function collects(value: string, named: string | undefined): boolean {
  const pattern = new RegExp(value, "i");
  const files = named === undefined ? SPECS : [named];
  return files.some((file) =>
    (TITLES.get(file) ?? []).some((title) => pattern.test(title)),
  );
}

interface Cell {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly values: readonly string[];
  readonly named: string | undefined;
  readonly noted: boolean;
}

/** Every row of every triage table that carries a command value. */
function cells(): readonly Cell[] {
  const found: Cell[] = [];
  for (const table of readdirSync(TRIAGE_DIR).sort()) {
    if (!table.endsWith(".md")) continue;
    const lines = readFileSync(path.join(TRIAGE_DIR, table), "utf8").split(
      "\n",
    );
    lines.forEach((line, index) => {
      const id = /^\| (vg-\d+) \|/.exec(line)?.[1];
      if (id === undefined) return;
      const values = [...line.matchAll(/--grep "([^"]*)"/g)].map(
        (match) => match[1] ?? "",
      );
      if (values.length === 0) return;
      found.push({
        id,
        file: table,
        line: index + 1,
        values,
        named: /npx playwright test ([\w.-]+\.spec\.ts)/.exec(line)?.[1],
        noted: /collects nothing|placeholder/.test(line),
      });
    });
  }
  return found;
}

const CELLS = cells();

describe("the triage cells' own commands", () => {
  test("reads the six tables' command cells", () => {
    expect(new Set(CELLS.map((cell) => cell.file)).size).toBe(6);
    expect(CELLS.length).toBeGreaterThan(20);
  });

  test("every value collects a case, or the cell says it does not", () => {
    const empty = CELLS.flatMap((cell) =>
      cell.values
        .filter((value) => !cell.noted && !collects(value, cell.named))
        .map(
          (value) => `${cell.file}:${cell.line} ${cell.id} --grep "${value}"`,
        ),
    );
    expect(empty, "cells whose command collects nothing").toEqual([]);
  });

  test("a cell that names a spec file is read against that file alone", () => {
    const value = "a fresh document is the reference composition";
    expect(collects(value, "reference-theme.spec.ts")).toBe(true);
    expect(collects(value, "keyboard.spec.ts")).toBe(false);
    // The file is what `vg-028` turns on: a value found in some other spec
    // would still collect nothing under the command the cell records.
    expect(collects("playback", "editor.spec.ts")).toBe(false);
  });
});
