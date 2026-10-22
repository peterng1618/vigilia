#!/usr/bin/env node
/**
 * Reports a registered capture whose surface paths have commits after the commit
 * the capture was taken at. `vg-287`'s ruling: the registry owns a capture's
 * freshness, and the check is a recorded sha against the surface it depicts.
 *
 * The registry is `docs/evidence/screenshots/README.md`'s copy table, extended
 * with two columns — the commit each capture was taken at and the paths that
 * produce what the image shows — so the manifest a person reads and the one this
 * reads are the same bytes and cannot drift.
 *
 * **Never bytes.** Two runs of one capture on one bundle differ in bytes at
 * identical dimensions, so `cmp` reports that capture stale on every run. The
 * check is the commit range `git log <sha>..HEAD -- <path>`, which needs no
 * re-shoot and no digest bookkeeping.
 *
 * Exit 0 = every registered capture is fresh. Exit 1 = findings (a surface path
 * moved, a named file that does not exist, a recorded sha that does not resolve).
 * Exit 2 = the manifest cannot be read — missing, no table, a row of the wrong
 * shape, a row naming no surface path — which is a finding rather than a silent
 * pass. Anything else is fail-open: an unexpected error warns and exits 0,
 * because this is a report and an instrument that blocks on its own breakage is
 * worse than one that says so. See docs/decisions/0061.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_MANIFEST = "docs/evidence/screenshots/README.md";
const HEADER = /^\|\s*Action's file \(this directory\)\s*\|/;
const COLUMNS = 4;
// The table's first two columns are file *names*, each relative to the directory
// its own header names. The other two are repo-relative.
const EVIDENCE_DIR = "docs/evidence/screenshots";
const DRAWINGS_DIR = "docs/design/mockups/current";

/** A manifest this script cannot read: a finding, never a pass. */
class ManifestError extends Error {}

const strip = (cell) => cell.replaceAll("`", "").trim();

function readManifest(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new ManifestError(`${path}: ${error.code ?? error.message}`);
  }
  return parseManifest(text, path);
}

