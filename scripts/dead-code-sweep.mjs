#!/usr/bin/env node
/**
 * Dead-code sweep: build the importer graph, and report what nothing reaches.
 *
 * Four rounds of refactoring across the editor, player and host leave surfaces
 * that no product code mounts but that stay green because their own test file
 * imports them. That class is invisible to both obvious questions — it is not
 * "no importer" (a test imports it) and not "no file" (the file is right there)
 * — and it is the class this repo actually produces: `font-picker.tsx` is kept
 * alive by a 984-line test and no mount, filed twice as `vg-268` and `vg-283`.
 *
 * What this is NOT: a verdict. Every hit is a candidate, printed with the search
 * that found it, and a human or an agent has to say whether the code is dead.
 * The false-positive engine in this repo is *string-resolved vocabulary* —
 * `data-vigilia-*` attributes, `--vigilia-*`/`--shell-*` custom properties,
 * `KIND_*` registries, Fabric JSON keys and classes composed by template
 * literal — all of which are live with no importer anywhere. None of it is
 * visible to this graph, and a literal search that comes back empty is not
 * proof of death. The same goes for a file's *content*: `design-md.mjs`,
 * `design-tokens.mjs`, `ownership-sweep.mjs` and `reuse-gate.mjs` read the
 * source tree as data, so a constant nothing imports can still redden a gate.
 *
 * Six candidate kinds, and each one records the search that found it:
 *
 *   - `test-only-consumer` — a module every importer of which is a test file.
 *   - `no-importer-file`   — a module nothing imports, once entry points and
 *                            the files vitest/Playwright discover by glob are
 *                            set aside. Miss the glob and this reports the
 *                            entire 244-file suite as dead.
 *   - `dead-export`        — a top-level export no production file imports *and*
 *                            which its own module never uses either. The symbol
 *                            is dead. A test import is not a consumer.
 *   - `redundant-export`   — the same, except its own declaring file does use it.
 *                            **The symbol is live and only the `export` keyword
 *                            is unnecessary** — which is the opposite remedy to
 *                            the kind above, and the reason they are two kinds
 *                            rather than one. Reporting them together as "unused
 *                            exports" invites a phase that deletes a symbol that
 *                            is in use, or claims a reduction that never lands.
 *   - `barrel-only-export` — an export whose only importer is its own package's
 *                            `index.ts`, and which no one then takes from it.
 *   - `unreachable-branch` — a member of a closed string-literal union whose
 *                            literal appears nowhere else in production code.
 *                            Literal-text only: a discriminant composed at
 *                            runtime is invisible here, which is the known
 *                            false positive of this kind.
 *
 * Usage:  node scripts/dead-code-sweep.mjs [--json <path>] [--self-test]
 *
 *   --json <path>  the CANDIDATE report, written in every mode, `--self-test`
 *                  included. The self-test result never goes to this path: its
 *                  own destination is fixed at
 *                  `src/web/test-results/dead-code-sweep-self-test.json`, so a
 *                  run that asks for both cannot silently overwrite the counts
 *                  a later phase is budgeting against.
 *   --self-test    run the checks below and exit non-zero on any failure. Both
 *                  this file and the `--json` one are overwritten with an
 *                  incomplete marker before the run starts (see below), so a
 *                  crash cannot leave a previous run's result on disk.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WEB = join(ROOT, "src/web");

const argv = process.argv.slice(2);
const jsonAt = argv.indexOf("--json");
const jsonPath = jsonAt === -1 ? null : argv[jsonAt + 1];
const SELF_TEST = argv.includes("--self-test");

// ---------------------------------------------------------------------------
// A crash must not read as a pass
// ---------------------------------------------------------------------------

/**
 * Both reports are written once, at the end of the run, so a crash anywhere
 * before that leaves the *previous* run's file in place: the process exits
 * non-zero while the artefact still reads green. A TypeError thrown during
 * classification produced exactly that — exit 1, and `20/20, failed: []` on
 * disk from a run that never finished.
 *
 * That is not tidiness. Phases of this plan are told to read the report rather
 * than the exit code, so a stale green is an instruction to trust the wrong
 * thing. Each destination is therefore overwritten with an explicit "did not
 * finish" marker the moment the run starts, and only completion replaces it. A
 * reader sees this run's result or an explicit incomplete state — never a
 * previous run's pass wearing this run's clothes.
 *
 * The marker does the work, not the clock: no timestamp or run id, which would
 * invite comparing two runs instead of asking whether this one finished.
 */
const SELFTEST_JSON = join(WEB, "test-results", "dead-code-sweep-self-test.json");

const incompleteSelfTestResult = () => ({
  incomplete: true,
  selfTest: true,
  passed: 0,
  failed: [],
  total: 0,
  checks: [],
  note: "This run did not finish — the process ended before the checks completed, so this file holds no result for it. It is not a pass.",
});

/**
 * The one predicate a reader should apply to the self-test file. The marker
 * fails it by construction — `total > 0` is why a `0/0` marker cannot be read as
 * a vacuous pass, and the self-test asserts both halves so the predicate cannot
 * be loosened without failing the gate.
 */
