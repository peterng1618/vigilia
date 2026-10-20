# 0081 — Agent scratch goes to one root, and the gate refuses the rest

- **Date:** 2026-10-21
- **Status:** accepted
- **Paths:** `scripts/scratch-gate.mjs`, `.claude/settings.json`, `src/web/package.json`

## The problem

**The user's question, 2026-10-21:** *"How do we prevent agents from saving scratch files &
folders from all over the places?"* — asked while a cleanup found **264 MB of agent scratch at
the root of `D:\`** (`scratch/` 46M, `tmp/` 28M, `vigilia-tester/` 182M, and `vigilia-pass/`,
`vigilia-scratch/`, `vigilia-proof/`, `vigilia-baseline-12d/`, `tmp-vigilia-final/`,
`vigil-redesign/`, `vigilia-agent-labels/`, `tmp-host.json`, `tmp-vt-report.json`) and **560 MB
under `C:\tmp`** (130 directories, 2279 entries) — beside in-tree residue: 22 orphan
`.claude/worktrees/agent-*` directories, `src/web/.agent-scratch/` (13M, the directory `vg-368`
was filed about) and two `.playwright-mcp/`.

Three mechanisms produced that, and they are three different failures:

1. **A relative path resolved against the wrong root.** `/tmp` is not `/tmp` here: Node resolves a
   leading-slash path against the **current drive**, so a session whose cwd is on `D:` writes
   `D:\tmp`. The drain plan's own note measured it (`fs.readFileSync('/tmp/…')` → `ENOENT …
   D:\tmp\…`), and it is why `D:\tmp` held logs and probe trees.
2. **`.gitignore` is not a boundary.** It hides a directory from git and from nothing else:
   `src/web/.agent-scratch/` was ignored for weeks and still counted in a census's denominator
   (`vg-368`), and the repo's answer was to teach three walkers to exclude it by name
   (`dead-selectors.mjs:38`, `manager-census.md:334`, `design-md.mjs`) — compensation, not
   cleanup. That row's ruling (2026-10-12, relocate outside the tree) and the drain plan's task
   for it (`2026-10-12-the-backlog-drain.md:4610`) were never executed.
3. **Every cleanup so far has been git-shaped.** The pass that removed 22 seats' worktrees left
   exactly their ignored content: 22 skeletons holding **0 regular files** and 144 dangling
   junctions, because `git worktree remove` and the harness's own "auto-cleaned if unchanged"
   both judge by `git status`.

So the problem is not carelessness. It is that **nothing in the loop says where scratch is
allowed to go**, and every mechanism meant to clean up afterwards asked git — which cannot see
the thing that was left.

## Rung 1 — Vigilia

Searched: `.gitignore` (96 lines), every walker that measures the tree (`dead-code-sweep.mjs`,
`dead-selectors.mjs`, `design-md.mjs`, `docs/architecture/manager-census.md`), the register for
scratch rows, the tracked `.claude/settings.json`, and the SDD ledgers' cleanup notes.

Found: **an ignore list and a naming convention, and no boundary.**
`scripts/reuse-gate.mjs` is already a `PreToolUse` hook on `Edit|Write|MultiEdit` that refuses a
write *by path* — exit 2 plus a stderr message — so the mechanism this needs exists and is in
daily use; what it checks is a different question (mechanism boundaries, not locations). The
harness's `PreToolUse` is therefore the seam to reuse rather than a new one to invent.

## Rung 2 — dependencies

Searched: what a check would need — a tree walk, git's own ignore verdict, the OS temp root, and
the hook's stdin contract.

Found: **nothing to install.** `readdirSync`, `git check-ignore --stdin`, `os.tmpdir()` and an
exit code cover it, and both halves are plain Node. The open question is not a library but a
layer: the harness's own permission surface may be able to deny a write by path, which would be
cheaper than a hook (rung 3).

## Rung 3 — platform

Searched: `os.tmpdir()` on this box, Node's resolution of a leading-slash path, Windows junction
semantics, and the harness's permission surface (tracked `.claude/settings.json` and the user's
global one).

Found:
- `os.tmpdir()` is `C:\Users\peter\AppData\Local\Temp`; **Node resolves `/tmp` against the current
  drive**, which is the mechanism behind `D:\tmp`.
- The project's `.claude/settings.json` carries **no permission rules at all** — only
  `enabledPlugins` and `hooks` — and the global one carries `permissions.allow` for `Bash(npm run
  *)`, `Bash(node *)` and friends. Nothing, at either level, restricts *where* a write lands.
- A **junction must be removed as a link**. Windows `rmdir` does that; a recursive delete that
  follows it walks into the target, which is how a "cleanup" can damage the checkout it was
  cleaning around. **Proved, because the blast radius is the main checkout**: a synthetic tree
  whose junction points at a directory with a file in it, removed with Node's
  `fs.rmSync(recursive)` — target survived, link removed. That is the delete this work uses, and
  the reason it is not `Remove-Item -Recurse`.
- **The harness's own permission surface cannot fence this on Windows, and the documented
  reason matters more than the conclusion.** A `permissions.deny` path rule is consulted for
  `Read(...)` and `Edit(...)` **only** — a `Write(path)` rule is accepted, never consulted, and
  warns at startup — so a path rule would cover the file tools and miss the shell redirect that
  produced most of the drive-root debris. Anchoring is also its own trap: `/path` means *the
  settings source*, `//path` the filesystem root, and on Windows a path normalises to
  `/c/Users/...`, so `//D:/**` is not the form the documentation shows. The OS-level answer —
  the sandbox — **does not run on native Windows** (`sandbox.enabled` defaults off and the
  platform note says commands run unsandboxed here), and there is **no documented write-side
  equivalent of `blockReadsOutsideWorkingDirectories`**. `PreToolUse` exit 2 blocking the call
  is documented, and `reuse-gate.mjs` already proves the shape works in this repo.

