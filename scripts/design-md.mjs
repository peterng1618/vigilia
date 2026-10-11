#!/usr/bin/env node

/**
 * The three checks that keep DESIGN.md honest.
 *
 * `--lint` — `@google/design.md`'s own lint, run through this file rather than as
 * one link of a shell chain. The linter's exit code is worthless — 0 for clean
 * and 0 for warnings-only alike, and `npx … lint` returns 0 with no stdout at all
 * — so a `&&` chain could never notice a warning. This spawns the *installed*
 * binary, parses the JSON summary it prints, and fails on any error or warning.
 * A report it cannot read fails too, never defaults to clean. Infos are
 * permitted and printed.
 *
 * `--sync` — the front matter's `spacing`, `rounded` and `typography` groups and
 * `editor-shell.css`'s `@theme static` block declare the same tokens with the
 * same values. The front matter is written *from* the CSS (design D4), and this
 * is what stops the two parting: a step added to one and not the other, or a
 * value edited in one, is a finding rather than a surface that renders slightly
 * wrong with no error anywhere. Only that one block is read — not `:root`, not
 * Tailwind's own defaults — because `@theme static` is where this repo declares
 * the scale (`editor-shell.css`, "It lives in `@theme`, not on a plain `:root`").
 *
 * `--cite` — the `§N` citations keep resolving. `docs/design/design-language.md`
 * was retired for this file, and its ten sections (with `§7` subdivided 1–8)
 * survive as `<!-- §N -->` markers so the repo's existing citations need no
 * change (D2). Three rules hold that: every number in the canonical range has a
 * marker; every citation whose number is in that range resolves to a marker; and
 * every marker is claimed by at least one citation, so a section nothing reads is
 * reported rather than forgotten. Rule 2 is logically a subset of rule 1 for
 * in-range numbers — rule 1 needs no citation to fire, which is why it exists —
 * but it is kept because it names the *citation*, and its per-`§N` reason is
 * merged with rule 1's rather than printed as a second line.
 *
 * The canonical range lives HERE and is never read from DESIGN.md: if it were
 * read from the file, deleting a marker would shrink the range it is checked
 * against and the deletion would pass. `§1`–`§10` with `§7.1`–`§7.8` is the
 * bible's own numbering (D3); every other `§N` in the repo belongs to the
 * redesign spec and is ignored.
 *
 * Both checks fail on their own findings, never on a proxy for them: the
 * `@google/design.md` linter's exit code is unusable — 0 for clean and 0 for
 * warnings-only alike — so this file reads the facts itself.
 *
 * `node scripts/design-md.mjs --self-test` proves every rule still fires. A check
 * that passes because it looked at nothing is the defect these exist to remove,
 * so an unparseable file is a failure, not an empty pass.
 */

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DESIGN_REL = "DESIGN.md";
const CSS_REL = "src/web/packages/editor/src/editor-shell/editor-shell.css";

/** The trees a citation may live in. DESIGN.md itself is not scanned, so it
 *  cannot claim its own markers with the citations in its prose. */
const CITE_TREES = ["docs", "src", "scripts"];
const CITE_EXTENSIONS = /\.(?:ts|tsx|js|jsx|mjs|cjs|md|json|css|html|txt|ya?ml)$/;

/**
 * The check's own files, skipped: they live in the scanned trees and their
 * fixture strings (`§1`, `§5`, `§9`) would otherwise claim markers the prose
 * does not — a check must not count its own fixtures as evidence.
 */
const CITE_EXCLUDE = new Set([
  "scripts/design-md.mjs",
  "src/web/tests/scripts/design-md.test.ts",
]);

/**
 * `docs/design/design-language.md`'s numbering: `§1`–`§10`, with sub-numbers
 * only under `§7`. The single source of truth for what a citation may resolve
 * against — never derived from DESIGN.md's markers (see the header).
 */
export const CITE_NUMBERS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8",
];