function parseManifest(text, source) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => HEADER.test(line));
  if (start === -1) {
    throw new ManifestError(
      `${source}: no registry table — no row beginning "| Action's file (this directory) |"`,
    );
  }
  const separator = (lines[start + 1] ?? "").trim();
  if (!/^\|(\s*-{2,}\s*\|)+$/.test(separator)) {
    throw new ManifestError(
      `${source}: the registry table's second row is not a markdown separator`,
    );
  }
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trimStart().startsWith("|")) break;
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== COLUMNS) {
      throw new ManifestError(
        `${source}: a row has ${cells.length} columns, expected ${COLUMNS}: ${line.trim()}`,
      );
    }
    const [file, twin, sha] = cells.slice(0, 3).map(strip);
    // The paths are read from the cell before the backticks come off: the column
    // is a list of backticked paths, and a cell without one names no surface.
    const paths = [...cells[3].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (file === "" || twin === "") {
      throw new ManifestError(`${source}: a row names no file: ${line.trim()}`);
    }
    if (paths.length === 0) {
      throw new ManifestError(
        `${source}: a row names no surface path: ${line.trim()}`,
      );
    }
    rows.push({
      file,
      twin,
      sha,
      files: [`${EVIDENCE_DIR}/${file}`, `${DRAWINGS_DIR}/${twin}`],
      surfaces: paths,
    });
  }
  if (rows.length === 0) {
    throw new ManifestError(`${source}: the registry table has no rows`);
  }
  return rows;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function resolves(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha)) return false;
  try {
    git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Commits touching `path` after `sha`, newest first. Empty means fresh. */
function commitsAfter(sha, path) {
  return git(["log", "--format=%h %s", `${sha}..HEAD`, "--", path])
    .split("\n")
    .filter((line) => line !== "");
}

function check(rows) {
  const findings = [];
  for (const row of rows) {
    if (!resolves(row.sha)) {
      findings.push({
        row,
        line: `recorded sha \`${row.sha}\` does not resolve to a commit`,
      });
      continue;
    }
    for (const rel of row.files) {
      if (!existsSync(join(ROOT, rel))) {
        findings.push({ row, line: `\`${rel}\` does not exist` });
      }
    }
    const moved = [];
    for (const rel of row.surfaces) {
      if (!existsSync(join(ROOT, rel.replace(/\/$/, "")))) {
        findings.push({ row, line: `surface \`${rel}\` does not exist` });
        continue;
      }
      const commits = commitsAfter(row.sha, rel);
      if (commits.length > 0) moved.push({ rel, commits });
    }
    if (moved.length > 0) findings.push({ row, moved });
  }
  return findings;
}

function report(rows, findings) {
  for (const finding of findings) {
    if (finding.moved === undefined) {
      console.log(`BROKEN ${finding.row.file}: ${finding.line}`);
      continue;
    }
    console.log(
      `STALE  ${finding.row.file} — taken at ${finding.row.sha.slice(0, 8)}, ${finding.moved.length} of ${finding.row.surfaces.length} surface paths moved`,
    );
    for (const { rel, commits } of finding.moved) {
      console.log(
        `       ${rel} — ${commits.length} commit(s), newest ${commits[0]}`,
      );
    }
  }
  const stale = findings.filter((f) => f.moved !== undefined).length;
  console.log(
    `capture-freshness: ${rows.length} registered capture(s), ${stale} stale, ${findings.length - stale} broken`,
  );
}

function main() {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--manifest");
  const manifest = resolve(
    process.cwd(),
    at === -1 ? DEFAULT_MANIFEST : (argv[at + 1] ?? DEFAULT_MANIFEST),
  );
  let rows;
  try {
    rows = readManifest(manifest);
  } catch (error) {
    if (!(error instanceof ManifestError)) throw error;
    console.error(`capture-freshness: MANIFEST — ${error.message}`);
    process.exit(2);
  }
  const findings = check(rows);
  report(rows, findings);
  process.exit(findings.length > 0 ? 1 : 0);
}

/** The registry's own table, one row per case. */
function fixture(rows) {
  return [
    "| Action's file (this directory) | Beside the drawing | Taken at | Surfaces |",
    "|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
}

function runScanner(manifest) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [fileURLToPath(import.meta.url), "--manifest", manifest],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return { code: 0, out: stdout };
  } catch (error) {
    return { code: error.status ?? 1, out: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function selfTest() {
  const head = git(["rev-parse", "HEAD"]).trim();
  const root = git(["rev-list", "--max-parents=0", "HEAD"]).trim().split("\n")[0];
  // The registry itself: it exists while this test can run, and it is the one
  // path whose history is guaranteed to be older than HEAD and newer than the
  // root commit. The twin is the drawing the shell captures sit beside, which is
  // as stable as the registry that names it. Nothing else about the live tree is
  // pinned.
  const registry = DEFAULT_MANIFEST;
  const row = (sha, file = "README.md", twin = "shell.html") =>
    `| \`${file}\` | \`${twin}\` | \`${sha}\` | \`${registry}\` |`;
  const dir = mkdtempSync(join(tmpdir(), "yunari-capture-freshness-"));
  const cases = [];
  const write = (name, text) => {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  };
  cases.push([
    "leaves a fresh capture alone",
    write("fresh.md", fixture([row(head)])),
    0,
    "0 stale",
  ]);
  cases.push([
    "reports a stale capture",
    write("stale.md", fixture([row(root)])),
    1,
    "1 stale",
  ]);
  cases.push([
    "reports a named file that does not exist",
    write("missing.md", fixture([row(head, "absent-desktop-chromium.png")])),
    1,
    "does not exist",
  ]);
  cases.push([
    "refuses a manifest with no table",
    write("untabled.md", "# A README with no registry table\n"),
    2,
    "MANIFEST",
  ]);
  cases.push([
    "refuses a row of the wrong shape",
    write("short.md", fixture([`| \`${registry}\` | \`${head}\` |`])),
    2,
    "columns",
  ]);
  let failed = 0;
  try {
    for (const [name, manifest, expected, needle] of cases) {
      const { code, out } = runScanner(manifest);
      const ok = code === expected && out.includes(needle);
      if (!ok) failed += 1;
      console.log(
        `${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (expected exit ${expected} and "${needle}", got exit ${code}: ${out.trim().split("\n").at(-1)})`}`,
      );
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (failed > 0) {
    console.error(`capture-freshness self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log(`capture-freshness self-test: all ${cases.length} cases behave`);
  process.exit(0);
}

try {
  if (process.argv.includes("--self-test")) selfTest();
  else main();
} catch (error) {
  // Fail open: a report that cannot run must not read as a verdict.
  console.error(`capture-freshness: not run — ${error.message}`);
  process.exit(0);
}
