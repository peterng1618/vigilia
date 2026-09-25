#!/usr/bin/env node

// Compaction checkpoint: PreCompact writes it, SessionStart(compact) reads it.
//
// A controller running subagent-driven development keeps its dispatch state —
// which agent id is working, against which base commit — only in context. The
// SDD ledger records rulings and completions, not in-flight dispatches, so
// compaction leaves a resumed controller unable to tell a running agent from a
// lost one. That is the failure that produced an unaccountable working-tree
// edit and a controller that stopped rather than commit work it could not name.
//
// PreCompact cannot make the model take a turn (command hooks communicate
// through stdout, stderr and exit codes only), so the snapshot is written here
// rather than requested from the controller. SessionStart is one of the events
// whose stdout reaches the model's context, so that half is an injection.
//
// The durable half is neither: a controller that writes a dispatch record at
// dispatch time never needs recovery. The injected text asks for it.
//
// The active plan is the workspace holding a live dispatch record, never the
// workspace whose ledger moved most recently — see ADR-0010. Ledger mtime marked
// four plans active at once, three of them finished or queued, and would drop a
// plan whose dispatch outlived a 24h quiet spell.
//
// Usage:
//   node scripts/sdd-checkpoint.mjs snapshot   # PreCompact hook
//   node scripts/sdd-checkpoint.mjs resume     # SessionStart hook, matcher compact
//   node scripts/sdd-checkpoint.mjs start      # SessionStart hook, matcher startup
//   node scripts/sdd-checkpoint.mjs --self-check
//
// Every mode reads the hook payload on stdin and always exits 0. A hook that
// blocks compaction or shows the user an error is worse than no snapshot.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

// A record that has not been touched in a week describes a dispatch nobody is
// waiting on any more; treating it as live would inject a stale agent id as
// fact. Nothing in the schema refreshes a record, so mtime is the only signal.
const DISPATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LEDGER_LINES = 40;
// Injected text competes with the context compaction just freed, so it stays
// small; the full snapshot stays on disk for the controller to read.
const MAX_CONTEXT_CHARS = 6000;

const mode = process.argv[2];

