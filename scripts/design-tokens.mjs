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
 * This is deliberately the *cheap* ratchet, and its second px tier is coarse in
 * a way that is documented rather than accidental: in a spacing property the
 * bible's §3 steps are enforced exactly, because the property is right there to
 * read, and everywhere else only the values the bible prints are allowed. The
 * real enforcement is the browser assertion in Task 4 — every gated element's
 * computed spacing on the bible's scale — which is what catches a `26px` in a
 * place this text scan cannot reason about.
 *
 * `node scripts/design-tokens.mjs --self-test` proves every rule still fires.
 * A guard that passes because it looked at nothing is the defect this file
 * exists to remove, so an empty gated list is a failure, not a pass.
 */

import { readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Bible §3's named steps: the only spacing values a surface may write. */
const SPACING_STEPS = new Set([4, 6, 8, 10, 12, 14, 16, 20, 24, 32]);
/** Always allowed anywhere: `1px` is a hairline border, and `0` is no border at all. */
const ALWAYS_PX = new Set([0, 1]);

/**
 * A px here *is* a spacing decision, so it is held to §3's steps alone — the
 * bible's `26px` row rhythm is a density, not a gutter, and 26 is in no step.
 */
const SPACING_PROPERTY =
  /^(?:padding|margin|inset|translate)(?:-|$)|^(?:gap|row-gap|column-gap|top|right|bottom|left)$/;

/**
 * A block whose whole selector list is one of these *defines* tokens, so its
 * literals are the values rather than a surface going around them. A rule that
 * merely mentions the attribute — `[data-shell-palette="x"] .chip`,
 * `:root:not([data-shell-palette="editorial"]) .editor-glass` — is a treatment
 * rule, and its hexes and px are violations like any other.
 */
const DEFINITION_SELECTOR =
  /^(?::root|\[data-shell-palette="[a-z-]+"\]|\.editor-shell-palette-swatch)$/;

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
 * explaining that `7px` was the bug is not that bug, and `calc()` is left alone.
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

function isDefinition(prelude) {
  const head = prelude.trim();
  if (head === "") return false;
  if (/^@theme\b/.test(head)) return true;
  return head.split(",").every((selector) => DEFINITION_SELECTOR.test(selector.trim()));
}

/** Offsets of every definition block's body: `@theme`, and the palette blocks. */
function definitionSpans(text) {
  const spans = [];
  let prelude = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") {
      if (isDefinition(prelude)) {
        let depth = 1;
        let j = i + 1;
        while (j < text.length && depth > 0) {
          if (text[j] === "{") depth += 1;
          else if (text[j] === "}") depth -= 1;
          j += 1;
        }
        spans.push([i + 1, j]);
        i = j;
        prelude = "";
        continue;
      }
      prelude = "";
    } else if (ch === "}" || ch === ";") {
      prelude = "";
    } else {
      prelude += ch;
    }
    i += 1;
  }
  return spans;
}

/** The property name the px at `index` is a value of, or null outside a declaration. */
function declarationProperty(text, index) {
  const start =
    Math.max(text.lastIndexOf("{", index), text.lastIndexOf("}", index), text.lastIndexOf(";", index)) + 1;
  const colon = text.indexOf(":", start);
  if (colon === -1 || colon > index) return null;
  const property = text.slice(start, colon).trim();
  return /^[a-z-]+$/.test(property) ? property : null;
}

function position(text, index) {
  const before = text.slice(0, index);
  return { line: before.split("\n").length, column: index - before.lastIndexOf("\n") };
}

/**
 * Violations in one file's source. `biblePx` are the values the bible prints
 * outside §3's spacing table; the steps and `0`/`1` are allowed without them,
 * so an empty allowlist narrows the rule rather than disabling it.
 */
