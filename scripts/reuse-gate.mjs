#!/usr/bin/env node
/**
 * Refuses the first write to a mechanism boundary while no decision note claims
 * that path. The mechanical half of AGENTS.md's reuse gate: the rule was skipped
 * repeatedly because satisfying an early rung read as discharging the gate, and
 * nothing in the workflow made the omission visible.
 *
 * Deliberately blunt. It checks *presence*, never quality - a note that lists
 * alternatives without saying what was searched passes here and must be caught
 * in review. See docs/decisions/README.md.
 *
 * Escape hatch, for a decision genuinely recorded elsewhere: set
 * VIGILIA_SKIP_REUSE_GATE=1 for the invocation. It is deliberately awkward, so
 * using it is visible in the transcript.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DECISIONS = join(ROOT, "docs", "decisions");

/**
 * Mechanism boundaries: owners where a wrong decision is expensive *and
 * invisible*, because nothing fails — it just renders wrong, or leaks, or
 * behaves differently only on the hardware nobody tested on.
 *
 * Tests are excluded: a test cannot introduce a mechanism.
 */
const WATCHLIST = [
  "src/web/packages/scene-fabric/src/glass.ts",
  "src/web/packages/scene-fabric/src/background-media.ts",
  "src/web/packages/scene-fabric/src/scene.ts",
  "src/web/packages/scene-fabric/src/adapter.ts",
  "src/web/packages/scene-fabric/src/persist.ts",
  "src/web/packages/scene-fabric/src/chart-object.ts",
  "src/web/packages/scene-fabric/src/object-asset.ts",
  "src/web/packages/renderer-core/src/theme/",
  "src/web/packages/renderer-core/src/data/protocol.ts",
  "src/web/packages/host/src/providers/",
  "src/web/packages/host/src/serve/static-path.ts",
  "src/web/packages/host/src/server.ts",
  "scripts/",
];

/** Windows `relative()` yields backslashes; every path here is posix. */
function posix(p) {
  return p.replaceAll("\\", "/");
}

function isWatched(path) {
  const rel = posix(relative(ROOT, resolve(ROOT, path)));
  if (rel.startsWith("..")) return false;
  if (/\.(test|dom\.test)\.[cm]?[jt]sx?$/.test(rel)) return false;
  return WATCHLIST.some((w) => (w.endsWith("/") ? rel.startsWith(w) : rel === w));
}

/**
 * Paths any note claims. A note lists them as a bullet that wraps onto indented
 * continuation lines, so reading only the line that starts with `Paths:` misses
 * every path after the first — which made the gate refuse files a note had
 * actually claimed. Read the whole bullet.
 */
function claimedPaths() {
  let notes;
  try {
    notes = readdirSync(DECISIONS).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const claimed = [];
  const lines = (text) => text.replace(/\r\n/g, "\n").split("\n");
  for (const file of notes) {
    let text;
    try {
      text = readFileSync(join(DECISIONS, file), "utf8");
    } catch {
      continue;
    }
    const rows = lines(text);
    for (const [i, row] of rows.entries()) {
      if (!/^- \*\*Paths:\*\*/.test(row)) continue;
      // The bullet wraps: indented rows that follow belong to the same field.
      for (const next of rows.slice(i + 1)) {
        if (!/^[ \t]+\S/.test(next)) break;
        for (const m of next.matchAll(/`(src\/[^`]+|scripts\/[^`]+)`/g)) {
          claimed.push(m[1].replace(/\/$/, "/"));
        }
      }
      for (const m of row.matchAll(/`(src\/[^`]+|scripts\/[^`]+)`/g)) {
        claimed.push(m[1].replace(/\/$/, "/"));
      }
    }
  }
  return claimed;
}

function covers(rel, claimed) {
  return claimed.some((c) => {
    const cDir = c.endsWith("/");
    const base = cDir ? c.slice(0, -1) : c;
    return cDir ? rel.startsWith(base) : rel === base || rel.startsWith(`${base}/`);
  });
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "{}";
  }
}

/** 0 allows, 2 refuses. Fail-open, by design, on anything unexpected. */
function decide(path, claimed) {
  if (typeof path !== "string" || path === "") return 0;
  if (!isWatched(path)) return 0;
  return covers(posix(relative(ROOT, resolve(ROOT, path))), claimed) ? 0 : 2;
}

if (process.argv.includes("--self-test")) {
  // This gate shipped a version that allowed every write, because Windows
  // relative() yields backslashes and the watchlist used forward slashes. A
  // gate that cannot refuse is worse than no gate, so prove it still can.
  const claimed = [
    "src/web/packages/scene-fabric/src/glass.ts",
    "src/web/packages/renderer-core/src/theme/",
  ];
  const abs = (p) => `${ROOT}/${p}`;
  const cases = [
    ["allows a path claimed by a note", abs("src/web/packages/scene-fabric/src/glass.ts"), 0],
    ["allows a path under a claimed directory", abs("src/web/packages/renderer-core/src/theme/glass.ts"), 0],
    ["refuses a watchlisted path with no note", abs("src/web/packages/host/src/providers/lhm.ts"), 2],
    ["allows a path outside the watchlist", abs("src/web/packages/editor/src/ui-copy.ts"), 0],
    ["allows a test on a watchlisted path", abs("src/web/packages/host/src/providers/lhm.test.ts"), 0],
    ["refuses a watchlisted file in a watched directory", abs("scripts/anything.mjs"), 2],
    ["allows an empty path", "", 0],
  ];
  let failed = 0;
  for (const [name, path, expected] of cases) {
    const got = decide(path, claimed);
    const ok = got === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (expected ${expected}, got ${got})`}`);
  }
  if (failed > 0) {
    console.error(`reuse-gate self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log("reuse-gate self-test: all cases behave");
  process.exit(0);
}

try {
  if (process.env.VIGILIA_SKIP_REUSE_GATE === "1") process.exit(0);

  const input = JSON.parse(readStdin() || "{}");
  const path = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
  if (decide(path, claimedPaths()) === 0) process.exit(0);

  process.stderr.write(
    [
      "",
      "REUSE GATE — refused.",
      "",
      `  ${posix(relative(ROOT, resolve(ROOT, path)))}`,
      "",
      "  This is a mechanism boundary. Work all seven rungs of AGENTS.md's",
      "  reuse gate, then land a decision note claiming this path:",
      "",
      "    docs/decisions/NNNN-<slug>.md   (template in docs/decisions/README.md)",
      "",
      "  The gate is about INTEGRATION, not existence. A native API existing",
      "  is not an answer, and rung 3 succeeding does not discharge rungs 4-5.",
      "  The question is whether anyone has solved THIS SHAPE of problem - in",
      "  this renderer, against this host, under these constraints - and what",
      "  they learned. A capability that still needs sampling, ordering,",
      "  invalidation, disposal and ownership decisions is exactly the",
      "  undischarged case: that is where the work is.",
      "",
      "  Record what you searched, what you found, and why each alternative was",
      "  rejected. The searches are the evidence; a list of libraries without",
      "  them is worth nothing.",
      "",
      "  If the decision is genuinely recorded elsewhere, set",
      "  VIGILIA_SKIP_REUSE_GATE=1 and say where it is recorded.",
      "",
    ].join("\n"),
  );
  process.exit(2);
} catch {
  // A gate that fails loudly is worse than one that does nothing.
  process.exit(0);
}