const isCompletePass = (doc) => doc.incomplete === false && doc.total > 0 && doc.passed === doc.total;

const incompleteCandidateReport = () => ({
  incomplete: true,
  note: "This run did not finish — the scan did not complete, so there is no candidate list for it. This is not a clean sweep and not a previous run's list.",
});

const writeJson = (path, doc) => {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(resolve(path), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
};

if (SELF_TEST) writeJson(SELFTEST_JSON, incompleteSelfTestResult());
if (jsonPath !== null && jsonPath !== undefined) writeJson(jsonPath, incompleteCandidateReport());

/** Windows `relative()` yields backslashes; every path here is posix. */
const posix = (p) => p.replaceAll("\\", "/");
const key = (full) => posix(relative(ROOT, full));

// ---------------------------------------------------------------------------
// Walk
// ---------------------------------------------------------------------------

const SCANNED_EXT = /\.(ts|tsx|mjs)$/;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCANNED_EXT.test(entry)) out.push(key(full));
  }
  return out;
}

function sourceFiles() {
  const files = [];
  const packages = join(WEB, "packages");
  let names = [];
  try {
    names = readdirSync(packages);
  } catch {
    names = [];
  }
  for (const name of names) {
    const src = join(packages, name, "src");
    try {
      if (statSync(src).isDirectory()) walk(src, files);
    } catch {
      // A package without `src` contributes nothing.
    }
  }
  walk(join(WEB, "tests"), files);
  walk(join(WEB, "scripts"), files);
  walk(join(ROOT, "scripts"), files);
  return [...new Set(files)].sort();
}

// ---------------------------------------------------------------------------
// Classify: which files are tests, which are entry points
// ---------------------------------------------------------------------------

/**
 * Every test file is an entry point. Vitest globs `*.test.ts(x)` under each
 * package's `src` and under `tests/e2e` and `tests/scripts`; Playwright globs
 * `*.spec.ts` under `tests/e2e`. Nothing imports a test, so a scanner that
 * misses this edge reports the whole suite as dead.
 */
const isTestFile = (file) =>
  /\.(test|spec)\.tsx?$/.test(file) || file.startsWith("src/web/tests/");

/**
 * Entry points are reached without an import: a package manifest's `main` /
 * `types` / `exports`, an `index.html` `src=`, a config, or a runner's own
 * file. They are excluded as *candidates*; their imports still count, so a
 * module only the boot path reaches is still live.
 *
 * `exports: { ".": "./src/index.ts" }` is why every package barrel is an entry
 * point and not "a module nothing imports".
 */
function entryPoints(files) {
  const points = new Set([
    "src/web/packages/player/src/main.ts",
    "src/web/packages/host/src/main.ts",
    "src/web/packages/host/bin/vigilia.js",
  ]);
  const packagesDir = join(WEB, "packages");
  let names = [];
  try {
    names = readdirSync(packagesDir);
  } catch {
    names = [];
  }
  for (const name of names) {
    const pkgDir = join(packagesDir, name);
    try {
      const manifest = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
      for (const field of [manifest.main, manifest.module, manifest.types]) {
        const path = typeof field === "string" ? `src/web/packages/${name}/${field.replace(/^\.\//, "")}` : null;
        if (path !== null && files.has(path)) points.add(path);
      }
      for (const target of Object.values(manifest.exports ?? {})) {
        const path = typeof target === "string" ? `src/web/packages/${name}/${target.replace(/^\.\//, "")}` : null;
        if (path !== null && files.has(path)) points.add(path);
      }
    } catch {
      // No manifest, or unreadable: the conventions below still apply.
    }
    for (const entry of readdirSync(pkgDir)) {
      if (!entry.endsWith(".html")) continue;
      const html = readFileSync(join(pkgDir, entry), "utf8");
      for (const m of html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)) {
        const path = `src/web/packages/${name}${m[1].startsWith("/") ? m[1] : `/${m[1]}`}`;
        if (files.has(path)) points.add(path);
      }
    }
  }
  return points;
}

const isScriptOrConfig = (file) =>
  /^src\/web\/packages\/[^/]+\/(vite|playwright|vitest)\.config[^/]*\.ts$/.test(file) ||
  /^src\/web\/(vite|playwright|vitest)\.config[^/]*\.ts$/.test(file) ||
  /^scripts\/[^/]+\.mjs$/.test(file) ||
  /^src\/web\/scripts\/[^/]+\.mjs$/.test(file) ||
  /^src\/web\/packages\/[^/]+\/scripts\/[^/]+\.mjs$/.test(file);

/**
 * An ambient declaration file is reached by the compiler's `include`, not by an
 * import, so "nothing imports it" is its normal state rather than a finding.
 */
const isAmbientTypes = (file) => file.endsWith(".d.ts");

// ---------------------------------------------------------------------------
// Parse: specifiers, imported names, exported names
// ---------------------------------------------------------------------------

const NAMES = /^[A-Za-z_$][\w$]*$/;

