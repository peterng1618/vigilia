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
 * ## Two files, split by state
 *
 * `backlog.jsonl` holds what can still be worked: `open`, `in progress`,
 * `unverified`. `backlog-archive.jsonl` holds what is closed: `verified`,
 * `withdrawn`. A row leaves the live file at the moment it reaches a closed state.
 *
 * The split is by state rather than by count because a count is a chore with no
 * trigger. "Archive once 20 completed rows pile up" was already breached — 33 of
 * 58 rows were `verified` — and had not fired for two sessions, because every
 * session must first decide whether it is due. Splitting by state makes the live
 * file short by construction instead of by decree.
 *
 * Everything every git-native tracker does here is on the record in
 * `docs/decisions/0019`. Two properties the split would otherwise cost:
 *
 *   - **The archive stays greppable.** Verified rows are the anti-double-report
 *     record. Grep it before filing a row.
 *   - **Ids and `supersededBy` resolve across both files**, so this gate checks
 *     the union and never reports a live row colliding with an archived one.
 *
 * ## Closure is derived from git, never asserted
 *
 * A row's state used to be a word an agent typed, inside the session that would
 * have changed it. Nothing outside that session could disagree — which is how two
 * fixes were reported as landed and were not, both caught by the user testing
 * rather than by this gate.
 *
 * So `verified` is no longer something an agent claims. Its `artefacts` shas must
 * resolve and be ancestors of HEAD. The agent does not flip the status; the status
 * is a fact about the repository or the gate fails. A row citing a sha from a lost
 * branch fails here, which is the ten-agents-died-mid-task failure caught by a
 * check that runs outside every session.
 *
 * ## The rules
 *
 * 1. Every line has an `id`, a `title`, a `state` from the fixed list, and a
 *    `source` — `user` for something the user raised, `agent` for a defect an
 *    agent found and did not fix in the same session, `mixed` for both. That is
 *    the answer to "how do feedback and discovered bugs unify": the same kind of
 *    thing with a different `source`.
 * 2. A `verified` item carries a `check` that **names something from its own
 *    statement.** A capability proven nearby is not a finding fixed. It cost two
 *    false "landed" reports on 2026-09-30, both found by the user testing.
 * 3. An `unverified` item carries a `note` saying what claims it is fixed.
 * 4. An `open` item says whether it is **claimed or parked**: an `owner` means
 *    somebody is on it now, and without one a `defer` of `out-of-scope`,
 *    `too-big` or `blocked` means it is deliberately not. This is the checkable
 *    form of "filed because it is not this task's work" — six rows claimed
 *    neither before it, all six genuinely parked, none saying so.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const FILE = resolve(ROOT, "docs/product/backlog.jsonl");
const ARCHIVE = resolve(ROOT, "docs/product/backlog-archive.jsonl");

/** Which file a state belongs in. The gate reports a row filed on the wrong side. */
const LOCATION = {
  open: FILE,
  "in progress": FILE,
  unverified: FILE,
  verified: ARCHIVE,
  withdrawn: ARCHIVE,
};

const STATES = new Set(["open", "in progress", "unverified", "verified", "withdrawn"]);
const SOURCES = new Set(["user", "agent", "mixed"]);
const DEFERS = new Set(["out-of-scope", "too-big", "blocked"]);

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

/**
 * Does this sha name a commit that is on the mainline?
 *
 * Exists and is an ancestor of HEAD are separate questions and both are needed:
 * a sha can resolve and still sit on a branch that was never merged, which is
 * exactly the shape of the ten agents that died mid-task with their work
 * uncommitted. Read-only git calls, no shell — `execFileSync` takes an argv
 * array, so a sha cannot become a second command.
 */
function commitIsOnMainline(sha) {
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd: ROOT, stdio: "ignore" });
  } catch {
    return "does not resolve to a commit";
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], { cwd: ROOT, stdio: "ignore" });
    return null;
  } catch {
    return "is not an ancestor of HEAD — it is on a branch that was never merged, or was lost";
  }
}

export function check(items, { archivedIds = [], commitIsOnMainline: probe = commitIsOnMainline } = {}) {
  const problems = [];
  if (!Array.isArray(items)) return ["backlog is not a list"];
  const seen = new Set();
  const closed = new Set(archivedIds);
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
    if (closed.has(item.id)) {
      problems.push(
        `${where}: already archived in backlog-archive.jsonl — a row that reached a closed ` +
          `state leaves the live file; remove it from here rather than tracking it twice`,
      );
    }

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
      // Closure is derived, not asserted. A verified row must point at a commit
      // that is actually on the mainline, so "landed" is a fact about the repo
      // rather than a word typed into this file.
      const shas = Array.isArray(item.artefacts) ? item.artefacts : [];
      if (shas.length === 0) {
        problems.push(
          `${where}: verified with no artefact commit — name the sha that closed it, so this ` +
            `stays checkable after the session that fixed it is gone`,
        );
      }
      for (const sha of shas) {
        const why = probe(sha);
        if (why) problems.push(`${where}: artefact ${sha} ${why}`);
      }
    }
    if (item.state === "unverified" && !item.note) {
      problems.push(`${where}: unverified with no note — say what claims it is fixed`);
    }
    if (item.state === "open") {
      if (!item.owner && !item.defer) {
        problems.push(
          `${where}: open but unclaimed — give it an owner if it is being worked, or a defer ` +
            `(${[...DEFERS].join(" | ")}) if it is parked, so a fresh session can tell which`,
        );
      }
      if (item.defer !== undefined && !DEFERS.has(item.defer)) {
        problems.push(`${where}: defer "${item.defer}" is not one of [${[...DEFERS].join(", ")}]`);
      }
      if (item.defer && item.owner) {
        problems.push(`${where}: has both an owner and a defer "${item.defer}" — parked or claimed, not both`);
      }
    }
  }
  return problems;
}

