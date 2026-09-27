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

/** Paths any note claims, from its `Paths:` frontmatter line. */
function claimedPaths() {
  let notes;
  try {
    notes = readdirSync(DECISIONS).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const claimed = [];
  for (const file of notes) {
    let text;
    try {
      text = readFileSync(join(DECISIONS, file), "utf8");
    } catch {
      continue;
    }
    const line = text.split("\n").find((l) => l.startsWith("- **Paths:**"));
    if (line === undefined) continue;
    for (const m of line.matchAll(/`(src\/[^`]+|scripts\/[^`]+)`/g)) {
      claimed.push(m[1].replace(/\/$/, "/"));
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

try {
  if (process.env.VIGILIA_SKIP_REUSE_GATE === "1") process.exit(0);

  const input = JSON.parse(readStdin() || "{}");
  const rel = input.tool_input?.file_path ?? input.tool_input?.path ?? "";
  if (typeof rel !== "string" || rel === "") process.exit(0);
  if (!isWatched(rel)) process.exit(0);
  if (covers(posix(relative(ROOT, resolve(ROOT, rel))), claimedPaths()))
    process.exit(0);

  process.stderr.write(
    [
      "",
      "REUSE GATE — refused.",
      "",
      `  ${relative(ROOT, resolve(ROOT, rel))}`,
      "",
      "  This is a mechanism boundary. Work all seven rungs of AGENTS.md's",
      "  reuse gate, then land a decision note claiming this path:",
      "",
      "    docs/decisions/NNNN-<slug>.md   (template in docs/decisions/README.md)",
      "",
      "  The note records what you searched, what you found, and why each",
      "  alternative was rejected. The searches are the evidence; a list of",
      "  libraries without them is worth nothing.",
      "",
      "  A native API existing is not an answer — rung 3 succeeding does not",
      "  discharge rungs 4-5. If the decision is genuinely recorded elsewhere,",
      "  set VIGILIA_SKIP_REUSE_GATE=1 and say where it is recorded.",
      "",
    ].join("\n"),
  );
  process.exit(2);
} catch {
  // A gate that fails loudly is worse than one that does nothing.
  process.exit(0);
}
