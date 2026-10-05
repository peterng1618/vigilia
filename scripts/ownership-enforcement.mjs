#!/usr/bin/env node
/**
 * Enforcement sweep: for each concept the ownership map names, find where the
 * rule is actually *enforced*, and report the concepts whose enforcement does not
 * live in the module the map names.
 *
 * Why this is a different script from `ownership-sweep.mjs`, and why both exist:
 *
 *   - `ownership-sweep.mjs` asks **"does this concept have one decider?"** It
 *     starts from the map and looks for a second site re-spelling a vocabulary.
 *     It is a necessary condition, and it is what caught the Arrange menu.
 *   - **This one asks "is the map's owner the module that decides?"** It starts
 *     from a concept's *name* and looks for the code that enforces it, then
 *     compares. A concept enforced in a module the map does not name is either a
 *     missing row or a **wrong owner**, and only a person can tell those apart.
 *
 * That second question is the one that matters as features grow. A map can be
 * perfectly one-owner and still have ossified: the row says `panel.ts` owns shape
 * material fields, and `panel.ts` faithfully enforces a rule that ought to live
 * somewhere else. `ownership-sweep.mjs` cannot see that — it has no way to know
 * an owner is wrong, only whether it is unique. **A green sweep is a warrant for
 * uniqueness, not for correctness.**
 *
 * The signal is a concept keyword appearing in a module the map does not name for
 * it. That is deliberately loose: it produces many false positives, because a
 * concept's word legitimately appears in its consumers, its tests, its prose and
 * its call sites. **It is a reading list, not a verdict list** — the output is
 * sorted by how strong the signal is so a human starts at the top.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MAP = join(ROOT, "docs/architecture/ownership.md");
const SRC = join(ROOT, "src/web/packages");

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

function parseMap() {
  const rows = [];
  for (const line of readFileSync(MAP, "utf8").split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const [concept, ownerCell] = cells;
    if (concept === "Concept" || concept === "" || ownerCell === "Owner") continue;
    const owners = [...ownerCell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (owners.length === 0) continue;
    rows.push({ concept, owners, cell: ownerCell });
  }
  return rows;
}

/**
 * The distinctive words of a concept, as a regex. A concept phrased in prose
 * ("Shape material fields (fill, stroke, border, shadow, radius)") carries its
 * own vocabulary in the parentheses, and those words are the ones worth searching
 * for — "fields", "material" and "shape" are not.
 */
function keywordsOf(concept) {
  const inParens = [...concept.matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/[,;/]/));
  const words = [...concept.matchAll(/[A-Za-z][A-Za-z0-9]{3,}/g)].map((m) => m[0]);
  const stop = /^(the|and|for|from|with|that|this|when|where|which|into|its|their|they|them|than|then|only|also|does|live|asks|asked|used|per|one|two|non|any|all|not|but|own|row|rows|name|names|named|file|files|path|paths|module|modules|layer|layers|state|list|lists|data|type|types|value|values|code|read|reads|writes|write|another|fields|field|property|properties|thing|things|part|parts|piece|pieces)$/i;
  const kept = [...inParens, ...words]
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stop.test(w))
    .map((w) => w.toLowerCase());
  return [...new Set(kept)];
}