export function check(relPath, source, biblePx = []) {
  const path = String(relPath ?? "");
  const named = new Set([...biblePx].map(Number));
  const text = scannable(String(source ?? ""), path);
  const definitions = definitionSpans(text);
  const inDefinition = (index) => definitions.some(([from, to]) => index >= from && index < to);
  const isCss = /\.css$/.test(path);
  const found = [];

  for (const match of text.matchAll(HEX)) {
    if (inDefinition(match.index)) continue;
    found.push({ rule: "hex-literal", ...position(text, match.index), text: match[0] });
  }

  for (const match of text.matchAll(PX)) {
    if (inDefinition(match.index)) continue;
    const value = Number(match[1]);
    if (ALWAYS_PX.has(value)) continue;
    const property = isCss ? declarationProperty(text, match.index) : null;
    const spacing = property !== null && SPACING_PROPERTY.test(property);
    if (spacing && !SPACING_STEPS.has(value)) {
      found.push({
        rule: "spacing-px",
        ...position(text, match.index),
        text: `${property}: ${match[0]}`,
      });
    } else if (!spacing && !SPACING_STEPS.has(value) && !named.has(value)) {
      found.push({ rule: "off-scale-px", ...position(text, match.index), text: match[0] });
    }
  }

  return found.sort((a, b) => a.line - b.line || a.column - b.column);
}

/**
 * Proves every rule still fires. Called only from the entry-point gate: an
 * importer in a process whose argv happens to mention `--self-test` must not
 * run it and exit mid-import.
 */