// Both silent-when-wrong behaviours get a runnable check: a task shown complete
// that is not makes the controller skip real work, and a plan shown active that
// is not injects a stale agent id as fact.
// `node scripts/sdd-checkpoint.mjs --self-check`.
if (mode === "--self-check") {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");

  const dir = mkdtempSync(join(tmpdir(), "sdd-check-"));
  const fixture = join(dir, "progress.md");
  writeFileSync(
    fixture,
    [
      "# SDD ledger — plan: x",
      "Task 3: dispatched (base 0175255)",
      "Task 1: complete (commits a..b)",
      "Task 3: Ruling: this line is a ruling, not a status",
      "Task 3: complete (commits c..d)",
      "### Task 2: CLOSED — re-review clean",
    ].join("\n"),
  );
  const got = statusLines(fixture);
  const want = [
    "Task 1: complete (commits a..b)",
    "Task 2: CLOSED — re-review clean",
    "Task 3: complete (commits c..d)",
  ];
  const statusOk = JSON.stringify(got) === JSON.stringify(want);

  // A plan with a recently-written ledger but no dispatch record is queued or
  // finished, not active — the case the mtime heuristic got wrong. The fixture
  // also pins the two rules that replaced it: only the plan STATUS.md names is
  // active, and a record under any other plan is surfaced, never trusted.
  const fake = mkdtempSync(join(tmpdir(), "sdd-plans-"));
  const base = join(fake, ".superpowers", "sdd");
  const plan = (slug, files) => {
    mkdirSync(join(base, slug), { recursive: true });
    writeFileSync(join(base, slug, "progress.md"), `# SDD ledger — plan: ${slug}\n`);
    for (const [name, body] of Object.entries(files)) {
      writeFileSync(join(base, slug, name), `${body}\n`);
    }
  };
  plan("2026-09-25-editor-viewport-and-mechanics", {
    "dispatch-a41b65ed.md": "Task 4 — agent a41b65ed",
    "dispatch-b72c99f0.md": "Task 5 — agent b72c99f0",
  });
  plan("2026-09-25-snapping-fidelity", { "dispatch-c1234567.md": "Task 6 — agent c1234567" });
  plan("2026-09-24-author-journey", {});
  writeFileSync(
    join(fake, "STATUS.md"),
    [
      "## Active work",
      "",
      "- **Active plan:** `docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md`.",
    ].join("\n"),
  );
  const state = recoveryState(fake);
  const shape = {
    active: state.active.map((p) => [p.slug, p.records.length]),
    unowned: state.unowned.map((p) => p.slug),
  };
  const plansOk =
    JSON.stringify(shape) ===
    JSON.stringify({
      active: [["2026-09-25-editor-viewport-and-mechanics", 2]],
      unowned: ["2026-09-25-snapping-fidelity"],
    });

  // An expired record must survive as an explicit marker rather than vanish into
  // "no dispatch ever existed".
  const old = join(base, "2026-09-25-snapping-fidelity", "dispatch-c1234567.md");
  writeFileSync(old, "Task 6 — agent c1234567\n");
  const past = new Date(Date.now() - 8 * 86_400_000);
  const { utimesSync } = await import("node:fs");
  utimesSync(old, past, past);
  // Searched across both lists so this check fails on its own rule rather than
  // cascading when the recoveryState check is the one that broke.
  const all = recoveryState(fake);
  const queued = [...all.active, ...all.unowned].find(
    (entry) => entry.slug === "2026-09-25-snapping-fidelity",
  );
  const expiredLines = queued ? recordLines(queued) : [];
  const expiredOk =
    expiredLines.some((line) => line.includes("EXPIRED")) &&
    !expiredLines.some((line) => line.includes("Task 6"));

  const checks = [
    ["statusLines", statusOk, JSON.stringify(got)],
    ["recoveryState", plansOk, JSON.stringify(shape)],
    ["expiredRecords", expiredOk, JSON.stringify(expiredLines)],
  ];
  const ok = checks.every(([, passed]) => passed);
  console.log(
    ok
      ? "self-check OK"
      : `self-check FAILED\n${checks
          .filter(([, passed]) => !passed)
          .map(([name, , detail]) => `  ${name}: ${detail}`)
          .join("\n")}`,
  );
  process.exit(ok ? 0 : 1);
}

function payload() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

function git(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function repoRoot(hint) {
  for (const candidate of [hint, process.cwd()]) {
    if (!candidate) continue;
    const root = git(candidate, ["rev-parse", "--show-toplevel"]);
    if (root) return root;
  }
  return "";
}

// Hoisted on purpose: the --self-check block at the top of this file runs before
// any `const` initializer below it.
function sddRoot(root) {
  return join(root, ".superpowers", "sdd");
}

// Plans that exist at all, whatever their state. A workspace with no ledger is
// not a plan workspace.
function allPlans(root) {
  const base = sddRoot(root);
  if (!existsSync(base)) return [];
  const plans = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(base, entry.name);
    const ledger = join(dir, "progress.md");
    if (!existsSync(ledger)) continue;
    plans.push({ slug: entry.name, dir, ledger });
  }
  return plans;
}

// Dispatch records for one plan: `dispatch-<agent id>.md`, plus the singular
// `dispatch.md` the first version of this convention wrote. Reads are guarded so
// a record deleted between the readdir and the read cannot fail a hook.
//
// Expired records are returned, not dropped. A record past the TTL is an expired
// recovery artifact, not evidence of a live agent — but reporting it as "no
// dispatch ever existed" would hide a dispatch that happened and was abandoned,
// which is the one thing a resumed controller most needs to see.
function dispatchRecords(dir) {
  const now = Date.now();
  const live = [];
  const expired = [];
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return { live, expired };
  }
  for (const name of names) {
    if (!/^dispatch(-[A-Za-z0-9_-]+)?\.md$/.test(name)) continue;
    const path = join(dir, name);
    let mtimeMs;
    try {
      mtimeMs = statSync(path).mtimeMs;
    } catch {
      continue;
    }
    const record = { name, path, mtimeMs };
    if (now - mtimeMs > DISPATCH_TTL_MS) expired.push(record);
    else live.push(record);
  }
  const byNewest = (a, b) => b.mtimeMs - a.mtimeMs;
  return { live: live.sort(byNewest), expired: expired.sort(byNewest) };
}