## Rung 4 — ecosystem

Searched: how the tools that already own this problem answer it — `git clean -X` / `-x` (the
canonical "remove ignored residue"), `git status --ignored`, npm's `files` publish allowlist,
CI steps that fail on untracked files, and the agent-side options (a sandboxed temp dir, tool
permission rules, pre-tool hooks).

Found: **the two real answers are "sandbox the writer" and "refuse at the tool boundary", and
this box can only have the second.** A sandbox (container, CI runner, `TMPDIR`-only process)
solves it by construction and is not available to an agent working in the user's own checkout
with a shell; what remains is the boundary the harness already exposes, which is also the one
this repo already uses for its own rules. The git-shaped answers agree with rung 1's finding
in a way worth recording: `git clean -X` deletes ignored content rather than hiding it, so the
ecosystem's own fix is a **filesystem** operation — and the reason the debris survived here is
that nobody ran one.

## Rung 5 — comparison

| Option | Fit | Cost | Risk | Verdict |
|---|---|---|---|---|
| Keep adding ignore rules and walker exclusions | Nothing changes | Zero | The residue stays a live input to every scan, which is what `vg-368` cost | Rejected — this is the status quo that produced the question |
| One line in `AGENTS.md` naming the scratch root | Reachable | One line | Nothing enforces it; the rule that was skipped is the one nobody reads at the moment of writing | Rejected as the only lever, kept as documentation |
| Harness permission rules (`permissions.deny` by path) | Reaches the file tools | Config only | Rung 3, from the harness's own docs: a path rule on `Write` is **accepted and never consulted**, and a shell redirect is out of its reach entirely; no sandbox on native Windows | Rejected as the whole answer, and not added as a second lock — a rule that is not consulted reads like a fence and is not one |
| **A `PreToolUse` refusal on the path, plus a gate step that walks the tree** | Both halves already exist in this repo's idiom | One script with two modes, one hook entry, one gate step | The refusal cannot see what a *tool* writes (the Playwright MCP, `npm ci`), which is exactly what the gate step is for | **Chosen** |

## Rung 6 — probe

Measured during the cleanup this decision came from, on this box:

