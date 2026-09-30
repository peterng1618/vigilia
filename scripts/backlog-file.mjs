#!/usr/bin/env node
/**
 * Turn commit trailers into backlog rows.
 *
 * ## Why this exists
 *
 * The rule said "file it" and agents remembered it perfectly and still did not
 * file, because filing competes with the task. The cost was three things paid at
 * the worst possible moment: an interruption, a second file opened, and a
 * category decision — all of them at exactly the point where the agent's context
 * is most poisoned by the thing it just found.
 *
 * So the finding rides something already being paid for. Every agent on this
 * project already writes a commit; this reads a trailer out of that message and
 * materialises a row from it. The agent types one line it was typing anyway. It
 * opens no file, runs no command, and chooses no category:
 *
 *     fix(editor): the drag marquee survives a pause instead of lasting 33ms
 *
 *     Discovered, not fixed:
 *     - vg-031 the palette's only colour control is free text
 *
 * ## Why the user's feedback is in the same channel
 *
 * `.claude/settings.json` registers no `UserPromptSubmit` hook, so a message
 * from the user reaches exactly one place: the root session's context. If that
 * session dies before committing — which happened ten times on the author-journey
 * pass — the request dies with it. The root session is how the user's own
 * feedback becomes durable, and the root session commits.
 *
 * `Found by the user, not fixed:` is the same trailer with a different word. The
 * parser does not need to know who spoke; the session writing it does.
 *
 * ## Idempotent by construction
 *
 * A trailer that has already been materialised is skipped, so running this twice
 * over the same history files nothing twice. That is what makes it safe to run
 * across a range of commits rather than only HEAD: a commit made before this
 * existed still gets filed, and a crash between commit and file loses nothing.
 *
 * Related: `docs/decisions/0019`.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FILE = resolve(ROOT, "docs/product/backlog.jsonl");

/** The two trailers, and the `source` each one records. */
const TRAILERS = [
  { re: /^Discovered,\s*not\s*fixed:\s*$/i, source: "agent" },
  { re: /^Found by the user,\s*not\s*fixed:\s*$/i, source: "user" },
];

/**
 * Content-hashed, so two agents filing at the same moment cannot collide on a
 * sequence number. The same idea as the registry's own ids.
 */
function idFor(title) {
  let hash = 0x811c9dc5;
  for (const char of title.toLowerCase()) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `vg-${hash.toString(16).padStart(8, "0").slice(0, 7)}`;
}

export function trailerTitles(message) {
  const lines = message.split(/\r?\n/);
  const out = [];
  let source = null;
  for (const line of lines) {
    const trailer = TRAILERS.find((t) => t.re.test(line.trim()));
    if (trailer) {
      source = trailer.source;
      continue;
    }
    if (source === null) continue;
    const item = line.match(/^\s*[-*]\s+(.*\S)\s*$/);
    // A blank line or a non-bullet ends the block, so a trailer cannot swallow
    // the rest of the commit body.
    if (item) {
      out.push({ title: item[1], source });
    } else if (line.trim() !== "") {
      source = null;
    }
  }
  return out;
}

function readIds() {
  try {
    return new Set(
      readFileSync(FILE, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim() !== "")
        .map((l) => JSON.parse(l).id),
    );
  } catch {
    return new Set();
  }
}

if (process.argv[1]?.endsWith("backlog-file.mjs")) {
  if (process.argv.includes("--self-test")) {
    const message = [
      "fix(editor): the drag marquee survives a pause",
      "",
      "Discovered, not fixed:",
      "- vg-031 the palette's only colour control is free text",
      "- vg-050 the trends panel plots nothing",
      "",
      "Verified: 139 tests pass.",
    ].join("\n");
    const mixed = ["refactor: x", "", "Found by the user, not fixed:", "- the top bar is lost"].join("\n");
    const none = "fix: x\n\nno trailers here";
    const trailing = ["fix: x", "", "Discovered, not fixed:", "", "A blank line ends the block.", "- not an item"].join("\n");
    const cases = [
      ["reads both bullets under one trailer", trailerTitles(message).length === 2],
      ["records agent as the source", trailerTitles(message)[0]?.source === "agent"],
      ["records user as the source for the user's trailer", trailerTitles(mixed)[0]?.source === "user"],
      ["a commit with no trailer files nothing", trailerTitles(none).length === 0],
      ["a blank line ends the block", trailerTitles(trailing).length === 0],
      ["the same title always yields the same id", idFor("a") === idFor("a")],
      ["different titles yield different ids", idFor("a") !== idFor("b")],
      ["ids are registry-shaped", /^vg-[0-9a-f]{7}$/.test(idFor("a"))],
    ];
    let failed = 0;
    for (const [name, pass] of cases) {
      if (!pass) failed += 1;
      process.stdout.write(`${pass ? "  ok  " : "  FAIL"} ${name}\n`);
    }
    if (failed > 0) {
      process.stderr.write("\nbacklog-file self-test failed\n");
      process.exit(1);
    }
    process.stdout.write("\nbacklog-file self-test passed\n");
  }

  const selfTest = process.argv.includes("--self-test");
  const range = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "HEAD~10..HEAD";
  const RS = String.fromCharCode(0x1e);
  const commits = execFileSync("git", ["log", "--format=%H%x00%B%x1e", range], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  })
    .toString()
    .split(RS)
    .filter((c) => c.trim() !== "");

  const known = readIds();
  const filed = [];
  for (const chunk of commits) {
    const [sha, ...rest] = chunk.replace(/^\s+/, "").split("\0");
    for (const { title, source } of trailerTitles(rest.join("\0"))) {
      const id = idFor(title);
      if (known.has(id)) continue;
      known.add(id);
      filed.push({ id, source, title, sha: sha.slice(0, 7) });
    }
  }

  if (filed.length === 0) {
    process.stdout.write(`backlog-file: nothing new in ${range}\n`);
  } else {
    for (const row of filed) {
      appendFileSync(
        FILE,
        JSON.stringify({
          id: row.id,
          state: "open",
          source: row.source,
          title: row.title,
          detail: `Found while landing ${row.sha}, not fixed there.`,
          defer: "out-of-scope",
        }) + "\n",
      );
      process.stdout.write(`filed ${row.id} (${row.source}) — ${row.title}\n`);
    }
    process.stdout.write(`backlog-file: ${filed.length} row(s) filed from trailers in ${range}\n`);
  }
}