/**
 * Markers no citation in the repo claims, each with the reason it is allowed to
 * stand unclaimed. Empty today — every one of the 18 sections is cited by name
 * somewhere in `docs/`, `src/` or `scripts/`. A genuinely uncited section is
 * recorded here with its reason rather than by dropping the rule.
 */
export const UNCITED_OK = [];

/** `spacing` → `--space-<key>`, `rounded` → `--radius-<key>`, `typography` →
 *  `--text-<key>` (the front matter key is the bare suffix, per design D4). */
const SYNC_PREFIXES = ["--space-", "--radius-", "--text-"];

function stripComment(line) {
  return line.replace(/\s+#.*$/, "");
}

/**
 * The YAML to read. The real file fences it with `---`; a fixture that passes
 * bare `spacing:`/`typography:` text (the brief's own shape) is read whole, and
 * yields nothing where it has no group to find. Only `DESIGN.md` uses the fenced
 * form, so the fallback cannot be reached by the CLI.
 */
function frontMatterText(design) {
  const text = String(design ?? "");
  if (!/^---[ \t]*\r?\n/.test(text)) return text;
  const rest = text.slice(text.indexOf("\n") + 1);
  const end = rest.search(/^---[ \t]*\r?$/m);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The three token groups the format carries, read line-wise from the front
 * matter. A deliberately small reader for a file this repo authors: top-level
 * `key:` opens a group, two-space `key: value` is a spacing/rounded step, and
 * under `typography` a two-space `key:` opens an entry whose four-space
 * `fontSize`/`lineHeight` carry its values. Any other key (`omitted`, `name`,
 * `fontFamily`) is ignored, not an error.
 */
function parseFrontMatter(design) {
  const groups = {
    spacing: new Map(),
    rounded: new Map(),
    typography: new Map(),
  };
  let group = null;
  let entry = null;
  for (const raw of frontMatterText(design).split(/\r?\n/)) {
    const line = stripComment(raw);
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    if (indent === 0) {
      const open = /^([A-Za-z0-9_-]+)\s*:\s*$/.exec(trimmed);
      group = open ? open[1] : null;
      entry = null;
      continue;
    }
    if (group === "spacing" || group === "rounded") {
      const step = /^([^\s:]+)\s*:\s*(.+)$/.exec(trimmed);
      if (step) groups[group].set(step[1], step[2].trim());
    } else if (group === "typography") {
      if (indent <= 2) {
        const open = /^([^\s:]+)\s*:\s*$/.exec(trimmed);
        if (open) {
          entry = { fontSize: undefined, lineHeight: undefined };
          groups.typography.set(open[1], entry);
        }
      } else if (entry !== null) {
        const field = /^(fontSize|lineHeight)\s*:\s*(.+)$/.exec(trimmed);
        if (field) entry[field[1]] = field[2].trim();
      }
    }
  }
  return groups;
}

/** Front-matter tokens by their CSS custom-property name, value stringed. */
function frontMatterTokens(design) {
  const groups = parseFrontMatter(design);
  const tokens = new Map();
  for (const [key, value] of groups.spacing) tokens.set(`--space-${key}`, String(value));
  for (const [key, value] of groups.rounded) tokens.set(`--radius-${key}`, String(value));
  for (const [key, entry] of groups.typography) {
    if (entry.fontSize !== undefined) tokens.set(`--text-${key}`, String(entry.fontSize));
    if (entry.lineHeight !== undefined) tokens.set(`--text-${key}--line-height`, String(entry.lineHeight));
  }
  return tokens;
}

/** The body of the `@theme static { … }` block, brace-matched. "" when absent. */
function themeStaticBlock(css) {
  const text = String(css ?? "");
  const at = /@theme\s+static\s*\{/.exec(text);
  if (at === null) return "";
  let depth = 1;
  let i = at.index + at[0].length;
  const start = i;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return text.slice(start, i - 1);
}

/** Every declaration in the `@theme static` block, comments stripped. */
function cssTokens(css) {
  const body = themeStaticBlock(css).replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map();
  for (const match of body.matchAll(/--([A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(`--${match[1]}`, match[2].trim());
  }
  return tokens;
}

const inScope = (name) => SYNC_PREFIXES.some((prefix) => name.startsWith(prefix));

const normalise = (value) => String(value).trim().replace(/\s+/g, " ");

/**
 * The front matter and the stylesheet declare the same in-scope tokens with the
 * same values. A name in one and not the other is a finding; so is a value that
 * differs. `what` is the token without its leading `--` (e.g. `space-16`,
 * `text-md--line-height`).
 */
export function checkSync(read, _opts = {}) {
  const want = frontMatterTokens(read?.design);
  const have = cssTokens(read?.css);
  const names = new Set([...want.keys(), ...have.keys()].filter(inScope));
  const findings = [];
  for (const name of [...names].sort()) {
    const what = name.slice(2);
    const inFront = want.get(name);
    const inCss = have.get(name);
    if (inFront !== undefined && inCss === undefined) {
      findings.push({
        what,
        why: `\`--${what}\` is declared in DESIGN.md's front matter but not in editor-shell.css's \`@theme static\``,
      });
    } else if (inFront === undefined && inCss !== undefined) {
      findings.push({
        what,
        why: `\`--${what}\` is declared in editor-shell.css's \`@theme static\` but not in DESIGN.md's front matter`,
      });
    } else if (normalise(inFront) !== normalise(inCss)) {
      findings.push({
        what,
        why: `\`--${what}\` is \`${inFront}\` in DESIGN.md's front matter but \`${inCss}\` in editor-shell.css's \`@theme static\``,
      });
    }
  }
  return findings;
}

const MARKER = /<!--\s*§(\d+(?:\.\d+)?)\s*-->/g;
const CITATION = /§(\d+(?:\.\d+)?)/g;

function markersIn(design) {
  const found = new Set();
  for (const match of String(design ?? "").matchAll(MARKER)) found.add(match[1]);
  return found;
}

function citedIn(sources, known) {
  const found = new Set();
  for (const source of sources ?? []) {
    for (const match of String(source).matchAll(CITATION)) {
      if (known.has(match[1])) found.add(match[1]);
    }
  }
  return found;
}

/** `§N` before `§N.M`, numeric; anything else last. */
function rank(what) {
  const match = /^§(\d+)(?:\.(\d+))?$/.exec(what);
  if (match === null) return [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  return [Number(match[1]), match[2] === undefined ? -1 : Number(match[2])];
}

function orderFindings(entries) {
  const byWhat = new Map();
  for (const { what, reason } of entries) {
    const reasons = byWhat.get(what) ?? [];
    reasons.push(reason);
    byWhat.set(what, reasons);
  }
  return [...byWhat.entries()]
    .map(([what, reasons]) => ({ what, why: reasons.join("; ") }))
    .sort((a, b) => {
      const [am, an] = rank(a.what);
      const [bm, bn] = rank(b.what);
      return am - bm || an - bn;
    });
}

/**
 * The three citation rules. `what` is the citation (`§9`); a number missing its
 * marker gathers the reason from whichever rules caught it. `opts.numbers` and
 * `opts.uncitedOk` default to the constants and exist so a self-test can shrink
 * the range to one number; the real CLI never sets them.
 */
export function checkCitations(read, opts = {}) {
  const numbers = opts.numbers ?? CITE_NUMBERS;
  const uncitedOk = new Set(opts.uncitedOk ?? UNCITED_OK);
  const known = new Set(numbers);
  const markers = markersIn(read?.design);
  const cited = citedIn(read?.citations, known);
  const entries = [];

  for (const number of numbers) {
    if (!markers.has(number)) {
      entries.push({
        what: `§${number}`,
        reason: `\`§${number}\` is in the canonical range (§1–§10, §7.1–§7.8) but DESIGN.md carries no \`<!-- §${number} -->\` marker`,
      });
    }
  }
  for (const number of cited) {
    if (!markers.has(number)) {
      entries.push({
        what: `§${number}`,
        reason: `the repo cites \`§${number}\`, but DESIGN.md carries no marker to resolve it`,
      });
    }
  }
  for (const number of markers) {
    if (!known.has(number) || cited.has(number) || uncitedOk.has(number)) continue;
    entries.push({
      what: `§${number}`,
      reason: `\`§${number}\` is a marker in DESIGN.md that no citation in \`docs/\`, \`src/\` or \`scripts/\` claims`,
    });
  }
  return orderFindings(entries);
}

/**
 * The citation sources: the tracked text files under the citation trees that
 * carry a `§`. The list comes from `git ls-files`, not a directory walk, so the
 * check reads tracked files only — untracked scratch under `src/` (a captured
 * `.vitest` report, an `.agent-scratch` note) cannot make the gate's verdict
 * depend on what happens to be lying on the disk. `git` failing is a failure,
 * not an empty read.
 */
function trackedPaths() {
  try {
    return execFileSync("git", ["ls-files", "--", ...CITE_TREES], { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .filter((line) => line !== "");
  } catch (error) {
    console.error(`design-md: cannot list tracked files (${error.message})`);
    process.exit(1);
  }
}

async function collectCitations(out) {
  for (const relPath of CITE_EXCLUDE) {
    if (!existsSync(resolve(ROOT, relPath))) {
      console.error(`design-md: CITE_EXCLUDE names \`${relPath}\`, which does not exist; a rename has re-armed the fixtures this exclusion removes`);
      process.exit(1);
    }
  }
  for (const relPath of trackedPaths()) {
    if (CITE_EXCLUDE.has(relPath) || !CITE_EXTENSIONS.test(relPath)) continue;
    const text = await readFile(resolve(ROOT, relPath), "utf8").catch(() => null);
    if (text !== null && text.includes("§")) out.push(text);
  }
}

/**
 * A file that cannot be read is a failure, not an empty read: `checkSync` and
 * `checkCitations` would then compare against nothing and pass.
 */
async function readOrFail(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    console.error(`design-md: cannot read ${label} at ${path} (${error.code ?? error.message})`);
    process.exit(1);
  }
}

/**
 * Proves every rule still fires, over inline fixtures. Called only from the
 * entry point: an importer whose argv happens to mention `--self-test` must not
 * run it and exit mid-import.
 */
function selfTest() {
  let failed = 0;
  const report = (name, ok, detail) => {
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (${detail})`}`);
  };
  const sync = (name, read, expected) => {
    const got = checkSync(read).map((f) => f.what);
    report(name, JSON.stringify(got) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  };
  const cite = (name, read, opts, expected, whyIncludes) => {
    const found = checkCitations(read, opts);
    const got = found.map((f) => f.what);
    const why = found.map((f) => f.why).join(" | ");
    report(name, JSON.stringify(got) === JSON.stringify(expected) && (whyIncludes === undefined || why.includes(whyIncludes)), `expected ${JSON.stringify(expected)}${whyIncludes ? ` with why ~ ${JSON.stringify(whyIncludes)}` : ""}, got ${JSON.stringify(got)} (${why})`);
  };

  // --sync: a value that differs, a name on one side only, :root ignored.
  sync("a value the stylesheet and the front matter disagree on", { css: "@theme static {\n  --space-16: 15px;\n}\n", design: "spacing:\n  16: 16px\n" }, ["space-16"]);
  sync("a name only the front matter declares", { css: "", design: "spacing:\n  16: 16px\n" }, ["space-16"]);
  sync("a name only the stylesheet declares", { css: "@theme static {\n  --space-40: 40px;\n}\n", design: "" }, ["space-40"]);
  sync("the line-height companion is its own token", { css: "@theme static {\n  --text-md: 13px;\n  --text-md--line-height: 1.5;\n}\n", design: "typography:\n  md:\n    fontSize: 13px\n    lineHeight: 1.3\n" }, ["text-md--line-height"]);
  sync("agreement is not a finding", { css: "@theme static {\n  --space-16: 16px;\n}\n", design: "spacing:\n  16: 16px\n" }, []);
  sync("reads @theme static, not :root", { css: "@theme static {\n  --space-16: 16px;\n}\n:root {\n  --space-16: 99px;\n}\n", design: "spacing:\n  16: 16px\n" }, []);
  sync("a name outside the three groups is not read", { css: "@theme static {\n  --spacing: 0.25rem;\n  --shadow-raised: 0 12px 28px #000;\n}\n", design: "" }, []);

  // --cite: each rule fires; a non-range number is ignored.
  cite("rule 1 — a range number with no marker", { design: "## Copy\n\nNo marker here.\n" }, { numbers: ["9"], uncitedOk: [] }, ["§9"], "canonical range");
  cite("rule 2 — a citation with no marker to resolve it", { design: "", citations: ["§9 is here"] }, { numbers: ["9"], uncitedOk: [] }, ["§9"], "the repo cites");
  cite("rule 3 — a marker no citation claims", { design: "<!-- §9 -->\n", citations: [] }, { numbers: ["9"], uncitedOk: [] }, ["§9"], "no citation");
  cite("a non-range number is ignored", { design: "<!-- §9 -->\n", citations: ["§9", "§75", "§141"] }, { numbers: ["9"], uncitedOk: [] }, []);
  cite("a claimed marker and a cited number agree", { design: "<!-- §9 -->\n", citations: ["DESIGN.md §9"] }, { numbers: ["9"], uncitedOk: [] }, []);
  cite("UNCITED_OK silences rule 3 only", { design: "<!-- §9 -->\n", citations: [] }, { numbers: ["9"], uncitedOk: ["9"] }, []);

  // --lint: the counts are read, and every shape they cannot be read from fails
  // closed rather than defaulting to clean.
  const lintCase = (name, reportValue, expected) => {
    const got = lintCounts(reportValue);
    const ok = expected.ok === false
      ? got.ok === false
      : got.ok === true && got.errors === expected.errors && got.warnings === expected.warnings;
    report(name, ok, JSON.stringify(got));
  };
  lintCase("a clean summary is read", { summary: { errors: 0, warnings: 0 } }, { ok: true, errors: 0, warnings: 0 });
  lintCase("a warning is not rounded to clean", { summary: { errors: 0, warnings: 1 } }, { ok: true, errors: 0, warnings: 1 });
  lintCase("a report with no summary fails closed", { findings: [] }, { ok: false });
  lintCase("a summary that is not an object fails closed", { summary: 0 }, { ok: false });
  lintCase("a null summary fails closed", { summary: null }, { ok: false });
  lintCase("an array summary fails closed", { summary: [] }, { ok: false });
  lintCase("a count that is not a number fails closed", { summary: { errors: 0, warnings: "0" } }, { ok: false });
  lintCase("a missing count fails closed", { summary: { errors: 0 } }, { ok: false });
  lintCase("a non-object report fails closed", "lint output", { ok: false });

  if (failed > 0) {
    console.error(`design-md self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log("design-md self-test: all cases behave");
  process.exit(0);
}

/**
 * The installed linter's CLI, read from its own `bin` metadata rather than
 * invoked through `npx`: `npx … lint` exits 0 with no stdout here, so neither
 * its code nor its output can be trusted through that shim. Two candidates — the
 * workspace's `node_modules` then the repo root's — so a hoist change does not
 * silently break the gate.
 */
const LINTER_DIRS = [
  "src/web/node_modules/@google/design.md",
  "node_modules/@google/design.md",
];

function linterCli() {
  for (const dir of LINTER_DIRS) {
    const pkgPath = resolve(ROOT, dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const bin = JSON.parse(readFileSync(pkgPath, "utf8")).bin?.["design.md"];
    if (typeof bin === "string") return resolve(ROOT, dir, bin);
  }
  console.error("design-md: @google/design.md is not installed; run `npm install` in src/web/");
  process.exit(1);
}

/**
 * The counts a parsed lint report carries, or the reason it carries none. Fails
 * closed on every shape it cannot read — no `summary`, a `summary` that is not an
 * object, counts that are not finite numbers — because a default of "clean" here
 * would be the same vacuity `--lint` exists to remove, re-implemented inside the
 * guard. It never guesses a count.
 */
export function lintCounts(report) {
  const summary = report?.summary;
  if (typeof summary !== "object" || summary === null || Array.isArray(summary)) {
    return { ok: false, why: "the report carries no `summary` object" };
  }
  const { errors, warnings } = summary;
  if (!Number.isFinite(errors) || !Number.isFinite(warnings)) {
    return {
      ok: false,
      why: `the summary carries no finite counts (errors: ${JSON.stringify(errors)}, warnings: ${JSON.stringify(warnings)})`,
    };
  }
  return { ok: true, errors, warnings };
}

/**
 * `@google/design.md`'s own lint. Only the summary it prints decides: its exit
 * code is 0 for clean and 0 for warnings-only alike, so a shell chain could pass
 * on a warning. Infos are permitted and printed; an error or a warning fails. A
 * crash, unparseable output, or a report whose counts cannot be read all fail —
 * a lint that examined nothing, or whose verdict could not be read, must not
 * come out as clean.
 */
function checkLint() {
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [linterCli(), "lint", DESIGN_REL], {
      cwd: ROOT,
      encoding: "utf8",
    });
  } catch (error) {
    console.error(`design-md: the linter could not run (${error.message})`);
    process.exit(1);
  }
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    console.error("design-md: the linter printed no JSON to read; the check would find nothing");
    process.exit(1);
  }
  for (const finding of Array.isArray(report?.findings) ? report.findings : []) {
    const line = `${finding.rule ?? "lint"}: ${finding.message}`;
    if (finding.severity === "info") console.log(line);
    else console.error(line);
  }
  const counts = lintCounts(report);
  if (!counts.ok) {
    console.error(`design-md: cannot read the linter's counts — ${counts.why}; the check must not read this as clean`);
    process.exit(1);
  }
  if (counts.errors > 0 || counts.warnings > 0) {
    console.error(`design-md: lint reports ${counts.errors} error(s) and ${counts.warnings} warning(s) in ${DESIGN_REL}`);
    process.exit(1);
  }
  console.log(`design-md: lint clean in ${DESIGN_REL} (0 errors, 0 warnings)`);
  process.exit(0);
}

function printFindings(findings, label) {
  for (const finding of findings) console.error(`${finding.what}: ${finding.why}`);
  if (findings.length > 0) {
    console.error(`design-md: ${findings.length} finding(s) in ${label}`);
    return 1;
  }
  console.log(`design-md: ${label} clean`);
  return 0;
}

/**
 * The CLI — self-test included — runs only when this file is the entry point, so
 * an importer gets the exported functions and no side effects. Both sides are
 * resolved through `realpathSync` so a symlinked invocation still matches;
 * Windows compares case-insensitively, because a drive-letter case difference
 * would otherwise run nothing.
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

  if (process.argv.includes("--lint")) checkLint();

  if (process.argv.includes("--sync")) {
    const design = await readOrFail(resolve(ROOT, DESIGN_REL), DESIGN_REL);
    const css = await readOrFail(resolve(ROOT, CSS_REL), CSS_REL);
    process.exit(printFindings(checkSync({ design, css }), `DESIGN.md and editor-shell.css`));
  }

  if (process.argv.includes("--cite")) {
    const design = await readOrFail(resolve(ROOT, DESIGN_REL), DESIGN_REL);
    const citations = [];
    await collectCitations(citations);
    if (citations.length === 0) {
      console.error("design-md: no citation sources were read; the check would look at nothing");
      process.exit(1);
    }
    process.exit(printFindings(checkCitations({ design, citations }), `${citations.length} citation source(s)`));
  }

  console.error("design-md: pass --lint, --sync, --cite or --self-test");
  process.exit(1);
}