if (process.argv[1]?.endsWith("backlog-check.mjs")) {
  const live = parse(readFileSync(FILE, "utf8"));
  const archive = parse(readFileSync(ARCHIVE, "utf8"));
  const archivedIds = archive.items.map((i) => i.id);
  const problems = [
    ...live.problems.map((p) => `backlog.jsonl ${p}`),
    ...archive.problems.map((p) => `backlog-archive.jsonl ${p}`),
    // A row filed on the wrong side of the split is drift in the making: the
    // live file grows with history again, or the archive holds work nobody reads.
    ...live.items
      .filter((i) => LOCATION[i.state] === ARCHIVE)
      .map((i) => `${i.id}: state "${i.state}" is closed — move it to backlog-archive.jsonl`),
    ...archive.items
      .filter((i) => LOCATION[i.state] === FILE)
      .map((i) => `${i.id}: state "${i.state}" is workable — move it back to backlog.jsonl`),
    ...check(live.items, { archivedIds }),
    ...check(archive.items),
  ];

  if (process.argv.includes("--self-test")) {
    // The probe is injected so each git rule can be shown failing without
    // needing a real repository. Both gates here once shipped a version that
    // passed everything, and a rule that cannot fail is a defect.
    const none = () => null;
    const ok = (i, opts) => check([i], opts).length === 0;
    const bad = (i, opts) => check([i], opts).length > 0;
    const onMainline = { commitIsOnMainline: none };
    const valid = {
      id: "vg-abc123",
      state: "verified",
      source: "agent",
      title: "the circle reads stronger than the rect",
      check: "hovered the circle's glass and compared it with the rect's",
      artefacts: ["528b0d2"],
    };
    const open = {
      id: "vg-def456",
      state: "open",
      source: "agent",
      title: "the palette colour field accepts anything",
      owner: "editor/src/palette-manager/",
    };
    const parked = { ...open, id: "vg-fed789", owner: undefined, defer: "out-of-scope" };
    const cases = [
      ["a valid item passes", ok(valid, onMainline)],
      ["THE MISTAKE: clamping proven on one field, claimed for another", bad({ ...valid, check: "the polygon sides field clamps onto 32" }, onMainline)],
      ["verified with no check fails", bad({ ...valid, check: undefined }, onMainline)],
      ["a check naming nothing from the statement fails", bad({ ...valid, check: "ran the linter" }, onMainline)],
      ["an unknown state fails", bad({ ...valid, state: "done" }, onMainline)],
      ["an unknown source fails", bad({ ...valid, source: "maybe" }, onMainline)],
      ["unverified with no note fails", bad({ ...valid, state: "unverified", check: undefined }, onMainline)],
      ["a malformed line loses one item, not the file", parse('{"id":"a","statement":"x","state":"open","source":"user"}\nnot json\n{"id":"b","statement":"y","state":"open","source":"user"}').items.length === 2],
      // The claim vs parked distinction.
      ["an open row with an owner passes", ok(open, onMainline)],
      ["an open row that is parked passes", ok(parked, onMainline)],
      ["THE MISTAKE: open, unowned and unsaid — nobody can tell if it is worked", bad({ ...open, owner: undefined }, onMainline)],
      ["an unknown defer fails", bad({ ...parked, defer: "later" }, onMainline)],
      ["claimed and parked at once fails", bad({ ...parked, owner: "x" }, onMainline)],
      // Closure is a fact about the repo, not a word in this file.
      ["verified with no artefact commit fails", bad({ ...valid, artefacts: [] }, onMainline)],
      ["an artefact that is not a commit fails", bad(valid, { commitIsOnMainline: () => "does not resolve to a commit" })],
      ["an artefact from a lost branch fails", bad(valid, { commitIsOnMainline: () => "is not an ancestor of HEAD — it is on a branch that was never merged, or was lost" })],
      // The split's cost, which is what makes the archive worth having.
      ["a live row already archived fails", bad(open, { archivedIds: ["vg-def456"] })],
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
  const counts = {};
  for (const i of live.items) counts[i.state] = (counts[i.state] ?? 0) + 1;
  process.stdout.write(
    `backlog-check: ${live.items.length} live (${Object.entries(counts).map(([s, n]) => `${n} ${s}`).join(", ") || "none"}), ` +
      `${archive.items.length} archived, all valid\n`,
  );
}
