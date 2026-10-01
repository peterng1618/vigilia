# Vigilia status

Updated: 2026-10-01
Branch: `claude/superpowers-workflow-cleanup`

## Current objective

**Be the human author. Use the product, find what is wrong, write it down, and
have it fixed. Repeat.**

This is a standing instruction, not a phase. A fresh session picking this up
should not be asking "what is the next task" — it should be opening the editor
and the host, driving them as an author would, and finding the next thing that
is broken. The backlog grows as a result; work is dispatched against it.

**The scope is expected to keep growing and the task sequence to keep changing.
That is the design, not drift.** This spec and plan are the one unconventional
pair in the repo: every other plan has a fixed scope written down before the
work starts, and this one is driven by finding things the list did not know to
ask for. A stale task number is the plan working. **Definition of done is a
floor, not a ceiling** — the pass ends when nothing is left that using the
product can find, not when the list runs out.

The loop, in order:

1. **Use the product** with Playwright MCP — the editor, the host, the player,
   at a real screen size and at 390 px. Insert, select, type, resize, save,
   reopen, play, fail. Do not read the source for a defect you can see.
2. **Write it into the findings backlog** — `docs/product/backlog.jsonl` is the
   registry, classified open or verified, with the measurement that shows it.
3. **Dispatch a subagent** to fix it, with the file set it owns and the files
   it must not touch, plus a browser proof it cannot fake.
4. **Verify the landed work yourself** by using it again. A passing agent report
   is not evidence; a screenshot and a number are.

## Active work

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md). Phase 0 is complete, the rebuild has run once, and `docs/product/backlog.jsonl` is the working queue — **19 rows**, with 65 closed rows in the archive. The registry is the source of truth; the workspace's `backlog-2026-09-30.md` predates it and is superseded.
- **Nothing is dispatched, and the root is draining the registry itself.** vg-071, vg-079 and vg-060 closed on `3e3783e` and `9bc48fe` — the three legs of "a session's work vanishes with no signal at either end", which is why they were worth doing together. `dispatch-active.md` in the workspace is current.
- **The standing rule earned the hard way is in the plan's Global Constraints: a canvas readback is a snapshot of a moment.** Twelve findings on this pass were the instrument, not the product — most recently a player screenshot taken before the first telemetry batch, which read as "no data anywhere" on a host that was streaming 133 batches. **Screenshot for what is visible, read the DOM for what is true, and when two probes disagree, find out which is wrong before believing either.** **A native prompt or chooser is invisible to automation, and an auto-dismissed prompt is indistinguishable from an absent one** — vg-064 filed two working commands as dead for exactly that reason, and their working sibling has neither a prompt nor a chooser.
- **Two claims were refuted by measuring rather than by reading**, and both would have been filed as defects: Group looked keyboard-only until a real canvas multi-select showed it in the context menu, and the Starter theme's rows looked id-derived until the document showed all 52 objects carry an authored `name`. **Check the counter-claim before writing the row.**
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. Weight player and phone work accordingly.
- **The rule for the pass:** fix what you find using what the repo already decides — the owner in `ownership.md`, the surrounding idiom, the copy in `ui-copy.ts`, the pattern the existing controls set. Only a genuine product decision with no precedent gets recorded and passed over. **Nothing waits on a human.**

## Last completed change

- **A bare `/editor/` opens what the author saved last** (`9bc48fe`, closes vg-060). `?theme=<id>` fixed the bookmark and not the round trip: rename, add a rectangle, save, close the tab, reopen — and the Starter, with the work still on the host and nothing said. `updatedAt` was already the store's mtime, documented as what keeps a template out of a count of the author's themes.
- **The editor says when a document is unsaved, and asks before it goes** (`3e3783e`, closes vg-071 and vg-079). `PersistenceManager.isDirty` already answered this and only the replace prompt ever asked; the session now owns the answer, pulls it, and two consumers read it — a mark at the far end of the footer, and `beforeunload`.
- **Every write of the envelope goes through one line** (`#writeEnvelope`), because the row named three edit paths that never touch Fabric — the theme name, a palette token, a binding — and forgetting one is a setter that lost a line, not a bug anyone would see.
- **Measured live, red then green:** 52→53 layers with the mark on, cleared by Save to library, back on for a nudge and a rename; a dead `?theme=` and a bare URL both open the author's 53, an empty library still opens the Starter. Editor suite **1042 across 87 files**; `backlog:check` 19 rows.

## Next

1. **Keep using the product** — the queue is only as good as the last hour of driving it. A host on a private port with a private `--themes-dir` is the loop: editor → Save to library → the player, at desktop and at 390 px.
2. **The queued findings, each measured and each with an owner named:** **vg-040 auto-save and a recovery prompt**, still blocked on the asset-ownership question the row records — it is the remaining half of what vg-071 and vg-079 just made visible. Then vg-023 entering a group dims the layer list but not the canvas, vg-028 the chart slide (not yet reproduced), and the POSIX root-volume join.
3. **The backlog-tracking boundary is yours and is still undecided** — what lands in `docs/product/backlog.jsonl` versus what a commit records. A session was lost mid-sentence stating it and it is written down nowhere. Nothing has been pruned in the meantime.
4. **Two paths are untested by hand and neither is reachable from the editor's own menus:** an image can only be pasted (the Insert menu has no Image), so the crop control's subject arrives by clipboard alone.
5. **Group C still wants a design pass**: the right sidebar restructure, the token panel to the left, the shortcut editor, the zoom toolbar, the gradient/colour surface. Then the screenshot spring clean — the **v1 captures wait until v1 is removed**, as decided.

## Blockers / unverified

- **Whether a person now calls the frosted card glass is still the user's call.** Transmission is measured; the verdict is not an agent's to make.
- [#7](https://github.com/peterng1618/vigilia/issues/7): the `Ctrl+N` discard prompt on a saved document — cause not established, pre-existing. Also filed by agents: **#13** artboard clipping (Fabric has no scene-level clip), **#14** the layer panel's missing background-media row, **#8–#10** rebuild questions, **#15** the Line's diagonal bounding box.
- **Agents die mid-task and leave finished work uncommitted — ten times on this pass**, and the harness reports a dead agent as *"stopped by the user"* when nobody stopped it. **Read `git status` first, treat what is missing as the agent's work to redo, and never attribute a stop to the user without their having said so.** Q1's nine files sat uncommitted across a whole crash, one `git clean` from gone. Commit before the end, not at it; **no agent shelling out does not mean it is done**; and pin `--maxWorkers` before believing a test count, since a default run under-reports by hundreds from worker starvation.
- **The Playwright MCP browser and the host ports are shared**, so two agents got a screenshot of someone else's document; and an agent's own test can be a **false green** — `press("Control+Shift+]")` is not that chord. Give each agent its own port and browser, **build the bundles before looking at anything** — a stale bundle cost this pass a wrong conclusion twice — and dispatch chords over CDP. Six stale preview servers from dead sessions were killed on this session's recovery.
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.