function selfTest() {
  const cases = [
    // A literal is a violation; a role reference is not.
    ["a hex colour is a violation", "a.css", ".x { color: #ff0000; }", 1],
    ["a role reference is not", "a.css", ".x { color: var(--text); }", 0],

    // Tier 1: a spacing property is held to §3's steps, and to nothing else.
    ["an off-scale px spacing is a violation", "a.css", ".x { padding: 7px; }", 1],
    ["an on-scale px spacing is not", "a.css", ".x { padding: 12px; }", 0],
    ["a bible row rhythm is not a spacing step", "a.css", ".x { margin: 26px; }", 1, { biblePx: [26] }],
    ["a hairline border is not", "a.css", ".x { border: 1px solid var(--edge); }", 0],
    ["a zero and a percentage are not", "a.css", ".x { margin: 0; opacity: 100%; }", 0],

    // Tier 2: outside a spacing property, every value the bible prints is allowed.
    ["a bible value outside a spacing property is not", "a.css", ".x { width: 26px; }", 0, { biblePx: [26] }],
    ["the same value is a violation with no allowlist", "a.css", ".x { width: 26px; }", 1],
    ["a rem length is not checked", "a.css", ".x { padding: 1rem; }", 0],
    ["calc() is not checked", "a.css", ".x { width: calc(100% - 7px); }", 0],

    // A definition block holds values; a rule that merely names a palette does not.
    [
      "a palette block keeps its hex",
      "editor-shell.css",
      '[data-shell-palette="graphite"] {\n  --shell-text: #eef9f4;\n}',
      0,
    ],
    [
      "a @theme block defines the scale, so its values are not literals",
      "editor-shell.css",
      "@theme static {\n  --text-xs: 11px;\n  --shadow-raised: 0 12px 28px #0000003d;\n}",
      0,
    ],
    [":root token block is a definition", "a.css", ":root {\n  --vigilia-input-bg: #ffffff;\n}", 0],
    [
      "a rule that only names a palette is not a definition",
      "editor-shell.css",
      '[data-shell-palette="graphite"] .chip {\n  color: #ff0000;\n  padding: 7px;\n}',
      2,
    ],
    [
      "a :not() treatment rule is not a definition",
      "editor-shell.css",
      ':root:not([data-shell-palette="editorial"]) .editor-glass {\n  background: #ff0000;\n}',
      1,
    ],
    ["the same hex outside a definition block is a violation", "a.css", ".x { color: #eef9f4; }", 1],

    ["a comment is not a violation", "a.css", "/* 12px was the step; 7px was the bug */", 0],
    ["an eight-digit hex is one violation, not two", "a.css", ".x { color: #00000059; }", 1],
    ["an id selector is not a hex colour", "a.css", "#app { height: 100%; }", 0],
    ["a tsx literal is checked", "a.tsx", 'const s = { padding: "7px" };', 1],
    ["a tsx comment is not", "a.tsx", "// 7px was the bug\nconst s = {};", 0],
    ["a url in a tsx file is not a comment", "a.tsx", 'const u = "https://x"; const s = "7px";', 1],
    // A masked comment must not move the line it reports: it did, and a
    // multi-line comment is what shifted every line below it.
    [
      "a violation after a multi-line comment keeps its line",
      "a.css",
      "/* one\n two */\n.x { padding: 7px; }",
      1,
      { line: 3 },
    ],
  ];

  let failed = 0;
  const report = (name, ok, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (${detail})`}`);
  };

  for (const [name, path, source, expected, options = {}] of cases) {
    const found = check(path, source, options.biblePx ?? []);
    report(
      name,
      found.length === expected && (options.line === undefined || found[0]?.line === options.line),
      `expected ${expected} violation(s)${options.line === undefined ? "" : ` on line ${options.line}`}, got ${found.length} on ${found.map((v) => v.line).join(",") || "no line"}`,
    );
  }

  // The brief writes its test as `check(...)` calls from an importer. Importing
  // must hand back the function and nothing else — no CLI, no exit, and not the
  // self-test either, whatever the importing process's argv happens to hold.
  const moduleUrl = pathToFileURL(import.meta.filename).href;
  const importer = (extra) =>
    spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(moduleUrl)}); console.log("imported", typeof m.check);`,
        ...extra,
      ],
      { encoding: "utf8" },
    );

  const probe = importer([]);
  report(
    "the export is callable without running the CLI",
    probe.status === 0 && probe.stdout.trim() === "imported function",
    `exit ${probe.status}, stdout ${JSON.stringify(probe.stdout.trim())}, stderr ${JSON.stringify(probe.stderr.trim().slice(0, 120))}`,
  );

  const flagged = importer(["--", "--self-test"]);
  report(
    "an importer's argv cannot trigger the self-test",
    flagged.status === 0 && flagged.stdout.trim() === "imported function",
    `exit ${flagged.status}, stdout ${JSON.stringify(flagged.stdout.trim().slice(0, 120))}`,
  );

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

/**
 * The CLI — self-test included — runs only when this file is the entry point,
 * so an importer gets `check` and no side effects at all. Both sides are
 * resolved through `realpathSync` so a symlinked invocation still matches
 * rather than silently running nothing; Windows compares case-insensitively,
 * because a drive-letter case difference would do the same.
 */
const isEntryPoint = (() => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  const real = (path) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  };
  const invoked = real(resolve(entry));
  const self = real(import.meta.filename);
  return process.platform === "win32"
    ? invoked.toLowerCase() === self.toLowerCase()
    : invoked === self;
})();

if (isEntryPoint) {
  if (process.argv.includes("--self-test")) selfTest();

  const gatedArg = flagValue("--gated");
  const gatedPath = gatedArg === null ? resolve(ROOT, DEFAULT_GATED) : resolve(gatedArg);

  let config;
  try {
    config = JSON.parse(await readFile(gatedPath, "utf8"));
  } catch (error) {
    console.error(`design-tokens: cannot read the gated list ${gatedPath} (${error.code ?? error.message})`);
    process.exit(1);
  }
  // A bare array is the gated list alone, which is what the plan's own
  // empty-list proof writes into a temp file.
  const gated = Array.isArray(config) ? config : config.gated;
  const biblePx = config.biblePx ?? [];
  if (!Array.isArray(gated)) {
    console.error(`design-tokens: ${gatedPath} must hold an array, or an object with a "gated" array`);
    process.exit(1);
  }
  if (!Array.isArray(biblePx) || biblePx.some((value) => !Number.isFinite(value))) {
    console.error(`design-tokens: ${gatedPath}'s "biblePx" must be an array of numbers`);
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
    for (const violation of check(relPath, source, biblePx)) {
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
}
