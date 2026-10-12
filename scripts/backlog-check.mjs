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
 * 4. A `verified` item carries `artefacts` as an **array** of shas that resolve
 *    and are ancestors of HEAD. A bare string is a different defect from a
 *    missing one and is reported as itself, not read as absent.
 * 5. Both registers run these rules. A row acquires `verified` as it *leaves*
 *    the live file for `backlog-archive.jsonl`, so a checker reading only the
 *    live file never enforces rules 2–4 on any row they were written for.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FILE = resolve(ROOT, "docs/product/backlog.jsonl");
const ARCHIVE = resolve(ROOT, "docs/product/backlog-archive.jsonl");

const STATES = new Set(["open", "in progress", "unverified", "verified", "withdrawn"]);
const SOURCES = new Set(["user", "agent", "mixed"]);

const NOISE =
  /^(that|this|with|from|then|than|them|they|their|there|here|what|when|which|while|only|also|just|like|does|should|could|would|have|been|into|over|each|some|more|most|very|much|make|made|really|thing|things|still|every|before|after|because|instead|another|same|used|using|were|being|about|field|fields|control|controls|button|buttons|panel|panels|value|values|item|items|state|owner|product|answer|answered)$/i;
const VERB =
  /^(clamps|clamped|clamping|slides|shows|renders|reads|gives|opens|works|holds|keeps|carries|named|lands|fails|prints|disappears|lists|asks|takes|makes|turns|draws|serves|reports|is|are|was|were|be|been|being|does|do|has|have|had)$/i;

/**
 * The words an item or a check is *about*.
 *
 * Stemmed on a small plural list, so a check saying "chart" counts as naming a
 * title saying "charts". Without that, the rule rejected a correct check for a
 * spelling difference — which is how a gate starts being worked around rather
 * than satisfied.
 */
const wordsOf = (text) =>
  new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .map((w) =>
        w.replace(
          /(charts|shapes|objects|assets|colours|colors|drives|points|handles|fields|checks|values|panels|groups|files|presets|readings|questions|buttons|options|panels)$/i,
          (m) => m.slice(0, -1),
        ),
      )
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
    if (typeof item?.title !== "string" || item.title.trim() === "") {
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
      const said = wordsOf(item.title);
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
          `${where}: the check names nothing from the title —\n` +
            `      says: ${[...said].slice(0, 8).join(", ")}\n` +
            `      check: ${[...checked].slice(0, 8).join(", ")}\n` +
            `      a check of a capability nearby is not a check of this finding`,
        );
      }
      // The check above is the stronger of the two, and it cannot answer this
      // question: whether the work it names still exists. Exists and is an
      // ancestor of HEAD are separate, and a sha can resolve while sitting on a
      // branch that was never merged — the shape of ten agents that died
      // mid-task with their work uncommitted. Read-only git calls, no shell:
      // execFileSync takes an argv array, so a sha cannot become a command.
      //
      // A bare string and an absent key are different defects: the first is a
      // shape the reader cannot consume, the second is a row with no close to
      // check. Reading the string as absent would report the wrong problem and
      // hide the shape, so it is rejected as itself.
      if (item.artefacts !== undefined && !Array.isArray(item.artefacts)) {
        problems.push(
          `${where}: artefacts must be an array of shas — a bare ${typeof item.artefacts} is ` +
            `read as absent, so the row's close is never checked`,
        );
      } else {
        const shas = Array.isArray(item.artefacts) ? item.artefacts : [];
        if (shas.length === 0) {
          problems.push(
            `${where}: verified with no artefact commit — name the sha that closed it, so this ` +
              `stays checkable after the session that fixed it is gone`,
          );
        }
        for (const sha of shas) {
          try {
            execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: ROOT, stdio: "ignore" });
          } catch {
            problems.push(`${where}: artefact ${sha} does not resolve to a commit`);
            continue;
          }
          try {
            execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: ROOT, stdio: "ignore" });
          } catch {
            problems.push(
              `${where}: artefact ${sha} is not an ancestor of HEAD — it is on a branch that was ` +
                `never merged, or was lost, so nothing downstream can rely on it`,
            );
          }
        }
      }
    }
    if (item.state === "unverified" && !item.note) {
      problems.push(`${where}: unverified with no note — say what claims it is fixed`);
    }
  }
  return problems;
}