// The plan `STATUS.md` names, read from its own `**Active plan:**` marker. Only
// the path is needed, so this is a scan for that marker rather than a parse of
// the document; a missing or unreadable STATUS.md yields "" and every plan is
// then treated as non-authoritative.
function activePlanPath(root) {
  let text;
  try {
    text = readFileSync(join(root, "STATUS.md"), "utf8");
  } catch {
    return "";
  }
  const match = /^\s*[-*]\s*\*\*Active plan:\*\*\s*`([^`]+)`/m.exec(text);
  return match ? match[1].trim() : "";
}

// Does this workspace belong to the plan STATUS.md names? The workspace slug is
// the plan file's basename, which is what sdd-workspace keys on.
function isActivePlan(plan, activePath) {
  if (!activePath) return false;
  return activePath.split("/").pop().replace(/\.md$/, "") === plan.slug;
}

function readRecord(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "(record disappeared between listing and read)";
  }
}

// A live record is read verbatim; an expired one is reported as what it is, so
// "expired" never reads as "nothing was ever dispatched here".
function recordLines(plan) {
  const lines = plan.records.map((record) => readRecord(record.path));
  for (const record of plan.expired) {
    const ageDays = Math.round((Date.now() - record.mtimeMs) / 86_400_000);
    lines.push(
      `[EXPIRED ${ageDays}d — ${record.name}: abandoned recovery artifact, not a live agent]`,
    );
  }
  return lines;
}

// The plan STATUS.md names, plus any workspace holding a dispatch record it did
// not name.
//
// STATUS.md stays the authority for which plan is active (AGENTS.md), so a
// record under a queued plan must never promote that plan. But such a record is
// exactly the state a resumed controller has to reconcile — a dispatch against
// the wrong plan is a mistake worth surfacing, not evidence worth trusting.
function recoveryState(root) {
  const activePath = activePlanPath(root);
  const named = activePath ? activePath.split("/").pop().replace(/\.md$/, "") : "";
  const active = [];
  const unowned = [];
  for (const plan of allPlans(root)) {
    const { live, expired } = dispatchRecords(plan.dir);
    if (live.length === 0 && expired.length === 0) continue;
    const entry = { ...plan, records: live, expired, named: plan.slug === named };
    (entry.named ? active : unowned).push(entry);
  }
  return { active, unowned, activePath };
}

// The ledger's own task-status section is the recovery-critical part; its
// rulings above it are long and are not what a resumed controller needs first.
function ledgerTail(path) {
  const lines = readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^## .*Task status/.test(lines[i])) start = i;
  }
  const from = start === -1 ? Math.max(0, lines.length - MAX_LEDGER_LINES) : start;
  return lines.slice(from, from + MAX_LEDGER_LINES).join("\n").trim();
}

// Which tasks are done, mid-loop or dispatched — the only ledger fact a resumed
// controller must have before it can dispatch anything. The rulings around
// these lines run to thousands of lines and are read on demand, not injected.
//
// Ledgers are append-only and self-correcting: a later line supersedes an
// earlier one for the same task ("Task 3: dispatched" then "Task 3: complete").
// Keeping the last occurrence per task is what makes the summary agree with the
// ledger instead of contradicting it.
function statusLines(path) {
  const lines = readFileSync(path, "utf8").replace(/\r\n/g, "\n").split("\n");
  const latest = new Map();
  for (const line of lines) {
    const match = /^#{0,3}\s*Task (\d+):(.*)$/.exec(line);
    if (!match) continue;
    const [, number, rest] = match;
    if (/^\s*Ruling:/.test(rest)) continue;
    latest.set(Number(number), `Task ${number}:${rest}`.trim());
  }
  return [...latest.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, line]) => line);
}

function snapshot(root, sessionId) {
  const parts = [
    `# Compaction checkpoint — session ${sessionId}`,
    "",
    `Snapshot written ${new Date().toISOString()} before context compaction.`,
    "Machine-generated by scripts/sdd-checkpoint.mjs; do not edit.",
    "",
    "## Git anchor",
    "",
    `branch: ${git(root, ["rev-parse", "--abbrev-ref", "HEAD"])}`,
    `head: ${git(root, ["log", "-1", "--format=%h %s"])}`,
    `dirty: ${git(root, ["status", "--porcelain"]).split("\n").filter(Boolean).length} paths`,
    "",
    "```",
    git(root, ["log", "--oneline", "-8"]),
    "```",
    "",
    "## Uncommitted work",
    "",
    "```",
    git(root, ["diff", "--stat"]) || "(clean)",
    git(root, ["status", "--porcelain"]),
    "```",
  ];
  const { active, unowned, activePath } = recoveryState(root);
  parts.push(
    "",
    "## Active plan (STATUS.md)",
    "",
    activePath ? `STATUS.md names: ${activePath}` : "STATUS.md names no active plan",
  );
  if (active.length === 0) {
    parts.push("", "## In-flight dispatch", "", "(no live dispatch record)");
  }
  for (const plan of active) {
    parts.push(
      "",
      `## In-flight dispatch — ${plan.slug}`,
      "",
      ...recordLines(plan),
      "",
      `## Ledger tail — ${plan.slug}`,
      "",
      "```",
      ledgerTail(plan.ledger),
      "```",
    );
  }
  if (unowned.length > 0) {
    parts.push(
      "",
      "## Dispatch records outside the active plan — reconcile, do not trust",
      "",
      ...unowned.flatMap((plan) => [`### ${plan.slug}`, ...recordLines(plan)]),
    );
  }
  return parts.join("\n");
}