- `D:\` root: 264 MB of agent scratch in eleven entries, the largest `vigilia-tester/` at 182 MB
  and `scratch/` at 46 MB; deleted, leaving the user's own directories untouched.
- `C:\tmp`: 560 MB, 130 directories, 2279 entries — `vigilia-drain/` 182M, `shallow-full/` 60M,
  `vigilia-walkthrough/` 57M, `t4rev/` 38M, `shallow-probe/` 24M.
- `.claude/worktrees/`: 23 leftovers — 22 `agent-*` directories holding **0 regular files** and
  144 junctions between them (2.2 MB), which is the git-shaped cleanup's own signature, plus a
  seat's `.task252-scratch/` (10 files, 342 KB of build and e2e logs) and one npm-ci log, which
  are the *other* failure: scratch written inside the tree and ignored, so no ignore rule would
  ever sweep it.
- `src/web/.agent-scratch/`: 13 MB, eight files, dated 2026-09-30.
- A plain `grep -rn` over the tree **timed out at 120 s** on the residue, which is the cost the
  memory already recorded: an ignored-but-present directory is a live input to every walk.

## Decision

**Scratch outside the repository goes under the OS temp tree or `C:\tmp\`, and the loop refuses
anywhere else.** One script owns the policy (`scripts/scratch-gate.mjs`) and runs in two modes:

- **as a `PreToolUse` hook**, refusing a `Write`/`Edit` whose path is scratch-shaped inside the
  repo or outside the sanctioned roots — and, for a `Bash` command, refusing one whose obvious
  output targets resolve there, because the drive-root debris came from shell redirections and
  from scripts, not from the file tools;
- **as a gate step** (`node scripts/scratch-gate.mjs --sweep`), walking the tree and failing on
  ignored-but-present entries that are not one of the documented stores — the half that catches
  what a hook cannot see, and the only half that is a *filesystem* walk.

The refusal is deliberately blunt and fails open: it judges a path and a short list of output
shapes, and a command it cannot read is allowed through to the gate step. A gate that refuses
work it does not understand is worse than one that misses a case.

Two details the implementation settled that the decision above did not:

- **The store list is matched per *segment*, not per path.** Git's own bare patterns match at any
  depth, so `packages/<pkg>/dist/` is as legitimate as the root one, and a list of full paths
  would have to name every package and go stale the next time one is added. Everything ignored
  that is *not* a documented segment is a finding, which is what stops the list growing quietly.
- **`.claude/` is a store, so the sweep cannot see the dead seats inside it** — and the 22
  skeletons are the largest single piece of residue this decision came from. They get their own
  check instead of a store exception: a directory under `.claude/worktrees/` that
  `git worktree list` does not name is a leftover, because that registry is what tells a live
  seat's checkout from its remains.

## What implements it

- `scripts/scratch-gate.mjs` — one policy, three modes: the `PreToolUse` refusal, `--sweep`, and
  `--self-test`, which proves both halves can fail (15 path cases, 5 command shapes, the store
  list's own shape, and the sweep's verdict on both a synthetic tree and this one).
- `.claude/settings.json` gains a `PreToolUse` entry on `Edit|Write|MultiEdit|NotebookEdit|Bash`
  beside the existing `reuse-gate` entry, which is the seam rung 1 found.
- `src/web/package.json` gains `scratch:check` and chains it into `gate` after `docs:check`, and
  `gates:self-test` chains the script's own self-test. CI runs `npm run gate`, so it is covered
  without a workflow edit.
- `docs/architecture/ownership.md` needed no row: the gate owns a policy about *where files go*,
  not a concept the product renders.

## Verified, and what is not

- **The refusal**: the exact hook command, fed the three payload shapes on stdin — a write to
  `D:\vigilia-tester\probe.mjs` exit 2, a write to a tracked source file exit 0, and a Bash
  redirect to `/tmp/full.json` exit 2. `/tmp` is the case worth having: it is the relative-path
  mechanism from the problem statement, refused before it can create `D:\tmp`.
- **The sweep**: `npm run scratch:check` was red on this tree before the cleanup (3 stray
  entries, 23 dead worktrees) and green after it, which is the reading that shows it can fail.
- **The cleanup it drove**: `.playwright-mcp/` and `src/web/.playwright-mcp/` (session debris,
  deleted), `src/web/.agent-scratch/` (13 MB — `vg-368`'s directory, **relocated** to
  `C:\tmp\vigilia-residue-2026-10-21\` per that row's ruling, not deleted), the 22 junction-only
  worktree skeletons and one seat's npm-ci log. `node_modules` verified intact afterwards.
- **The gate**: `npm run gate` reaches the new step and reads it green, then exits 1 at
  `design:check` — the pre-existing `vg-626` red (remainder 20, ceiling 19), unchanged by this
  work; `typecheck` and the unit suite run separately because that red stops the chain.
- **Not verified, and it is the half that matters most**: no `PreToolUse` hook fired in the
  session that wrote this entry — not the new one, and not the pre-existing `reuse-gate` one,
  whose `scripts/anything.mjs` refusal is a self-test case. Two `Write` probes and one Bash
  redirect landed untouched. The `PreCompact` hook *had* fired earlier in that session, so the
  hook mechanism is live and the likely reading is that Claude Code captures its hook set at
  session start and an edit to the file does not take effect until the next one. **So the
  refusal is wired and not yet observed intercepting a live tool call**: a fresh session, and
  Claude Code's `/hooks` review if it asks for one, is what turns this line green.
- **Not addressed**: `C:\tmp` itself holds 560 MB of older scratch. The rule this decision sets
  covers where scratch *goes*; whether that tree is pruned is a separate call, and it is the
  user's.