const files = walk(SRC);
const sources = new Map(
  files.map((f) => [posix(relative(ROOT, f)).replace(/^src\/web\//, ""), readFileSync(f, "utf8")]),
);

/**
 * Modules that name every concept by construction, so a hit in one is not
 * evidence of anything.
 *
 * `ui-copy.ts` is the case that proved it: it held the top hit for almost every
 * row — 13 mentions of `theme`, 21 of `panel`, 10 of `artboard` — because copy
 * is *about* the concepts, and a field label necessarily contains the field's
 * name. Counting that as enforcement evidence would drown the real signal in the
 * one file guaranteed to match.
 *
 * This is a judgement, and it is the only one in the script. It is listed rather
 * than inferred so a reader can disagree with it: a concept genuinely *decided*
 * in one of these would be missed.
 */
const NAMES_CONCEPTS = /(^|\/)(ui-copy|copy)\.[jt]sx?$/;

const rows = parseMap();
const findings = [];

/**
 * The map writes `editor/src/...`; the source keys are `packages/editor/src/...`
 * because the workspace prefix is stripped. Comparing them directly made every
 * map-named owner look like somewhere-else, which is how the first run reported
 * a concept's own owner as the top hit for 82 of 92 rows.
 *
 * The obvious repair — match on a suffix — is too loose in the other direction:
 * a row naming `glass.ts` then claimed every `glass.ts`, and the run found
 * nothing at all. So: **strip the workspace prefix from the map's path and
 * compare path segments**, which is exact for the `src/...` rows and only falls
 * back to a basename match for a row that names a bare file.
 */
function ownedBy(owners, file) {
  return owners.some((owner) => {
    // Test the trailing slash BEFORE stripping it. Stripping first is what made
    // a directory owner indistinguishable from a file owner, so
    // `selection-inspector/index.ts` came back as a hit on the
    // `selection-inspector/` row that owns it.
    const isDir = owner.endsWith("/");
    const trimmed = owner.replace(/\/$/, "").replace(/^\.?\//, "");
    if (isDir && file.includes(trimmed)) return true;
    return file === trimmed || file.endsWith(`/${trimmed}`);
  });
}

/**
 * Modules that compose everything and therefore mention everything.
 *
 * `editor-session.ts` wires the session's parts together, so it names selection,
 * charts, geometry, text, theme and artboard in the ordinary course of being the
 * thing that holds them. Counting it as enforcing each of those concepts would
 * flag nearly every row, which is what the first tuned run did.
 */
const COMPOSES = /(^|\/)(editor-session|editor-main|editor-interaction|live-runtime)\.[jt]sx?$/;

for (const row of rows) {
  const keywords = keywordsOf(row.concept);
  if (keywords.length === 0) continue;
  const owned = row.owners;

  const elsewhere = [];
  for (const [file, source] of sources) {
    if (ownedBy(owned, file)) continue;
    if (NAMES_CONCEPTS.test(file)) continue;
    if (COMPOSES.test(file)) continue;
    let score = 0;
    const matched = [];
    for (const k of keywords) {
      const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
      const hits = (source.match(re) ?? []).length;
      if (hits === 0) continue;
      score += Math.min(hits, 5);
      matched.push(`${k}×${Math.min(hits, 5)}`);
    }
    if (score >= 6) elsewhere.push({ file, score, matched });
  }

  if (elsewhere.length > 0) {
    elsewhere.sort((a, b) => b.score - a.score);
    findings.push({
      concept: row.concept,
      mapNames: owned,
      keywords,
      elsewhere: elsewhere.slice(0, 4),
    });
  }
}

const report = {
  mapRows: rows.length,
  sourceFiles: sources.size,
  conceptsWithEnforcementElsewhere: findings.length,
  findings: findings.sort((a, b) => b.elsewhere[0].score - a.elsewhere[0].score),
  note:
    "A READING LIST, not verdicts. A concept's word appearing in a module the map " +
    "does not name is normal for consumers, call sites, prose and re-exports. What " +
    "this cannot do is judge whether an owner is CORRECT — only whether enforcement " +
    "sits somewhere the map has not accounted for. Both questions are real and they " +
    "are independent: ownership-sweep.mjs answers the first, this seeds the second.",
};
process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);

if (process.argv.includes("--self-test")) {
  const checks = [
    // The parenthesised vocabulary is the concept's own: those words are what a
    // second owner would have to re-spell, so they must survive.
    ["a concept's own vocabulary is kept", (() => {
      const k = keywordsOf("Shape material fields (fill, stroke, border, shadow, radius)");
      return ["fill", "stroke", "border", "shadow", "radius"].every((w) => k.includes(w));
    })()],
    // Prose words are not, and the stoplist is what removes them.
    ["prose words are dropped", (() => {
      const k = keywordsOf("Shape material fields (fill, stroke, border, shadow, radius)");
      return !k.includes("fields");
    })()],
    ["a directory owner is not violated by its own children", ownedBy(["editor/src/selection-inspector/"], "packages/editor/src/selection-inspector/index.ts")],
    ["a file owner is not violated by itself", ownedBy(["editor/src/object-actions.ts"], "packages/editor/src/object-actions.ts")],
    ["a genuinely different file is not excused", !ownedBy(["editor/src/object-actions.ts"], "packages/editor/src/editor-shell/shell-layout.tsx")],
    ["the real run produced a reading list", findings.length > 0],
  ];
  const failed = checks.filter(([, ok]) => !ok);
  for (const [name, ok] of checks) process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${name}\n`);
  if (failed.length > 0) {
    process.stderr.write(`\nownership-enforcement self-test failed: ${failed.map(([n]) => n).join(", ")}\n`);
    process.exit(1);
  }
  process.stdout.write("\nownership-enforcement self-test passed.\n");
}