/**
 * One register's rows and problems, from its text.
 *
 * A register that cannot be read, or holds no rows, is a failure like any
 * malformed line. An absent file must not throw and an empty one must not read
 * `all valid`: a baseline that answers green to a missing register is the same
 * false green the rules below exist to catch, one level up.
 */
export function registerRows(name, text) {
  if (text === null) {
    return { name, items: [], problems: ["unreadable — the file is missing or cannot be opened"] };
  }
  if (text.trim() === "") {
    return { name, items: [], problems: ["empty — a register with no rows is not a clean register"] };
  }
  return { name, ...parse(text) };
}

/** Read one register by path. A failure is returned as a problem, never thrown. */
export function readRegister(path) {
  let text = null;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    // Left null on purpose: the problem set must always be the thing that
    // answers, so an unreadable register is reported like any other finding.
  }
  return registerRows(path.slice(ROOT.length + 1).replace(/\\/g, "/"), text);
}

if (process.argv[1]?.endsWith("backlog-check.mjs")) {
  // Split by state, the two files are one register: a row acquires `verified`
  // as it *leaves* the live file, so reading only the live file never runs
  // rules 2-4 on any row they were written for. The archive read lands as an
  // error, not a warning — a gate that tolerates the drift it finds is the
  // false green the whole split was meant to prevent.
  const registers = [FILE, ARCHIVE].map(readRegister);
  const problems = registers.flatMap(({ name, items, problems: readProblems }) =>
    [...readProblems, ...check(items)].map((problem) => `${name}: ${problem}`),
  );
  const items = registers.reduce((count, register) => count + register.items.length, 0);

  if (process.argv.includes("--self-test")) {
    const ok = (i) => check([i]).length === 0;
    const bad = (i) => check([i]).length > 0;
    const problem = (i, re) => check([i]).some((p) => re.test(p));
    const valid = {
      id: "vg-abc123",
      state: "verified",
      source: "agent",
      title: "the circle reads stronger than the rect",
      check: "hovered the circle's glass and compared it with the rect's",
      // HEAD at the time this was written: a sha that resolves and is an
      // ancestor of itself, which is the only shape the positive case can have.
      artefacts: ["HEAD"],
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
      // The sha rule answers what the check cannot: does the work still exist.
      ["verified with no artefact commit fails", bad({ ...valid, artefacts: [] })],
      // A bare string must be named as a shape, not silently read as absent:
      // asserting the message is what makes this case fail when the rule is
      // disabled, since the absent-key path would otherwise still reject it.
      ["a bare-string artefacts is rejected as a shape", problem({ ...valid, artefacts: "abc1234" }, /array/)],
      ["an artefact that is not a commit fails", bad({ ...valid, artefacts: ["a1b2c3d"] })],
      ["a malformed line loses one item, not the file", parse('{"id":"a","statement":"x","state":"open","source":"user"}\nnot json\n{"id":"b","statement":"y","state":"open","source":"user"}').items.length === 2],
      // The central deliverable is the *set* the CLI reads. Narrowing it to the
      // live file alone is the change this check exists to fail, and it is the
      // one no rule inside check() can see, because check() never knew the set.
      ["both registers are read, live and archive", registers.map((r) => r.name).join(",") === "docs/product/backlog.jsonl,docs/product/backlog-archive.jsonl"],
      ["an unreadable register is a labelled failure", registerRows("docs/product/backlog.jsonl", null).problems.some((p) => /unreadable/.test(p))],
      ["an empty register is a failure, not all-valid", registerRows("docs/product/backlog.jsonl", "\n\n").problems.some((p) => /empty/.test(p))],
      // The two cases above call registerRows directly, so the catch that stops
      // a missing file from throwing is exercised by neither. This one reads a
      // real path that does not exist, so the throwing path itself is covered.
      ["a register path that does not exist is a failure, not a throw", readRegister(`${ROOT}/docs/product/backlog-no-such-register.jsonl`).problems.some((p) => /unreadable/.test(p))],
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
    process.stderr.write(`backlog-check:\n  ${problems.join("\n  ")}\n\n`);
    process.exit(1);
  }
  process.stdout.write(`backlog-check: ${items} items across both registers, all valid\n`);
}
