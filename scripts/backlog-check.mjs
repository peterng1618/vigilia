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
 * 6. **The split is by state, and each file refuses the other's rows.** The live
 *    file holds what can still be worked; the archive holds `verified` and
 *    `withdrawn`. This was stated and not enforced, which is how `vg-505` was
 *    written into the archive carrying `state: "open"` — a live row invalid to
 *    work, invisible to any census of the live file, and unclosable, since no
 *    phase reads the archive. A rule the checker knows and does not test is a
 *    convention, and a convention loses to whoever is in a hurry.
 * 7. A row lives in one register, never both.
 * 8. A parked row is `open` and carries a well-formed `PARKED <date>:` marker.
 * 9. **The register never loses a row.** Every row is checked and none of them
 *    is the set: an append script that cut the last row while adding another
 *    reported the same count before and after, so the gate was green with a
 *    finding gone (`vg-502`). The id set is compared against `HEAD`, and the
 *    comparison is against **both** registers because a close only ever *moves*
 *    a row between the two files. See docs/decisions/0054.
 * 10. **A `check` belongs to a closed row.** It is evidence of a close, so an
 *    `open` row carrying one holds a claim that does not stand — and it is
 *    unvalidated by construction, since the rules above it are gated on
 *    `verified` (`vg-514`). Closed means `verified` or `withdrawn`: a withdrawn
 *    row's check records what was examined before its subject turned out to be
 *    gone, which is worth keeping. See docs/decisions/0055.
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
    // `detail` is prose, and it was the last field a reader consumes whose shape
    // nothing stated. `vg-174` carried a two-element array for as long as it has
    // been that way, and the failure was silent *and reader-dependent*:
    // `row.detail.match(…)` throws while `MARKER.test(row.detail)` coerces the
    // array to a comma-joined string and matches anyway, so two probes over one
    // register disagreed about whether that row carried a ruling. Refused as a
    // shape, like a bare-string `artefacts` below, rather than coerced on read —
    // see docs/decisions/0046-a-rows-detail-is-a-string.md.
    if (item.detail !== undefined && typeof item.detail !== "string") {
      const shape = Array.isArray(item.detail) ? "array" : typeof item.detail;
      problems.push(
        `${where}: detail must be a string — a bare ${shape} is read differently by a ` +
          `reader that coerces it and one that does not, so the register says two things at once`,
      );
    }
    if (seen.has(item.id)) problems.push(`${where}: duplicate id`);
    seen.add(item.id);

    // Rule 10. The `verified` branch below validates what a check *says*; this
    // one refuses it where there is no close for it to be evidence of. The axis
    // is closed rather than `verified`, which is the same pair `checkPlacement`
    // computes — a `withdrawn` row's check is a record of what was examined
    // before its subject turned out to be gone, and deleting that to satisfy a
    // rule about closes would be the wrong trade. See docs/decisions/0055.
    if (item.state !== "verified" && item.state !== "withdrawn") {
      for (const field of ["check", "artefacts"]) {
        if (item[field] === undefined) continue;
        problems.push(
          `${where}: ${field} on a row in state "${item.state}" — it is evidence of a close, so it ` +
            `belongs to a verified or withdrawn row; a close REPLACES it rather than leaving it for ` +
            `the next one to inherit`,
        );
      }
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
 * Rule 8: a parked row is `open` and carries a well-formed `PARKED <date>:` marker.
 *
 * The triage parks a real-but-low-value finding rather than closing it, so the
 * census can separate "known, not scheduled" from "to do". A marker nothing
 * validates defeats that, because parking a row by making it invisible is the
 * outcome the policy exists to prevent.
 *
 * **The rule is deliberately narrow about what it calls a marker.** The word
 * `PARKED` already appears in three rows as prose — "PARKED BY THE USER
 * (2026-10-11)", "PARKED by the controller", "MINOR 5 WAS PARKED, NOT FIXED" —
 * which is three informal parking records spelled three ways, and is the reason a
 * canonical marker is worth having. But a rule that read any `PARKED` as a marker
 * would fail those three rows, so only a `PARKED` followed by a **date-shaped
 * token** is treated as an attempt at the marker: that catches the near-miss a
 * person actually writes (`PARKED 2026-10-16` with no colon, or a non-ISO date)
 * and leaves the prose alone.
 *
 * See docs/decisions/0045-a-parked-row-is-a-marker-not-a-state.md.
 */
const PARKED_ATTEMPT = /PARKED\s+\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/;
const PARKED_MARKER = /PARKED \d{4}-\d{2}-\d{2}:/;

export function checkParked(items) {
  const problems = [];
  if (!Array.isArray(items)) return problems;
  for (const item of items) {
    const where = item?.id ?? "?";
    const detail = typeof item?.detail === "string" ? item.detail : "";
    if (!PARKED_ATTEMPT.test(detail)) continue;
    if (!PARKED_MARKER.test(detail)) {
      problems.push(
        `${where}: a PARKED marker that is not "PARKED <YYYY-MM-DD>:" — a malformed marker parks the row for a reader and not for the census`,
      );
      continue;
    }
    if (item.state !== "open") {
      problems.push(
        `${where}: parked with state "${item.state}" — a parked row stays open, because a closed row has nothing left to defer`,
      );
    }
  }
  return problems;
}

/** How many rows are parked, so the census separates them from the work. */
export function parkedCount(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((i) => typeof i?.detail === "string" && PARKED_MARKER.test(i.detail)).length;
}

/**
 * Which file a row may sit in, because the split is by state.
 *
 * A row that reaches a closed state leaves the live file; a row that is not
 * closed has no business in the archive. Both directions are failures: a live
 * row in the archive is invisible to every reader of the live file and can
 * never be triaged, and a closed row in the live file is counted as work that
 * still needs doing.
 */
export function checkPlacement(register, items) {
  const problems = [];
  if (!Array.isArray(items)) return problems;
  const inArchive = register.endsWith("backlog-archive.jsonl");
  for (const item of items) {
    if (item?.state === undefined) continue;
    const closed = item.state === "verified" || item.state === "withdrawn";
    if (inArchive && !closed) {
      problems.push(`${item?.id ?? "?"}: state "${item.state}" in the archive — it holds verified and withdrawn rows only, so this row can never be worked or triaged`);
    }
    if (!inArchive && closed) {
      problems.push(`${item?.id ?? "?"}: state "${item.state}" in the live file — a closed row belongs in the archive, or it is counted as work still to do`);
    }
  }
  return problems;
}

/**
 * A row lives in one register, never both.
 *
 * Cross-file id disjointness is *assumed* by the moves between the two files
 * and was checked by nothing: a row copied into the archive without being
 * removed from the live file, or returned to live without leaving the archive,
 * leaves the checker reporting nothing while the same finding is counted twice
 * (or worked twice). A row that has moved is a `git mv` of one line, so a
 * reader may rely on the two files being disjoint.
 */
export function checkDisjoint(registers) {
  const problems = [];
  const owners = new Map();
  for (const { name, items } of registers) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item?.id === undefined) continue;
      const first = owners.get(item.id);
      if (first === undefined) owners.set(item.id, name);
      else problems.push(`${item.id}: present in both ${first} and ${name} — a row lives in one register, so one of the two is stale`);
    }
  }
  return problems;
}

