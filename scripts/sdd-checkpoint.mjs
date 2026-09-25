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
// The durable half is neither: a controller that writes `dispatch.md` at
// dispatch time never needs recovery. The injected text asks for it.
//
// Usage:
//   node scripts/sdd-checkpoint.mjs snapshot   # PreCompact hook
//   node scripts/sdd-checkpoint.mjs resume     # SessionStart hook, matcher compact
//   node scripts/sdd-checkpoint.mjs start      # SessionStart hook, matcher startup
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

// Only plans whose ledger moved recently are in flight; the rest are finished
// and their state cannot help a resumed controller.
const ACTIVE_PLAN_WINDOW_MS = 24 * 60 * 60 * 1000;
const CHECKPOINT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LEDGER_LINES = 40;
// Injected text competes with the context compaction just freed, so it stays
// small; the full snapshot stays on disk for the controller to read.
const MAX_CONTEXT_CHARS = 6000;

const mode = process.argv[2];

// The summary is silent when wrong — a task shown complete that is not causes
// the controller to skip real work — so the parse gets one runnable check.
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
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(ok ? "self-check OK" : `self-check FAILED\n${JSON.stringify(got, null, 2)}`);
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

const sddRoot = (root) => join(root, ".superpowers", "sdd");

function activePlans(root) {
  const base = sddRoot(root);
  if (!existsSync(base)) return [];
  const now = Date.now();
  const plans = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const ledger = join(base, entry.name, "progress.md");
    if (!existsSync(ledger)) continue;
    if (now - statSync(ledger).mtimeMs > ACTIVE_PLAN_WINDOW_MS) continue;
    plans.push({ slug: entry.name, dir: join(base, entry.name), ledger });
  }
  return plans;
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
  const plans = activePlans(root);
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
  if (plans.length === 0) {
    parts.push("", "## Active plans", "", "(no ledger modified in the last 24h)");
  }
  for (const plan of plans) {
    const dispatch = join(plan.dir, "dispatch.md");
    parts.push(
      "",
      `## In-flight dispatch — ${plan.slug}`,
      "",
      existsSync(dispatch)
        ? readFileSync(dispatch, "utf8").trim()
        : "(no dispatch.md — no in-flight dispatch was recorded for this plan)",
      "",
      `## Ledger tail — ${plan.slug}`,
      "",
      "```",
      ledgerTail(plan.ledger),
      "```",
    );
  }
  return parts.join("\n");
}

// The recovery path only works if the record it reads was being written. This
// is the only place the convention can be stated without spending the
// controller's context on it: it costs one line per session, once.
function startContext(root) {
  const plans = activePlans(root);
  if (plans.length === 0) return "";
  return [
    "Subagent-driven development is in flight on this repo. The ledger records rulings and completions; it does NOT record what is running. Context compaction destroys the difference.",
    "",
    "So: write `<workspace>/dispatch.md` when you dispatch a subagent — plan, task, agent id, base sha, state — and rewrite it when that task completes. Workspaces:",
    ...plans.map((plan) => `  ${plan.dir}`),
    "",
    "A PreCompact hook snapshots git state and every ledger tail to `.superpowers/sdd/checkpoint/<session-id>.md` and re-injects the dispatch state after compaction. An unrecorded dispatch is the one thing that recovery cannot reconstruct.",
  ].join("\n");
}

function resumeContext(root, sessionId) {
  const dir = join(sddRoot(root), "checkpoint");
  const file = join(dir, `${sessionId}.md`);
  const plans = activePlans(root);
  const text = [
    "Context was compacted. Your recollection of in-flight work is gone; the files are not.",
    "Trust `git log` and the ledgers below over your own recollection of what you did.",
    "",
    "Git anchor:",
    `  branch: ${git(root, ["rev-parse", "--abbrev-ref", "HEAD"])}`,
    `  head: ${git(root, ["log", "-1", "--format=%h %s"])}`,
    `  dirty: ${git(root, ["status", "--porcelain"]).split("\n").filter(Boolean).length} paths (read the snapshot before trusting any working-tree edit)`,
    "",
    "In-flight dispatch and task status per active plan:",
  ];
  for (const plan of plans) {
    const dispatch = join(plan.dir, "dispatch.md");
    text.push(
      "",
      `### ${plan.slug}`,
      existsSync(dispatch)
        ? readFileSync(dispatch, "utf8").trim()
        : "(no dispatch.md — no in-flight dispatch recorded)",
      "",
      "Tasks:",
      ...statusLines(plan.ledger).map((line) => `  ${line}`),
    );
  }
  text.push(
    "",
    "Before your next dispatch:",
    "1. A task listed `complete` is DONE — never re-dispatch it. Resume at the first task with no such line.",
    "2. Reconcile each in-flight dispatch against live agents. An agent id you cannot find is not running: its work is in `git log` or it is lost. Do not assume it finished.",
    "3. Write each dispatch to `<workspace>/dispatch.md` when you dispatch (task, agent id, base sha, state) and rewrite it on completion. The ledger records rulings; only `dispatch.md` records what is running.",
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
  if (root) {
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
