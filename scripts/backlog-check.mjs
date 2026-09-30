#!/usr/bin/env node
/**
 * The backlog registry, enforced.
 *
 * ## Why JSONL
 *
 * This was a markdown table, then a JSON array, and both failed the same way:
 * **one file that every agent rewrites.** A table cell containing a literal `|`
 * silently truncated the parse and the gate reported green over 5 of 30 rows; two
 * agents appending to one array collide on the whole file. Both were mine, on the
 * same day, and neither was carelessness — it was the format.
 *
 * A search turned up [beads](https://github.com/steveyegge/beads), an issue
 * tracker built for agents, whose own FAQ says "with markdown, two agents working
 * on the same project means conflicting TODO lists and duplicated work". Two of its
 * ideas are worth taking and neither needs its database:
 *
 *   - **JSONL** — one JSON object per line, append-only. Two agents adding
 *     different items write different lines and git merges them. A malformed line
 *     costs one item, not the file.
 *   - **content-hashed ids** (`vg-a1b2`) so two agents creating items at the
 *     same moment never collide on a sequence number.
 *
 * The rules live here, in a language with comments, not as prose above a table
 * nobody re-reads.
 *
 * ## The rules
 *
 * 1. Every line has an `id`, a `statement`, a `state` from the fixed list, and
 *    a `source` — `user` for something the user raised, `agent` for a defect an
 *    agent found and did not fix in the same session, `mixed` for both. That is
 *    the answer to "how do feedback and discovered bugs unify": the same kind of
 *    thing with a different `source`.
 * 2. A `verified` item carries a `check` that **names something from its own
 *    statement.** A capability proven nearby is not a finding fixed. It cost two
 *    false "landed" reports on 2026-09-30, both found by the user testing.
 * 3. An `unverified` item carries a `note` saying what claims it is fixed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FILE = resolve(ROOT, "docs/product/backlog.jsonl");

const STATES = new Set(["open", "in progress", "unverified", "verified", "withdrawn"]);
const SOURCES = new Set(["user", "agent", "mixed"]);

const NOISE =
  /^(that|this|with|from|then|than|them|they|their|there|here|what|when|which|while|only|also|just|like|does|should|could|would|have|been|into|over|each|some|more|most|very|much|make|made|really|thing|things|still|every|before|after|because|instead|another|same|used|using|were|being|about|field|fields|control|controls|button|buttons|panel|panels|value|values|item|items|state|owner|product|answer|answered)$/i;
const VERB =
  /^(clamps|clamped|clamping|slides|shows|renders|reads|gives|opens|works|holds|keeps|carries|named|lands|fails|prints|disappears|lists|asks|takes|makes|turns|draws|serves|reports|is|are|was|were|be|been|being|does|do|has|have|had)$/i;

const wordsOf = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !NOISE.test(w) && !VERB.test(w)),
  );

/** Read the registry. A malformed line is reported and skipped, never fatal. */
export function parse(text) {
  const items = [];
  const problems = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === "") return;
    try {
      items.push(JSON.parse(line));
    } catch (error) {
      problems.push(`line ${i + 1}: does not parse — ${error.message}`);
    }
  });
  return { items, problems };
}

export function check(items) {
  const problems = [];
  if (!Array.isArray(items)) return ["backlog is not a list"];
  const seen = new Set();
  for (const [n, item] of items.entries()) {
    const where = item?.id ?? `line ${n + 1}`;
    if (typeof item?.statement !== "string" || item.statement.trim() === "") {
      problems.push(`${where}: no statement`);
      continue;
    }
    if (!STATES.has(item.state)) {
      problems.push(`${where}: state "${item.state}" is not one of [${[...STATES].join(", ")}]`);
      continue;
    }
    if (!SOURCES.has(item.source)) {
      problems.push(`${where}: source "${item.source}" is not one of [${[...SOURCES].join(", ")}]`);
    }
    if (seen.has(item.id)) problems.push(`${where}: duplicate id`);
    seen.add(item.id);

    if (item.state === "verified") {
      const said = wordsOf(item.statement);
      if (said.size === 0) {
        problems.push(`${where}: verified, but the statement names nothing to check against`);
        continue;
      }
      if (typeof item.check !== "string" || item.check.trim() === "") {
        problems.push(`${where}: verified with no check named — name the test or the hand-check that ran`);
        continue;
      }
      const checked = wordsOf(item.check);
      if ([...said].every((w) => !checked.has(w))) {
        problems.push(
          `${where}: the check names nothing from the statement —\n` +
            `      says: ${[...said].slice(0, 8).join(", ")}\n` +
            `      check: ${[...checked].slice(0, 8).join(", ")}\n` +
            `      a check of a capability nearby is not a check of this finding`,
        );
      }
    }
    if (item.state === "unverified" && !item.note) {
      problems.push(`${where}: unverified with no note — say what claims it is fixed`);
    }
  }
  return problems;
}

if (process.argv[1]?.endsWith("backlog-check.mjs")) {
  const { items, problems: readProblems } = parse(readFileSync(FILE, "utf8"));
  const problems = [...readProblems, ...check(items)];

  if (process.argv.includes("--self-test")) {
    const ok = (i) => check([i]).length === 0;
    const bad = (i) => check([i]).length > 0;
    const valid = {
      id: "vg-abc123",
      state: "verified",
      source: "agent",
      statement: "the circle reads stronger than the rect",
      check: "hovered the circle's glass and compared it with the rect's",
    };
    const cases = [
      ["a valid item passes", ok(valid)],
      ["THE MISTAKE: clamping proven on one field, claimed for another", bad({ ...valid, check: "the polygon sides field clamps onto 32" })],
      ["verified with no check fails", bad({ ...valid, check: undefined })],
      ["a check naming nothing from the statement fails", bad({ ...valid, check: "ran the linter" })],
      ["an unknown state fails", bad({ ...valid, state: "done" })],
      ["an unknown source fails", bad({ ...valid, source: "maybe" })],
      ["an open item needs no check", ok({ ...valid, state: "open", check: undefined })],
      ["unverified with no note fails", bad({ ...valid, state: "unverified", check: undefined })],
      ["a malformed line loses one item, not the file", parse('{"id":"a","statement":"x","state":"open","source":"user"}\nnot json\n{"id":"b","statement":"y","state":"open","source":"user"}').items.length === 2],
    ];
    const failed = cases.filter(([, pass]) => !pass);
    for (const [name, pass] of cases) process.stdout.write(`${pass ? "  ok  " : "  FAIL"} ${name}\n`);
    if (failed.length > 0) {
      process.stderr.write("\nbacklog-check self-test failed\n");
      process.exit(1);
    }
    process.stdout.write("\nbacklog-check self-test passed\n");
  }

  if (problems.length > 0) {
    process.stderr.write(`docs/product/backlog.jsonl:\n  ${problems.join("\n  ")}\n\n`);
    process.exit(1);
  }
  process.stdout.write(`backlog-check: ${items.length} items, all valid\n`);
}
