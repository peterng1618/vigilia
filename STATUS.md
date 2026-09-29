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
2. **Write it into the findings backlog** in
   [the plan](docs/superpowers/plans/2026-09-29-author-journey-proof.md),
   classified blocking or deferred, with the measurement that shows it.
3. **Dispatch a subagent** to fix it, with the file set it owns and the files
   it must not touch, plus a browser proof it cannot fake.
4. **Verify the landed work yourself** by using it again. A passing agent report
   is not evidence; a screenshot and a number are.

## Active work

- **Active plan:** [author journey proof](docs/superpowers/plans/2026-09-29-author-journey-proof.md). Phase 0 is complete, the rebuild has run once, and the Findings backlog is the working queue — **~44 findings, 28 landed**, 1 resolved as a side effect, 6 withdrawn as instrument errors, the rest queued or in a design pass.
- **Three of the plan's premises were stale and are corrected in place.** U28 quotes a test reading *"snaps back to 100"* that **exists nowhere in `src/web`**; the real test asserts opacity *refuses*, so both bounded fields agree and there is no inconsistency to settle. `MAX_GLASS_BLUR_RADIUS` is already exported and only the barrel omits it. And the slider cannot be Base UI's, because the inspector is imperative DOM.
- **A standing rule earned the hard way, now in the plan's Global Constraints: a canvas readback is a snapshot of a moment.** Six findings on this pass were the instrument, not the product — a handle read in the wrong coordinate space, a selection outline mistaken for a stroke, a stale document behind the dirty guard, a test name quoted from memory, a black screen that was Fabric's repaint caught mid-frame, and a preset the DOM resolved while my object path did not. **Screenshot for what is visible, read the DOM for what is true, and when two probes disagree, find out which is wrong before believing either.**
- **The round trip is now verified by hand**, which STATUS listed as unverified: insert a Text → save the package → read `theme.json` out of the zip → reopen the file, and the run is **identical** at all three points, colour as a token reference and no hex. §73 and §75 intact.
- **The frame that matters:** the editor is **desktop-only** (`tests/e2e/surface.ts`); a **phone is the main display type** and the **player is the product's face**. Weight player and phone work accordingly.
- **The rule for the pass:** fix what you find using what the repo already decides — the owner in `ownership.md`, the surrounding idiom, the copy in `ui-copy.ts`, the pattern the existing controls set. Only a genuine product decision with no precedent gets recorded and passed over. **Nothing waits on a human.**

## Last completed change

- **A token says how many objects use it, and which** (`b474563`, `658721f`, `4c42793`). `objectPaletteReferences` sits beside `reassignObjectPaletteReferences`, which already walked the scene and **returned a count that was thrown away**; the panel takes an injected `usage()` so the number it shows and the number that guards a deletion come from one walk.
- **The completeness claim was wrong, and the gap was charts.** A `VigiliaChart` names its tokens in `settings` and carries no `vigiliaPaint`, so the walk that "only has two places" called a token dead while a gauge was painted with it. The read now covers it; the *rewrite* stays in `ChartManager`, which owns the engine re-apply.
- **One entry per object, not per reference** — a panel whose fill, stroke and shadow all name a token is one object to look at, and the figure says so.
- **Measured in a browser on the reference document**: all **19** tokens — the printed count equals the objects listed, and every one of those names is a row in the layer list. `Frosted panel · 8` names the eight cards; `CPU · 5` includes `trends-chart`, which is the chart case the old walk could not see.
- Red without the fix, individually: root-only walk (4 fail), charts unread (3 fail), count dropped from the option (2 fail). Gate green: `typecheck`, `lint`, `format:check`, **2169 unit tests across 167 files**.

## Next

1. **Two subagents are in flight on disjoint files**: A (glass control discloses its limit; one tooltip owner) and C (new objects cascade instead of stacking). B (bounded fields clamp, show the bound, get a native slider) is queued behind A. Review each on its report.
2. **Then the queued findings, all measured and all with an owner named:** U30 the player prints a JS parse error to a wall display, U31 the shipped reference theme's 52 objects are unnamed in the data (`text()` never writes `name`), and the POSIX root-volume join above.
3. **Three questions are now closed by ruling, not by agent judgment** — glass on Circle/Ellipse/Triangle/Polygon (Polyline/Path/Line skipped for having no closed area), the colour picker's ecosystem (shadcn/ui, not Base UI; the alpha requirement stands), and the Arrange menu (removed as redundant with its own toolbar). All three are in the plan.
4. **Keep using the product.** The backlog is only as good as the last hour of driving it.
5. Group C still wants a design pass: the right sidebar restructure, the token panel to the left, the shortcut editor, the zoom toolbar, the gradient/colour surface. Then the screenshot spring clean — the **v1 captures wait until v1 is removed**, as decided.

## Blockers / unverified

- **Whether a person now calls the frosted card glass is still the user's call.** Transmission is measured; the verdict is not an agent's to make.
- [#7](https://github.com/peterng1618/vigilia/issues/7): the `Ctrl+N` discard prompt on a saved document — cause not established, pre-existing. Also filed by agents: **#13** artboard clipping (Fabric has no scene-level clip), **#14** the layer panel's missing background-media row, **#8–#10** rebuild questions.
- **Agents die silently and leave finished work uncommitted** — three times now. And the converse: **no agent shells running does not mean the agent is done**, it means it was between tool calls. Check `git status` after a notification, verify the tree (`typecheck` + `npm test`), and commit what is good rather than losing it — and expect a second wave of changes from the same agent afterwards. A default-worker test run also under-reports: 1821 tests against a real 2169, from worker starvation alone. Pin `--maxWorkers` before believing a count.
- **The Playwright MCP browser and the host ports are shared**, so two agents got a screenshot of someone else's document; and an agent's own test can be a **false green** — `press("Control+Shift+]")` is not that chord, because Playwright synthesises by key name and never applies the shift-to-character mapping. Give each agent its own port and browser, **build the bundles before looking at anything** — a stale bundle cost this pass a wrong conclusion — and dispatch chords over CDP.
- The frosted CPU card's `mr` handle **is closed as not-a-bug** — measured twice this session, statically and under a live drag, and a frosted card tracks the pointer exactly as well as an unfrosted one. Task 9's remaining open edges: the `Promise.allSettled` split frame, and `storage-card-value` overrunning its card. The **POSIX drive→volume join is no longer merely unproven, it is a real defect**: `library-devices.ts:53` strips a trailing slash, so a root volume's `/` becomes `""`, the join at line 118 never matches, and **on macOS and Linux every root volume reports as belonging to no drive**. It passes on Windows because `C:` has no trailing slash. Queued behind a decision note — the path is on the reuse-gate watchlist.