/** `import { a as b, type C } from "x"` imports `a` and `C`, not `b`. */
function namesFromList(list) {
  return list
    .split(",")
    .map((cell) => cell.trim().replace(/^type\s+/, ""))
    .map((cell) => cell.split(/\s+as\s+/)[0].trim())
    .filter((name) => NAMES.test(name));
}

const IMPORT_BRACED = /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const IMPORT_NS = /import\s+\*\s+as\s+[\w$]+\s*from\s*["']([^"']+)["']/g;
const IMPORT_DEFAULT =
  /import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\}\s*)?from\s*["']([^"']+)["']/g;
const IMPORT_SIDE_EFFECT = /import\s*["']([^"']+)["']/g;
const IMPORT_DYNAMIC = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
const VI_MOCK = /\bvi\.(?:do)?mock\s*\(\s*["']([^"']+)["']/g;
const EXPORT_FROM = /export\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
const EXPORT_STAR = /export\s+\*\s*(?:as\s+[\w$]+\s*)?from\s*["']([^"']+)["']/g;

const EXPORT_FN = /^export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm;
const EXPORT_CLASS = /^export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_VAR = /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_TYPE = /^export\s+(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const EXPORT_DEFAULT = /^export\s+default\b/gm;
const EXPORT_LIST = /^export\s*\{([^}]*)\}(\s*from\s*["'][^"']*["'])?/gm;

/**
 * Specifiers a file reads, with the names taken from each (null = whole module).
 *
 * `reExport` separates `export { x } from "./y"` from a plain `import`: only the
 * first forwards `y`'s name to this file's own consumers, and treating an import
 * as a forward makes a consumer's consumer look like a consumer of the name.
 */
function readSpecifiers(source) {
  const edges = [];
  const push = (spec, names, reExport = false) => edges.push({ spec, names, reExport });

  for (const m of source.matchAll(IMPORT_BRACED)) push(m[2], namesFromList(m[1]));
  for (const m of source.matchAll(IMPORT_NS)) push(m[1], null);
  for (const m of source.matchAll(IMPORT_DEFAULT)) push(m[2], ["default"]);
  for (const m of source.matchAll(IMPORT_SIDE_EFFECT)) push(m[1], null);
  for (const m of source.matchAll(IMPORT_DYNAMIC)) push(m[1], null);
  for (const m of source.matchAll(VI_MOCK)) push(m[1], null);
  for (const m of source.matchAll(EXPORT_FROM)) push(m[2], namesFromList(m[1]), true);
  for (const m of source.matchAll(EXPORT_STAR)) push(m[1], null, true);
  return edges;
}

/** Top-level exported names declared by a file itself. */
function declaredExports(source) {
  const found = new Set();
  for (const re of [EXPORT_FN, EXPORT_CLASS, EXPORT_VAR, EXPORT_TYPE]) {
    for (const m of source.matchAll(re)) found.add(m[1]);
  }
  for (const m of source.matchAll(EXPORT_DEFAULT)) found.add("default");
  for (const m of source.matchAll(EXPORT_LIST)) {
    if (m[2] !== undefined) continue; // `export { x } from "./y"` re-exports y's name
    for (const cell of m[1].split(",")) {
      const name = cell.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && NAMES.test(name)) found.add(name);
    }
  }
  return [...found].sort();
}

// ---------------------------------------------------------------------------
// Resolve specifiers to scanned files
// ---------------------------------------------------------------------------

const EXTS = ["", ".ts", ".tsx", ".mjs", "/index.ts", "/index.tsx"];

function resolveSpecifier(from, spec, files) {
  let base;
  if (spec.startsWith(".")) {
    base = posix(join(dirname(from), spec));
  } else {
    const vigilia = /^@vigilia\/([^/]+)(\/.*)?$/.exec(spec);
    if (vigilia !== null) {
      base = `src/web/packages/${vigilia[1]}/src${vigilia[2] ?? ""}`;
    } else if (spec.startsWith("@/")) {
      base = `src/web/packages/editor/src/${spec.slice(2)}`;
    } else {
      return null; // a bare specifier: react, node:fs, vitest, systeminformation
    }
  }
  for (const ext of EXTS) if (files.has(base + ext)) return base + ext;
  if (/\.js$/.test(base)) {
    const stem = base.replace(/\.js$/, "");
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      if (files.has(stem + ext)) return stem + ext;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The graph
// ---------------------------------------------------------------------------

const all = sourceFiles();
const files = new Set(all);
const ENTRY = entryPoints(files);
const isEntryPoint = (file) => ENTRY.has(file) || isScriptOrConfig(file);

/**
 * A commented-out import is not an import, and a doc example must not become an
 * edge — this repository documents modules inside comments, and a phantom
 * importer *hides* a real candidate. A double slash counts as a comment only
 * when whitespace precedes it, which spares `https://` and a path in a string.
 */
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/[^\n]*/g, "$1");

const source = new Map(
  all.map((file) => [file, stripComments(readFileSync(join(ROOT, file), "utf8"))]),
);

/**
 * A second view of each file, with quoted strings blanked, used only to decide
 * whether a module *uses* one of its own exports. A name inside a string is
 * vocabulary, not a call — `data-vigilia-*` and the `KIND_*` registries are
 * exactly the trap this repository sets — so it must not count as a use.
 *
 * Not handled: backticks and regex literals — a symbol named only as static text
 * inside a template literal still counts as a use, which would tier a dead export
 * `redundant-export`, and a latent wrong tier is invisible in the report. No row
 * is affected today; the only backtick hits are real `${…}` interpolations.
 */
const stripStrings = (text) =>
  text.replace(/"(?:[^"\\\n]|\\.)*"/g, '""').replace(/'(?:[^'\\\n]|\\.)*'/g, "''");

