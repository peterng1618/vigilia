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

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md). Phase 0 is complete and `docs/product/backlog.jsonl` is the working queue — **23 open rows**, 69 in the archive. The registry is the source of truth; the workspace's `backlog-2026-09-30.md` predates it and is superseded.
- **Six agents are dispatched on wave 1, each owning a disjoint file set, none of them committing or building — the root builds once, verifies once, commits per row with explicit paths.** vg-087 `layer-panel.tsx`; vg-086 `shell-layout.tsx` + the `view` block of `ui-copy.ts`; vg-088 `runs.ts`; vg-089 + vg-084 `index.ts`, `text-manager/`, `chart-manager/`; vg-072 `viewport-manager/`; vg-085 the themes store, `server.ts` and the library dialog. Ownership and the no-build/no-commit rules are in the workspace's `dispatch-active.md` and its `dispatch-w1-*.md` records.
- **vg-083 is withdrawn — refuted by a spec this repo had already implemented five days earlier.** The language is a theme property: `metadata.locale`, required on v2 and refused when malformed, governing the words the theme's clock spells; the player's chrome is explicitly outside it. The failure was mine — an agent was dispatched to look for a weather provider before `docs/superpowers/specs/2026-09-26-clock-and-theme-locale.md` was read. **Read the spec index before filing a row about a settled area.**
- **Two of the six rows had already been attempted or misread once, so their briefs carry the reason rather than just the symptom.** vg-072's obvious fix was reverted for breaking the point-under-cursor invariant, so its brief asks *when* to refit, not *how*. vg-088's two dropdowns may not actually disagree — one `value` is a stored ref and the other's a bare id — so its brief asks which control is mis-bound rather than assuming.
- **The standing rule earned the hard way is in the plan's Global Constraints: a canvas readback is a snapshot of a moment.** Twelve findings on this pass were the instrument, not the product — most recently a player screenshot taken before the first telemetry batch, which read as "no data anywhere" on a host that was streaming 133 batches. **Screenshot for what is visible, read the DOM for what is true, and when two probes disagree, find out which is wrong before believing either.**
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. Weight player and phone work accordingly.

## Last completed change

- **Switching a token to a gradient keeps the colour it had** (`b9df2b9`, closes vg-082). Choosing Linear gradient over the Frosted panel replaced a 30% alpha `#0815234d` with an opaque white-to-black sweep across eight objects; `seedPaint` carries the colour in both directions and invents nothing.
- **A pasted image survives the theme it was saved in** (`dbde35a` + `ba043ee`, closes vg-070). Reopening a saved theme did not show a broken image, it dropped the **object** — 53 back where the document held 55, so the next save wrote 53 and the author's paste was gone. Fabric enlivens from `src` alone, so a dead `blob:` URL costs the object.
- **The ordering was the defect, so the ownership moved** (`dbde35a`). The shell revives before a session exists, so the bytes must be resolvable before `EditorSession` is built — and the session built its asset manager as a field, after. `editor-main` now builds and loads one manager and hands it to both, which left `EditorSessionOptions.assets` a second way to hand over the same bytes that nothing read, so it is gone.
- **Measured live, red then green:** 55 objects on reload with both images decoding, against 53 before; a saved document with no `src` and no `blob:` anywhere in the scene, reopened by both readers; a phone-sized player load fetching `assets/pasted-probe.png` over HTTP; gradient stops carrying `#0815234d` in both directions; the colour picker at (1325, 480) through a drag, a hue click and a reopen. Suite **2436 across 180 files**; `backlog:check` 19 rows.

## Next

1. **Land wave 1.** Build once, drive the editor on canvas, verify each of the five rows by using it — vg-089's clipping is visible behaviour and vg-072's badge is a number on a real window resize — then commit each row with explicit paths and close it in the registry with the measurement that proves it.
2. **Wave 2 is measurement, not fixing, and it needs the browser the root is holding.** vg-090 the bar takes a radius and its track does not; vg-091 chart edits do not serialise and one undo reverses several; vg-092 icon fill floods the counters. All three are filed as NOT INDEPENDENTLY REPRODUCED, and none of them is worth dispatching blind — drive each, and file what the driving finds.
3. **vg-081 the colour drag still blocks 38–48%** and vg-080 did not reach it; the peaks are gone but 50 ms tasks remain and the token scaling is still unconfirmed. Needs profiling in the root's own browser session, not another agent's.
4. **The rows that are decisions, not defects, and are not going to drain by fixing code:** vg-085 whether theme deletion is deliberately out of scope (ADR-0017 does not say), vg-046 the artboard clip, vg-036 the letterbox, vg-051 where the queue lives, vg-029 the preview cadence, vg-056 the layer multi-select, and the backlog-tracking boundary itself.
5. **Keep using the product** — the queue is only as good as the last hour of driving it. A host on a private port with a private `--themes-dir` is the loop: editor → Save to library → the player, at desktop and at 390 px.

## Blockers / unverified

- **Whether a person now calls the frosted card glass is still the user's call.** Transmission is measured; the verdict is not an agent's to make.
- [#7](https://github.com/peterng1618/vigilia/issues/7): the `Ctrl+N` discard prompt on a saved document — cause not established, pre-existing. Also filed by agents: **#13** artboard clipping (Fabric has no scene-level clip), **#14** the layer panel's missing background-media row, **#8–#10** rebuild questions, **#15** the Line's diagonal bounding box.
- **Agents die mid-task and leave finished work uncommitted — ten times on this pass**, and the harness reports a dead agent as *"stopped by the user"* when nobody stopped it. **Read `git status` first, treat what is missing as the agent's work to redo, and never attribute a stop to the user without their having said so.** Q1's nine files sat uncommitted across a whole crash, one `git clean` from gone. Commit before the end, not at it; **no agent shelling out does not mean it is done**; and pin `--maxWorkers` before believing a test count, since a default run under-reports by hundreds from worker starvation.
- **The Playwright MCP browser and the host ports are shared**, so two agents got a screenshot of someone else's document; and an agent's own test can be a **false green** — `press("Control+Shift+]")` is not that chord. Give each agent its own port and browser, **build the bundles before looking at anything** — a stale bundle cost this pass a wrong conclusion twice — and dispatch chords over CDP. Six stale preview servers from dead sessions were killed on this session's recovery.
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.