/**
 * Rule 9: the register never loses a row.
 *
 * Every rule above validates a row and none of them sees the set. An append
 * script of the controller's own used `lastIndexOf` to find the last line's
 * start and cut the register's final row instead of appending after it, and the
 * gate printed the same count before and after — the deletion and the addition
 * cancelled in the only number it prints, so a filed finding was gone and the
 * run was green (`vg-502`).
 *
 * **The union of both registers, not the live file alone**: every close moves a
 * row from live to archive, so a rule reading one file would fire on the
 * register's normal operation. The invariant is that a row is never *lost*, and
 * the two files are one register split by state.
 *
 * Pure, so the self-test can drive it without git. See docs/decisions/0054.
 */
export function checkContinuity(previous, current) {
  const problems = [];
  if (!(previous instanceof Set) || !(current instanceof Set)) return problems;
  for (const id of previous) {
    if (current.has(id)) continue;
    problems.push(
      `${id}: was in a register at HEAD and is in neither now — a row that vanishes is the one ` +
        `thing membership cannot see, and a close MOVES a row between the files rather than removing it`,
    );
  }
  return problems;
}

/**
 * Every id either register carried at a revision, and whether that could be read.
 *
 * `checked: false` means the comparison could not run, and the caller must not
 * report a green over it — a summary line that reads `all valid` above a check
 * that never ran is the same false green `registerRows` refuses one level up. A
 * register whose HEAD copy does not parse is unreadable for this purpose rather
 * than a source of missing ids, which would report every one of its rows as
 * having vanished.
 */