// The recovery path only works if the record it reads was being written. This
// is the only place the convention can be stated without spending the
// controller's context on it: it costs one line per session, once.
//
// Deliberately keyed off *any* workspace, not `activePlans`: a session that has
// not dispatched yet has no record, and gating the convention on one would mean
// it is never taught to the session that needs to start writing them. The
// workspace named here is the most recently touched ledger — a hint for where to
// write, not a claim about what is active.
function startContext(root) {
  const plans = allPlans(root);
  if (plans.length === 0) return "";
  const newest = plans
    .map((plan) => {
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(plan.ledger).mtimeMs;
      } catch {
        // An unreadable ledger only loses the hint, not the convention.
      }
      return { ...plan, mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return [
    "Subagent-driven development is in flight on this repo. The ledger records rulings and completions; it does NOT record what is running. Context compaction destroys the difference.",
    "",
    `So: write \`<workspace>/dispatch-<agent id>.md\` when you dispatch a subagent — plan, task, agent id, base sha, state — and delete it when that task completes. \`STATUS.md\` names the one active plan; dispatch records say what is running inside it. Most recently touched workspace: ${newest.dir}`,
    "",
    "A PreCompact hook snapshots git state and every ledger tail to `.superpowers/sdd/checkpoint/<session-id>.md` and re-injects the dispatch state after compaction. An unrecorded dispatch is the one thing that recovery cannot reconstruct.",
  ].join("\n");
}

function resumeContext(root, sessionId) {
  const dir = join(sddRoot(root), "checkpoint");
  const file = join(dir, `${sessionId}.md`);
  const { active, unowned, activePath } = recoveryState(root);
  const text = [
    "Context was compacted. Your recollection of in-flight work is gone; the files are not.",
    "Trust `git log` and the ledgers below over your own recollection of what you did.",
    "",
    "Git anchor:",
    `  branch: ${git(root, ["rev-parse", "--abbrev-ref", "HEAD"])}`,
    `  head: ${git(root, ["log", "-1", "--format=%h %s"])}`,
    `  dirty: ${git(root, ["status", "--porcelain"]).split("\n").filter(Boolean).length} paths (read the snapshot before trusting any working-tree edit)`,
    "",
    activePath
      ? `Active plan per STATUS.md: ${activePath}`
      : "STATUS.md names no active plan — every dispatch record below is unreconciled.",
    "",
    "In-flight dispatch and task status:",
  ];
  if (active.length === 0) {
    text.push("", "(no live dispatch record for the active plan — nothing is in flight)");
  }
  for (const plan of active) {
    text.push(
      "",
      `### ${plan.slug}`,
      ...recordLines(plan),
      "",
      "Tasks:",
      ...statusLines(plan.ledger).map((line) => `  ${line}`),
    );
  }
  if (unowned.length > 0) {
    text.push(
      "",
      "Dispatch records under plans STATUS.md does not name — these do NOT make",
      "those plans active. Reconcile each: a dispatch against a queued plan is a",
      "mistake to resolve, not work to resume.",
      ...unowned.flatMap((plan) => ["", `### ${plan.slug}`, ...recordLines(plan)]),
    );
  }
  text.push(
    "",
    "Before your next dispatch:",
    "1. A task listed `complete` is DONE — never re-dispatch it. Resume at the first task with no such line.",
    "2. Reconcile each in-flight dispatch against live agents. An agent id you cannot find is not running: its work is in `git log` or it is lost. Do not assume it finished.",
    "3. Write each dispatch to `<workspace>/dispatch-<agent id>.md` when you dispatch (task, agent id, base sha, state) and delete it on completion. The ledger records rulings; only the dispatch record says what is running.",
    "",
    `Full pre-compaction snapshot (git log, ledger tails, uncommitted diffstat): ${file}`,
  );
  const joined = text.join("\n");
  return joined.length > MAX_CONTEXT_CHARS
    ? `${joined.slice(0, MAX_CONTEXT_CHARS)}\n\n[truncated — read ${file} in full]`
    : joined;
}

function prune(dir) {
  const cutoff = Date.now() - CHECKPOINT_TTL_MS;
  for (const name of readdirSync(dir)) {
    try {
      if (statSync(join(dir, name)).mtimeMs < cutoff) rmSync(join(dir, name));
    } catch {
      // Best effort: an unprunable checkpoint is not worth failing the hook over.
    }
  }
}

try {
  const input = payload();
  const root = repoRoot(input.cwd);
  // Project hooks run inside subagents, and `agent_id` is present only there.
  // Without this guard a worker that compacts receives controller instructions
  // about reconciling other agents — and a worker writing the root's dispatch
  // snapshot would report a state it does not own (ADR-0010).
  const inSubagent = typeof input.agent_id === "string" && input.agent_id !== "";
  if (root && !inSubagent) {
    const sessionId = String(input.session_id ?? "unknown").replace(
      /[^A-Za-z0-9_-]/g,
      "",
    );
    if (mode === "snapshot") {
      const dir = join(sddRoot(root), "checkpoint");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${sessionId}.md`), `${snapshot(root, sessionId)}\n`);
      prune(dir);
    } else if (mode === "resume" || mode === "start") {
      // The settings matcher scopes each of these to one source; re-checking
      // `source` here would only add a way to silently no-op.
      const additionalContext =
        mode === "start" ? startContext(root) : resumeContext(root, sessionId);
      if (additionalContext) {
        process.stdout.write(
          JSON.stringify({
            hookSpecificOutput: {
              hookEventName: "SessionStart",
              additionalContext,
            },
          }),
        );
      }
    }
  }
} catch {
  // A hook that fails loudly is worse than one that does nothing.
}
