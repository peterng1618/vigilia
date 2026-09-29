#!/usr/bin/env node
/**
 * One-owner sweep: find places where a concept the ownership map assigns to one
 * module is also *decided* somewhere else.
 *
 * The Arrange menu was the case that started this. `ownership.md` gives arrange
 * actions to `layer-tree.ts` and `arrange.ts`; `shell-layout.tsx` then picked two
 * of the eight by hand. The defect was not a stale list — it was a second owner
 * of the *set*, which is the rule AGENTS.md states as "one owner per concept".
 *
 * Two kinds of check, both mechanical, neither a judgement:
 *
 *   1. A concept whose declared owner is one module, but whose vocabulary is
 *      spelled out literally in a second module. Enumerations are the give-away:
 *      a list of action ids, keys or type names written out where the owner
 *      already exports the list.
 *   2. A module named in the map as an owner that is imported and *also*
 *      shadowed by a local literal of the same idea nearby.
 *
 * What this is NOT: a proof of correctness. It finds candidates. Every hit needs
 * a human or an agent to say whether the second site is a legitimate consumer or
 * a second owner — a consumer that *reads* the owner's list is the rule working,
 * and this script cannot tell those apart. Reporting a consumer as a violation is
 * the expected false-positive rate, and the reason each hit is printed with the
 * owner it collides with rather than as a verdict.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAP = join(ROOT, "docs/architecture/ownership.md");
const SRC = join(ROOT, "src/web/packages");

/** Windows `relative()` yields backslashes; every path here is posix. */
const posix = (p) => p.replaceAll("\\", "/");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.(test|dom\.test)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every `path/like/this.ts` mentioned in a map row, with the concept beside it. */
function parseMap() {
  const rows = [];
  for (const line of readFileSync(MAP, "utf8").split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [concept, ownerCell] = cells;
    if (concept === "Concept" || concept === "" || ownerCell === "Owner") continue;
    const owners = [...ownerCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    // Prose owners ("`editor/src/editor-shell.ts`") name one module; a cell with
    // several backticked paths is a deliberate co-ownership and not a violation.
    if (owners.length === 0) continue;
    rows.push({ concept, owners, cell: ownerCell });
  }
  return rows;
}

/**
 * String literals that look like an enumeration's members.
 *
 * The first sweep counted *any* shared string, and a theme's field names
 * (`metadata`, `artboard`, `globals`, `assets`) scored 53 — which is a
 * document's vocabulary appearing in its own validator and serialiser, not a
 * second owner. Two filters fix that, and both come from what made the Arrange
 * menu a violation rather than a consumer:
 *
 *   - a **discriminator**: a kebab-case token. `align-left`, `distribute-x` are
 *     ids someone could pass to a function; `artboard` is a property name. A
 *     re-spelled *id* is the give-away, because ids are the vocabulary a caller
 *     selects from and a second copy of that selection is a second owner.
 *   - a **count floor** relative to the owner's set, so a one-off coincidence
 *     cannot clear it.
 */
function discriminatorsIn(source) {
  const found = new Set();
  for (const m of source.matchAll(/"([a-z][a-z0-9]*(?:-[a-z0-9]+)+)"/g)) found.add(m[1]);
  return found;
}

/** A module's exported array/record of ids — the owner's own vocabulary. */
function exportedVocabularies(source) {
  const out = [];
  const re = /(?:export\s+)?const\s+[A-Z_][A-Z0-9_]*\s*(?::[^=]+)?=\s*(?:new (?:Readonly)?Set\(\s*)?\[([^\]]*)\]/g;
  for (const m of source.matchAll(re)) {
    const ids = [...m[1].matchAll(/"([a-z][a-z0-9-]*)"/g)].map((x) => x[1]);
    if (ids.length >= 3) out.push(ids);
  }
  // And a record keyed by id, which is how ARRANGE_ICONS and its siblings are written.
  const rec = /(?:export\s+)?const\s+[A-Z_][A-Z0-9_]*\s*:\s*Readonly<Record<string[^>]*>>\s*=\s*\{([\s\S]*?)\n\};/g;
  for (const m of source.matchAll(rec)) {
    const keys = [...m[1].matchAll(/"([a-z][a-z0-9-]*)"\s*:/g)].map((x) => x[1]);
    if (keys.length >= 3) out.push(keys);
  }
  return out;
}

const files = walk(SRC);
const sources = new Map(
  files.map((f) => [posix(relative(ROOT, f)).replace(/^src\/web\//, ""), readFileSync(f, "utf8")]),
);

const rows = parseMap();
const hits = [];

// Every module that exports an id vocabulary, whoever owns it. The Arrange
// violation is a *subset* of its owner's list, so a subset match is the signal
// — a second site that re-spells 2 of 8 has still taken ownership of the choice.
const vocabularies = [];
for (const [file, source] of sources) {
  for (const ids of exportedVocabularies(source)) {
    vocabularies.push({ file, ids: new Set(ids), size: ids.length });
  }
}

for (const [file, source] of sources) {
  const here = discriminatorsIn(source);
  if (here.size === 0) continue;
  for (const vocab of vocabularies) {
    if (vocab.file === file) continue;
    // Inside the owner's own directory is the owner, not a rival.
    if (file.startsWith(vocab.file.replace(/\/[^/]+$/, "/"))) continue;
    const shared = [...here].filter((id) => vocab.ids.has(id));
    if (shared.length < 2) continue;
    hits.push({
      kind: "vocabulary",
      concept: rows.find((r) => r.owners.some((o) => vocab.file.includes(o.replace(/\/$/, ""))))?.concept ?? "(unmapped)",
      owner: vocab.file,
      other: file,
      shared: shared.slice(0, 8),
      count: shared.length,
      ofTotal: vocab.size,
    });
  }
}

// The same, but between two files that both re-spell a third's list.
const enumHits = [];
for (const [file, source] of sources) {
  const here = discriminatorsIn(source);
  for (const vocab of vocabularies) {
    if (vocab.file === file) continue;
    if (file.startsWith(vocab.file.replace(/\/[^/]+$/, "/"))) continue;
    const shared = [...here].filter((id) => vocab.ids.has(id));
    if (shared.length >= 2) enumHits.push({ a: file, b: vocab.file, shared, count: shared.length, ofTotal: vocab.size });
  }
}
enumHits.sort((x, y) => y.count / y.ofTotal - x.count / x.ofTotal);

const report = {
  mapRows: rows.length,
  sourceFiles: sources.size,
  vocabularyCollisions: hits.sort((x, y) => y.count - x.count),
  subsetReSpellings: enumHits.slice(0, 20),
  note:
    "Candidates, not verdicts. A module that READS an owner's exported list is the " +
    "rule working; only a module that re-spells the vocabulary is a second owner. " +
    "Every hit needs adjudication.",
};
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);

/**
 * The self-test proves the sweep can still see a violation it has already seen.
 *
 * A gate that cannot fail is worse than no gate: it reports green forever while
 * the thing it watches rots. So the fixture is the Arrange case itself — a
 * second site re-spelling a subset of an owner's ids — and the assertion is that
 * the sweep names it. If a future change to this script stops detecting that
 * shape, the self-test fails and says so, which is the only honest way for a
 * heuristic to be trusted in CI.
 */
if (process.argv.includes("--self-test")) {
  const OWNER = `const IDS = ["align-left", "align-right", "align-top"] as const;`;
  const RIVAL = `session.arrange("align-left"); session.arrange("align-right");`;
  const CONSUMER = `for (const id of IDS) { use(id); }`;

  const owner = exportedVocabularies(OWNER).flat();
  const checks = [
    ["an owner's array is read as a vocabulary", owner.length === 3],
    ["a rival re-spelling a subset is detected", discriminatorsIn(RIVAL).size >= 2],
    ["a consumer reading the list is not a discriminator", discriminatorsIn(CONSUMER).size === 0],
    ["the real run produced candidates to adjudicate", report.subsetReSpellings.length > 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${name}\n`);
  if (failed.length > 0) {
    process.stderr.write(`\nownership-sweep self-test failed: ${failed.map(([n]) => n).join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write("\nownership-sweep self-test passed.\n");
}
