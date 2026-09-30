# Vigilia status

Updated: 2026-09-30
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

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md). Phase 0 is complete, the rebuild has run once, and `docs/product/backlog.jsonl` is the working queue — **52 rows, 31 landed**. The registry is the source of truth; the workspace's `backlog-2026-09-30.md` predates it and is superseded.
- **Nothing is dispatched.** Q1 (group exit, filled lock, selectable-but-locked) and Q2 (circle-glass parity) both reported before the last crash and both are landed — Q1 recovered from an uncommitted tree as `528b0d2`. `dispatch-active.md` in the workspace is current.
- **Q2 refuted the lead rather than fixing it.** The circle-glass report's "shape-dependent sample region" is arithmetic: the sweep gave every shape the same *authoring* box and a Circle has no 240x160. At one box all five shapes take a byte-identical region, and the frost is equal to every digit printed. vg-037 stays open on the radius-vs-width authoring asymmetry, not on the renderer.
- **The standing rule earned the hard way is in the plan's Global Constraints: a canvas readback is a snapshot of a moment.** Ten findings on this pass were the instrument, not the product. **Screenshot for what is visible, read the DOM for what is true, and when two probes disagree, find out which is wrong before believing either.**
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. Weight player and phone work accordingly.
- **The rule for the pass:** fix what you find using what the repo already decides — the owner in `ownership.md`, the surrounding idiom, the copy in `ui-copy.ts`, the pattern the existing controls set. Only a genuine product decision with no precedent gets recorded and passed over. **Nothing waits on a human.**

## Last completed change

- **A group you can leave, a lock you can read, and a lock you can still click** (`528b0d2`, `1eaaf6c`). Double-clicking outside an entered group now exits it, and the reason it was silent before is the fix's mechanism: entering a group takes everything outside it off the artboard, so Fabric resolves that double-click to *nothing* — no target is the outside.
- **The lock is a fill, not a second drawing.** Lucide ships no filled lock, but `fill` reaches the `<svg>` and overrides its own `fill="none"`, so weight distinguishes locked from unlocked at 13px with no wrapper and no new dependency.
- **Locked is Fabric's own vocabulary, not an invented flag** — `hasControls: false` plus the `lock*` flags, with `selectable` kept true. The hole was that an `ActiveSelection` transforms its members through itself; `onSelect` is the wrong hook because it also gates a plain click, so locked members are dropped once the selection exists.
- **A crop frame that covered nothing.** A `Rect` is centre-anchored and `getBoundingRect()` reports a corner, so the frame sat one whole image up-left of its image, three of its four crop edges off the canvas.
- **Red without each fix**: 2 of 6 dblclick tests, the filled-lock test, 5 of 7 lock tests, the crop-frame test.

## Next

1. **Keep using the product** — the queue is only as good as the last hour of driving it. The host is not built and no editor bundle is current; both are needed before any further visual claim.
2. **The queued findings, each measured and each with an owner named:** U30 the player prints a JS parse error to a wall display, U31 the shipped reference theme's 52 objects are unnamed because `text()` never writes `name`, and the POSIX root-volume join.
3. **Three questions are closed by ruling, not by agent judgment** — glass on Circle/Ellipse/Triangle/Polygon (Polyline/Path/Line skipped for having no closed area), the colour picker's ecosystem (shadcn/ui, not Base UI; the alpha requirement stands), and the Arrange menu (removed as redundant with its own toolbar).
4. **Group C still wants a design pass**: the right sidebar restructure, the token panel to the left, the shortcut editor, the zoom toolbar, the gradient/colour surface. Then the screenshot spring clean — the **v1 captures wait until v1 is removed**, as decided.
5. **Whether a locked selection may still be reordered** is deliberately left open: front/back stay enabled, because reordering is not a transform.

## Blockers / unverified

- **Whether a person now calls the frosted card glass is still the user's call.** Transmission is measured; the verdict is not an agent's to make.
- [#7](https://github.com/peterng1618/vigilia/issues/7): the `Ctrl+N` discard prompt on a saved document — cause not established, pre-existing. Also filed by agents: **#13** artboard clipping (Fabric has no scene-level clip), **#14** the layer panel's missing background-media row, **#8–#10** rebuild questions, **#15** the Line's diagonal bounding box.
- **Agents die mid-task and leave finished work uncommitted — ten times on this pass**, and the harness reports a dead agent as *"stopped by the user"* when nobody stopped it. **Read `git status` first, treat what is missing as the agent's work to redo, and never attribute a stop to the user without their having said so.** Q1's nine files sat uncommitted across a whole crash, one `git clean` from gone. Commit before the end, not at it; **no agent shelling out does not mean it is done**; and pin `--maxWorkers` before believing a test count, since a default run under-reports by hundreds from worker starvation.
- **The Playwright MCP browser and the host ports are shared**, so two agents got a screenshot of someone else's document; and an agent's own test can be a **false green** — `press("Control+Shift+]")` is not that chord. Give each agent its own port and browser, **build the bundles before looking at anything** — a stale bundle cost this pass a wrong conclusion twice — and dispatch chords over CDP. Six stale preview servers from dead sessions were killed on this session's recovery.
- **The POSIX drive→volume join is a real defect, not merely unproven**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.