const selfUse = new Map(all.map((file) => [file, stripStrings(source.get(file))]));
const escapeRe = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const usesIn = (text, name) =>
  (text.match(new RegExp(`\\b${escapeRe(name)}\\b`, "g")) ?? []).length;

/**
 * What the `redundant-export` evidence sentence claims: occurrences of the name
 * in its own file outside quoted strings, minus the declaration's own mention of
 * it. Counting the declaration reported `instantiateCard` as 2 occurrences for a
 * single call site, which sends a Phase 2 reader hunting a call site that does
 * not exist. The tier decision keeps the raw count — a use beyond the
 * declaration is exactly what makes the export redundant.
 */
const usesOutsideDeclaration = (text, name) => Math.max(0, usesIn(text, name) - 1);

/** consumedBy[target] = [{ from, names }] where names === null is the whole module. */
const consumedBy = new Map(all.map((file) => [file, []]));
/** reExports[barrel] = [{ target, names }] — how a barrel forwards another file's names. */
const reExports = new Map();
const unresolved = [];

for (const file of all) {
  for (const edge of readSpecifiers(source.get(file))) {
    const target = resolveSpecifier(file, edge.spec, files);
    if (target === null) {
      // Only a relative or aliased specifier was supposed to land on a file.
      if (edge.spec.startsWith(".") || edge.spec.startsWith("@/")) {
        unresolved.push({ from: file, spec: edge.spec });
      }
      continue;
    }
    consumedBy.get(target).push({ from: file, names: edge.names });
    if (edge.reExport) {
      if (!reExports.has(file)) reExports.set(file, []);
      reExports.get(file).push({ target, names: edge.names });
    }
  }
}

/** Barrels a file's names can be reached through, transitively. */
function barrelRoutes(target) {
  const routes = new Map(); // barrel -> Set<name> | null (whole module)
  const seen = new Set();
  const queue = [target];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const [from, edges] of reExports) {
      if (from === target || seen.has(from)) continue;
      for (const edge of edges) {
        if (edge.target !== current) continue;
        const forwarded = edge.names === null ? null : edge.names;
        if (forwarded === null) routes.set(from, null);
        else routes.set(from, new Set([...(routes.get(from) ?? []), ...forwarded]));
        seen.add(from);
        queue.push(from);
      }
    }
  }
  return routes;
}

const packageOf = (file) => /^src\/web\/packages\/([^/]+)\//.exec(file)?.[1] ?? null;
const ownBarrel = (file) => {
  const pkg = packageOf(file);
  return pkg === null ? null : `src/web/packages/${pkg}/src/index.ts`;
};

// ---------------------------------------------------------------------------
// Closed string-literal unions — the `unreachable-branch` kind
// ---------------------------------------------------------------------------

const LITERAL = /"[^"\n]{0,60}"/g;
/** Literals joined by `|`, at the head of a run: the body of a union. */
const RUN_BODY = /^\s*\|?\s*"[^"\n]{0,60}"(?:\s*\|\s*"[^"\n]{0,60}")*/;

/**
 * Only a *declaration* is a closed union, and only two shapes are mechanical:
 * a `type X = …` alias and a `name: …` property annotation. A `Pick<T, "a" | "b">`
 * argument list, a ternary, or any other run of quoted literals is a selection
 * the graph cannot judge — those are the false positives that made an earlier
 * draft of this kind report 45 hits, and they are filtered out here rather than
 * left for a human to wade through.
 */
const TYPE_ALIAS = /(?:^|\n)[ \t]*(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g;
const PROPERTY_UNION =
  /(?:^|\n)[ \t]*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:\s*"[^"\n]{0,60}"(?:\s*\|\s*"[^"\n]{0,60}")+/g;

/** Every declaration-shaped run of quoted literals in a file. */
function unionRunsIn(text) {
  const runs = [];
  for (const m of text.matchAll(TYPE_ALIAS)) {
    const run = RUN_BODY.exec(text.slice(m.index + m[0].length));
    if (run !== null) runs.push([...run[0].matchAll(LITERAL)].map((x) => x[0]));
  }
  for (const m of text.matchAll(PROPERTY_UNION)) {
    runs.push([...m[0].matchAll(LITERAL)].map((x) => x[0]));
  }
  return runs.filter((members) => members.length >= 2);
}

const unions = [];
const unionLiterals = new Map(); // literal -> occurrences inside a union
const literalCounts = new Map(); // literal -> occurrences anywhere in the scanned tree

