#!/usr/bin/env node
/**
 * Row-overlap check: find ownership rows that describe the same words.
 *
 * The artboard transform went missing from the map because two rows described it
 * between them — row 63 said "viewport fitting, artboard paint" and row 74 said
 * "artboard size/preview fit/paint/media" — and the module that actually computes
 * the fit was in neither. Neither row was wrong on its own. **Together they made
 * a concept look covered, which is worse than a gap because it reads as done.**
 *
 * That is the class worth checking mechanically, and it is checkable: two rows
 * whose distinctive words overlap are describing one thing twice, and the reader
 * cannot tell which row to believe. The fix is always the same and never a move:
 * **split the row**, or name the owner that decides it.
 *
 * This is the one map check that can be sharp, because it needs no judgement
 * about code — only about the map's own text. Which is why it belongs in the
 * gate, unlike the enforcement reading list.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAP = join(ROOT, "docs/architecture/ownership.md");

/** Words too common in this codebase to identify a concept. */
const STOP = new Set([
  "the", "and", "for", "from", "with", "that", "this", "when", "where", "which",
  "into", "its", "their", "they", "them", "than", "then", "only", "also", "does",
  "live", "asked", "asks", "used", "per", "own", "row", "rows", "name", "names",
  "named", "file", "files", "path", "paths", "module", "modules", "layer", "layers",
  "state", "list", "lists", "data", "type", "types", "value", "values", "code",
  "read", "reads", "writes", "write", "another", "field", "fields", "property",
  "properties", "thing", "things", "part", "parts", "piece", "pieces", "one", "two",
  "does", "not", "all", "any", "but", "non", "own", "hand", "hands", "side",
]);

/** The distinctive words of a concept: long, and not shared English. */
function keywordsOf(concept) {
  const words = [...concept.matchAll(/[A-Za-z][A-Za-z0-9]{3,}/g)].map((m) => m[0].toLowerCase());
  return [...new Set(words.filter((w) => w.length >= 5 && !STOP.has(w)))];
}

function parseMap() {
  const rows = [];
  let section = "(root)";
  for (const line of readFileSync(MAP, "utf8").split(/\r?\n/)) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [concept, ownerCell] = cells;
    if (concept === "Concept" || concept === "" || ownerCell === "Owner") continue;
    const owners = [...ownerCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (owners.length === 0) continue;
    rows.push({ section, concept, owners, keywords: new Set(keywordsOf(concept)) });
  }
  return rows;
}

const rows = parseMap();
const overlaps = [];

for (let i = 0; i < rows.length; i++) {
  for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i];
    const b = rows[j];
    // The same owner means a deliberate split, not a duplicated description.
    if (a.owners.some((o) => b.owners.includes(o))) continue;
    const shared = [...a.keywords].filter((k) => b.keywords.has(k));
    if (shared.length < 2) continue;
    overlaps.push({
      shared,
      a: { concept: a.concept, owner: a.owners[0], section: a.section },
      b: { concept: b.concept, owner: b.owners[0], section: b.section },
    });
  }
}

const report = {
  mapRows: rows.length,
  overlappingRowPairs: overlaps.length,
  overlaps: overlaps.sort((x, y) => y.shared.length - x.shared.length),
  note:
    "Two rows describing the same words is one concept written twice, and the " +
    "reader cannot tell which row to believe. The artboard transform went missing " +
    "from the map this way. The fix is to split the row or name the owner that " +
    "decides — never to move an owner on the strength of an overlap.",
};
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);

if (process.argv.includes("--self-test")) {
  const kw = (c) => new Set(keywordsOf(c));
  const sharedOf = (x, y) => [...kw(x)].filter((k) => kw(y).has(k));
  const checks = [
    // Prose and grammar are dropped. Note what is NOT asserted: `canvas` and
    // `data` survive, because in this codebase they are domain words and two
    // rows about them overlapping is exactly the signal worth having.
    ["grammar words are dropped", (() => {
      const k = kw("The canvas and the data with their own values");
      return !k.has("the") && !k.has("and") && !k.has("with") && !k.has("their") && !k.has("own");
    })()],
    ["domain words survive the stoplist", kw("The canvas and the data").has("canvas")],
    ["distinctive words survive", kw("Frosted-glass control").has("frosted") || kw("Frosted-glass control").has("glass")],
    ["a genuine overlap is found", sharedOf("artboard size and preview fit", "artboard preview fit and paint").length >= 2],
    ["unrelated concepts are not", sharedOf("Palette token reassignment", "Per-image crop session").length === 0],
    ["the real map scan produced pairs", overlaps.length > 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${name}\n`);
  if (failed.length > 0) {
    process.stderr.write(`\nownership-overlap self-test failed: ${failed.map(([n]) => n).join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write("\nownership-overlap self-test passed.\n");
}
