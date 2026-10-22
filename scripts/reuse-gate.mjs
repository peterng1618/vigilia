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
 * YUNARI_SKIP_REUSE_GATE=1 for the invocation. It is deliberately awkward, so
 * using it is visible in the transcript.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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
  "src/web/packages/renderer-core/src/charts/",
  "src/web/packages/renderer-core/src/data/protocol.ts",
  "src/web/packages/host/src/providers/",
  "src/web/packages/host/src/serve/static-path.ts",
  "src/web/packages/host/src/server.ts",
  // The editor's own mechanism boundaries. Added after a pass found the list
  // covered no editor path at all while the editor is where most of these
  // decisions now live: the Fabric/React boundary, the row projection, the
  // persistent-host shell, the session lifecycle, the one primitive library
  // the spec rules on, and the column's read-only projection with the refusal a
  // document edit earns. That last entry named `selection-inspector/style.ts`
  // until 0066: the file went at `aa5edf96`, the entry was inert twice over (a
  // path that is gone, and a note that still claimed it), and it is repointed
  // rather than deleted.
  // The editor's ordinary layout and copy are deliberately absent — a wrong
  // decision there is visible on the next render rather than invisible.
  "src/web/packages/editor/src/editor-shell/bridge.ts",
  "src/web/packages/editor/src/editor-shell/layer-tree.ts",
  "src/web/packages/editor/src/editor-shell/shell-layout.tsx",
  "src/web/packages/editor/src/editor-session.ts",
  "src/web/packages/editor/src/components/ui/",
  "src/web/packages/editor/src/selection-inspector/view.ts",
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
  return WATCHLIST.some((w) =>
    w.endsWith("/") ? matchesDirectory(posix(relative(ROOT, resolve(ROOT, w))), rel) : rel === w,
  );
}

/**
 * Directory entries: a bare name matches at any depth, an anchored one does not.
 *
 * `scripts/` claims a *kind* of path rather than a location — the repo has a
 * second `scripts/` under `src/web/`, and it was ungated while the watchlist
 * read as saying otherwise. This is the rule git already applies to a bare
 * gitignore pattern and the one `AGENTS.md` states for this repo, so the
 * watchlist is now readable the same way. An entry carrying a `/` keeps its
 * meaning exactly: `glass.ts` names that file at that path, not any file of
 * that name. See docs/decisions/0025.
 */
function matchesDirectory(entry, rel) {
  const base = entry.replace(/\/$/, "");
  if (!base.includes("/")) return rel.split("/").includes(base);
  return rel === base || rel.startsWith(`${base}/`);
}

/**
 * Every entry must name something that exists, or the list reads as coverage it
 * does not have (vg-544): the dead entry was inert twice over and nothing on the
 * write side can see it. Each shape is read by the rule `isWatched` matches it
 * by (0025) — an anchored entry is a path from the root, and a bare name matches
 * at any depth, so reading a bare name at the root alone would red on a live
 * entry and invite the wrong repair, narrowing the list.
 */
function entryExists(entry) {
  const base = entry.replace(/\/$/, "");
  if (base.includes("/")) return existsSync(resolve(ROOT, base));
  return trackedPaths().some((rel) => rel.split("/").includes(base));
}

