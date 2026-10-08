#!/usr/bin/env node

/**
 * The ratchet that keeps the design language consumed.
 *
 * The scales in `editor-shell.css`'s `@theme static` block are the design
 * language; a surface that writes `padding: 7px` or `color: #ff0000` has gone
 * around them, and nothing fails — it just renders slightly wrong. This scans
 * the files listed in `design-tokens.gated.json` — the files already converted —
 * and refuses a literal that should have been a token. The list only grows, so
 * the repo never has to be green all at once.
 *
 * `node scripts/design-tokens.mjs --self-test` proves every rule still fires.
 * A guard that passes because it looked at nothing is the defect this file
 * exists to remove, so an empty gated list is a failure, not a pass.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Bible §3's named steps, plus `0` and `1` — `1px` is a hairline border, not a spacing decision. */
const PX_EXEMPT = new Set([0, 1, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32]);

/** Longest alternative first: a 6-digit match on an 8-digit literal would leave two hex digits behind. */
const HEX = /(?<![\w#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g;
const PX = /(?<![\w.])(\d+(?:\.\d+)?)px(?![\w-])/g;

const DEFAULT_GATED = "scripts/design-tokens.gated.json";
const ROOT = resolve(import.meta.dirname, "..");

/**
 * Blank a span to spaces, keeping its newlines. A masked span must not move a
 * reported line number, so whitespace is emptied character for character.
 */
function blank(span) {
  return span.replace(/[^\n]/g, " ");
}

/**
 * The text the rules read: comments and `calc()` blanked out. A comment
 * explaining that `7px` was the bug is not that bug, and rule 3 leaves
 * `calc()` alone.
 */
function scannable(source, relPath) {
  let text = source.replace(/\/\*[\s\S]*?\*\//g, blank);
  if (/\.(tsx?|jsx?)$/.test(relPath)) {
    // `(?<!:)` because `https://` is not a comment, and blanking the rest of
    // that line would hide every violation on it.
    text = text.replace(/(?<!:)\/\/[^\n]*/g, blank);
  }
  const opens = /\bcalc\(/g;
  let match = opens.exec(text);
  while (match !== null) {
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === "(") depth += 1;
      else if (text[i] === ")") depth -= 1;
      i += 1;
    }
    const from = match.index + match[0].length;
    text = text.slice(0, from) + blank(text.slice(from, i - 1)) + text.slice(i - 1);
    match = opens.exec(text);
  }
  return text;
}

/**
 * The one place a hex is not a violation: a block that declares a shell
 * palette, whose values *are* the literals. Region-scoped, not file-scoped —
 * the same hex outside the block is still a violation.
 */
function paletteSpans(text) {
  const spans = [];
  let pending = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      const start = i + 1;
      if (/\[data-shell-palette=/.test(pending)) {
        let depth = 1;
        let j = start;
        while (j < text.length && depth > 0) {
          if (text[j] === "{") depth += 1;
          else if (text[j] === "}") depth -= 1;
          j += 1;
        }
        spans.push([start, j]);
        i = j;
        pending = "";
        continue;
      }
      pending = "";
    } else if (ch === "}") {
      pending = "";
    } else {
      pending += ch;
    }
    i += 1;
  }
  return spans;
}

function position(text, index) {
  const before = text.slice(0, index);
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") };
}

/** Violations in one file's source. The caller owns reading it and reporting where. */
export function check(relPath, source) {
  const path = String(relPath ?? "");
  const text = scannable(String(source ?? ""), path);
  const palette = paletteSpans(text);
  const inPalette = (index) => palette.some(([from, to]) => index >= from && index < to);
  const found = [];
  for (const match of text.matchAll(HEX)) {
    if (inPalette(match.index)) continue;
    found.push({ rule: "hex-literal", ...position(text, match.index), text: match[0] });
  }
  for (const match of text.matchAll(PX)) {
    if (PX_EXEMPT.has(Number(match[1]))) continue;
    found.push({ rule: "off-scale-px", ...position(text, match.index), text: match[0] });
  }
  return found.sort((a, b) => a.line - b.line || a.column - b.column);
}

const SELF_TEST = process.argv.includes("--self-test");

if (SELF_TEST) {
  const cases = [
    // A literal is a violation; a role reference is not.
    ["a hex colour is a violation", "a.css", ".x { color: #ff0000; }", 1],
    ["a role reference is not", "a.css", ".x { color: var(--text); }", 0],
    ["an off-scale px spacing is a violation", "a.css", ".x { padding: 7px; }", 1],
    ["an on-scale px spacing is not", "a.css", ".x { padding: 12px; }", 0],
    // The legitimate literals: a hairline, a zero, a percentage, a hex in the palettes.
    ["a hairline border is not", "a.css", ".x { border: 1px solid var(--edge); }", 0],
    ["a zero and a percentage are not", "a.css", ".x { margin: 0; opacity: 100%; }", 0],
    [
      "a palette block keeps its hex",
      "editor-shell.css",
      '[data-shell-palette="graphite"] {\n  --shell-text: #eef9f4;\n}',
      0,
    ],
    ["the same hex outside a palette block is a violation", "a.css", ".x { color: #eef9f4; }", 1],
    ["a comment is not a violation", "a.css", "/* 12px was the step; 7px was the bug */", 0],
    ["calc() is not checked", "a.css", ".x { width: calc(100% - 7px); }", 0],
    ["a rem length is not checked", "a.css", ".x { padding: 1rem; }", 0],
    ["an eight-digit hex is one violation, not two", "a.css", ".x { color: #00000059; }", 1],
    ["an id selector is not a hex colour", "a.css", "#app { height: 100%; }", 0],
    ["a tsx literal is checked", "a.tsx", 'const s = { padding: "7px" };', 1],
    ["a tsx comment is not", "a.tsx", "// 7px was the bug\nconst s = {};", 0],
    ["a url in a tsx file is not a comment", "a.tsx", 'const u = "https://x"; const s = "7px";', 1],
    // A masked comment must not move the line it reports: it did, and a
    // multi-line comment is what shifted every line below it.
    ["a violation after a multi-line comment keeps its line", "a.css", "/* one\n two */\n.x { padding: 7px; }", 1, 3],
  ];
  let failed = 0;
  for (const [name, path, source, expected, line] of cases) {
    const found = check(path, source);
    const ok = found.length === expected && (line === undefined || found[0]?.line === line);
    if (!ok) failed += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (expected ${expected} violation(s)${line === undefined ? "" : ` on line ${line}`}, got ${found.length} on ${found.map((v) => v.line).join(",") || "no line"})`}`,
    );
  }
  if (failed > 0) {
    console.error(`design-tokens self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log("design-tokens self-test: all cases behave");
  process.exit(0);
}

function flagValue(name) {
  const at = process.argv.indexOf(name);
  if (at === -1) return null;
  const value = process.argv[at + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`design-tokens: ${name} needs a path`);
    process.exit(1);
  }
  return value;
}

const gatedArg = flagValue("--gated");
const gatedPath = gatedArg === null ? resolve(ROOT, DEFAULT_GATED) : resolve(gatedArg);

let gated;
try {
  gated = JSON.parse(await readFile(gatedPath, "utf8"));
} catch (error) {
  console.error(`design-tokens: cannot read the gated list ${gatedPath} (${error.code ?? error.message})`);
  process.exit(1);
}
if (!Array.isArray(gated)) {
  console.error(`design-tokens: ${gatedPath} must hold a JSON array of repo-relative paths`);
  process.exit(1);
}
if (gated.length === 0) {
  // The whole point of the ratchet: a list nobody has added to yet proves nothing.
  console.error(`design-tokens: the gated list ${gatedPath} is empty; the guard would check nothing`);
  process.exit(1);
}

let violations = 0;
for (const entry of gated) {
  const relPath = String(entry);
  let source;
  try {
    source = await readFile(resolve(ROOT, relPath), "utf8");
  } catch (error) {
    console.error(`design-tokens: ${relPath} cannot be read (${error.code ?? error.message})`);
    violations += 1;
    continue;
  }
  for (const violation of check(relPath, source)) {
    console.error(
      `${relPath}:${violation.line}:${violation.column} ${violation.rule} ${violation.text}`,
    );
    violations += 1;
  }
}
if (violations > 0) {
  console.error(`design-tokens: ${violations} violation(s) across ${gated.length} gated file(s)`);
  process.exit(1);
}
console.log(`design-tokens: ${gated.length} gated file(s) clean`);