export function idsAtHead(rev = "HEAD") {
  const ids = new Set();
  for (const path of ["docs/product/backlog.jsonl", "docs/product/backlog-archive.jsonl"]) {
    let text;
    try {
      // `maxBuffer` is explicit because the default is 1 MiB and the archive
      // passed it on 2026-10-16 (1.25 MB) — which threw `ENOBUFS` and would have
      // silently reported the comparison as unchecked. `readFileSync`, which the
      // rest of this file uses, has no such ceiling, so the two paths disagree
      // about what a register may weigh unless this is named.
      text = execFileSync("git", ["show", `${rev}:${path}`], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      const reason = String(error?.message ?? error).split("\n")[0];
      return { ids, checked: false, why: `${rev}:${path} could not be read — ${reason}` };
    }
    const { items, problems } = parse(text);
    if (problems.length > 0) {
      return { ids, checked: false, why: `${rev}:${path} does not parse — ${problems[0]}` };
    }
    for (const item of items) if (item?.id !== undefined) ids.add(item.id);
  }
  return { ids, checked: true, why: "" };
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
  const head = idsAtHead();
  const live = new Set(
    registers.flatMap(({ items: rows }) => rows.map((row) => row?.id)).filter((id) => id !== undefined),
  );
  const problems = [
    ...registers.flatMap(({ name, items, problems: readProblems }) =>
      [...readProblems, ...check(items), ...checkPlacement(name, items), ...checkParked(items)].map(
        (problem) => `${name}: ${problem}`,
      ),
    ),
    ...checkDisjoint(registers),
    ...checkContinuity(head.ids, live),
  ];
  const items = registers.reduce((count, register) => count + register.items.length, 0);
  const parked = registers.reduce((count, register) => count + parkedCount(register.items), 0);

  if (process.argv.includes("--self-test")) {
    const ok = (i) => check([i]).length === 0;
    const bad = (i) => check([i]).length > 0;
    const problem = (i, re) => check([i]).some((p) => re.test(p));
    // Rule 8 lives in its own function, so `problem` above cannot reach it —
    // asserting the message is what makes each case fail when the rule is
    // disabled, rather than passing because some other rule rejected the row.
    const parkedProblem = (i, re) => checkParked([i]).some((p) => re.test(p));
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
      // `vg-174` was the only row of 529 whose detail was not a string, and the
      // two readers of that field disagreed about what it said. Asserting the
      // message keeps the case failing when the rule is disabled, since the row
      // is valid in every other respect.
      ["a row whose detail is an array fails", problem({ ...valid, detail: ["the finding", "the ruling"] }, /detail must be a string/)],
      ["a row whose detail is a string passes", ok({ ...valid, detail: "why it was closed" })],
      // Rule 10 changed this case's premise: an open row needs no check, and it
      // may not carry one either — nor an `artefacts`, which is the same claim
      // in a different field. The case keeps its intent and now drops both.
      ["an open item needs no check, and carries neither close field", ok({ ...valid, state: "open", check: undefined, artefacts: undefined })],
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
      // Rule 6, and the first of these is the case that happened: `vg-505` was
      // written into the archive carrying `state: "open"`, where it was invalid
      // to work and invisible to every reader of the live file.
      ["an open row in the archive fails", checkPlacement("docs/product/backlog-archive.jsonl", [{ id: "vg-x", state: "open" }]).length > 0],
      ["an open row in the live file passes", checkPlacement("docs/product/backlog.jsonl", [{ id: "vg-x", state: "open" }]).length === 0],
      ["a verified row in the archive passes", checkPlacement("docs/product/backlog-archive.jsonl", [{ id: "vg-x", state: "verified" }]).length === 0],
      ["a withdrawn row in the archive passes", checkPlacement("docs/product/backlog-archive.jsonl", [{ id: "vg-x", state: "withdrawn" }]).length === 0],
      ["a verified row left in the live file fails", checkPlacement("docs/product/backlog.jsonl", [{ id: "vg-x", state: "verified" }]).length > 0],
      // Rule 7: a row lives in one register. Disjointness was assumed by every
      // move between the files and checked by nothing.
      ["an id in both registers fails", checkDisjoint([{ name: FILE, items: [{ id: "vg-x" }] }, { name: ARCHIVE, items: [{ id: "vg-x" }] }]).length > 0],
      ["registers with no shared id pass", checkDisjoint([{ name: FILE, items: [{ id: "vg-x" }] }, { name: ARCHIVE, items: [{ id: "vg-y" }] }]).length === 0],
      ["an unreadable register is a labelled failure", registerRows("docs/product/backlog.jsonl", null).problems.some((p) => /unreadable/.test(p))],
      ["an empty register is a failure, not all-valid", registerRows("docs/product/backlog.jsonl", "\n\n").problems.some((p) => /empty/.test(p))],
      // Rule 8: a parked row is `open` and carries a canonical marker. The last
      // case is the one that keeps the rule honest — three real rows say PARKED
      // in prose, and a rule that read the bare word would fail all three.
      ["a canonical PARKED marker on an open row passes", checkParked([{ id: "vg-x", state: "open", detail: "why it is parked. PARKED 2026-10-16: low value, real." }]).length === 0],
      ["PARKED with no colon fails", parkedProblem({ id: "vg-x", state: "open", detail: "PARKED 2026-10-16 low value" }, /not "PARKED/)],
      ["PARKED with a non-ISO date fails", parkedProblem({ id: "vg-x", state: "open", detail: "PARKED 16/10/2026: low value" }, /not "PARKED/)],
      ["a parked verified row fails", parkedProblem({ id: "vg-x", state: "verified", detail: "PARKED 2026-10-16: low value" }, /stays open/)],
      ["a parked withdrawn row fails", parkedProblem({ id: "vg-x", state: "withdrawn", detail: "PARKED 2026-10-16: low value" }, /stays open/)],
      ["PARKED as prose passes, because it is not a marker attempt", checkParked([{ id: "vg-x", state: "open", detail: "MINOR 5 WAS PARKED, NOT FIXED: the count stays optional." }]).length === 0],
      ["parkedCount counts markers and not prose", parkedCount([{ id: "a", state: "open", detail: "PARKED 2026-10-16: x" }, { id: "b", state: "open", detail: "was PARKED by the controller" }]) === 1],
      // Rule 10: a check is evidence of a close, and the axis is *closed* rather
      // than `verified`. The withdrawn case is the one that keeps the rule
      // honest — a rule written on "not verified" would fail it, and seven real
      // rows carry a check there as the record of what was examined.
      ["a check on an open row fails", problem({ ...valid, state: "open", check: "ran the linter" }, /evidence of a close/)],
      ["artefacts on an open row fails", problem({ ...valid, state: "open", artefacts: ["HEAD"] }, /evidence of a close/)],
      ["a check on an in-progress row fails", problem({ ...valid, state: "in progress", check: "ran the linter" }, /evidence of a close/)],
      ["a check on a withdrawn row passes, because it records what was examined", ok({ ...valid, state: "withdrawn" })],
      // Rule 9: the register never loses a row. The middle case is the incident
      // itself — the count was identical before and after, so only the id set
      // can see it.
      ["a row that vanished from both registers fails", checkContinuity(new Set(["vg-a", "vg-b"]), new Set(["vg-b"])).length > 0],
      ["a row that moved between the registers passes", checkContinuity(new Set(["vg-a"]), new Set(["vg-a"])).length === 0],
      ["a row added since HEAD passes", checkContinuity(new Set(["vg-a"]), new Set(["vg-a", "vg-b"])).length === 0],
      // The comparison is only worth its green if it ran, so the read itself is
      // a case: this fails if `git show HEAD:<register>` stops resolving.
      ["HEAD's registers can be read, so continuity is compared and not assumed", idsAtHead().checked === true],
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
  process.stdout.write(
    `backlog-check: ${items} items across both registers, ` +
      (head.checked
        ? "all valid"
        : `valid by shape, continuity NOT checked (${head.why})`) +
      ` (${parked} parked, ${items - parked} to work or closed)\n`,
  );
}