/** The tracked set: the walker this repo already uses for every path in the tree. */
function trackedPaths() {
  return execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((rel) => rel !== "");
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

/**
 * A claim names the file being written, and only that file.
 *
 * A claim ending in `/` used to license every path beneath it, which made the
 * gate a one-shot latch per directory: the first change to a boundary was
 * guarded and nothing after it was, so a note on `charts/` covered a file the
 * note never discusses and that did not exist when it was written. The blunt,
 * presence-only reading stays; the unit a claim is made in is a file. A claim
 * ending in `/` therefore names nothing, and a note that relied on one names
 * its files instead. See docs/decisions/0059.
 */
function covers(rel, claimed) {
  return claimed.some((c) => rel === c);
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
    "src/web/packages/renderer-core/src/charts/",
    "src/web/scripts/generate-font-trios.mjs",
  ];
  const abs = (p) => `${ROOT}/${p}`;
  const cases = [
    ["allows a path claimed by a note", abs("src/web/packages/scene-fabric/src/glass.ts"), 0],
    // vg-144's own shape. `charts/grid.ts` is watchlisted and named by NO note,
    // so the refusal is this rule's doing rather than another note's, and the
    // directory claim in the array is what used to allow it.
    ["refuses a file under a directory claim", abs("src/web/packages/renderer-core/src/charts/grid.ts"), 2],
    ["refuses a watchlisted path with no note", abs("src/web/packages/host/src/providers/lhm.ts"), 2],
    // vg-544: the entry that replaced the dead one must actually refuse. A dead
    // entry cannot be seen from here, which is what the existence cases below
    // are for.
    ["refuses the replacement path with no note", abs("src/web/packages/editor/src/selection-inspector/view.ts"), 2],
    ["allows a path outside the watchlist", abs("src/web/packages/editor/src/ui-copy.ts"), 0],
    ["allows a test on a watchlisted path", abs("src/web/packages/host/src/providers/lhm.test.ts"), 0],
    ["refuses a watchlisted file in a watched directory", abs("scripts/anything.mjs"), 2],
    ["refuses a bare directory entry at any depth", abs("src/web/scripts/anything.mjs"), 2],
    ["allows a bare directory entry its own note claims", abs("src/web/scripts/generate-font-trios.mjs"), 0],
    ["still anchors an entry that carries a path", abs("src/web/packages/scene-fabric/src/unrelated.ts"), 0],
    ["allows an empty path", "", 0],
  ];
  // The array above is synthetic, so no case in it sees the live registry
  // (vg-425's gap, from this side). These two do, and the pair is the point: a
  // chart file a note names is allowed, and one no note names is refused. A
  // registry that answers the same to both is the defect this rule exists to
  // prevent - it is latched by a directory claim, or it names nothing at all.
  // Both paths are found rather than pinned, so a later note naming one does
  // not turn this red for the wrong reason.
  const live = claimedPaths();
  const chartsDir = "src/web/packages/renderer-core/src/charts";
  const chartFiles = readdirSync(join(ROOT, chartsDir))
    .filter((f) => !/\.(test|dom\.test)\.[cm]?[jt]sx?$/.test(f))
    .map((f) => `${chartsDir}/${f}`)
    .filter((p) => isWatched(abs(p)));
  const unclaimed = chartFiles.filter((p) => !covers(p, live));
  cases.push(
    ["refuses a chart file no note names (live registry)", abs(unclaimed[0] ?? `${chartsDir}/nothing.ts`), 2, live],
    ["allows a chart file a note names (live registry)", abs(chartFiles.find((p) => covers(p, live)) ?? `${chartsDir}/nothing.ts`), 0, live],
  );
  let failed = 0;
  for (const [name, path, expected, pool = claimed] of cases) {
    const got = decide(path, pool);
    const ok = got === expected;
    if (!ok) failed += 1;
    console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (expected ${expected}, got ${got})`}`);
  }

  // vg-544, the durable half: a dead entry reads as coverage and no write-side
  // case can see it. Read the live WATCHLIST, not a synthetic array, and read
  // each entry by the rule it matches by (0025) rather than by `existsSync`
  // alone. The two cases after the first prove the check can fail, so a whole
  // list that reads green is not vacuous. The bare name is found rather than
  // pinned: a name that occurs only below the root, which a root-only reading
  // would call dead.
  const nested =
    trackedPaths()
      .flatMap((rel) => rel.split("/").slice(0, -1))
      .find((name) => name !== "" && !existsSync(resolve(ROOT, name))) ?? "";
  const integrity = [
    ["every watchlist entry names a path that exists", WATCHLIST.filter((e) => !entryExists(e)), []],
    ["reads a bare name at any depth, not at the root", nested !== "" && entryExists(`${nested}/`), true],
    ["finds an entry that is nowhere in the tree", entryExists("src/web/nothing/here.ts"), false],
  ];
  for (const [name, got, expected] of integrity) {
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` (expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)})`}`,
    );
  }

  if (failed > 0) {
    console.error(`reuse-gate self-test: ${failed} case(s) wrong`);
    process.exit(1);
  }
  console.log("reuse-gate self-test: all cases behave");
  process.exit(0);
}

try {
  if (process.env.YUNARI_SKIP_REUSE_GATE === "1") process.exit(0);

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
      "  YUNARI_SKIP_REUSE_GATE=1 and say where it is recorded.",
      "",
    ].join("\n"),
  );
  process.exit(2);
} catch {
  // A gate that fails loudly is worse than one that does nothing.
  process.exit(0);
}