for (const file of all) {
  const text = source.get(file);
  for (const m of text.matchAll(LITERAL)) {
    literalCounts.set(m[0], (literalCounts.get(m[0]) ?? 0) + 1);
  }
  for (const members of unionRunsIn(text)) {
    unions.push({ file, members });
    for (const member of members) {
      unionLiterals.set(member, (unionLiterals.get(member) ?? 0) + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Classify
// ---------------------------------------------------------------------------

const IMPORTERS = "importer graph over every .ts/.tsx/.mjs under src/web/packages/*/src, src/web/tests, src/web/scripts and scripts/ (dist/ and node_modules/ excluded), resolving relative, @vigilia/* and @/* specifiers";

const candidates = [];
const list = (paths) => (paths.length === 0 ? "none" : paths.join(", "));

function productionImporters(file) {
  return consumedBy.get(file).filter((edge) => !isTestFile(edge.from));
}

function testImporters(file) {
  return consumedBy.get(file).filter((edge) => isTestFile(edge.from)).map((e) => e.from);
}

for (const file of all) {
  if (isEntryPoint(file)) continue;
  if (isAmbientTypes(file)) continue; // reached by tsconfig `include`, not an import
  if (isTestFile(file)) continue; // discovered by a glob, not by an import

  const edges = consumedBy.get(file);
  const prod = productionImporters(file);
  const tests = testImporters(file);

  if (edges.length === 0) {
    candidates.push({
      kind: "no-importer-file",
      file,
      evidence: `0 importers. Search: ${IMPORTERS}; this file is not an entry point (index.html src, build target, config, script) and no vitest/Playwright glob names it. A module kept live only by string-resolved vocabulary is invisible here.`,
    });
    continue;
  }

  if (prod.length === 0) {
    candidates.push({
      kind: "test-only-consumer",
      file,
      evidence: `every importer is a test file (${edges.length}): ${list(tests)}. Search: ${IMPORTERS}, then each importer classified test vs production by *.test.ts(x) / *.spec.ts and the tests/ tree. No production module in any package reaches this file; a name it exports may still be live as string-resolved vocabulary.`,
    });
    continue;
  }

  const barrel = ownBarrel(file);
  const routes = barrelRoutes(file);
  const exportsDeclared = declaredExports(source.get(file));

  for (const name of exportsDeclared) {
    const direct = consumedBy.get(file).filter((e) => e.names === null || e.names.includes(name));
    const through = [];
    for (const [barrelFile, names] of routes) {
      for (const edge of consumedBy.get(barrelFile)) {
        if (names !== null && !names.has(name)) continue;
        if (edge.names === null || edge.names.includes(name)) through.push(edge.from);
      }
    }
    const consumers = [...new Set([...direct.map((e) => e.from), ...through])];
    const prodConsumers = consumers.filter((file_) => !isTestFile(file_));
    if (prodConsumers.length > 0) continue;

    const testConsumers = consumers.filter(isTestFile);
    if (prodConsumers.length === 0 && consumers.includes(barrel)) {
      candidates.push({
        kind: "barrel-only-export",
        file,
        symbol: name,
        evidence: `imported only by its own package barrel ${barrel}, and no file takes "${name}" from that barrel. Search: importer graph (${IMPORTERS}) plus named-import tracking through re-export chains. Test importers: ${list(testConsumers)}.`,
      });
      continue;
    }

    const importerSearch = `0 production importers; ${direct.length + through.length} importer(s), all tests: ${list(testConsumers)}. Search: ${IMPORTERS}, then for every file that imports this one the imported name list was read from the clause; a namespace import, a dynamic import(), a side-effect import or a vi.mock factory consumes every name and would have hidden this. Consumers reached through a re-exporting barrel are followed. String-resolved vocabulary is invisible to this search.`;

    // `default` has no name to search for, so it is forced to 0 and always lands
    // in the dead tier — an `export default function foo()` whose `foo` is used in
    // its own module would be tiered dead-export. No default row exists at HEAD.
    // The two tiers take opposite actions, so they are two kinds, not one.
    const ownUses = name === "default" ? 0 : usesIn(selfUse.get(file), name);
    if (ownUses > 1) {
      candidates.push({
        kind: "redundant-export",
        file,
        symbol: name,
        evidence: `the symbol is LIVE: its own declaring file uses it (${usesOutsideDeclaration(selfUse.get(file), name)} occurrence(s) of the name outside quoted strings, the declaration that names it excluded) and no other production file imports it. Only the "export" keyword is unnecessary — do not delete the symbol. ${importerSearch}`,
      });
    } else {
      candidates.push({
        kind: "dead-export",
        file,
        symbol: name,
        evidence: `the symbol is dead: ${name === "default" ? "a default export carries no name to search for" : "its own declaring file never uses it outside quoted strings (1 occurrence — the declaration itself)"}, so nothing in its own module reaches it either. ${importerSearch}`,
      });
    }
  }
}

// Unreachable branches: the literal exists only inside its own union.
const unreachableDeclarers = new Map(); // literal -> every file that declares it
for (const union of unions) {
  for (const member of new Set(union.members)) {
    if (!unreachableDeclarers.has(member)) unreachableDeclarers.set(member, new Set());
    unreachableDeclarers.get(member).add(union.file);
  }
}

for (const union of unions) {
  if (isEntryPoint(union.file) || isAmbientTypes(union.file) || isTestFile(union.file)) continue;
  for (const member of new Set(union.members)) {
    const total = literalCounts.get(member) ?? 0;
    const inside = unionLiterals.get(member) ?? 0;
    if (total - inside > 0) continue;
    const declarers = [...unreachableDeclarers.get(member)].sort();
    // One literal can be declared in more than one file, so a row count is not a
    // count of distinct dead branches — say which this is, both here and in the report.
    const elsewhere =
      declarers.length > 1
        ? ` The SAME literal is declared in ${declarers.length} files (${declarers.join(", ")}), so this row is one of ${declarers.length} for a single distinct branch.`
        : " This literal is declared in one file, so this row is one distinct branch.";
    candidates.push({
      kind: "unreachable-branch",
      file: union.file,
      symbol: member,
      evidence: `the literal ${member} appears ${total} time(s) in the scanned tree (tests included) and every one is inside a closed union at ${union.file}; nothing else in the source names it, so nothing in the source produces it and nothing switches on it.${elsewhere} Search: literal-text scan for ${member} minus its occurrences inside union runs, over declaration-shaped unions only (a type alias body or a property annotation; a Pick<T, ...> argument list is not read as a union). Expected false positives: a variant produced or read through a composed string, and a value that arrives from outside the source — a sensor type name or a persisted Fabric JSON property — which is a decision rather than a deletion.`,
    });
  }
}

candidates.sort((a, b) => a.kind.localeCompare(b.kind) || a.file.localeCompare(b.file) || (a.symbol ?? "").localeCompare(b.symbol ?? ""));

/** A candidate outside a package is still counted, under the tree that owns it. */
function bucketOf(file) {
  if (file.startsWith("src/web/tests/")) return "(tests)";
  if (file.startsWith("scripts/") || file.startsWith("src/web/scripts/")) return "(scripts)";
  return "(root)";
}

/**
 * Every kind is printed even at zero: "this kind found nothing at HEAD" is an
 * answer, and a kind that silently disappears reads as one that was never run.
 */
const KINDS = [
  "test-only-consumer",
  "no-importer-file",
  "dead-export",
  "redundant-export",
  "barrel-only-export",
  "unreachable-branch",
];
const countsByKind = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
const countsByPackage = {};
for (const candidate of candidates) {
  countsByKind[candidate.kind] = (countsByKind[candidate.kind] ?? 0) + 1;
  const bucket = packageOf(candidate.file) ?? bucketOf(candidate.file);
  countsByPackage[bucket] = (countsByPackage[bucket] ?? 0) + 1;
}

const report = {
  scanned: {
    files: all.length,
    productionFiles: all.filter((f) => !isTestFile(f)).length,
    testFiles: all.filter(isTestFile).length,
    testOnlyModules: candidates.filter((candidate) => candidate.kind === "test-only-consumer").length,
  },
  candidates,
  countsByKind,
  countsByPackage,
  /**
   * `unreachable-branch` rows are per declaration site, and one literal can be
   * declared in two files — so its row count is not its count of distinct dead
   * branches. This is the number a reader should quote.
   */
  unreachableBranchDistinctLiterals: new Set(
    candidates.filter((c) => c.kind === "unreachable-branch").map((c) => c.symbol),
  ).size,
  unresolvedRelativeSpecifiers: unresolved,
  /** Set false only here; the start-of-run marker writes true to the same path. */
  incomplete: false,
  note:
    "Candidates, not verdicts, and nothing here is deleted. `data-vigilia-*` attributes, " +
    "`--vigilia-*`/`--shell-*` custom properties, `KIND_*` registries, Fabric JSON keys, " +
    "classes composed by template literal, and any file a gate reads as data are all live " +
    "with no importer — none of that is visible to this graph, and a name with an empty " +
    "search is not a name that is dead.",
};

function renderReport(report) {
  const lines = [];
  lines.push("Dead-code sweep — candidates, not verdicts. Nothing is deleted by this run.");
  lines.push("");
  lines.push(
    `Scanned ${report.scanned.files} files (${report.scanned.productionFiles} production, ${report.scanned.testFiles} test).`,
  );
  lines.push("");
  for (const [kind, count] of Object.entries(report.countsByKind)) {
    const distinct =
      kind === "unreachable-branch" && report.unreachableBranchDistinctLiterals !== count
        ? `  (${report.unreachableBranchDistinctLiterals} distinct literals — one literal declared in two files is two rows, one branch)`
        : "";
    lines.push(`${kind} — ${count}${distinct}`);
    const rows = report.candidates.filter((candidate) => candidate.kind === kind);
    for (const row of rows.slice(0, 25)) {
      lines.push(`  ${row.file}${row.symbol === undefined ? "" : ` :: ${row.symbol}`}`);
    }
    if (rows.length > 25) lines.push(`  … ${rows.length - 25} more (see --json)`);
    lines.push("");
  }
  if (Object.keys(report.countsByKind).length === 0) lines.push("No candidates.");
  lines.push("By package: " + JSON.stringify(report.countsByPackage));
  lines.push("");
  lines.push(report.note);
  if (report.unresolvedRelativeSpecifiers.length > 0) {
    lines.push("");
    lines.push(`Unresolved relative specifiers (${report.unresolvedRelativeSpecifiers.length}) — each one hides a file's importer:`);
    for (const row of report.unresolvedRelativeSpecifiers.slice(0, 20)) {
      lines.push(`  ${row.from} -> ${row.spec}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

if (jsonPath !== null && jsonPath !== undefined) writeJson(jsonPath, report);

if (!SELF_TEST) process.stdout.write(renderReport(report));

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

/**
 * The self-test is the only gate this script has.
 *
 * Biome's `files.includes` covers `src/web/**\/*.{ts,tsx,json,css}` and no
 * tsconfig includes `scripts/`, so nothing else in this repository can fail
 * `.mjs` — not the linter, not the typechecker. A scanner that reports
 * everything, or nothing, has told you nothing, so the checks below assert both
 * directions against cases the register already names, and assert that the test
 * suite itself is not reported (the single likeliest way for the graph to be
 * wrong).
 *
 * The result lands in a file rather than only on stdout: a hook rewrites stdout
 * in this environment, so a count read from the terminal is not evidence. That
 * file has its own fixed path and is never the `--json` path.
 *
 * What these checks do NOT establish: `barrel-only-export` has never produced a
 * row in this tree, so the branch that emits one is unexercised. The barrel
 * check below proves a route is *followed*, not that the kind can fire.
 */
if (SELF_TEST) {
  const at = (kind, file, symbol) =>
    candidates.some(
      (candidate) =>
        candidate.kind === kind &&
        candidate.file === file &&
        (symbol === undefined || candidate.symbol === symbol),
    );
  const inAnyKind = (file) => candidates.filter((candidate) => candidate.file === file);

  const CARD_LIBRARY = "src/web/packages/editor/src/card-library.ts";
  const FONT_PICKER = "src/web/packages/editor/src/font-picker/font-picker.tsx";
  const SETTINGS_FIELD = "src/web/packages/editor/src/editor-shell/controls/settings-field.ts";
  const LIVE = "src/web/packages/editor/src/boot-theme.ts";

  const checks = [
    ["the walk found the tree", all.length > 400],
    ["the walk found the test suite", all.filter(isTestFile).length > 200],
    [
      "test-only-consumer lands on font-picker.tsx",
      at("test-only-consumer", FONT_PICKER),
    ],
    [
      "no test file is ever a candidate (discovery is an edge)",
      candidates.every((candidate) => !isTestFile(candidate.file)),
    ],
    [
      "no package barrel is a no-importer-file (exports makes it an entry point)",
      candidates.every(
        (candidate) =>
          candidate.kind !== "no-importer-file" || !/^src\/web\/packages\/[^/]+\/src\/index\.ts$/.test(candidate.file),
      ),
    ],
    ["no ambient .d.ts is a candidate", candidates.every((candidate) => !isAmbientTypes(candidate.file))],
    [
      "dead-export lands on settingsField() (its own file never uses it)",
      at("dead-export", SETTINGS_FIELD, "settingsField"),
    ],
    [
      "redundant-export lands on instantiateCard (its own file calls it)",
      at("redundant-export", CARD_LIBRARY, "instantiateCard"),
    ],
    /**
     * The number in a redundant row is evidence a Phase 2 reader acts on, so it
     * must mean what its sentence says. `instantiateCard` is declared once and
     * called once: the raw occurrence count is 2, and a row reporting 2 says a
     * second call site exists when it does not. This fails the moment the
     * declaration is counted again — the raw count is asserted here separately,
     * so the check is not a restatement of the emitter.
     */
    [
      "a redundant row reports uses, not occurrences (instantiateCard is declared once and called once, so 1)",
      (() => {
        const row = candidates.find(
          (candidate) =>
            candidate.kind === "redundant-export" &&
            candidate.file === CARD_LIBRARY &&
            candidate.symbol === "instantiateCard",
        );
        const claimed = /\((\d+) occurrence/.exec(row?.evidence ?? "")?.[1];
        return claimed === "1" && usesIn(selfUse.get(CARD_LIBRARY), "instantiateCard") === 2;
      })(),
    ],
    [
      "every redundant row's number is its use count, not its occurrence count",
      candidates
        .filter((candidate) => candidate.kind === "redundant-export")
        .every(
          (candidate) =>
            Number(/\((\d+) occurrence/.exec(candidate.evidence)?.[1]) ===
            usesIn(selfUse.get(candidate.file), candidate.symbol) - 1,
        ),
    ],
    [
      "the two export tiers are disjoint (opposite remedies, one row never both)",
      candidates.every(
        (candidate) =>
          candidate.kind !== "dead-export" && candidate.kind !== "redundant-export"
            ? true
            : candidates.filter((other) => other.file === candidate.file && other.symbol === candidate.symbol).length === 1,
      ),
    ],
    [
      "the negative case is absent from every kind",
      inAnyKind(LIVE).length === 0,
    ],
    [
      "every candidate carries kind, file and the search that found it",
      candidates.every(
        (candidate) =>
          typeof candidate.kind === "string" &&
          typeof candidate.file === "string" &&
          typeof candidate.evidence === "string" &&
          candidate.evidence.length > 40,
      ),
    ],
    [
      "the run produced candidates (a scanner that reports nothing proved nothing)",
      candidates.length > 0,
    ],
    // The union filter, on fixtures: the repo's own contents change, the shape does not.
    [
      "a type-alias union is read as a closed union",
      unionRunsIn('export type Kind = "none" | "object";')[0]?.length === 2,
    ],
    [
      "a multi-line union is read as a closed union",
      unionRunsIn('export type Key =\n  | "tl"\n  | "tr";')[0]?.length === 2,
    ],
    [
      "a Pick<T, ...> argument list is not read as a union",
      unionRunsIn('function f(options: Pick<O, "flex" | "width"> = {}) {}').length === 0,
    ],
    /**
     * What this establishes and what it does not: it proves a barrel's re-export
     * is *followed* as a route — so an export consumed through its own package
     * barrel is not reported as unused — for the real case of `settingsFieldsFor`
     * through `renderer-core/src/index.ts`. It does NOT exercise the branch that
     * emits a `barrel-only-export` candidate, which has never produced a row in
     * this tree; that branch is unproven by this file's only gate.
     */
    [
      "a barrel's re-export is followed as a route (an import is not)",
      barrelRoutes("src/web/packages/renderer-core/src/charts/settings-fields.ts")
        .get("src/web/packages/renderer-core/src/index.ts")
        ?.has("settingsFieldsFor") === true,
    ],
    [
      "every kind is reported, including the ones that found nothing",
      KINDS.every((kind) => typeof report.countsByKind[kind] === "number"),
    ],
  ];

  const outPath = resolve(SELFTEST_JSON);
  const result = {
    incomplete: false,
    checks: [],
    passed: 0,
    failed: [],
    total: 0,
    selfTest: true,
    note: "A run with fewer than total passes is a failure; the file is written either way so the count can be read without the terminal. `incomplete: false` marks a finished run — the start-of-run marker writes `true` to this path.",
  };
  const write = () => {
    result.checks = checks.map(([name, ok]) => ({ name, ok }));
    result.passed = checks.filter(([, ok]) => ok).length;
    result.failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
    result.total = checks.length;
    writeJson(SELFTEST_JSON, result);
  };
  write();

  /**
   * The regression this guards: the self-test once wrote its result to the same
   * path as `--json`, so `--self-test --json out.json` replaced the candidate
   * report with the checks and exited 0.
   *
   * It has to run AFTER the first write, and that is the whole point: written
   * into the list above, it read `--json` while the candidate report was still
   * intact and passed while the bug was live — a check that cannot fail. Building
   * it here is what makes the red-proof reproduce.
   *
   * Vacuous without `--json`, which is why the usage line names both flags.
   */
  let intact = jsonPath === null || jsonPath === undefined;
  if (!intact) {
    try {
      intact = Object.hasOwn(JSON.parse(readFileSync(resolve(jsonPath), "utf8")), "candidates");
    } catch {
      intact = false;
    }
  }
  // Pushed unconditionally so the total is a stable number: a check that
  // appears only on some runs is a count nobody can quote.
  checks.push([
    "the report at --json still holds candidates after the self-test ran (vacuous unless --json was passed)",
    intact,
  ]);

  /**
   * The guardian for the mechanism above, and pushed after its first write so it
   * reads the artefact a later phase reads rather than the in-memory object.
   *
   * The property is the short-circuit one: before completion the marker is the
   * *only* thing on disk, so if the marker cannot satisfy `isCompletePass`, no
   * early exit can leave a completion behind. Asserting the real file is a
   * complete pass as well keeps the predicate itself strict — a check on the
   * marker alone would pass while `isCompletePass` was loosened to `passed ===
   * total`, which is exactly the `0/0` marker reading as a vacuous pass.
   */
  checks.push([
    "an unfinished run cannot read as a pass (the start-of-run marker is not a completion)",
    (() => {
      const onDisk = JSON.parse(readFileSync(outPath, "utf8"));
      const marker = incompleteSelfTestResult();
      return (
        isCompletePass(onDisk) &&
        onDisk.incomplete === false &&
        onDisk.passed === onDisk.total &&
        marker.incomplete === true &&
        !isCompletePass(marker)
      );
    })(),
  ]);
  write();

  for (const { name, ok } of result.checks) process.stdout.write(`${ok ? "  ok  " : "  FAIL"} ${name}\n`);
  process.stdout.write(`\ndead-code-sweep self-test: ${result.passed}/${result.total} passed -> ${outPath}\n`);
  if (result.failed.length > 0) process.exit(1);
}
