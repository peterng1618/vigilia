# SDD ledger — plan: docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md

Spec: docs/superpowers/specs/2026-09-25-editor-viewport-and-mechanics.md (binding authority)
Base before Task 1: (recorded at dispatch)

## Pre-flight scan

`preflight-scan.md` (173 lines) was produced by a dedicated scan agent, read in full, and is
adopted by reference. Summary as delivered: pair scan (12 rows), self-consistency scan (11
rows), 11 confirmed defects (D1–D11), 8 unverified suspicions (U1–U8), verdicts: Tasks 3, 10,
11 clean; everything else not clean.

Nodes verified by me directly:

- The bridge's real owner is `src/web/packages/editor/src/editor-shell/bridge.ts`, and the
  sibling UI-polish plan has already rewritten it. **D2 confirmed.**
- `src/web/packages/editor/src/editor-shell/layer-panel.tsx` does not exist; the panel on
  disk is `src/web/packages/editor/src/layer-panel.ts` + `.dom.test.ts`. `editor-shell/`
  currently holds `bridge.ts`, `canvas-dock.tsx`, `editor-shell.css`, `layer-tree.test.ts`,
  `palette.ts`, `session-facade.ts`, `shell-layout.tsx` and their tests — and `layer-tree.ts`
  itself is being created right now by UI-polish Task 3, so even the file Task 8 *needs* is
  in flight. **D6 confirmed.**
- `header-wash` is `rect("header-wash", 0, 0, 1280, 142, "#06101a70", 0)`
  (`new-fabric-theme.ts:331`) and omits the interaction argument, so it takes the helper
  default and is selectable and evented. The plate at `:328` passes `backgroundOnly`
  (`:15-19`), which already sets `selectable: false, evented: false`. **D3/D11 confirmed** —
  Task 5's drag at (30, 60) lands inside `header-wash`'s 0..142 band, and its Step 3 fix
  branch edits a fixture that is already correct.
- `ProductShortcutId` (`shortcut-manager/index.ts:2-13`) has 11 members and none of them is
  `canvas.nudge-*`; `PRODUCT_SHORTCUTS` (`:23-36`) is 12 entries over those 11 ids
  (`delete` and `backspace` both map to `edit.delete`). **D4 confirmed** — Task 6's test
  registers an id its own Produces union does not declare.
- `getScenePoint(e: TPointerEvent): Point` (`SelectableCanvas.d.ts:418`), resolved through
  `getPointer(e)` → `clientX`/`clientY`. **D9 confirmed** — a bare `{x, y}` yields `NaN` on
  both sides and `toBeCloseTo` never passes on `NaN`, so the test cannot pass at all.
- `HistoryManager.suspend()` (`history-manager/index.ts:41-49`) is a counter, so it batches
  per *gesture*, not per idle window. **D8 confirmed** — two separate presses give two
  entries, and Task 6's single-undo assertion contradicts its own Step 3 rule.

### Rulings

Plan A's defects are all cheap and local, so I amended
`docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md` in place rather than
carrying corrections in dispatch prompts — same reason as Plan C: `task-brief` reads that
file, so an amended plan gives amended briefs and one authority.

| # | Ruling | Cost if wrong |
|---|---|---|
| D1 | **`onChange(listener: () => void): () => void` is added to Task 1's `ViewportManager` Produces block** (Task 1 owns the interface; Task 4 only consumes it), the Task 3 stub gains it, and `viewport-manager/index.ts` is added to Task 4's Files list and `git add`. As written, Task 4 must add a method to a file its own file list forbids it to touch, and its test casts through `as never` so nothing catches it — the readout would simply never subscribe. | A zoom readout that renders once and never updates, with a green test suite. Silent. |
| D2 | **`editor-shell/bridge.ts` is added to Task 4's Files list and `git add`.** Task 4 declares a new `EditorShellBridge` member without naming the file that owns it; Task 8 names it correctly, so the two tasks disagree about where the interface lives. | A bridge literal that fails to compile, or a member added in the wrong file. Loud. |
| D3 | **Task 5's drag starts at `(20, 300)`** — below `header-wash`'s 142px band and inside the pasteboard once Task 2 has unclamped the canvas — and Step 3 names `header-wash`, not the plate. As written the drag grabs `header-wash`, which is the exact failure the test claims to be detecting, so its red-then-green loop proves nothing. | A marquee test that fails for the wrong reason and passes for the wrong reason. Silent. |
| D11 | **Task 5 Step 3's "if the plate is still evented, set `evented: false`" branch is struck** and replaced with a note that `backgroundOnly` (`new-fabric-theme.ts:15-19`) already does this at `:328`. The instruction sends an implementer to edit a fixture that is already correct. | An implementer makes a no-op edit and reports having fixed something. |
| D4 | **Task 6's test stops registering `canvas.nudge-left-large`**; the large step is expressed as `event.shiftKey` inside the plain handler, and Task 6's Produces union is the authority on which ids exist. | A compile error. Loud, but it costs a dispatch. |
| D5 | **Task 8 Step 3 states the two `groupContext` signatures explicitly**: `GroupingManager.groupContext(): readonly FabricObject[]` (Task 7) and the bridge's `groupContext(): readonly string[]`, derived by mapping objects to `id` (Task 8). The projection rule already forbids Fabric objects on the bridge; the step simply never said so. | A bridge fixture that fails to compile. Loud. |
| D6 | **Plan:13's dependency claim is corrected to match the Self-Review**: Tasks 8 and 9 depend on the sibling UI-polish plan (Task 8 needs `editor-shell/layer-panel.tsx` and `layer-tree.ts`, which that plan creates); Tasks 1–7 and 10–11 do not. The earlier statement says "only for Task 11's context menu", which is both the wrong task number and the wrong scope, and it is the line an executor reads first. | Running Task 8 standalone finds no test files. Loud at Step 2, but the executor may instead "fix" the path. |
| D7 | **Task 9's fixture stops stubbing `can`** and expresses eligibility through `target()` instead, with the expectation written as `OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id)).map((action) => action.label)` rather than a hand-written two-element literal. `ActionGate` has no `can` member — deliberately, because a per-id `can` would only re-enter `actionEnabled` — so the mandated mechanism cannot produce the asserted pair. | The tempting "fix" is to re-derive eligibility inside the menu, which is exactly what Step 3 forbids and what Review Focus item 5 exists to prevent. This is the highest-value ruling in the set. |
| D8 | **Task 6 Step 3's coalescing rule is restated** as "a burst of nudges is one history entry: open on the first nudge, close on a short idle window or on any other action", so the rule and Step 5's single-undo assertion describe the same mechanism. `HistoryManager.suspend()`'s counter only batches one gesture, so as written a correct implementation fails the test. | A timing-dependent test that either flakes or forces an unstated idle-window implementation. |
| D9 | **Task 1 Step 6's test dispatches a real `MouseEvent`** with `clientX`/`clientY` rather than passing `{x, y} as never`. `getScenePoint` resolves through `getPointer(e)`, so both reads are `NaN` and `toBeCloseTo` cannot pass on `NaN` — the test mapped to Review Focus item 2 fails regardless of the implementation. | The one test pinning "the point under the cursor stays fixed" never runs. Task 1's whole purpose is that invariant. |
| D10 | **Task 2 Step 1's "(create it if absent)" becomes "the file already exists — add the case beside the existing `mountEditorShell` tests and keep the `getContext` proxy `beforeEach`"**, and `editor-shell.dom.test.ts` is listed under Modify. The proxy is load-bearing: without it Fabric's render pass cannot `drawImage` an undecoded image in jsdom. | An implementer drops or duplicates the proxy and gets an opaque render failure in an unrelated test. |

### Scan suspicions I did not act on

**U1** (`+`/`=`/`shift+1` lowercasing in `navigation.ts`) — the file does not exist yet, so
the implementer defines the behaviour; the suspicion is unanswerable now and harmless either
way. Recorded, not ruled.

**U2** (Task 3 Step 6's `Number.isFinite` assertion is weaker than its claim) — I ruled to
**strengthen it**: the assertion becomes a comparison against the expected clamped translate,
because a finite-but-unclamped value passing is the exact regression Review Focus item 1 is
mapped to. Task 1's `pan-bounds.test.ts` covers `clampPan` as a pure function, not that
`panBy` uses it, so nothing else catches this.
**Cost if wrong.** A slightly more brittle assertion in one e2e step. Cheap.

**U3** (inline placeholder bodies and `{ /* as in Interfaces */ }`) — left alone. Every case
is legible from its surrounding text, and the alternative is transcribing values I have not
derived. The implementers are told to fill them; a placeholder that survives into a report
is a review finding.

**U4** (spec citations that are wrong: `snap-manager/index.ts:125` should be `:155`;
`guide-renderer/index.ts:30` should be `snap-manager/guide-renderer.ts:30`) — I ruled to
**fix both in the spec**, since the spec is the binding authority and a citation an executor
follows to the wrong line is a real cost for a two-line edit.
**Cost if wrong.** None; the corrections are verified.

**U5** (12 bindings vs an 11-member union) — Task 6 Step 3's "beside the existing eleven"
matches the union and is the number that matters. No edit.

**U6** (fork references), **U7** (`@base-ui/react/context-menu` unused), **U8** (Task 11's
named pre-existing failures) — recorded as unverified and left as the tasks' own work.

## Task status

(none dispatched yet)

## Amendment pass (in progress)

I amended the plan file in place rather than carrying corrections in dispatch
prompts, for the same reason as Plans B and C: `scripts/task-brief` extracts the
task text from that file, so an amended plan yields amended briefs and one
authority rather than two. Two rulings below were **corrected after a first
attempt** — I record both the correction and why, because the first attempt is
the kind of error that reads as correct in a diff.

| # | Ruling | Cost if wrong |
|---|---|---|
| D1 | `onChange(listener: () => void): () => void` added to Task 1's `ViewportManager` Produces block; Task 3's stub gains it; `viewport-manager/index.ts` added to Task 4's Files and `git add`. | A readout that renders once and never updates, green suite. Silent. |
| D2 | `editor-shell/bridge.ts` added to Task 4's Files and `git add`. | A bridge literal that fails to compile, or a member in the wrong file. Loud. |
| D3 | Task 5's drag starts at `(20, 300)`, below `header-wash`'s 142px band, with the reason stated inline. | A marquee test that fails for the wrong reason and passes for the wrong reason. Silent. |
| D11 | Task 5 Step 3 rewritten: `header-wash` (`new-fabric-theme.ts:331`) omits the interaction arg and is the object the drag grabs; the plate at `:328` already passes `backgroundOnly` and needs no edit. The old "if the plate is still evented" branch is struck. | An implementer makes a no-op edit and reports having fixed something. |
| D4 | Task 6's second test stops registering `canvas.nudge-left-large`; the Produces union is the authority on which ids exist. | A compile error. Loud. |
| D5 | Task 8 Step 3 names both signatures: `GroupingManager.groupContext(): readonly FabricObject[]` and the bridge's `readonly string[]`, derived by mapping objects to `id` and skipping anonymous ones. | A bridge fixture that fails to compile. Loud. |
| D6 | Plan:13's dependency claim corrected to Tasks 8 and 9 only. | Running Task 8 standalone finds no test files. |
| D7 | Task 9's fixture drops the `can` override and derives the expectation from `OBJECT_ACTIONS.filter((a) => actionEnabled(gate, a.id))`. | The tempting "fix" is to re-derive eligibility in the menu — exactly what Step 3 forbids. Highest-value ruling in the set. |
| D8 | Task 6 Step 3 restates coalescing as suspend-on-first-nudge / resume-on-idle-window, naming `HistoryManager.suspend()`'s counter at `history-manager/index.ts:41-49`. | A timing-dependent test that forces an unstated implementation. |
| D9 | Task 1 Step 6 dispatches a real `MouseEvent` and passes a real `Point` to `zoomToPoint`, with `Point` added to the `fabric/es` import. | The one test pinning "the point under the cursor stays fixed" never runs. Task 1's whole purpose. |
| D10 | Task 2 Step 1 becomes "the file already exists — add the case beside the existing tests, keep the `getContext` proxy `beforeEach`", with the proxy's load-bearing reason stated. | An implementer drops the proxy and gets an opaque render failure in an unrelated test. |
| U2 | Task 3 Step 6's `Number.isFinite` pair replaced by a saturation check: pan the same way twice and assert the translate does not move. | A weak assertion on the one invariant Task 2's clamp exists to provide. |
| U4 | Both spec citations fixed in `specs/2026-09-25-editor-viewport-and-mechanics.md:36-37` — `snap-manager/index.ts:155` and `snap-manager/guide-renderer.ts:30` (verified by reading both). | An executor follows the citation to the wrong line. |

### Two corrections I made to my own rulings

**D4, first attempt was wrong.** I first rewrote the test as
`manager.register("canvas.nudge-left", (event) => …)`, which does not compile:
`ShortcutHandler` is `() => void` (`shortcut-manager/index.ts:1`). The settled
ruling is both smaller and more honest — one id, both presses route to it,
`toHaveBeenCalledTimes(2)` — and the step now says the handler must be widened
to `(event: KeyboardEvent) => void` if the step is to read `shiftKey` at all.
Verified against the source: `bindingFor` matches when `binding.shift === undefined`,
so one binding with no `shift` field covers plain and shifted alike, and the
eleven existing zero-argument handlers stay assignable.
**Cost if wrong.** The test asserts routing, not step size; Step 5's browser test
is what pins the 1 / 10 px difference.

**U2, first attempt was wrong.** I first replaced the finiteness pair with
`expect(transform[4]).toBeCloseTo(1000 - 48, 0)`, derived from Task 1's
`clampPan`. That bakes in an unverified sign convention between
`viewportTransform[4]` and `clampPan`'s `offset` — Fabric's `zoomToPoint`
computes `vpt[4] += before.x - after.x`, and I did not trace `panBy` to confirm
the two agree. The settled ruling is sign-agnostic: assert finiteness, record the
translate at the limit, pan the same way again, assert it has not moved. That is
the clamp's actual contract and it does not depend on my arithmetic.
**Cost if wrong.** A slightly looser assertion than an exact clamped value would
give; it still fails on an unclamped transform, which is the regression it pins.

### Still unamended

None. D1–D11, U2 and U4 are applied; U1, U3, U5–U8 are recorded above as left
alone deliberately.

### Follow-on amendments found while preparing dispatches

| # | Ruling | Cost if wrong |
|---|---|---|
| D1a | **Task 3's `viewport` stub gains `onChange: vi.fn(() => () => undefined)`.** Adding `onChange` to `ViewportManager` in Task 1 is what makes Task 3's hand-written stub stop satisfying the interface, so `bindViewportNavigation({ canvas, viewport })` no longer compiles. Same ruling, second site. | Task 3 fails at its first `npx vitest run`, on a type error unrelated to gestures. Loud but wasteful. |
| D1b | **Task 4's readout test drops `as never` for `satisfies ViewportManager`** and gains a stub with every member. This is the ruling that matters most: `as never` is precisely what would have hidden a missing `onChange`, so the test as written could not detect the defect D1 exists to prevent. | The readout silently never subscribes, with a green suite. Silent — the same failure D1 was raised to fix. |
| D1c | Task 4's test also gains the `React.memo`-style stability warning in prose (return a primitive from `getSnapshot`, never a fresh object) and a re-render assertion: set the stub's zoom to `2`, fire its listeners, assert `"200%"`. Without it the test only pins the first paint. | A readout frozen at its mount value passes the test. |
| D1d | Duplicated `Create:` lines for `zoom-readout.tsx` / `.dom.test.tsx` removed (my earlier edit inserted them a second time), and `bridge.ts` added to Task 4's `git add` list, which D2 had added to the Files list but not to the commit. | An implementer creates the file twice in the file list and forgets to stage the bridge. Cosmetic, but `git add` misses cause failed commits. |

**Also checked and clean.** `ViewportManager` is consumed only by Tasks 3, 4 and 10; Tasks 5–9 do not construct a stub of it, so D1a/D1b are the last two sites. Verified by grepping the plan for every `viewport:` object literal.

| D12 | **Task 10 Step 4's `git add` list gains the two source directories** it is allowed to modify. Step 3 says "fix the found cause" in `guide-renderer.ts` / `snap-manager/index.ts` / `indicator-manager/index.ts`, but the commit staged only `editor.spec.ts` and `docs/evidence/screenshots` — so a real fix would have been left uncommitted, and the task's whole point is verifying that this code is correct at non-1 zoom. | A verified fix silently lost, and the next task inherits a dirty tree. Loud at the next `git status`, but easy to "clean up" the wrong way. |

**Checked, no change needed.** `guide-renderer.ts:36-37` already divides `GUIDE_WIDTH` by `canvas.getZoom() || 1` and applies the viewport transform to the context, so Task 10 is genuinely a verification task rather than a fix task — its Step 3 conditional is the right shape. I read the block to confirm the line number the plan cites is the divide.

## Task status

**Task 1: complete** — commit `1f05897`, base `e6cf380`. Implementer reported DONE_WITH_CONCERNS.
Review package `review-e6cf380..1f05897.diff` (17994 bytes, 1 commit) generated before HEAD moved;
task reviewer dispatched on `sonnet` and read-only.

Files created: `viewport-manager/index.ts`, `viewport.test.ts`, `pan-bounds.ts`, `pan-bounds.test.ts`.
Implementer's reported evidence: 2 files / 10 tests pass; full editor package 52 files / 289 pass;
`typecheck`, `lint`, `format:check`, `status:check` all clean.

### Implementer concerns carried into review

1. **The brief's Step 6 test was vacuous as written and the brief did not say so.** At zoom 1 with
   zero translate, scene coordinates equal client coordinates, so a no-op `zoomToPoint` would have
   passed the invariance pair. The implementer added an anchor (`identity = at(400,300)` asserted to
   be exactly `400,300`, then `before.x !== 400` after `zoomToFit`) before the pair, and
   teeth-checked it: replacing `zoomToPoint(point, …)` with `new Point(0,0)` fails with
   `expected 256 to be close to 512`. **My D9 amendment fixed the `NaN` half of this test and missed
   the vacuity half** — worth recording, because D9 is exactly the ruling I called the one that saves
   Task 1's whole purpose, and it was still only half the fix.
   *Cost if wrong.* Nothing now; the reviewer is asked to verify the anchor independently.
2. **Zero-size / non-finite host guards are additions the brief does not specify.** The brief's
   sample writes `canvas.setDimensions` from `host.clientWidth/Height` unguarded and sets
   `zoom = () => canvas.getZoom() || 1`; the shipped version early-returns from every entry point
   when the host measures 0 or non-finite, and `zoom()` is a plain `canvas.getZoom()`. The second
   half is a correction of an AGENTS.md violation in my own plan text (`|| 1` coerces an invalid
   transform to a valid-looking one; the rule says refuse, do not coerce). **Ruling: accept both**,
   and the reviewer is asked to judge whether the guard is itself covered — it is not, because the
   brief defines no expected result for it. Unverified by test, flagged, not blocking: jsdom never
   gives a laid-out host, and Task 2 is where a real host first exists.
   *Cost if wrong.* A guard that never fires in production and hides a genuine zero-size bug behind a
   silent no-op. Task 3's browser evidence is where that would surface.
3. **`zoomToFit` now commits through the same clamp as every other move.** The brief had it call
   `setViewportTransform` twice (once to reset, once to centre). Strictly better: one writer, one
   clamp. Consequence for Task 2 — a host narrower than 96px cannot express the centred offset, since
   `PAN_OVERSCROLL_MARGIN` is 48. Harmless at realistic sizes; noted because Task 2 owns the host.
4. **`MAX_ZOOM = 64` may be arbitrary.** Implementer flagged it and kept it verbatim because the
   brief's Produces block is authoritative. I wrote that value; an overview of a 1280x720 document
   sits near 0.25, so 64 is ~256x past a useful maximum. Left as-is deliberately: changing it now
   would invalidate Task 1's already-run test, and the value is a one-line change if the browser pass
   in Task 3 finds it wrong. **Ruling: keep 64, revisit at Task 3's browser evidence.**
   *Cost if wrong.* A zoom slider whose top half is unusable. Cosmetic, cheap to fix, visible to the
   author — which is the point, since the goal is judged on authoring UX, not on tests.

### Task 1 review outcome — APPROVED

Reviewer (sonnet, read-only, on `review-e6cf380..1f05897.diff`): **✅ spec compliant**, no Critical,
no Important, six Minor. Both named risks resolved in the implementation's favour, and the
reviewer's reasoning on each is independently checkable rather than a restatement of the report:

- **Risk 1 — the invariance test is non-vacuous, and my brief was the trap.** Reviewer verified the
  anchor arithmetically: after `zoomToFit`, scale is 0.78125 and the centred x-translate is
  `(1000 - 1280*0.78125)/2 = 0`, so the scene point at client 400 is `400/0.78125 = 512`, giving the
  `not.toBe(400)` assertion real teeth. It also supplied the mutation the report did not:
  `canvas.zoomToPoint(point, target)` → `canvas.setViewportTransform([target,0,0,target,0,0])`
  (zoom without re-anchoring) makes `after = 256` against `before = 512`.
- **Risk 2 — the guards are required, not scope creep.** Traced to AGENTS.md's refuse-don't-coerce
  rule, and the reviewer sharpened it beyond the report: the host half is defensive but the
  `artboard()` half is load-bearing, because `artboard()` is third-party and reaches `fitScale`
  before its `Number.isFinite(scale)` check.

### Ruling: the Task 2 host/artboard box hazard

The reviewer's Minor 1 claimed the host passed to the camera may be the dock-inset box rather than
the artboard box, and recommended handing it to Task 2. **I verified the situation and ruled the
opposite way on the remedy.**

The observation is correct and I confirmed each site: `fitArtboardViewport` writes
`container.style.width/height` from the scaled artboard (`editor-shell.ts:110-115`), `container` is
appended to `host` (`:279`) and the canvas is created inside it (`:132-133`), with
`fitArtboardViewport(container, host, …)` called at `:278`. **But the reviewer's proposed fix —
pass the artboard box to the camera — is wrong for this design.** Under Task 2 the canvas fills the
host and the artboard is a region *inside* it drawn by the clamped transform; the camera must
measure the full stage. The correct remedy is that `container` stops being artboard-sized and fills
`host`, which Task 2's brief already implies (`container` keeps `inset: 0`; its own test asserts
`canvas.getWidth() === 1000` for a 1000x800 host) but never states as the camera's `host`.

So I added one step to Task 2 Step 3 in the plan: **name the camera's `host` at its construction
site**, identify it as `container`, state that `container` must fill its parent and that
`fitArtboardViewport`'s dimension writes go with it, and record the failure mode — a canvas sized to
a box excluding the dock inset while fit divides by a box including it, so the artboard renders at
the wrong scale. The two line references are verified reads, not inferred. Task 2's brief regenerated
(80 → 81 lines) and the new text confirmed present.

**Cost if wrong.** The artboard renders at a subtly wrong scale in the browser. Task 2's own Step 5
capture is the check, and it is a rendered inspection, not a geometry assertion — so it would be
caught, but only at the task that would then have to redo its own wiring.

### Minor findings parked (none load-bearing, none blocking)

1. `resize()` sizes the canvas to the host while `fitScale` divides by the host — same hazard as
   above, now ruled on and folded into Task 2's step.
2. `commit` forwards `scale` to `clampPan` unguarded, so a non-finite `artboard()` propagates `NaN`
   through `Math.min/Math.max` (`pan-bounds.ts:14-27`). One `if (!Number.isFinite(scale)) return;` in
   `commit` would close every caller at once instead of the three sites that guard today. **Not
   actioned**, because `fitScale` and `zoomToPoint` already guard the only two paths that can produce
   a non-finite scale, and Task 2 is where `artboard()` first becomes a live input — carried into
   Task 2's dispatch instead.
3. The zero-host guard has no test. **Not actioned**: jsdom never gives a laid-out host, so the test
   would have to fabricate the zero, which pins the guard rather than the behaviour. Task 2's
   browser capture at a real size is the meaningful check.
4. `notify()` fires unconditionally after each operation, so Task 4's readout will get spurious
   renders. Carried into Task 4's dispatch: compare the returned value rather than assume change.
5. `ViewportManagerInput` is an extra export the Produces block never declared. Harmless — the
   brief's own printed multi-line parameter list forces either an inline object type or a name — and
   it is the better of the two. Accepted.
6. `onChange`'s doc comment dropped the brief's "Task 4's zoom readout is the consumer" pointer.
   Cosmetic; Task 4's dispatch names the consumer anyway.

### Task 2 brief strengthened while waiting (two additions, both verified reads)

Both come from reading the live source for the next dispatch rather than from a review finding.

1. **The camera's `host` is now named at its construction site** (Step 3). Recorded above under the
   Task 1 review ruling; the short version is that the brief implied the right answer via
   `container` keeping `inset: 0` and its own test asserting `canvas.getWidth() === 1000` for a
   1000x800 host, but never said which element the camera measures.
2. **`createNativeEditor`'s `artboard: Artboard` parameter is now explicitly removed.** Verified:
   its only reads inside that function are `width: artboard.width, height: artboard.height` at
   `editor-shell.ts:196-197`, and both go with the resize. I checked for a third use and found none
   — an `artboard` at `:260` is `mountEditorShell`'s own destructured parameter, not the helper's.
   Leaving a dead parameter is the kind of thing that survives a task and confuses the next reader.

Regenerated Task 2's brief (81 lines) and confirmed fence parity clean.

### CORRECTION to my own Task 2 amendment (the host/artboard ruling)

I amended Task 2 Step 3 to name the camera's `host` as `container`. **That was wrong, and I caught it
before dispatching Task 2.** The correct answer is the shell's **`host`** element — the one
`mountEditorShell` receives.

Two verified facts decide it, and the brief for Task 1 already said so:

- The Architecture section reads "hands **the host element** to that module instead" (plan:7), and
  `createViewportManager({ host, … })` is named `host` for that reason. My amendment contradicted the
  plan's own framing.
- `container` is created *inside* `mountEditorShell` (`editor-shell.ts:279-289`) and has no measured size
  of its own. In jsdom it measures **0** even with `inset: 0`, because there is no layout engine; the
  tests stub dimensions on the host they pass in (`editor-shell.dom.test.ts:35-36` and five more sites,
  all `clientWidth: 400, clientHeight: 300`). A camera constructed with `container` would therefore hit
  Task 1's zero-size guard at **every** entry point and silently do nothing, so this task's own
  `expect(shell.editor.canvas.getWidth()).toBe(1000)` could never pass.
- `fitArtboardViewport` already reads `host` for the fit while writing `container`'s dimensions
  (`:142` vs `:130-131`), so `host` is the box the scale was always computed from. Keeping it preserves
  that relationship instead of inventing a new one.

Step 3 now states this, names `container` as a passive full-bleed child that loses the
`container.style.width/height` writes, and carries both verified facts plus the jsdom-0 consequence.
Task 2's brief regenerated (81 → 83 lines) with the new text confirmed present and fence parity clean.

**Why I record this rather than quietly fixing it.** It is the second time this session I have written
an amendment that reads correct in a diff and is wrong in substance — the first was D4's
non-compiling handler. Both were caught by reading the source the amendment depends on rather than by
re-reading the amendment. The pattern is: my rulings about *what code should do* have been sound, and
my rulings about *which existing thing to touch* have needed the extra read. Task 2 was the highest-risk
task in this plan precisely because it is all "which existing thing", and the wrong host would have
failed loudly at Step 1 — a lost dispatch, not a shipped bug. Worth the check it got.

## Task 2: committed `093b3ec` (base `8184472`), report DONE_WITH_CONCERNS — two concerns adjudicated by measurement

Report at `task-2-report.md`. 4 files, +154/−101. Unit: 109 suites, 303 passed.
The implementer reported two e2e failures as a *consequence of the deliberate
design change* rather than a drag regression. **I did not accept that from the
report — I reproduced it and measured the mechanism in a live browser.**

Measured facts (preview server on :4174, bridge `window.vigiliaEditorBridge`):

- Canvas is host-sized **626×594** (`getWidth()`/`getHeight()`), `viewportTransform`
  `[0.4890625, 0, 0, 0.4890625, 0, 120.9375]`, so `zoom = 0.4890625` and `ty = 120.94`
  centres the 626×352 plate in a 594-tall canvas.
- **Drag mechanics are intact.** Grabbing `resource-card` at canvas-local (432,418)
  and moving the pointer +60px produced `left` 748 → 872.5, i.e. Δ124.5 = 60/0.4890625
  exactly. Screen→scene conversion scales by 1/zoom as designed.
- **`getCoords()` returns scene coordinates**, not canvas-local. My first sweep
  assumed canvas-local and produced a wrong conclusion ("`load-gauge` is not under
  its own centre"), which I discarded rather than act on.

Root cause of both failures: the tests map a *fixed artboard coordinate* through the
**canvas bounding box** — `box.x + (432/1280)*box.width`, `box.y + (418/720)*box.height`
(`editor.spec.ts:1369-1370`, `:1420-1421`, and the shared `selectStarterChart` helper at
`:1727-1730`). That identity `artboardCoord/artboardSize == canvasFrac` held **only while
the canvas *was* the artboard**; Task 2 deliberately ended that. `box.height` is now 594
(host) rather than 720×0.489=352, and the mapping additionally ignores `ty`.

### Ruling 1: the two e2e fixes belong to Task 10, not to Task 2 — **no plan amendment**

`editor.spec.ts` is Task 10's file ("Snapping and indicators at non-1 zoom", Files:
`src/web/tests/e2e/editor.spec.ts`), Task 10's Step 4 already stages `docs/evidence/screenshots`,
and Task 2 Step 6 does not stage `editor.spec.ts` — so the implementer was **correct**
to leave it unedited. The plan's "no second simplified model" spirit applies here too:
one shared helper, one fix, one task.

**But the failures must be resolved inside Task 10, not merely noticed.** Carried into
Task 10's dispatch as a mandatory deliverable with the exact evidence above.

**Cost if wrong.** Two e2e tests stay red until Task 10 (they are red *now*, caused by
Task 2); if Task 10 were dropped or reordered away, the red would persist with no owner.
Mitigated by recording it in the Task 10 dispatch and by the fact that Task 10 must
rebuild and run the browser suite anyway.

### Ruling 2: the corrected mapping is `vpt`, and the artboard rect becomes the shared primitive

The fix is *not* "add `ty`": the honest form is to stop re-deriving the artboard's screen
rect from the canvas box and **ask for it**. Task 2 already introduced exactly that
computation — `artboardScreenRect(canvas, artboard)` at `editor-shell.ts:121`, used for the
media element at `:372` — but only as a module-local function. Two consumers need it
(media placement; e2e pointing), which is the point at which AGENTS.md's reuse gate and
"one owner per concept" both apply.

**Ruling: Task 10 extends `ViewportManager` with an artboard-screen-rect accessor and
rewrites one shared e2e helper to use it.** `ViewportManagerPanBoundsInput.vpt` already
exists for the pan-clamp, so no new dependency is introduced into `viewport-manager`.

Rejected alternative — hand-rolling `(sx/1280)*box.width + ty` in the spec: it puts camera
maths in a test file, duplicates a transform the camera already owns, and leaves
`artboardScreenRect` module-private with two callers' worth of need.

**Cost if wrong.** Adds a public member to an interface Task 3–11 consume. If a later task
finds it redundant, the removal is local: one interface member, one implementation, one
test helper. Low, and strictly cheaper than the alternative it replaces.

### Ruling 3: the five `selectStarterChart` consumers are NOT silently broken

Checked rather than assumed. Their click point now lands at scene **(432,458)**, and
`load-gauge` spans scene y 374–462 — so the click still selects the chart (verified: active
goes `null` → `load-gauge`), but **4px from its bottom edge**, on the `gauge-card` overlap
region. That razor margin is precisely why `rehydrates a chart runtime after undo` grabbed
the parent `gauge-card` instead and left `load-gauge` at 432. So the helper is not
"passing for the wrong reason"; it is passing on a near-miss that a 4px perturbation flips.
Rewrite the helper too, and add the missing precondition assertion (`activeObject` is
`load-gauge`) so this margin can never silently widen again.

**Cost if wrong.** Three assertions added to tests that currently pass. Low.

### Ruling: Task 3 Step 3 amended — the keyboard zoom needed a test and a text-entry guard

Read the brief before dispatching and found a defect of the same shape as the I2 finding I had
just made Task 5 close: **Step 3 adds keyboard zoom (`+`/`=`, `-`, `shift+1`) and Step 1's test
block exercises none of it.** Step 5's teeth check only covers the wheel path. Untested shipped
behaviour, mandated by the plan.

Worse than untested — **actively conflicting with Task 5's rename field**, which shipped one commit
earlier. These are bare-key window listeners:

- `-` and `=` are text characters. Focused in a layer-name rename input, `-` must insert a hyphen,
  not zoom out mid-word.
- `shift+1` types `!`.
- Escape already cancels a rename; nothing may consume it.

The plan's own text said "do **not** add them to `PRODUCT_SHORTCUTS` — that dispatcher … defers to
text fields", which reads as licence to skip the deferral. It is the opposite: leaving the dispatcher
is exactly what makes the guard the implementer's job. The plan's Global Constraints also already
require "Unmodified keys keep deferring to a focused text field
(`TEXT_ENTRY_DEFERRED_ACTIONS`)" — so this was a stated constraint the task text silently dropped.

**Ruling: amend Step 3 to require the deferral, reuse the existing owner, and add a sixth test.**
`isTextEntryTarget` is module-private at `shortcut-manager/index.ts:93` with a single caller at `:68`;
export and import it rather than copying its body (AGENTS.md "one owner per concept"). Step 7's
`git add` gained `shortcut-manager/index.ts` so the commit can contain its own fix, and the test
count went 5 → 6.

**Cost if wrong.** One exported function and one imported guard in a 6-test file; if navigation later
wants a different deferral owner, the change is two lines. The alternative — shipping bare-key window
listeners with a rename field live — corrupts authored layer names, which is data loss and not
recoverable by a later task.

### Ruling: Task 3 Step 6 amended — the e2e contradicted Step 1, and read the wrong owner

Two defects in Step 6's browser test, found by reading it against Step 1:

1. **It asserted the opposite of the unit contract.** `page.mouse.wheel(0, -400)` with no modifier,
   then `expect(readZoom()).toBeGreaterThan(fitted)`. Step 1 pins a plain wheel as **pan** and
   asserts `zoomToPoint` was not called. The e2e could only pass by breaking what the unit test
   requires. Amended to hold `Control` around the wheel, with the teeth check inverted: release the
   modifier and confirm it fails.
2. **It read a different owner than the one under test.** `readZoom` reached `canvas.getZoom()`
   through a scan of `Object.keys(window)` for a `vigilia-fabric-editor` prefix — Plan B Task 4
   replaced that handle with `window.vigiliaEditorBridge`, and Task 1 made `ViewportManager.zoom()`
   the owner of zoom. A test that reads the canvas directly cannot detect a camera that stops
   driving the canvas. Amended to read `vigiliaEditorBridge.editor.viewport.zoom()`.

Also amended Step 5 to add a teeth check for the new deferral guard, for the same reason I2 exists:
an unexercised guard is a guess.

**Cost if wrong.** The amended e2e reads a handle Plan B Task 4 established and Task 1 owns. If that
handle is renamed again before Task 3 runs, the test fails loudly at `page.evaluate` rather than
silently passing — which is the correct failure mode and cheap to fix.

### Ruling: Task 5's browser test was vacuous — rewritten, and the artboard-screen-rect ownership moved to Task 5

Read Task 5's brief before its turn and found the same class of defect as Task 6's Step 6, but worse
because it is silent:

1. **The drag never reached the canvas.** Step 1 hardcoded `page.mouse.move(20, 300)` … `move(900, 700)`
   in *page* coordinates. Measured post-Task-2 canvas rect is x≈357–983, y≈72–666, so `(20,300)` is
   left of the canvas and `(900,700)` is below it. The assertion is only "nothing moved", so an
   off-canvas drag passes **vacuously** — the test would go green while proving nothing about the
   marquee, and Step 4's teeth check (start inside an object) would never have been attempted because
   it was already green.
2. **`const after = await page.evaluate(() => { /* same read */ });`** — a literal placeholder in a
   plan step. A placeholder inside a code block is a plan failure by the writing-plans rules.
3. **It read the wrong handle.** The `read` helper scanned `Object.keys(window)` for a
   `vigilia-fabric-editor` key; Plan B Task 4 replaced that with `window.vigiliaEditorBridge`.
4. **No vacuity guard.** Nothing distinguished "the marquee worked" from "the canvas ignores pointer
   input".

**Ruling: rewrite Step 1** to derive points from the camera, assert the derived point is inside the
canvas before using it, and carry an explicit vacuity guard — the same gesture started **inside** an
object must move it, so a dead canvas fails the test rather than passing it. Also corrected Step 3's
stale `(20, 300)` reference and Step 4, which had been told to add a separate inside-an-object test
that is now the guard's own block.

### Ruling: `ViewportManager.artboardScreenRect()` belongs to Task 5, not Task 10

I had assigned the accessor to Task 10. **That was a sequencing error: Task 10 runs after Task 5 and
Task 6, both of which need the mapping in their own browser tests.** Moved to Task 5 — the first e2e
consumer after Task 2 — with Task 10 amended to consume it. Task 5's `git add` and Files list gained
`viewport-manager/index.ts`; Task 10's header now reads "Consumes … (**Task 5**, which owns it)".

The accessor **moves** the maths rather than duplicating it: `artboardScreenRect(canvas, artboard)`
already exists module-local at `editor-shell.ts:121` (used for the media element at `:372`), and
Task 5 must delete that copy and repoint the media call. Two implementations of one transform is
exactly what AGENTS.md's "one owner per concept" forbids. No new dependency: the camera already holds
the canvas, the viewport transform and the artboard accessor.

**Cost if wrong.** One interface member, its implementation, and one deleted module-local function —
local and reversible. The alternative was three separate browser tests each re-deriving the camera's
transform, which is the duplication this rule exists to prevent, and a Task 5 that cannot run.

This is the fifth task whose plan text specified behaviour with no test, a wrong test, or a
placeholder. The pattern is consistent enough to state: **these plans' test steps are trustworthy for
the behaviour the author was looking at and unreliable for everything added later in prose.** Every
remaining brief gets read against its own task text before dispatch.

### Ruling: Task 6 amended — Ctrl+A would have stolen the rename field's select-all, and `TEXT_ENTRY_DEFERRED_ACTIONS` is misnamed

Read the shortcut deferral predicate rather than trusting the brief's "arrow keys already defer; verify
that rather than assuming it". The predicate at `shortcut-manager/index.ts:66-69` is:

```ts
const deferred =
  binding !== undefined &&
  (!binding.modifier || TEXT_ENTRY_DEFERRED_ACTIONS.has(binding.action)) &&
  isTextEntryTarget(event.target);
```

So an **unmodified** binding defers automatically (arrow keys: fine, as the brief said), but a
**modifier** binding defers **only if its id is in `TEXT_ENTRY_DEFERRED_ACTIONS`** — and that set is
`file.new`, `edit.undo`, `edit.redo` only. Task 6 adds `canvas.select-all` on `mod+a` and nothing else
in the plan would have caught it:

**Ctrl+A while renaming a layer would select every object on the canvas instead of the text in the
field.** That is the current behaviour of every modifier binding not in that set.

**Ruling: rename the constant to `MODIFIED_KEY_DEFERRED_ACTION_IDS` and add `canvas.select-all`.**
Renaming is the substantive part — the name `TEXT_ENTRY_DEFERRED_ACTIONS` describes the unmodified-key
case, which needs no list at all, so it actively hid the gap. The precondition for a *modifier* id to
appear there is now stated in the name.

Verified while there: `delete`/`backspace` (`edit.delete`) are unmodified so they already defer, and
`mod+]/[` are modifier-qualified but have no text meaning, so they correctly do **not** belong in the
set. Recorded the rule so a later task adding e.g. `mod+backspace` knows it must add the id.

Also amended Step 5, two fixes:
- It contained the plan's second literal placeholder, `page.evaluate(/* read the object's left */)`.
  Replaced with a real read through `window.vigiliaEditorBridge`, plus `expect(before).toBeTypeOf("number")`
  so a failed lookup surfaces as a failure instead of `undefined + 1`.
- Selection now goes through `bridge.selectLayer("header-wash")` rather than clicking the layer row:
  a focused panel row is a different starting state, and this test is about the nudge binding.
- Added the **Ctrl+A-in-a-field assertion**, which is what gives the deferral fix teeth, and a second
  teeth check that removes `canvas.select-all` from the deferred set.

Also verified, no change needed: z-order's owner is `layerManager` (`editor-interaction.ts:26-29`), and
`bridge.ts:220-225` already maps `front`/`bottom` action ids onto it — so Task 6's `mod+]/[` handlers
call the same methods rather than reimplementing ordering. Confirmed no key collision with the existing
twelve bindings (`shortcut-manager/index.ts:24-35`); `mod+a`, `mod+]` and `mod+[` are all free.

**Cost if wrong.** One renamed constant, one added id, and the modifier set's membership rule written
down. The alternative is Ctrl+A destroying a rename-in-progress in a way the author would experience as
"my text keeps disappearing", with nothing in either plan pointing at the cause.

### Cross-plan matrix built (files AND keys) — no unresolved conflict

Extracted every task's Create/Modify/Test list from all three plans and compared them pairwise. Every
shared file is **sequential within its own plan**, which the one-implementer rule already serialises:
Plan A `editor-shell.ts` (Tasks 2,3,5), `editor-shell.css` (2,4,5,9), `ui-copy.ts` (4,9),
`shell-layout.tsx` (4,9), `bridge.ts` (4,8), `editor-interaction.ts` (2,7), `editor-session.ts` (6,7),
`layer-panel.tsx` (8), `editor.spec.ts` (3,5,10), `viewport-manager/index.ts` (1,5); Plan B
`layer-panel.tsx` (5,6), `bridge.ts` (2,4,5,6), `layer-panel.dom.test.tsx` (5,6), `shell-layout.tsx`
(5,6,7), `editor-shell.css` (5,7). **No cross-plan file conflict.** Also grepped both other plans for
references to the two files Plan B Task 5 deleted (`src/layer-panel.ts`,
`layer-panel.dom.test.ts`): none found — the only pre-deletion reference was in Plan B Task 1, which had
already run.

The gap in my original scan was **keys**, which surfaced as the arrow-key collision above. Both plans
were internally consistent; only reading them against each other exposed it.

### Plan-text repair pass — Task 7's and Task 10's placeholder browser tests

Both were `await page.goto(EDITOR); // <what to verify>` and nothing else — the
same defect as Plan B Task 5's rename test, in two more places. A test that
asserts nothing passes forever and reads as coverage in the plan.

**Task 7 Step 6, rewritten and verified against real API:**
- Drives the whole flow through a `setThemePackage` fixture rather than
  "group two layers": the assertion is about the context surviving an undo, and
  building the group through UI gestures would make the test fail for reasons
  that have nothing to do with it.
- Points come from `artboardScreenRect()` (Task 5), never from the canvas box.
  Task 2 made the canvas host-sized, so a hardcoded page-space literal can be
  off-canvas and pass vacuously — that is exactly what Task 5's rewrite exists to
  remove, and Task 7's original step would have reintroduced it.
- The nudge is `ArrowRight` on a **group child**, which is the only path that
  reaches the case the unit test cannot: a restored scene builds *new* Fabric
  objects, so a context holding pre-undo instances points at objects that are no
  longer on the canvas. Escape after the undo is the real assertion.

**Task 10 Step 1, rewritten after reading `guide-renderer.ts`:** it would have
asserted on `getObjects()`, and **guides are not Fabric objects** — they are
painted onto `canvas.getSelectionContext()` at `guide-renderer.ts:29-40`. The
test would have found zero guides and passed on an empty loop.

Replaced with what actually owns each claim:
- **Unit (new Step 1):** the two pure decisions — `GUIDE_WIDTH / zoom`
  (`guide-renderer.ts:37`, which has **zero** zoom coverage today) and clamping
  to guide bounds rather than the viewport. `guide-renderer.dom.test.ts` already
  has the context spy, so both are directly assertable. Teeth check included.
- **Browser (Step 2):** zoom through `viewport.zoomToPoint` (scene coordinates,
  scale factor — verified at `viewport-manager/index.ts:128`), drag via the
  Task 5 helper, capture, and **report what the image shows**. No pixel
  assertions.
- **Step 3** gained the screenshot-registry row. `docs/evidence/screenshots/README.md`
  carries `| Viewport | Resize or change zoom | add when changed |`, and Task 10
  changes zoom — a capture on disk but unregistered is invisible.

Task 10's Files list gained `guide-renderer.dom.test.ts` and `guide-renderer.ts`
so the step's own commit can contain its own fix.

**Cost if wrong.** Both are test-only and both fail loudly. The alternative was
shipping a plan whose two "browser test" steps would have produced a green test
that rendered nothing — the specific failure mode this branch already found once,
in Plan B Task 5.

### Task 2 review adjudicated (opus, review-8184472..093b3ec.diff) — Needs fixes, 2 findings kept, 2 rejected

Verdict was "Task quality: Needs fixes" with one Important. I verified all four
claims myself rather than accepting the summary.

**Important 1 — "the `getWidth() === 1000` assertion has no teeth" — PARTLY RIGHT,
and its own arithmetic is wrong.** I measured instead of reasoning: the height
assertion **has** teeth (I broke it to `-1` and the test failed with
`expected 800 to be -1`). The old `fitCanvasViewport` set the canvas to the
*artboard scaled by fit*, which for a 1000×800 host against a 1280×720 artboard
is `min(0.78125, 1.111) = 0.78125` → **1000×562.5**, not 1000×800. So the height
line discriminates old from new. The reviewer asserted otherwise; it did not run
the old code.

But the reviewer's structural point is right and worth acting on: the **width**
line is genuinely vacuous, because at fit scale the width-limited axis by
definition equals the host, so `getWidth() === 1000` cannot distinguish
"host-sized" from "artboard-sized-and-fitted" for this particular fixture. And
the comment above it — "1280x720 fitted into 1000x800 would be a 1000px-wide
canvas, and it must no longer be" — is now **false**, since 1000 is exactly what
it is. **Ruling: fix the fixture, not the assertion.** Change the host to
1000×400 (fit scale 0.5556 → old canvas 711×400, new 1000×400). Now the width
line discriminates and the height line stays honest. Correct the comment.

**Important 2 — `setFitMode`'s parameter is dropped — ACCEPTED as a Minor, not
Important.** Verified: zero callers (`grep` finds only the declaration at
`editor-shell.ts:78` and the implementation at `:438`). The editor no longer
honours a fit mode on purpose — Task 2's own plan text at `:409` says so. So the
behaviour is intended; what is wrong is only that the type still advertises a
parameter the implementation ignores, so a future caller passing `"cover"`
compiles and is silently ignored. **Ruling: drop the parameter from the
interface.** The editor frames the whole board; the author's `fitMode` is
authored artboard state the *player* consumes (`artboard-panel.ts:78` writes it
into the envelope), which is a different concept that never belonged on this
method. Deleting the parameter makes the type tell the truth. If the editor ever
needs a cover view, that is a new decision with a real caller.

**Rejected — the `plan`-path clipPath finding.** The reviewer is right that
`plan` has no callers (I confirmed: no `plan:` argument anywhere in
`packages/*/src` or `tests/`, and `ScenePlan` has exactly one importer,
`editor-shell.ts`). It is dead today and would misbehave if revived. But it is
**not this task's defect and not this task's fix**: `git show 8184472` proves the
`scene?.apply(plan)` → `applyArtboardPaint` ordering predates Task 2 unchanged,
so Task 2 neither introduced nor worsened it, and the reviewer's own note says
"dead today". Reviving a dead path is speculative work. **Ruling: park it.** If a
future task wires `plan`, that task clears the adapter's `clipPath` — one line,
and this ledger entry is the pointer. Cost if wrong: a revived `plan` path shows
a hidden pasteboard until someone reads this line.

**Rejected — Minor 1 (negative-scale rect) and Minor 3 (no browser check at
non-fit zoom).** The first is unreachable because the camera clamps zoom
positive (`viewport-manager/index.ts:87`), and the second is **Task 10's
deliverable**, which already carries the non-fit-zoom verification. Neither is a
Task 2 defect.

**Deferred, not rejected — Minor 2 (unconditional `backgroundColor` clear).**
Real but harmless today; noted for the final whole-branch review rather than
spent as a fix round now.

**Sequencing:** the accepted fixes touch `editor-shell.ts` and
`editor-shell.dom.test.ts`, and Task 3's implementer is running against
`editor-shell.ts` right now. The one-implementer rule serialises them, so Task
2's fix round is **parked until Task 3 commits**.

### Correction to my own cross-plan matrix: there IS a cross-plan file overlap

My matrix recorded "**No cross-plan file conflict**" and justified it with
"every shared file is sequential within its own plan, which the one-implementer
rule already serialises." **That reasoning was wrong**, and reading Task 8's and
Task 9's briefs against Plan B's Task 6 brief exposed it. The claim I checked was
*within* each plan; I never compared Plan A's tasks against Plan B's directly
beyond grepping for the two deleted files.

The actual overlap:

| File | Plan A | Plan B |
|---|---|---|
| `editor-shell/layer-panel.tsx` | Task 8 | Task 6 |
| `editor-shell/layer-panel.dom.test.tsx` | Task 8 | Task 6 |
| `editor-shell/bridge.ts` | Task 8 | Tasks 2, 4, 5, 6 |
| `editor-shell/shell-layout.tsx` | Task 9 | Tasks 5, 6, 7 |

**Why it is not a disaster:** the one-implementer rule serialises the writes, so
there is no merge conflict — only an ordering constraint, which is what the
matrix should have recorded.

**Ruling: Plan B's Tasks 6–10 run before Plan A's Tasks 8–11.** Task 8's brief
already declares "This task depends on the UI-polish plan" and its Step 1 calls
`bridge(rows, { groupContext })` — the override-taking `bridge` factory that Plan
B Task 5 created and Task 6 extends. Task 9 consumes `arrangeActions` and
`actionEnabled`, which Plan B Tasks 1–2 delivered (verified present at
`object-actions.ts:73,82,188`). Running A first would mean extending a helper
that B then rewrites underneath it.

**Verified safe to interleave:** Plan A Tasks 3–7 touch `viewport-manager/*`,
`editor-shell.ts`, `editor-shell.css`, `ui-copy.ts`, `shortcut-manager/*`,
`grouping-manager/*`, `editor-interaction.ts` and `editor-session.ts`; Plan B
Tasks 6–10 touch `layer-panel.tsx`, `bridge.ts`, `layer-panel.dom.test.tsx`,
`shell-layout.tsx`, `editor-shell.css`, `ui-copy.ts`. `editor-shell.css` and
`ui-copy.ts` overlap but not on the same tasks (A5/A9 vs B7), so the order above
holds. Neither order creates a conflict for A3–7 vs B6–10.

**Cost if wrong.** Discovering it at Task 8 means rebasing three files' worth of
work onto a panel that changed shape. The ledger entry is cheap; the rework is
not.

### Task 11's "known pre-existing failures" premise was FALSE — I measured it

The plan asserted that `display-fabric.spec.ts` carries two pre-existing
phone-chromium failures ("keeps repainting as samples arrive", "is byte-stable at
a fixed clock on one platform"), both "hanging at `document.fonts.ready` after
`page.clock.runFor()`", and told the implementer to confirm them and move on.

**Both pass.** Measured just now:

```
✓ tests\e2e\display-fabric.spec.ts:322 › charts draw through a Fabric object ›
    keeps repainting as samples arrive  (28.5s)  [phone-chromium]
✓ tests\e2e\display-fabric.spec.ts:671 › every fixture renders ›
    is byte-stable at a fixed clock on one platform  (29.4s)  [phone-chromium]
```

Removed the claim from Step 2 and replaced it with the measurements. Both tests
now read as must-pass, with a standing instruction that a red suite is a failure
to investigate rather than to classify as pre-existing without a base-commit run
proving it.

**Why this mattered enough to correct.** A "known failure, ignore it" note is
the one instruction that can silently swallow a real regression — and this plan
*is* expected to produce red tests before Task 10 fixes them. An implementer at
Task 11 holding a licence to accept two red phone-chromium tests has no way to
distinguish "the documented one" from "the one Task 10 was supposed to fix and
did not". The laundry list had to go even though it was only wrong about the
specifics.

**Cost if wrong.** None measured; both tests were run to establish this, and both
were green. If they later go red, the plan now says to investigate rather than
excuse, which is the correct default either way.

### Task 2 fix round: committed `419a512` (base `8d43499`) — DONE, both findings closed

One dispatch, two fixes, no findings rejected.

- Fixture host changed 1000×800 → **1000×400**, so fit scale is 0.5556 and a
  fitted canvas would be **711×400** against the host-sized **1000×400**. The
  width assertion now discriminates, which it did not before. Teeth check
  reported verbatim: `AssertionError: expected 1000 to be 711`.
- `setFitMode`'s parameter dropped at `editor-shell.ts:78`; the now-unused
  `FitMode` import removed after a grep confirmed no other reference. The method
  itself and `artboard-panel.ts:78` are untouched, as instructed.
- Report: 1 file / 7 tests pass; typecheck, biome lint and format clean.

**One correction to my own brief.** The brief told the implementer to "fix the doc
comment above the implementation so it no longer refers to a parameter". It never
did refer to one — it already stated the whole-board framing and the player-crop
rationale. The implementer correctly reported having made no edit there. The
instruction was harmless, but it was a third instance of the session pattern: my
rulings about *what should be true* have been sound, and my rulings about *which
existing thing to touch* have needed the read first.

### Task 3 review adjudicated (opus, `review-7c427ee..8d43499.diff`) — Needs fixes, all 7 accepted

Spec compliance ✅ (all seven steps; both implementer departures justified).
Task quality **Needs fixes**, 2 Important + 5 Minor. **I accepted all seven.**

**Important 1 — a lost `mouseup` leaves the gesture claimed forever — ACCEPTED,
and it is the most serious defect found in this plan so far.** `onMouseMove`
(`navigation.ts:121-126`) pans on any move while `panning` is true and never
checks `event.buttons`. The reviewer re-ran it live: a `mousemove` carrying
`buttons: 0` still moved the transform, `[120,117.9]` → `[220,217.9]`.

The blast radius is why it is Important rather than Minor: `claim()` sets
`skipTargetFind = true` and `selection = false`, so a mouseup lost outside the
window leaves the editor **unable to select anything** until some later mouseup
or blur — the exact failure mode my Task 3 dispatch asked the reviewer to
scrutinise, and it was there. Fix: `if (event.buttons === 0) { endPan(); return; }`
with a unit test and a teeth check. Cost if wrong: the gesture ends early on a
platform that reports `buttons` as 0 mid-drag — no such platform is known, and
the alternative is a wedged editor.

**Important 2 — `activatesOnSpace` misses half the controls that take Space —
ACCEPTED.** It recognises `<button>` and six ARIA roles, but not
`<input type="checkbox|radio|button|submit">`, `<a href>`, `<summary>` or
`<select>`. The reviewer verified a focused checkbox gives `defaultPrevented:
true, skipTargetFind: true`. **This is reachable in the shipped editor today**:
`chart-manager/panel.ts:136` renders boolean chart settings as checkboxes, so
Space on one opens pan mode instead of toggling it. The implementer's guard
closed the toolbar-button case and left the rest — a partial fix that reads as a
complete one, which is why it needed the independent check.

The fix routes the `<input>` case through `isTextEntryTarget` rather than copying
its type list: that function is false for exactly the input types that consume
Space, so the negative case already has an owner. The reuse rule doing real work
rather than being quoted.

**Minors 3–7 all accepted, none rejected.** `deltaMode` normalisation (a
line-mode wheel pans ~3px instead of ~48); `release()` clobbering
`skipTargetFind`/`selection` it never captured; the per-keydown `Set` allocation,
closed for free by hoisting the set Fix 2 already rewrites; the ctrl/alt guard
sitting below the Space branch so Ctrl+Space and Alt+Space are claimed as pans;
and the wheel-zoom sign being unassertable because the stub's `zoom()` is a
constant.

Fix 6 is the one worth naming: **it is a test-only fix and it is the reason I did
not triage the Minors away.** `Math.exp(-deltaY / WHEEL_ZOOM_DIVISOR)` cannot be
observed through a stub that always returns 1, so the suite would pass with the
sign inverted or the divisor wrong. That is the same class of vacuous assertion
as Task 10's guides-on-`getObjects()` and Task 5's off-canvas drag, found this
time by the reviewer rather than by me.

**Cost if wrong (Minors 3–7).** Roughly forty lines of diff across one file and
its test, all local and reversible. Triaging them away would have cost a memory
of "these were known and accepted", which is how a defect outlives the session
that named it.

### Ruling: Task 6's named teeth check was toothless, and its `ownerOf` sketch did not compile

Found while reading Task 6's brief against the live source before dispatch — the
same pre-dispatch read that produced the Task 5, 6, 7, 10 and 11 rulings. Five
defects, all verified by probing real Fabric 7.4.0 under Node rather than by
reasoning, and all amended into the plan in place.

1. **The named teeth check proved nothing.** It said "delete the `ownerOf`
   comparison and confirm the cross-group test fails". Probed: with `child`
   inside `grp` and `sibling` at the canvas root,
   `grp.getObjects().indexOf(sibling)` is `-1`, so `from < 0 || anchorAt < 0`
   **already refuses**. Under either reading of the now-unguarded
   `const parent = ownerOf(moved)` — the owning group, or `undefined` → the
   canvas root — the test still passes. Replaced with two checks that were
   measured to fail: drop the parent scoping *and* the index guard (the child is
   spliced into the canvas root), and change `target = anchorAt + 1` to
   `target = from` (Fabric returns `false`, so `reorderLayer` returns `false`).
2. **The index guard is load-bearing beyond tidiness, and the plan never said
   why.** `moveObjectTo` calls `removeFromArray` (a no-op for an absent object)
   and then `_objects.splice(index, 0, object)`, so **`splice(-1, …)` inserts
   before the last element** — a mismatched array would reparent the object
   instead of refusing. Recorded inline at the guard.
3. **`ownerOf(moved)` does not compile.** The real signature is
   `ownerOf(root, id)` (`layer-tree.ts:139`), as is `findById`. The old text
   called the object form "shorthand" and told the implementer to check the
   signature — advice that would have been fine had the surrounding code not
   been wrong. Rewritten with `root` held in a local so the three reads cannot
   see different arrays.
4. **The unit tests could not have run.** `bridgeFor` is defined in
   `bridge.dom.test.ts:45` and **is not exported**; `layer-panel.dom.test.tsx`
   does not import `Canvas`. Worse, the fixtures omitted `historyManager`, which
   Step 4 calls. Added the routing (put the three in `bridge.dom.test.ts` beside
   `bridgeFor`) and `historyManager: { saveState }` to each fixture, plus a
   `saveState` assertion — reordering is authored state and nothing else in the
   unit suite pinned it.
5. **The e2e fixture could never pass.** It used `fill: "#00b8d9"` with no
   `vigiliaPaint` ref and no `globals.palette`, which
   `fabric-envelope-validate.ts:328-373` rejects as `unresolved-global-ref`, and
   `setThemePackage` asserts `writeThemePackage(...).ok` — so the test would have
   failed before the editor opened. Rewritten to follow the working
   `movable.vigilia-theme` fixture at `editor.spec.ts:1322`.

I also recorded, in the test text itself, what the new e2e's vacuity guard does
and does not cover: `expect(afterPanel).not.toEqual(beforePanel)` cannot pass on
a dead drag, but a drag that fires with the wrong ids is caught only by the
envelope assertion on the next line.

**Cost if wrong.** All five are test-and-fixture changes plus one corrected code
sketch. Cheap individually; the alternative was dispatching an implementer at a
task whose tests could not compile, whose fixture could not open, and whose
teeth check would have been reported as passing.

### Ruling: Task 4 was mandating a second owner for a concept that already has one

Found by the pre-dispatch read of Task 4's brief. The brief said:

> `EditorShellBridge` gains `readonly viewport: ViewportManager | undefined` … Add the new member in `bridge.ts`, and add the field to whatever literal constructs the bridge so it type-checks.

**That is wrong twice over, and the second half was already true under another name.**
Verified reads: `EditorShellBridge` already declares `readonly editor: EditorInteraction`
(`bridge.ts:51`, `:67`, `:200`), and `EditorInteraction` already declares
`readonly viewport: ViewportManager` (`editor-interaction.ts:12-13`) — **required, not
optional**. And the literal the brief hunts for, `createEditorShellBridge({ editor,
session })` at `editor-main.ts:155`, **already passes `editor`**.

So the mandated member is a duplicate of a required member, on the one surface every
panel reads, and the `| undefined` would have weakened a required member into a nullable
one — forcing every consumer to handle a case that cannot occur, which is how a null
check outlives the reason it was added.

**Ruling: the bridge gains nothing.** `ZoomReadout` takes `viewport: ViewportManager` as
a prop; `shell-layout.tsx` is the only file that reads the bridge, passing
`bridge.editor.viewport`. Removed `bridge.ts` from both the Files list and the `git add`
block. The component being a plain presentational one is also what makes Step 1's
`viewport` stub — a value satisfying `ViewportManager` with no bridge and no cast — the
natural shape rather than a contrivance.

**Cost if wrong.** If a later task needs the readout to work with no editor mounted, it
needs the optional member back: one member, one call site. The alternative today is an
optional duplicate of a required member. Low either way; the reason to rule now is that
a plan which tells an implementer to add a field that already exists costs a dispatch,
and this one would have compiled.

### Ruling: Task 4's "check `onChange` exists" instruction was written for a world that no longer exists

The brief's Step 3 said "if Task 1 shipped without it, stop and report". Task 1 did ship
it, I verified it directly, and the implementation notifies subscribers after every
`apply()`. Nothing to check and nothing to report — but the sentence told an implementer
to stop and report on a condition already known false, which is a wasted round if read
literally.

Replaced with the instruction that is actually useful: **read the current `ViewportManager`
before writing the stub**, because Task 1's own fix round and Task 5's later addition both
land on that interface. Step 1's `satisfies` failing to compile is the intended outcome;
quietly filling in a member the interface no longer has is not.

### Amendment: Task 4 Step 4's browser evidence could not distinguish tracking from a first paint

"Wheel-zoom and confirm the readout tracks the zoom rather than staying at the fit value"
is satisfied by any implementation that renders a plausible number, because fit zoom at a
1280×720 host is already a non-round number that differs from the value a broken readout
would show only if you happened to know it. A capture cannot show the difference between
"subscribed" and "rendered once" — both look like a number.

Amended to the pair that does: **pan with a space-drag and confirm the percentage is
unchanged while the canvas visibly moves** (a readout wired to the wrong event would move
here), then ctrl-wheel and confirm it changes. Also required the e2e case in the Files
list and required it to read through `window.vigiliaEditorBridge`, not the canvas — Task 1
made `ViewportManager` the owner of zoom, so a test reading `canvas.getZoom()` cannot
detect a readout that stopped following the camera. That is the same defect Task 3's
Step 6 had, found once there and prevented here.

### Ruling: Task 5 Step 1's vacuity guard and Step 3's offered fix contradicted each other

Step 1's guard drags `at(640, 80)` to prove the canvas still responds to pointer input.
Artboard y = 80 is **inside `header-wash`**, which is `rect("header-wash", 0, 0, 1280, 142,
…)` (`new-fabric-theme.ts:331`). Step 3 then offers, as an available fix, giving
`header-wash` `backgroundOnly`. **Take that fix and the guard's own target stops being
interactive, so the test fails on the line after the assertion it exists to protect** —
and the failure would read as a marquee bug.

It is worse than a trap: Step 3 also says "Decide from what Step 2 actually reports", and
what Step 2 reports is precisely that the drag grabbed `header-wash`. Task 2's second e2e
failure is the same shape — a drag resolving to the wrong object and moving it. So the
offered fix is the *likely* one, and the guard is the thing it breaks.

**Ruling: repoint the guard at `time-card` (`(70, 450)`, inside 52,150 260×330 and outside
every child it contains) and add an explicit instruction not to solve the drag by disarming
`header-wash` unless the pointer itself lands inside the band.** Verified reads for all of
it: `card()` (`new-fabric-theme.ts:568-579`) routes through `rect()` with the default
`positioned` interaction, so it is selectable and evented; `header-wash` is the scene's
only full-width rect above y=142; `time-card`'s children all start at y≥189, so 450 clears
them.

**Cost if wrong.** The guard drags a different object. If `time-card` were ever
non-interactive the guard fails loudly at `not.toEqual`, which is the correct failure mode.
The alternative was a guard that silently stops guarding exactly when its task's fix is
applied.

### Correction to Task 5's own text: it named the wrong task for its own accessor

Line 785 read "Derive the point through the same `artboardScreenRect` accessor **Task 10
adds**". Task 5 is where that accessor was moved to (recorded earlier in this ledger), and
Task 5's own Interfaces block at `:775` says so. The prose had not been updated with the
ruling, so two lines of the same task disagreed about which task owns the accessor — and
the prose line is the one an implementer reads at the point of use. Corrected in place,
with a parenthetical recording that it was a sequencing fix.

### Ruling: Task 6's coalescing mechanism could not produce the history entry its own test asserts

Found by reading Task 6's brief against `history-manager/index.ts` and `editor-shell.ts`
before dispatch. This is the highest-value find of the pre-dispatch pass so far, because
the plan states the mechanism confidently and the mechanism does not work.

**The brief said:** suspend on the first nudge, resume on an idle timeout or on any other
action, and "fire `object:modified` … so the existing `object:modified` → `save` listener
records **one** history entry per gesture."

**Read the implementation.** `save()` is `if (this.#suspended > 0) return;`
(`history-manager/index.ts:51-52`) — it **early-returns, it does not queue**. The
`object:modified` listener is `canvas.on("object:modified", save)` (`editor-shell.ts:222`),
and `historyManager.saveState` is the same `save` (`:232`). So the sequence the brief
prescribes is: `suspend()` → nudge → fire `object:modified` → *suppressed* → `release()` →
**nothing ever calls `save` again**. The burst records **no history entry at all**, and
Step 5's `Control+z` assertion is the only thing that would have caught it — after a
dispatch, in the browser, as a failure whose cause is two files away.

**Ruling: `endBurst` releases and then calls `historyManager.saveState()` explicitly, in
that order**, with a comment saying why, because the next reader's instinct will be that
the explicit save is redundant with the `object:modified` listener. It is not: that
listener is suppressed for the entire burst by design.

**The `object:modified` fire stays.** It has three other listeners that need it and have
nothing to do with history: `chart-manager/index.ts:87` rerasterizes a scaled chart,
`indicator-manager/index.ts:113,121` hides the angle and size indicators, and
`selection-inspector/index.ts:306` re-renders the fields. Dropping it to "fix" the history
would break all three.

**The rejected alternative, recorded so it is not re-proposed:** fire `object:modified`
and let it save, without suspending at all. Simpler, and it gives one entry *per keypress* —
a ten-step nudge needs ten undos. That is the behaviour the coalescing exists to prevent.

**Teeth check rewritten to attack the right line.** The old one said "remove the single-save
coalescing and confirm the undo assertion fails (it would take two undos to return)" — which
describes the *unsuspended* implementation, not the shipped one. The new check removes
`saveState()` from `endBurst` and left it as the **first** of the two, because it is the one
that proves the explicit save is load-bearing rather than redundant.

**Cost if wrong.** If `save()` were later changed to flush on release, the explicit call
would be a redundant duplicate — harmless, since `save()` already dedupes with
`sameScene(scene, this.#entries[this.#index])` (`:54`). So the ruling is safe under either
implementation, which is the reason to prefer it over "restructure `save()` to flush".

### Amendment: Task 6 Step 5's Ctrl+A locator and the arrow-key focus precondition

Two small corrections while reading the test.

- **`input[aria-label^="Rename"]` was unchecked.** Verified it matches:
  `layer-panel.tsx:161` renders `` aria-label={`${uiCopy.panels.rename} ${row.name}`} `` and
  `ui-copy.ts:129` is `rename: "Rename"`. Left as written, now with the line references, so
  an implementer does not have to re-derive them.
- **The arrow keys need document focus, and the test never says so.** `page.keyboard.press`
  targets whatever is focused; `page.goto` leaves `<body>` focused, which is what the
  window-level dispatcher needs — but the Ctrl+A block at the end focuses the rename input,
  so an implementer who reorders the blocks or adds an interaction above gets a silent
  no-nudge. Added the precondition and the signature to check when the unit tests pass and
  the browser assertion does not.
### Ruling: Task 7 could not make its own browser test pass, and Step 5 named no owner

Found by reading Task 7's brief against `grouping-manager/index.ts`, `text-manager/index.ts`,
`shortcut-manager/index.ts`, `scene-fabric/persist.ts` and Fabric's own target search — before
dispatch, while Task 3's fix round ran.

This is the second-highest-value find of the pass. The task is not wrong about *what* group
entry is; it is silent about the one mechanism that makes it observable, and its Escape wiring
names a different owner than the one the dispatcher already has.

#### The defect: nothing in the plan makes a child the pointer's target

Step 1 asserts `manager.enterGroup({ object: child })` returns the child, and Step 6 polls a
live browser for `active === "child"` after a `dblclick` inside the child. Neither can pass on
the plan's own implementation, because **entering a group does not change what Fabric's hit
test returns.**

Read Fabric: `searchPossibleTargets` (`index.node.cjs:11265-11285`) retargets from a group to
its child only when **both** conditions hold:

- `target.subTargetCheck` is true (`:11246`) — without it the sub-search never runs and the
  group itself is returned;
- `container.interactive` is true (`:11269`) — with the sub-search run but this false, the
  group is still returned.

Both default to `false` (`groupDefaultValues`, `:9016-9020`). The plan's Step 3 sets neither —
it says only "`enterGroup` sets the child active and records the ancestor path." So after a
correct implementation of the plan's text, a `dblclick` inside the child resolves to the
**group**, `expect.poll(async () => (await state()).active).toBe("child")` never settles, and
Task 7 fails Step 6 for a reason its own Step 3 cannot explain. An implementer would be left
hunting a bug in code that is right.

**Ruling: `enterGroup` sets `subTargetCheck` and `interactive` on the group it enters,
remembering which it changed; `exitGroup` restores them.** The unit test now asserts both
flags directly, so a failure names the mechanism rather than only the symptom.

**Why this does not reintroduce editor state into a portable document — the concern that
hesitated first.** `scene-fabric/persist.ts:58` sets `includeDefaultValues = false` before
every serialisation, so a property equal to its default is **not written**. `subTargetCheck:
false` and `interactive: false` are exactly the `Group` defaults, so a group an `enterGroup`
has since restored serialises without them, byte-identical to one that never entered.
Verified by reading, not assumed.

The same mechanism is why `persist.dom.test.ts:243-263` is not in the way. That test pins the
key set for a group constructed with `subTargetCheck: true, interactive: true` — a **non-default**
group, which is exactly the case that does persist, and its comment says it exists to make
"editor state in a portable document" arrive as a visible failure. This task never constructs
such a group and never persists one mid-entry.

**The alternative I rejected, recorded so it is not re-proposed:** enable both flags
permanently on every group, or on group creation in `grouping-manager`. It is a smaller diff
and it is wrong on two counts: it writes editor interaction state into every saved document
(the failure `persist.dom.test.ts` was written to catch), and it makes group entry
unobservable as a state change, which is the thing the feature is.

#### The defect: Step 5 named the wrong owners

- **Double-click.** Step 5 said "bind double-click on the canvas to `enterGroup`" without
  noting that `text-manager` already owns `mouse:dblclick` (`text-manager/index.ts:30`). No
  conflict exists — its handler returns early for any non-`IText` target (`:20-22`) — but an
  implementer who does not know that will either duplicate the listener or "resolve" the
  clash by rewriting the text handler. Amendment says which, and forbids taking the event over.
- **Escape.** Step 5 said to bind Escape directly and *not* to add it to `PRODUCT_SHORTCUTS`.
  The half that is right is not adding it to the registry. The half that is wrong is binding
  it by hand: `ShortcutManager` is already the owner of window-level keys
  (`shortcut-manager/index.ts:79`), so a second global `keydown` listener duplicates that
  owner and races it inside a focused rename field — which is precisely the case the
  dispatcher's `TEXT_ENTRY_DEFERRED_ACTIONS` predicate exists to handle.
  Amendment routes it through `#shortcuts.register` and says to check the text field case,
  with `TEXT_ENTRY_DEFERRED_ACTIONS` named as the fix if it misbehaves.

#### The defect: the undo requirement had no mechanism

Step 5's original text carried no mention of post-restore handling while Step 6's own tests
require it. `reviveScene` calls `loadFromJSON` (`scene-fabric/persist.ts:87-93`), which builds
**new** objects. Probed under `fabric/node`: after a round trip the group is a different
instance, and the stale pre-undo instance has `canvas === undefined`. So the flags an
`enterGroup` set are gone from the revived group *and* the context points at objects no longer
on the canvas — two independent failures, both land on the same `Control+z` line.

**Ruling: re-apply the flags and re-resolve the context by id on
`editor:history-state-loaded`** (`history-manager/index.ts:75`), the point `editor-shell.ts:334`
already hooks to restore the artboard plate. One hook, two restores, one owner. A second teeth
check was added: drop the re-apply and the `Control+z` step must fail.

**Cost if wrong.** If the flags turn out to be persisted after all, the saved-document concern
returns — but `persist.dom.test.ts`'s default-stripping case is the test that would say so, and
it is unaffected by this change, so the failure would be visible in Task 11's full gate rather
than silent. If `editor:history-state-loaded` fires before the tree is fully revived, the
by-id re-resolution finds nothing and Task 7's own browser test fails loudly at the Escape
assertion. Neither path is a silent one, which is the reason to prefer this over inventing a
new event.
## Task 3 — fix round 1 re-review: CLEAN, with two parked assertion gaps

`bash scripts/review-package … 419a512 a495699` → `review-419a512..a495699.diff`
(1 commit, 20514 bytes). Re-reviewed on sonnet. Verdict: **all seven findings ADDRESSED,
no new Critical/Important breakage.**

The two Important fixes were verified by reading the code rather than by accepting the
report: the `event.buttons === 0` branch really does run before the pan (`navigation.ts:156-159`,
via `endPan`) and `activatesOnSpace` really does cover the `<input>` partition through
`isTextEntryTarget`. The re-reviewer re-derived both teeth checks independently and got the
same assertions the implementer reported, which is the second time this task's break checks
have discriminated.

It also confirmed the change I was most suspicious of: the two pre-existing drag tests gained
`buttons: 1` / `buttons: 4` and that **strengthens** them, because jsdom defaults `buttons` to
`0` and with the new branch a `0`-carrying move would end the gesture for a trivial reason — so
before the edit those assertions proved less than they appeared to.

### Parked: Fix 4's fix has no assertion (Minor, code correct)

The re-reviewer's sharpest find. `release()` correctly captures and restores
`resumeSkipTargetFind` / `resumeSelection` (`navigation.ts:101-102`, `:111-112`), but **no test
distinguishes the captured value from a hardcoded one**: the suite asserts `skipTargetFind`
`false` before the claim, `true` after it, `false` after release — and the captured value at
claim time *is* `false`, so a `release()` writing literals passes every one. `canvas.selection`
is never asserted anywhere in the file.

**Ruling: corrected in the report, dispatched as a fix round 2 with two test-only assertions.**
Give the claim fixture a canvas with `skipTargetFind = true` / `selection = false` **already
set** before the gesture, and assert both survive `release()`. That is the only shape that
fails against a hardcoded restore.

**Why not park it for the final review instead.** Vigilia's evidence rule is that a regression
test must fail when the fix is disabled before it is trusted. Fix 4's fix currently has no
test at all, and the report claimed it had one — the claim is the part that would mislead a
later reader. It is two assertions on a file already open, so the cost of closing it is smaller
than the cost of one reader believing coverage that does not exist.

**Why the fix round is not urgent.** The code is right; only its proof is missing. Round 2 is
queued behind Plan B Task 6, which holds the single implementer slot.

### Parked: Fix 6 pins the zoom direction but not the divisor (Minor)

The corrected stub now makes `zoom()` mutable, so sign inversion is caught — the review's Fix 6
is genuinely closed. But the brief also claimed the test would catch a *wrong divisor*, and the
re-reviewer is right that it does not: `2 * Math.exp(-delta / 100)` satisfies both
`toBeGreaterThan(2)` and `toBeLessThan(2)`. Magnitude stays unpinned.

**Ruling: accepted as-is, not corrected.** The defect Fix 6 was written against is an inverted
wheel, and that is now caught. Pinning the divisor means asserting a specific zoom *value*
against `WHEEL_ZOOM_DIVISOR`, which turns a correct behaviour change into a test edit — the
wrong trade for a value nothing else reads. Recorded here so a later reader does not believe
the magnitude is covered. Folded into the same fix round 2 as a one-line comment on the
constant naming the test that would move with it, if the implementer judges that cheaper than
leaving it.

### Out of scope, noted for the final review

`shortcut-manager/index.ts:104` allocates `new Set([...])` inside `isTextEntryTarget` on every
call, and `navigation.ts` now calls it up to three times per keydown (`:179-183`, `:53`). The
fix removed one per-keydown allocation from `navigation.ts` while reusing an owner that
allocates per call. Pre-existing, trivial, and not this task's to fix.

`navigation.dom.test.ts` binds `bindViewportNavigation` in `setup()` and unbinds only in its one
`unbinds every listener` case, so each test leaks window listeners onto jsdom's shared `window`.
No cross-test corruption found. Pre-existing pattern; a sharp edge for whoever adds the next
test in that file — which is now fix round 2, so it should not make it worse.
### Ruling: Task 8 needed no new wiring — but it does depend on Task 7's ordering

Found by reading Task 8's brief against `layer-panel.tsx`, `bridge.ts`,
`bridge.dom.test.ts` and Fabric's `setActiveObject`.

**The question Task 8's text left open.** Step 3 adds `groupContext(): readonly string[]` to the
bridge and tells the panel to mark the owning row — but says nothing about **what makes the
panel re-render when a canvas double-click enters a group.** Every other panel update flows
through `LayerStore.mutate` (`layer-panel.tsx:55-59`). A canvas gesture does not: it goes
`enterGroup` → `canvas.setActiveObject(child)`, and nothing in that path touches the store. An
implementer could reasonably conclude the panel needs a new subscription, and add one.

**Read it and it does not.** Fabric's `setActiveObject` fires `selection:created`
**synchronously** (`index.node.cjs:11456-11460` → `_fireSelectionEvents`), the bridge already
subscribes to that event pair and calls `notify()` (`bridge.ts:74-79`), and `LayerStore.set`'s
subscription re-reads `bridge.layers()` on every notify (`layer-panel.tsx:42-45`). One entry is
enough. Caching is also already handled: the store holds the projection rather than rebuilding
it per `getSnapshot` (`:27-30`), which is what makes reading `groupContext()` inside `layers()`
safe.

**Ruling: no new wiring; the amendment says so explicitly, and forbids adding a listener pair.**
A second subscription would be a second owner of "when the tree is stale" for a path that
already has one.

**The ordering constraint this exposes, which neither task states.** Because that notification
is synchronous, Task 7's `enterGroup` must record the context **before** it changes the active
object. Record it after and the panel renders once with the old context, and Task 8's browser
check sees a tree that has not yet marked the group. The amendment puts that requirement in
Task 8's text — where the consumer notices it — and adds "fix it in Task 7, do not compensate
in the panel". I have not verified Task 7's eventual ordering because Task 7 has not run; this
is a constraint on it, not a finding against it.

**Cost if wrong.** If Task 7 does record first, the paragraph costs a paragraph. If it does not
and the implementer compensates in the panel, the symptom is a one-notification-late tree that
looks like a React batching bug — which is exactly the class of defect that eats an afternoon.

### Correction: Task 8's "select the child directly" reading needed bounding

Step 3 says "let a tree click on a child select the child itself when its group is the current
context". Read as written against the source, the antecedent is fine — but the sentence around
it invites a rewrite of `selectLayer`, and the existing suite pins the behaviour it would
remove: `bridge.dom.test.ts:212-217` asserts `selectLayer("child")` calls
`setActiveObject(group)`, the **owning group**, and Task 5's widened `bridgeFor` canvas stub
keeps that assertion live. The amendment bounds the new branch to the context case and names
that test as the thing that turns red for the right reason if it is widened by mistake.

It also records that `ownerOf`'s signature is `(root, id)` with the only caller passing
`canvas.getObjects()` (`bridge.ts:144`) — the fourth instance this session of the same trap,
after `bridgeFor`'s unexported factory, `ownerOf`'s argument order in the UI-polish plan's
Task 6, and the `arrangeActions` mis-credit.
### Task 10: one stale line reference, one mis-framed hypothesis — both corrected

Small, but both would have cost an implementer real time.

**Stale reference.** Step 5's list of mapping sites ended with "the `selectStarterChart` helper at
`:1727-1730`". `:1727` is `expect(atLimit.length).toBe(2);` — an unrelated assertion. The helper
is at `:1806-1821` and its click is `box.x + (432 / 1280) * box.width`, `box.y + (418 / 720) *
box.height` (`:1813-1814`). The other five ranges in that list are accurate; only this one was
stale, and it is the one a fix must reach or the helper keeps its near-miss margin.

**Mis-framed hypothesis.** Step 3 offered two causes: "if the guides scale with zoom, the divide
at `guide-renderer.ts:37` is reading the wrong value; if they clamp to the viewport instead of
the artboard, `snap-manager/index.ts`'s `guideBounds` call is not reaching the renderer."
Verified the second is not a live possibility: `snap-manager/index.ts:260` already passes
`guideBounds: bounds()`, and that `bounds` is the artboard accessor the session supplies
(`editor-session.ts:142-156`) — not `calculateSnappingViewportBounds`, which lives in the
renderer file as a fallback for callers that pass nothing. A viewport clamp would therefore mean
the artboard accessor itself is wrong, which Task 5's own work would have surfaced first. The
amendment keeps the sentence as a pointer to which owner to suspect and tells the implementer to
check the divide first, so a fruitless second hypothesis does not get a shift of debugging.

Confirmed the first hypothesis is at least coherent: `guide-renderer.ts:34-37` applies the
viewport transform to the context and then writes `lineWidth = GUIDE_WIDTH / zoom`, which is the
correct shape for a hairline under a transformed context. Whether it *is* correct at non-1 zoom
is Task 10's inspection to make, and the plan is right to leave it to the browser rather than
assert it from reading.

### Task 11 needs no amendment — the concession it used to carry is already gone

Step 2 previously accepted two phone-chromium failures as pre-existing. The plan now says "no
known-failing tests are carried into this gate" and carries the measured output for both
(`✓ 1 passed (32.4s)`, `✓ 1 passed (32.9s)`). Verified in the file at `:1605-1614`. That is the
right shape: a red suite is a finding, and a pre-existing classification needs a base-commit run
to earn it.
### Task 3 fix round 2 brief prepared (not yet dispatched)

Written while Plan B Task 6 held the implementer slot. `task-3-fix2-brief.md`. Test-file only:
`navigation.ts` is correct and the brief forbids touching it, with a `git diff --stat` check in
the report contract so a left-in teeth check cannot be committed.

**Fix A** is the parked assertion gap — pre-set `skipTargetFind = true` / `selection = false`
before the gesture and assert both survive `release()`, which is the only shape that fails
against the hardcoded restore the round-1 fix replaced. **Fix B** is the comment recording that
the wheel-zoom test pins direction but not magnitude.

**The first draft of Fix A was wrong, and I caught it before dispatch rather than after.** It
asserted both flags mid-gesture with a comment claiming that proved the claim was in force. It
does not: `claim()` writes `skipTargetFind = true` and `selection = false`, which are *exactly*
the values the test pre-sets — a boolean has no third value to distinguish "preserved" from
"written". Those two assertions were decoration. Replaced with the cursor (`"grab"`), which is
independent of the flags and does change; the comment now says why re-asserting the flags there
would prove nothing.

**Ruling recorded for the implementer:** `endPan` reads `if (spaceHeld) showCursor(...) else
release()` (`navigation.ts:165-172`), so the gesture order **must** be mousedown → mouseup →
keyup. A `mouseup` alone does not release while Space is held. Without that note an implementer
who reorders to mousedown → keyup → mouseup gets a test that passes for the wrong reason, or one
that fails and looks like a defect in `release()`.

**This is the fifth instance of the session pattern**, and the first where the error was in *my*
text rather than the plan's: my rulings about *what should be true* have been sound; my
statements about *which existing thing to touch, and what a given assertion observes* need the
read first. The pre-dispatch read is what catches these, and it also has to be applied to my own
briefs.

### Plan A Task 5 pre-dispatch read — the marquee pick point was unreachable

Task 5's Step 1 built a correct artboard->client mapping and then picked the pasteboard point as
`at(1340, 780)`. That point does not exist. `fitScale()` is `Math.min(vw/1280, vh/720)`
(`viewport-manager/index.ts:97-100`) — a **contain**-fit, so at the host the canvas does not carry
the artboard's aspect ratio: at the measured 626x594 the artboard draws 626x352 with `ty` 120.94.
The `at()` helper's `rect.width / 1280` and `rect.height / 720` factors are the same number only
because both equal the fit scale, so the helper is right for artboard coords 0..720 and
meaningless below that — and `y = 780` is below the artboard entirely. `at(1340, 780)` evaluated
to client (1012, 502) against a canvas spanning x 357..983: 30px to the right of the canvas, so
the brief's own `expect(sx).toBeLessThan(canvasBox.x + canvasBox.width)` guard would have failed
before the marquee was exercised. This is the failure mode the surrounding paragraph warns about
("an off-canvas drag passes **vacuously**"), reached by a different route than the one it warns
about: the coordinates were derived from the camera, but from the artboard's *logical* extent
rather than its *rendered* one.

Task 10 already knew the rendered extent — it records "canvas 626x594, zoom 0.4890625, ty 120.94"
and states plainly that `box.height` is the host's 594 "rather than `720 x zoom = 352`". `ty =
(594 - 352) / 2 = 121` confirms the contain-fit independently, so the two tasks disagreed and
Task 5 was the wrong one.

**Ruling: pick the pasteboard point from the canvas box, not from an artboard coordinate.**
`[canvasBox.x + canvasBox.width - 16, canvasBox.y + canvasBox.height - 16]`, then assert it is
past the artboard rect on both axes (which is the pasteboard claim, stated directly) and drag
up-left to `at(100, 200)`. The end point stays an artboard coordinate because it must land inside
`time-card`; only the start needed the box. The contain-fit leaves ~240px of pasteboard below and
~350px right of the artboard, so the corner is comfortably outside every authored object, and the
16px inset keeps the press off the canvas edge.
**Cost if wrong:** if a future layout change puts the shell's floating dock or a panel over that
corner, the press misses the canvas and the in-object vacuity guard fails loudly on the next
lines — a visible red test, not a silent pass. Verified consistent with Task 10's own numbers
rather than re-derived, so the two tasks now agree.

### Plan A Task 8 pre-dispatch read — fixture missing the row it asserts on

Step 1's snippet referenced a `rows` fixture that was never defined and asserted on
`[data-vigilia-layer="other"]`, a row no fixture in the plan creates. The `bridge(rows, overrides)`
call shape is valid (`layer-panel.dom.test.tsx:9`, which spreads `...overrides` before its closing
cast), so the only defect was the absent fixture — but it mattered: with a single-group fixture the
"dims the rest" half of the test would have had nothing to read, and the assertion would have been
silently vacuous on the null from `querySelector`.

**Ruling: spell out a three-row fixture (current group, its child, a second non-current group) and
add the child's own `data-context="true"` assertion.** The child assertion is the load-bearing one:
Step 3 adds a branch that lets a tree click select a child when its group is the current context,
and without pinning the child's marker the test would pass on a panel that marks only the group.
**Cost if wrong:** nothing beyond three extra fixture lines; the assertions are all on rows the
fixture defines, so none can pass vacuously.
Also confirmed in this pass, not changed: Task 8's `selectLayer` warning cites
`bridge.dom.test.ts:212-217`, and `ownerOf(root, id)` takes root first with the sole caller passing
`canvas.getObjects()` — both match the source.

### Plan A Tasks 7 and 9 pre-dispatch read

**Task 9 — the fixture it told the implementer to use is not exported.** Step 1 said "against the
shared panel-test helper (`layer-panel.dom.test.tsx`, UI-polish Task 5)" and then called
`bridge(rows)`. That helper is declared `function bridge(...)` at `layer-panel.dom.test.tsx:9` —
module-scoped, no `export`. `rows` was also undefined, as in Task 8. **Ruling: declare a local
`ActionGate` in the new test instead.** `ActionGate` is exported (`object-actions.ts:67-70`) and is
two members, so the honest fixture is three lines; importing the panel's helper would mean
widening a test file's surface to serve a consumer outside it, and no test in this repo imports
from another test file — a precedent that would be worth setting deliberately, not as a side
effect of a snippet. **Cost if wrong:** none; the derived `expected` list is unchanged, and it is
the assertion that carries the test. Also corrected: the comment claimed `canArrange` "is never
called", but `actionEnabled` calls it for every `arrange:` id — there are none in `OBJECT_ACTIONS`,
so the conclusion held and the reasoning did not. Rewritten to say so.

**Task 7 — the step was ambiguous about what `enterGroup` does to the context.** Step 1's
assertions are consistent with exactly one rule, and Step 3 never states it: `enterGroup({object})`
sets the context to `[ownerGroup(object) ?? object]` and does not push. Under that rule entering
the group leaves `[group]`, entering the child leaves it unchanged, and one `exitGroup()` yields
`[]` — matching the fixture. Under a push implementation the last three assertions fail together.
A second call to `enterGroup` on an already-entered group's child is an ordinary navigation, not a
depth change, which is also what Figma does. **Ruling: write the rule into Step 1 beside the
assertions**, since a fresh implementer sees only this task and would otherwise be choosing between
two readings that the tests distinguish but the prose does not mention. **Cost if wrong:** if the
intended model was nesting, this is a one-line change in `enterGroup` plus a re-read of the
assertions — but nothing else in Tasks 7-11 consumes a nested context, so nothing else moves.

### Plan A Task 10 pre-dispatch read — the mapping fix had no step

Task 10's preamble carried a detailed specification of a mapping repair (repoint six `editor.spec.ts`
sites plus `selectStarterChart` at Task 5's `artboardScreenRect()` accessor) and a teeth check for
it, but **no step** — numbered 1, 2, 3 with the mapping work living only in the prose above them.
Two things broke as a result: Step 2's browser test says `clientOfScene` "is the one Step 0's
mapping fix also uses", and **there is no Step 0**; and the task's own stated deliverable — the two
tests Task 2 turned red (`persists an ordinary drag and restores it through undo`,
`rehydrates a chart runtime after undo`) — had no step that runs them green. Task 11 Step 2
already depends on both being green ("Task 10's deliverable"), so the gate would have caught it,
but only after the whole task was executed.

**Ruling: the mapping work becomes Task 10 Step 1, with the helper written out in full, and Task
10's steps are renumbered 1-4.** The helper is a `sceneToClient(page, x, y)` that reads the rect
through `window.vigiliaEditorBridge.editor.viewport.artboardScreenRect()`, scales by
`rect.width / 1280`, and offsets by the rect — the same uniform scale the Plan A Task 5 marquee fix
uses, for the same reason (the contain-fit means the canvas box is not the artboard's rendered
extent). The step also folds in the `selectStarterChart` precondition assertion the preamble
requires, since that helper is one of its call sites; leaving it in prose would have split one
coherent edit across a step and a paragraph, which is how it went missing the first time.
**Cost if wrong:** none that is not caught by a test — Step 1's own teeth check requires both drag
tests to fail with the old mapping restored, so a cosmetic edit to the helper fails visibly.
Also corrected: the self-review's placeholder-scan note, which referred to "Task 10 Step 1" as the
old arithmetic step; it now names the renumbered one.

### Task 3 fix round 2 complete — commit `1425593`, re-review dispatched

Base `0bab852`. 14/14 tests in `navigation.dom.test.ts`, typecheck/lint/format clean, one file
changed (40 insertions, test only).

The implementer reproduced both teeth checks and went one better than the brief asked: it probed
each assertion **independently**, so the evidence shows two distinct regressions rather than one
test failing twice. Hardcoding both flags fails at `:172` on `skipTargetFind`; hardcoding only
`selection` fails at `:173` on `selection`. That is the property the previous round lacked — a
single assertion pair that could not distinguish "restored" from "written" — and it is now pinned
by a test whose failure mode names which flag stopped being restored.

Verified independently by me: `git diff --stat a495699 HEAD -- .../viewport-manager/navigation.ts`
is empty, so the file the brief said not to touch stayed untouched across both fix rounds and the
whole of Task 3.

The re-reviewer is dispatched against `review-0bab852..1425593.diff` with an explicit instruction
**not to trust the report** and to reproduce the checks itself, plus one case the previous round
missed: whether the `selection` assertion alone is decoration. That is the exact class of defect
that made round 2 necessary, so the round that fixes it is the round that must not be believed on
its own say-so.

**Task 7 (Plan A) verified clean but deliberately not dispatched yet.** Its brief checks out —
`bridge.run` handles `arrange:` ids (`bridge.ts:258-263`) so `store.bridge?.run(id)` is correct, and
`arrangeActions()`'s `eligible` matches the rule the toolbar reads. It is withheld only because it
and Task 6 both modify `editor-session.ts` and `tests/e2e/editor.spec.ts`, and the live reviewer is
reading those. Sequenced: Task 6, its review, Task 7, its review.

### Task 3 fix round 2 — CLEAN, task complete

Re-reviewer verdict: **both findings ADDRESSED**, and it reproduced rather than trusted. It
hardcoded both flags and got the `:172` failure; then hardcoded **only** `selection` and got a
`:173` failure. Neither assertion is decoration — which is the thing round 2 existed to establish,
and which round 1 could not show.

The reviewer also found a sharper limitation than the brief's, and it is worth recording because it
bounds what this test is for: **reducing `release()` to `claimed = false; return;` makes the new
test pass.** With the pre-set pair equal to what `claim()` writes, "restored" and "never restored"
are the same post-state. So the test catches a *wrong literal*, not an *absent restore* — its teeth
are real but narrower than its name and its "Restored, not reset" comment imply. It is inherent to
booleans having no third value, and the brief said as much, but the test's name overstates it.
**Ruling: accept and do not rename now.** The case is covered by the pre-existing space-drag test
for the default path, and renaming mid-loop would invalidate the break-check evidence just
recorded. **Cost if wrong:** a future reader over-trusts the name and assumes an absent restore is
caught here. Recorded so the next person to touch the file sees it; if that file is opened again
for any other reason, fold the rename into that change.
Verified by me: `navigation.ts` is unchanged across the whole of Task 3 (`git diff --stat
a495699 HEAD` on that path is empty) — the break checks were restored cleanly, twice.

**Task 3 is complete.** Plan A stands at Tasks 1-3 done, 4-11 pending.

### Scratch files found in the tree — owner identified, not deleted

The reviewer flagged two untracked files violating AGENTS.md's no-scratch-in-tree rule:
`src/web/zz-probe.json` and `src/web/packages/editor/src/editor-shell/zz-review-probe.dom.test.ts`.
I traced them to the **live Plan B Task 6 reviewer**, which was mid-probe on `reorderLayer` when the
files appeared — the same `bridge.ts` modification and the same function. **Ruling: leave them in
place, and delete them only after that agent is confirmed complete and its `bridge.ts` teeth check
reverted.** Deleting a running agent's scratch is how a teeth check silently becomes a no-op and a
review reports on a file that no longer exists. **Cost if wrong:** two stray files sit in the tree
for a few more minutes; the alternative risk is a corrupted review. **These must be removed before
any commit** — they are untracked, so they cannot be staged accidentally, but they must not survive
the session.

### STATUS.md carried the disproved failure claim — corrected

`STATUS.md:52-53` still asserted the two `display-fabric.spec.ts` phone-chromium failures were
pre-existing and "not absorbed". Both plans had already been corrected to record that both tests
**pass** (32.4s, 32.9s). AGENTS.md requires propagating a changed decision to contradictory current
docs together, so this was a live contradiction between STATUS.md and both plans, not a stale note.
Corrected, and the "Next" section updated: it still said Spec A's Tasks were awaiting review and
that Snapping had no execution method chosen, both untrue. Added the unrun-browser-suite residual
from Plan B Task 6 to Blockers. `npm run status:check` passes, 58 lines (limit 70).

### Plan A Task 10 — a helper that does not exist, and seven stale line citations

Two more defects in the same step I had just added, both found by checking Task 10's browser test
against the real `editor.spec.ts` rather than against the plan's own numbers:

1. **`await openStarterTheme(page)` — no such helper.** `rg` finds zero definitions and zero other
   call sites in `tests/e2e/`; the plan mentions it exactly once, in this snippet. The starter scene
   is what `page.goto(EDITOR)` already loads, and tests needing a different scene call
   `setThemePackage(page, name, envelope)` (`editor.spec.ts:1857`). An implementer would have hit a
   compile error and invented something.
2. **Every line citation was ~97 lines stale.** The seven mapping sites are at
   `:1369-1370`, `:1420-1421`, `:1577-1578`, `:1607-1608`, `:1639-1640`, `:1910-1911` and
   `selectStarterChart` at `:1903-1918` — not the `:1806-1821` the plan had just been corrected to,
   because Plan B's work moved the file underneath. **The set itself was right in all three
   revisions; only the numbers drifted**, which is exactly the failure mode the earlier `:1727-1730`
   correction was made to fix and did not prevent. So the step now says: read the set with
   `rg -n 'box\.width|box\.height'`, which returns precisely those seven pairs, and treat anything
   still listed as a site you missed. **A grep that enumerates the set beats a line number that
   rots**, and this is the third time this plan has paid for the difference.
3. Also corrected: `sceneToClient` assumed a `1280x720` scene, but `:1369-1370` maps a **320x180**
   fixture. It now takes `sceneWidth`, and `artboardRect` is split out as its own helper because
   Step 3's browser test calls it directly and would otherwise have needed the undefined one.
4. Added to Step 3: when Task 4's readout lands, assert it reads `200%` at the 2x zoom rather than
   only eyeballing the capture — the same text-or-nothing rule that forced Task 7 Step 6 to be
   rewritten.

No ruling was needed for any of these; they are corrections to text that was wrong, and the plan is
the only artifact affected.

### Ruling: `artboardScreenRect()` is CANVAS-relative, not client — my own contract error, caught before Task 5 dispatched

Found while pre-reading Task 5's brief against source, and it is mine: I wrote "the artboard's rect in
**client** coordinates" into the `ViewportManager.artboardScreenRect` Produces block, and the phrase
then propagated into four consumer sites (Task 5's test, Task 7's `at()`, Task 10's `sceneToClient`
and Task 10's prose). It is false for the maths the accessor inherits.

**The evidence.** `artboardScreenRect` is built from `canvas.viewportTransform`
(`editor-shell.ts:125-132`): `left` is `vpt[4]`, `top` is `vpt[5]`. The camera writes those as
`(viewport.width - board.width * scale) / 2` / `(viewport.height - board.height * scale) / 2`
(`viewport-manager/index.ts:109-113`), where `viewport` is the **canvas** size. Measured: at the
626×594 host the artboard draws 626×352 with `ty` 120.94, so the accessor returns ≈(0, 121). The
canvas element's own client rect is x≈357–983, y≈72–666. Canvas-relative and client differ by
(357, 72).

**Ruling: keep the accessor canvas-relative and add the canvas box offset once, in each consumer.**
Canvas-relative is the frame `viewportTransform` is really in; converting inside the accessor would
force a `getBoundingClientRect()` on every pan and zoom notification, i.e. a layout read per frame.
Each e2e consumer already reads the canvas `boundingBox()` for its own pasteboard points, so the
offset is free there.

**Cost if wrong — and why this was invisible.** Every consumer's points land ~357px left and ~72px
above the intended target, i.e. off the canvas, where a drag selects nothing and the assertion
passes. This is the *same vacuity class* the marquee rewrite exists to remove, so it would not have
gone red; it would have shipped as a green suite proving nothing. Fixing the frame was therefore
worth more than the defect count suggests.

**Second defect in the same pass: the plan's pasteboard geometry was wrong.** Task 5's comment
claimed "about 240px of pasteboard below the artboard and 350px to its right". `fitScale()` is a
contain-fit: `min(626/1280, 594/720) = 0.489`, so the artboard draws 626×352 — **full canvas width**.
There is no pasteboard to its right at all; the pasteboard is the 121px band above and the 121px
band below. The pick point now places the press by Y only, at the horizontal centre, and the guards
assert `sy` is inside the canvas and below the artboard's bottom edge. The old X guard
(`sx > rect.left + rect.width`) would have *failed* once the frames were made consistent, which is
how the geometry error surfaced: fixing one defect exposed the other.

**Third: `zoomToPoint`'s frame.** Task 10's comment called its argument "SCENE coordinates".
`ViewportManager.zoomToPoint` forwards to Fabric's `canvas.zoomToPoint` (`:128-134`), which takes a
canvas-element point. Following the old comment literally would have sent the zoom anchor 357px into
the page. Comment corrected; the call was already passing a canvas-relative point, so only the prose
was wrong.

**Fourth: `clientOfScene` did not exist.** Task 10 Step 3 calls
`clientOfScene(page, "load-gauge")` twice, and Step 1 defines only
`sceneToClient(page, sceneWidth, x, y)`. Written in full: it reads the object's own geometry
(`left`/`top` plus half the scaled size, via the bridge, throwing on an unknown id) and delegates to
`sceneToClient`. Deliberately **not** Fabric's `getCenterPoint()` — probed it under `fabric/node` and
it returned `{x:52, y:150}` for a rect at `left:52, top:150`, i.e. the origin itself under the
default origin, so it would aim at the top-left corner.

**Fifth: Task 10's `selectStarterChart` line numbers were stale again** (`:1806-1821` → `:1903-1918`,
click `:1910-1911`). Third revision of the same citation. The step already instructs re-deriving the
set with `rg -n 'box\.width|box\.height'`, which has been right in all three revisions while the
numbers drifted each time; the prose now says so explicitly rather than presenting the numbers as
fact.

Also corrected: `editor-shell.ts:372` → `:375` (the `setBounds` call inside `placeMedia`), and
Task 5's Step 4 teeth check gained a second break — drop only the `box.x`/`box.y` terms and both
tests must fail again, because a helper that adds the offset in the wrong place still passes the
first break.

### Verification pass: every coordinate conversion in Plan A is now in one frame

After the amendment, every point conversion in the plan was re-read from the file rather than
trusted:

| line | site | form |
|---|---|---|
| 849 | Task 5's marquee test | `canvasBox.x + rect.left + x * scale` |
| 1275 | Task 7's group-entry test | `canvasBox.x + rect.left + (x / 320) * rect.width` |
| 1582 | Task 10's `sceneToClient` | `box.x + rect.left + x * scale` |

Exactly three, all canvas-box + canvas-relative rect. A grep for the old wording
(`rect.left + x * scale`, `box.width`) and for "client coordinates" outside the corrected sentences
returns nothing. **Tasks 6, 8 and 9 have no point conversions at all** — my first check used an awk
range that spanned past its task and produced false hits from Task 7 and Task 10; the count above is
from absolute line numbers, which is the check that cannot drift.

Briefs regenerated for Tasks 5, 7 and 10 (the three that consume the accessor) and each verified by
grepping for the superseded phrase rather than by mtime — zero matches for "in **client**
coordinates" in all three. Tasks 6, 8, 9 and 11 needed no regeneration on this account.

### Ruling: Plan A Task 4 may run before Task 5, and now carries the coordinate guidance it needs

Re-checked the interleaving ruling at `progress.md:694` ("Plan B's Tasks 6–10 run before Plan A's
Tasks 8–11") against the actual `**Files:**` blocks rather than against the matrix's prose. Two
findings:

**1. Plan A Task 4 overlaps Plan B Task 7 on three files** — `editor-shell.css`, `shell-layout.tsx`
and `ui-copy.ts`. The matrix recorded only the **Task 9** row for `editor-shell.css`/`shell-layout.tsx`
and missed that Task 4 touches both. The one-implementer rule still serialises them, so this is an
ordering constraint and not a conflict, but the matrix was incomplete. **Ruling: A4 runs before B7,
and A4 may run while B6's fix round is in flight** — A4 does not touch `layer-panel.tsx` or
`bridge.ts`, which is what B6's fix holds. **Cost if wrong:** whichever lands second rebases three
files; recoverable, and the ledger entry makes it visible rather than surprising.

**2. Task 4's e2e needs a pointer coordinate that Task 5's shared helper does not exist yet to
provide.** Task 4 Step 4 registers a browser case for the zoom readout; Task 5 defines
`artboardScreenRect` and the camera-derived mapping helper. So A4-first means A4's test must place
the pointer on its own, and the plan said nothing about how — an implementer would most naturally
write a literal page coordinate.

**Ruled: Task 4 Step 4 now carries the idiom the repo already uses** (`editor.spec.ts:1829-1835`):
`.locator("canvas.upper-canvas").hover({ position: { x: 200, y: 200 } })`, then
`keyboard.down("Control")` → `mouse.wheel(0, -400)` → `keyboard.up("Control")`.

My first draft of that block was **wrong and I corrected it before dispatch**: it suggested a plain
`mouse.wheel` reading "ctrl-wheel is the gesture the camera listens for", which contradicts
`navigation.ts:128` — a plain wheel *pans*, and `editor.spec.ts:1693-1696` already says so in a
comment. A test written from my draft would have asserted zoom after a pan and failed for a reason
unrelated to the readout.

**Cost if wrong.** A literal `(640, 360)` falls at page x 640 inside a canvas spanning x≈357–983, so
it *would* land on the canvas and the test would pass — which is why this is a latent-portability
defect rather than a live failure, and why it was worth writing the idiom down instead of leaving it
to the implementer's judgment.

## Task 6 pre-dispatch verification — five defects found and amended

Read the brief against source before dispatch. All five are the "missing or wrong load-bearing
mechanism" class, and the first two would have failed the task outright.

**1. `{ key: "ArrowLeft" }` can never match — the whole task would have failed.**
`bindingFor` lower-cases the event key and compares with `===` (`shortcut-manager/index.ts:40-47`);
every existing entry is lower-case. A binding written `"ArrowLeft"` matches nothing, so all four
nudges and both z-order keys would be dead and Task 3's browser test is the only thing that would
have caught it.
**Ruling: the `key` fields are `"arrowleft"`/`"arrowright"`/`"arrowup"`/`"arrowdown"`.** `]`/`[`
have no case and are written as-is.
**Cost if wrong:** none — this is measured against the shipped function.

**2. The brief's own deferral test could never pass.**
It dispatched the second keydown on `window`. `window.dispatchEvent` sets `target` to `window`
itself (measured in jsdom: `target === window` → true), so `isTextEntryTarget(event.target)` reads
the window and the nudge fires a second time. The assertion `toHaveBeenCalledTimes(1)` is
unsatisfiable whatever the binding does — the test would have been "fixed" by weakening it.
**Ruling: dispatch on the input with `bubbles: true`,** the idiom all four existing deferral tests
in that file already use.
**Cost if wrong:** none; the corrected form is the file's established shape.

**3. No implementation sketch for the handlers, and the obvious one is wrong twice.**
`canvas.select-all` must not select the artboard plate (`selectable: false, evented: false`,
`editor-shell.ts:139-156`) — selecting it would move the artboard on the next nudge. And a nudge
must move the *targets*, not the selection's own `left`/`top`.
**Ruling: filter `selectable === true` for select-all (the same predicate `snap-manager/index.ts:38`
uses; it also excludes locked objects, which is correct), and nudge via the `arrange.ts:143-151`
idiom** — `getCenterPoint()` paired with `setPositionByOrigin(..., "center", "center")`.
**Measured:** the pair moves `left` by exactly 1 and exactly 10 for a single object, and exactly 1
for both members of a live `ActiveSelection`. **Cost if wrong:** a nudge that drifts by the selection
origin (`sel.left` reads 26 for members at 1 and 51 — it is the group origin, not the bbox left).

**4. Teeth check 1 had no teeth.** Measured against the real `EditorHistory`: with the explicit
`saveState` and without it, the browser test passes **identically** — the `Control+z` handler itself
calls `undo()`, whose revive re-fires `object:modified` → `save()`, recording an entry the break was
supposed to prevent. Neither the undo nor the redo assertion distinguishes the two mechanisms.
**Ruling: the mechanism is pinned by a unit test in `history-manager/index.test.ts`** (its owner —
the file already imports `EditorHistory` and needs no jsdom), driving `EditorHistory` directly with
no timing. **Verified it has teeth: deleting the explicit `save()` fails it with
`expected +0 to be 1`.** `index.test.ts` added to the task's Files and to Step 6's `git add`.
**Cost if wrong:** the plan claimed a proof it did not have, which is worse than no proof.

**5. The idle window is a real race.** A `Control+z` inside the 300ms window is a silent no-op —
measured: the object stays at `before + 11`. **Ruling: `waitForTimeout(400)` before the undo, plus a
`Control+y` redo assertion that lands on `before + 11`,** which is what actually proves coalescing
(a per-press mechanism lands at `before + 1`).

Also corrected: `selectedCount` was used but never defined (now written in the test beside `left`,
with a note that both are test-local); the `bridge.ts:220-225` citation pointed at the index
arithmetic, not the `layerManager` calls (now `:275`/`:280`).

**My own defect, caught by the fence check:** inserting prose between two code blocks split a fence,
leaving the file at odd parity so that Tasks 7-11 and the Self-Review all parsed as code. Repaired;
all four plan/spec files re-verified balanced with zero headings inside fences. Brief 6 regenerated
(365 lines, one task — the broken parity had made it 1113 lines spanning six tasks).

## User-reported bug fixed out of band — commits `9067a96`, `673efb7`

**Reported:** "when the starter theme first opened, the background couldn't be selected from the
canvas, as expected. But as soon as one undo action landed, the background is selectable, moveable &
transform able, like a normal object."

**Root cause, measured, not reasoned.** `SCENE_PERSISTED_PROPERTIES` (`scene-fabric/persist.ts:39`)
listed only `id` plus the three `vigilia*` keys. Fabric 7.4.0's `toObject` omits `selectable`,
`evented` and `locked` **entirely** — this is not `includeDefaultValues`, which is what I assumed
first and probed wrong. Probed both ways: with `includeDefaultValues = true` the keys are absent
from the default output, and with `false` they are absent too; only an explicit
`propertiesToInclude` entry emits them. So `serialiseScene` dropped all three, `loadFromJSON`
restored Fabric's defaults (`selectable: true, evented: true`), and **first open looked correct only
because the authored JSON still carried the flags literally**. Nothing had been saved and revived
yet. Every undo was a revive, so the first undo unlatched the background.

**This is wider than the reported symptom.** The same mechanism unlatched every locked object
(`object-lock-manager/index.ts:14` writes `selectable: false, evented: false, locked: true` and
saves) on the first undo. The user noticed the background because it is the most visible.

**Fix:** added `"selectable"`, `"evented"`, `"locked"` to `SCENE_PERSISTED_PROPERTIES`. Defaults
are still stripped — an ordinary object emits none of the three — and `excludeFromExport` still
outranks the list, so the artboard plate stays out of the document. Verified by probe, not assumed.

**Evidence, both with teeth measured:**
- `persist.dom.test.ts` "keeps an authored interaction lock across a round trip", plus a companion
  that an ordinary object still emits no flags. Reverting the fix fails it.
- `editor.spec.ts` "keeps the starter background unselectable after an undo" — reproduces the
  reported journey in a real browser. With the fix reverted it fails as
  `{"evented": true, "selectable": true}`, which **is** the user's bug, phrase for phrase.
- Full unit suite 1312 passed; lint and typecheck clean; `format:check` clean.

**Ruling: the browser assertion targets the object's flags, not a hit test.** My first draft guarded
vacuity with `canvas.findTarget()`, asserting the background was the resolved target — it returned
`null` and the test failed on its own guard. **`findTarget` skips any object with `evented: false`**,
so it structurally cannot witness this bug: it reports nothing at that point whether the background
is armed or not. A hit test here is a guard that can never fail. Replaced with `containsPoint`,
which asks the object's own geometry and is true either way. A 5x6 grid scan of the canvas
(`findTarget` at each point) is what established this, rather than more reasoning.
**Cost if wrong:** a vacuity guard that cannot fail would let the whole test pass while asserting
nothing — the exact toothless-check failure already recorded twice in this ledger.

**Also confirmed pre-existing, not mine:** `persists an ordinary drag and restores it through undo`
(`editor.spec.ts:1313`) and `rehydrates a chart runtime after undo` (`:1407`) fail identically with
this change stashed and rebuilt. They are the host-sized-canvas mapping casualties Task 10 owns.

### My own e2e insertion invalidated four of the plan's citations — corrected before Task 4 dispatched

The 138-line browser case added for the undo/interaction-flags fix (`9067a96`) landed at
`editor.spec.ts:1464`, so **every citation at or past that line moved by +138**. Verified by reading
each site rather than by arithmetic alone:

| Plan says | Now | Content confirmed |
|---|---|---|
| `:1577` | `:1715` | `box.x + (x / 1280) * box.width` |
| `:1607` | `:1745` | `box.x + (x / 1280) * box.width` |
| `:1639` | `:1777` | `box.x + (180 / 1280) * box.width` |
| `:1903-1918` | `:2041-2056` | `async function selectStarterChart(...)` |
| `:1910-1911` | `:2048-2049` | the `432`/`418` click |
| `:1857` | `:1995` | `async function setThemePackage(` |
| `:1690-1699` | `:1829-1835` | the ctrl-wheel zoom idiom |

`:1313` and `:1369-1370` are before the insertion and still correct.

**Ruling: the plan now carries the offset inline as well as the corrected numbers.** The mapping
bullets are a reading aid that Task 10's Step 1 re-derives by grep — but a stale *example* inside
that aid is how the earlier `:1806-1821` → `:1727-1730` confusion happened, and the next insertion
will move them again. **Cost if wrong:** someone trusts a number instead of the grep and edits the
wrong site. The grep remains the stated truth; the numbers are now labelled as a reading aid in the
same sentence, with the offset that produced them.

**Ruling: I do not re-number Plan B's or Plan C's citations for this.** Checked: neither cites
`editor.spec.ts` past `:1464` (Plan C cites no `editor.spec.ts` line at all). Nothing else to repair.

### The interaction-flags fix moved `persist.ts` by 9 lines — four citations across two plans corrected

Adding three entries to `SCENE_PERSISTED_PROPERTIES` plus a comment block grew `persist.ts` by 9
lines above everything the plans cite. Every target re-read and confirmed:

| Was | Now | Target confirmed |
|---|---|---|
| `persist.ts:33` | `persist.ts:39` | `export const SCENE_PERSISTED_PROPERTIES = [` |
| `persist.ts:49` | `persist.ts:58` | `canvas.includeDefaultValues = false;` |
| `persist.ts:60-68` | `persist.ts:69-77` | `export function serialiseThemeEnvelope(` |
| `persist.ts:78-84` | `persist.ts:87-93` | `export async function reviveScene(` |

Fixed in Plan A's plan file, Plan A's ledger, Task 7's brief, and Plan B's ledger.

**The claims themselves are unaffected, and that was checked rather than assumed.** Task 7's
`:1424` rests on `subTargetCheck`/`interactive` being defaults-only and therefore absent from a
saved document. My change persists `selectable`/`evented`/`locked` — an overlapping but *different*
set of three. `subTargetCheck` and `interactive` are still stripped, so Task 7's reasoning holds and
its re-apply-after-revive requirement is unchanged. **Cost if wrong:** if it had been the same set,
Task 7 would have concluded the flags survive a revive and dropped its re-apply step, breaking group
entry after every undo.

**Note for the next insertion:** this is the second citation shift this session (the e2e case moved
`editor.spec.ts` by 138, this moved `persist.ts` by 9). Both were mine, both were found by grepping
for the citation rather than by re-reading the prose.

## Task 5 and Task 7 briefs verified against source while Task 4 ran

**Task 7 (Plan B) — every load-bearing claim checked, all exact:**
- `useSelection(store)` at `shell-layout.tsx:117-119` returns the cached snapshot via
  `useSyncExternalStore`. Confirmed by reading it.
- `EditorShellSnapshot.selectedCount` (`bridge.ts:26`) is the field; `ObjectTarget.memberCount` is
  `base.selectedCount` (`bridge.ts:111`), so reading `selectedCount` and calling the registry's
  `eligible(target)` are the same rule seen from two sides. Confirmed.
- The Step 1 failure mode is real: `SelectionStore.#snapshot` defaults to
  `{ selectedCount: 0, locked: false, activeKind: "none" }` (`shell-layout.tsx:83`,
  re-applied at `:100` when no bridge is set), and `canvas-dock.tsx:32-35` already guards with
  `bridge === undefined ? [] : …`. So `actionEnabled(bridge, id)` would dereference `undefined` in
  the fixture while the count-based predicate cannot. The brief's correction is right.
- `arrangeActions()`' `eligible` is `(target) => target.memberCount > 1 && !target.locked`
  (`object-actions.ts:194`), and the list derives from `ARRANGE_ICONS` (`:176-185`), so the
  `toHaveLength(arrangeActions().length)` assertion is the right "derived, not literal" form.

**Task 5 — its central frame claim is correct and I had it wrong once before.** Read
`editor-shell.ts:121-133`: `artboardScreenRect` returns `left: vpt[4]`, `top: vpt[5]`, which are
canvas-element-relative, not client. The brief's ruling to keep that frame and have each e2e
consumer add the canvas box offset once matches the implementation. Its "move the maths onto the
camera and delete the local copy" instruction is also correct — `:121` is the only definition and
`:375` its only caller.

**Task 5 overlaps Task 4 on `editor-shell.css` and `tests/e2e/editor.spec.ts`.** Both are sequenced
behind the one-implementer rule; Task 4 runs first and holds the file set until its review closes.

## Task 4: zoom readout — implementer returned DONE_WITH_CONCERNS

BASE `673efb7`, commit `a2a1156` (9 files, +183/-5). Unit 1313 passed across 123 files;
typecheck, lint, format:check, build clean. New e2e `tracks the camera's zoom in the stage
readout` passes. Both teeth checks measured by the implementer: removing `keepMounted` fails the
unit assertion; dropping the subscription fails the e2e with `Expected: 73, Received: 49`.

**Four declared deviations, all of which I accept as corrections rather than drift:**

1. **The brief's guard was a production no-op.** Its literal `bridge === undefined ? null : …`
   referenced a `let bridge` local in `shell-layout.tsx` that nothing ever assigned. Rolldown
   constant-folded the readout out of the built bundle entirely (`data-vigilia-zoom`: 0
   occurrences), so the first e2e run failed on a missing locator. Implementer deleted the dead
   local and guarded on `store.bridge`. **This is the third time this session a "guard" was
   measured and found toothless** — same class as the `findTarget` vacuity guard and the
   `re-dispatch` item. The build-product count is what caught it, not inspection.
2. **`shell-layout.dom.test.tsx` modified, not in the brief's Files or `git add` lists.** Its
   `editor: {} as EditorShellBridge["editor"]` stub throws once the readout really mounts. Without
   it the editor-shell suite is red. Necessary, included in the commit. Brief was incomplete.
3. **The brief's Step 1 locator could never match.** Base UI portals the popup to `body` and
   unmounts it while closed, so `host.querySelector('[aria-label="Zoom to fit"]')` is always null.
   Shipped `Menu.Portal keepMounted`, `aria-label` on each `Menu.Item`, `document.querySelector`.
   Separately reproduced: a non-`keepMounted` Base UI portal popup hangs jsdom ~35 s at teardown,
   with a bare `Menu.Root` and no Vigilia code involved.
4. **`.editor-shell-positioner` lost `position: relative`** (`editor-shell.css:197-200`). It was the
   containing block for the portalled popup's fixed positioning, trapping it inside the stage's
   `overflow: hidden`. Verified in the working tree: the rule is now `z-index: 60` alone, with a
   3-line comment explaining both halves. This is a cross-cutting CSS change and Task 7 also edits
   this file, so the reviewer was pointed at it.

**Ruling: deviations 2-4 are accepted into the task's scope without a fix round.** The brief
prescribed a literal that cannot work; the implementer measured why and shipped what does. The
alternative — reverting to the brief's text — ships a readout that does not exist in the bundle.
**Cost if wrong:** the reviewer may find the CSS change over-reaches; it is one declaration on one
rule, revertible in isolation.

**Not yet verified by anyone but the implementer:** the readout's actual appearance. The e2e proves
tracking, and the implementer reports space-drag moved the canvas (160, 120) at an unchanged 49 %
while ctrl-wheel took 49 % → 73 %. The rendered-inspection step (Step 4) is the reviewer's and my
own to corroborate at the plan gate.

## Task 4's e2e case shifted `editor.spec.ts` by +48 — third citation shift this session

Task 4's browser case landed at `editor.spec.ts:1875-1922`, immediately above
`reorders a layer` (`:1923`). Anything this plan cites at or past the insertion moved by +48.

**Swept both plans and every remaining brief by grepping for the citation, not by re-reading
prose** (the same method that caught the previous two). Complete inventory of `editor.spec.ts`
citations and what each resolves to now:

| Citation | Where | Now | Verdict |
|---|---|---|---|
| `:277-278` | Plan B plan `:1507`, B8 brief | unchanged | above insertion, correct |
| `:1313` | Plan A `:1744`, A10 brief `:14` | `persists an ordinary drag…` | unchanged, correct |
| `:1369-1370` | Plan A `:1747`, A10 brief `:17` | mapping site #1 | unchanged, correct |
| `:1407` | A10 brief `:14` | `rehydrates a chart runtime…` | unchanged, correct |
| `:1420-1421` | Plan A `:1747`, A10 brief `:17` | mapping site #2 | unchanged, correct |
| `:1577`/`:1607`/`:1639` | Plan A `:1747` | **`:1715`/`:1745`/`:1777`** | corrected (the +138 offset, still right) |
| `:1829-1835` | Plan A `:755` | wheel-zoom idiom | unchanged — target moved but the citation does not |
| `:1903-1918` | Plan A `:1747`, A10 brief `:17` | **`:2041-2056`** | corrected by the +138 note, still right |
| `:1995` | Plan A `:1922` | **`:2043`** (`setThemePackage`) | **STALE — fixed now** |

**Only one citation was stale**, and it was the one whose target moved while the citation did not:
`:1995` named `setThemePackage`, which Task 4's insertion pushed to `:2043`. The `:1829` citation
happens to still point at the wheel idiom because Task 3 also added a test above it, so the two
movements cancelled — correct by accident, and it is now labelled as such in the plan so nobody
"fixes" it later.

**Ruling: the +48 offset is recorded in the plan beside Task 4's e2e step, not applied blindly to
every number.** Applying it to `:1829` would break a citation that currently resolves correctly.
**Cost if wrong:** a future reader trusts a number that has since drifted; the grep in Task 10 Step 1
re-derives the mapping-site set, which is the check that cannot drift.

Task 10's brief carries the same `:1857` error at its `:192` and needs the same fix — **deferred to
Task 10's own dispatch**, when the brief is regenerated from the corrected plan, rather than patching
a file that will be rewritten.

## Task 4 closed — review Approved, one Important finding fixed as `230bb58`

Task reviewer (sonnet) returned **Spec compliant ✅ / Task quality: Approved**. File-by-file against
the brief: all seven listed files have their hunk, `ViewportManager` and `bridge.ts` untouched.

One Important finding — and it was about a **comment, not behaviour**:

> Deviation 4's stated mechanism cannot hold. `position: relative` does not establish a containing
> block for fixed positioning (only `transform`/`filter`/`contain` do), and Base UI supplies
> `position` inline, so the stylesheet rule was inert before and after removal.

**I verified this myself rather than taking either party's word**, because both the implementer's
rationale and the reviewer's counter-claim are mechanism claims and mechanism claims have been wrong
three times this session. Read the framework source:

- `node_modules/@base-ui/react/internals/useAnchorPositioning.mjs:334-351` — `floatingStyles` always
  sets `position: resolvedPosition`, where `resolvedPosition` is `positionMethod` (`'absolute'` by
  default, `:59`) once positioned and `'fixed'` before.
- `node_modules/@base-ui/react/utils/usePositioner.mjs:18-31` — that object is spread into
  `style` on the rendered element, i.e. inline.
- `node_modules/@base-ui/react/floating-ui-react/components/FloatingPortal.mjs:55` — the portal
  container resolves to `document.body`.

So: inline `position` beats the stylesheet unconditionally, and a `body`-portalled popup is not
clipped by the stage's `overflow: hidden` regardless. **The reviewer is right and the implementer's
comment was wrong on both halves.**

**The implementer's own account conflates two things.** Its report says the declaration "was the
containing block for the portalled popup's fixed positioning and trapped it inside the stage's
`overflow: hidden`". Reading its report against the actual first failure — the e2e could not find
`[data-vigilia-zoom]` because the dead guard had folded the readout out of the bundle — those are two
separate problems, and the CSS was not load-bearing for either. Deviation 4 was an unnecessary
change shipped with a wrong rationale. Harmless, but it did not do what it claimed.

**Ruling: fix the comment, keep the removal, no behaviour change, no re-review seat.**
`230bb58` rewrites the comment to state what the rule actually contributes (a stacking context) and
leaves `position: relative` out, since it was dead either way and the sibling menubar menus share
this class. **Cost if wrong:** a future editor of this CSS reads a comment that does not mention a
declaration that was never doing anything — which is the state the removal already leaves.

**Why this needed no fix round and no re-review:** the finding is a comment on a rule whose computed
style is unchanged in every state. Dispatching an implementer round and a scoped re-review for a
three-line comment would cost two seats to re-verify a file the reviewer already read. AGENTS.md's
own rule — the smallest change that preserves the invariant — points the same way. The reviewer's
remaining findings are Minor and are parked below.

**Parked (Minor, no action):**
- `editor.spec.ts` new case — `percent()` is an unpolled `textContent` read compared for exact
  equality against a later camera read; a late React render could flake it. Follows the idiom of the
  pan-bounds test directly above it. The plan gate's full e2e run is where a flake would surface.
- Same case — the space-drag coordinates are literals `(400,400)`/`(500,470)`. They do land inside
  the measured canvas rect (x≈357-983, y≈72-666) and match the neighbouring test, so no false pass;
  the derived-coordinate rule is honoured where it matters, on the ctrl-wheel hover.
- `zoom-readout.dom.test.tsx:44-48` — the popup is `hidden` while closed and jsdom fires `onClick`
  on hidden elements, so the click proves wiring but not reachability. None of the three menu items
  has browser coverage. **The readout's fit/selection/100 % buttons are therefore unverified
  end-to-end** — recorded here rather than fixed, because Task 4's brief scoped the e2e to tracking.
- `shell-layout.dom.test.tsx:132-137` — the stub is still a partial cast; a future required `editor`
  member stays invisible. Cosmetic.
- The `act(...)` stderr warning returns in the new test file. Repo-wide and pre-existing: no
  `setupFiles`, `environment: "node"`, and nothing sets `IS_REACT_ACT_ENVIRONMENT`. Not introduced
  here. Worth one global setup line at the plan gate, not a task round.

**⚠️ One item the reviewer could not verify, and it is mine to answer: STATUS.md.** The reviewer
noted the commit carries no STATUS.md hunk while AGENTS.md requires one. That is deliberate and now
resolved: STATUS.md's bullets landed separately as `469b236 docs(status): record the zoom readout`,
matching this workstream's established pattern (`673efb7` did the same for the flags fix). The
implementer flagged the same thing as concern 1 and asked whether to fold it in; the answer is no.

**Task 4 is complete.** Plan A stands at Tasks 1-4 done, 5-11 pending.

## The citation sweep subagent was unreliable — six fabrications, all caught by re-measuring

I dispatched a read-only sweep over all three plans' source citations. **Its report cannot be
trusted and I am not applying it in bulk.** Verified fabrications, each caught by reading the file
myself:

| Sweep claimed | Actual |
|---|---|
| `snap-manager/index.ts:78`/`:92` — both readers already **exported** | Private: `:66 function readMovementMarker(`, `:82 function readMovementModifiers(`. The module exports exactly three symbols (`:21`, `:25`, `:95`). |
| `layer-panel.tsx:42-45` is inside `mutate()`, not `set` | It **is** `set` — `:42 this.#rows = bridge.layers();` with the subscription at `:43-45`. The plan was right and the "correction" was invented. |
| `new-fabric-theme.ts:15-19` is `positioned`/`text`/`dim`, `backgroundOnly` is `:16-20` | `:15-19` **is** `backgroundOnly` exactly (open `:15`, close `:19`). Plan correct. |
| `snap-manager/index.ts` "has more than three exports" | It has exactly three. |
| `editor-shell.ts` "canvas is now host-sized at `:204-205`" | Unverified, and the surrounding claims about `fitArtboardViewport` contradict the working tree. |
| `ui-copy.ts:136` for `rename` | `:138` when I read it — then `:136` on a later read. Racy, see below. |

**Why this happened, and the rule it produces.** The sweep ran while **Task 7's implementer was
editing `ui-copy.ts` live** (it adds a toolbar label). Two of my own reads of that one line returned
different numbers minutes apart. A read-only verifier dispatched against a moving working tree
produces a mixture of true-at-the-time and stale observations, and it reported them all with
identical confidence.

**Ruling: never dispatch a verification sweep whose subject is a file a live implementer holds.**
The one-implementer rule serialises writers, but it does not protect a *reader* from a writer.
**Cost if wrong:** a sweep that runs against a quiet tree gives good results; this one did not, and
its bad rows were indistinguishable from its good ones — which is worse than no sweep, because six
of its claims would have caused a plan edit that broke a correct citation.

**The three stalenesses I verified myself, all in still-pending tasks, are fixed. The rest of the
sweep's report is discarded.** Rather than trust or discard wholesale, each row was re-measured;
what survived is below.

## The four citations fixed, each re-measured before the edit

Triage rule applied: **a stale citation inside a completed task is history; the same citation inside
a pending task is a defect.** Plan B's layer-panel/editor-session rows and Plan A's `editor-shell.ts`
rows all sit in Task 5, which Plan B has already finished — rewriting them would be busywork on prose
nobody executes. Only pending-task citations were touched.

| Where | Was | Now | Verified by |
|---|---|---|---|
| Plan A `:564` (`isTextEntryTarget` "module-private") | `:93` | declared `:94`, doc comment `:92-93`; **already exported by Task 3** | `awk ':92-96'` |
| Plan A `:1038` (same claim) | `:93` | `:94` | same read |
| Plan A `:1311` (rename field) | `layer-panel.tsx:161`, `ui-copy.ts:129` | `layer-panel.tsx:229`; `ui-copy.ts` **by symbol, not line** | `awk ':227-231'` |
| Plan A `:1623` (`notify` subscription) | `bridge.ts:74-79` | `:77-79` defines `notify`, `:85` is the registration | `awk ':72-85'` |
| Plan A `:1629` (`ownerOf` call) | `bridge.ts:144` | `:150` | `awk ':148-152'` |

**Two of my own edits were then corrected by re-measuring, not by review:**

1. I first wrote `layer-panel.tsx:62-64` for the cached `get`, taking it from the sweep's report.
   Grepping for `readonly get` put it at **`:67`**, with the `#rows` field at `:34`. My first edit
   was wrong in the same way the sweep was — a number that read as plausible.
2. The same grep surfaced **`mutate()` at `:58`**, which re-reads the projection after an action.
   Naming it matters: it is the third re-read site, and a reader checking "does the tree update
   itself" now sees all three (`:42`, `:44`, `:58`) rather than inferring there is only one.

**The `isTextEntryTarget` row is the most valuable of the four.** Both Plan A citations told the
implementer the function was module-private and to export it — but **Task 3 already exported it**, so
the instruction was a no-op that reads as work. The replacement says to verify with a grep rather
than a line number, which is the durable form: it cannot go stale as the file grows.

**Task 6's brief regenerated** (365 lines) and the corrections confirmed present at `:77` and `:350`.

## CORRECTION to the Task 4 closure: it broke `npm run typecheck`, and I closed it Approved on a false claim

Task 7's implementer reported as a **concern** that `shell-layout.dom.test.tsx` had a "pre-existing
TS2352" and that it added `as unknown as` to clear it. I measured that claim instead of accepting it,
because "pre-existing" is exactly the kind of assertion that is cheap to check and expensive to get
wrong. **It is not pre-existing. Task 4 introduced it, and Task 4 reported the opposite.**

Measured, three detached worktrees, no writes to the branch:

| Commit | `npm run typecheck` |
|---|---|
| `673efb7` (before Task 4) | **0 errors — passes** |
| `a2a1156` (Task 4) | **fails** — `shell-layout.dom.test.tsx:58 TS2352`, stub missing 12 `EditorInteraction` members |
| `e3ee189` (Task 7, HEAD) | passes again — Task 7's `as unknown as` clears it |

**What went wrong.** Task 4's own report says "typecheck, lint, format:check, build clean". That was
false. Task 4 added the `viewport` sub-object to an existing cast in `shell-layout.dom.test.tsx`
without widening the cast, which turned a previously-legal `as` into an illegal one — and the
`as unknown as` needed to fix it was added a task later, by Task 7, as a side effect of its own work.

**Worse: I closed Task 4 without running the gate myself.** I read the tree, read the diff, verified
the CSS mechanism down to the framework source, and viewed the capture — but I took the test-result
line in the report on trust. The task reviewer did the same: its report cites the implementer's
"tests passed" evidence and explicitly says it does not re-run the suite. So a red gate travelled
through a full implementer self-review, a full task review, and my own closure pass, and was caught
only because the *next* implementer tripped over it and mentioned it as a minor concern.

**This is the same failure class the session has hit four times now, one layer up.** The dead
`let bridge` guard, the `findTarget` vacuity guard, the folded-out readout — each was a guard that
could not fail. Here the "guard" was a reported test result nobody re-ran, and it could not fail
either, because no one executed it.

**Ruling: an implementer's reported gate result is not evidence; the gate must be run by the
controller at least once per task, and the report's command line is reproduced rather than
paraphrased.** Concretely: before closing any task from here on I run `npm run typecheck` myself,
since it is the cheapest gate and the one that just slipped. **Cost if wrong:** one extra command
per task, ~10 seconds, against a class of defect that has now cost a full task cycle to discover and
would have cost more had Task 7 not happened to touch the same file.

**No fix dispatch needed.** Task 7 already repaired it, accidentally but correctly, and the tree at
HEAD is green. What was wrong was the *record*, and this entry is the correction: **Task 4 did not
ship a clean typecheck, and its closure note above is inaccurate on that point.**

**Task 7's concern 1 is therefore not a pre-existing defect — it is Task 4's defect that Task 7
found and fixed.** Task 7's report deserves credit for surfacing it rather than absorbing it.

## Task 6's brief pre-verified (same window, nothing writing)

| Citation | Verified content |
|---|---|
| `shortcut-manager/index.ts:24-35` | the 12-entry `PRODUCT_SHORTCUTS` table, every key lower-case |
| `shortcut-manager/index.ts:40-47` | `bindingFor` — `event.key.toLowerCase()`, `binding.shift === undefined` widens |
| `history-manager/index.ts:41-49` | `suspend()` — a counter, returns an idempotent release |
| `history-manager/index.ts:51-52` | `save(): void {` then `if (this.#suspended > 0) return;` |
| `arrange.ts:19-23` | `applyArrange` |
| `arrange.ts:40-42` | `editor.historyManager.saveState(); return true;` |
| `arrange.ts:53` | `!objects.some((object) => object.locked) &&` |
| `arrange.ts:143-151` | `move()` — `getCenterPoint()` + `setPositionByOrigin(..., "center", "center")` |
| `editor-shell.ts:139-156` | `artboardPlate` — `selectable: false, evented: false, excludeFromExport: true` |
| `editor-shell.ts:222` | `canvas.on("object:modified", save)` |
| `editor-shell.ts:232` | `saveState: save` |
| `bridge.ts:275` / `:280` | `action === "front"` → `bringToFront()` / `"back"` → `sendToBack()` |
| `chart-manager/index.ts:87` | `object:modified` → `#rerasterizeScaledChart` |
| `indicator-manager/index.ts:113` / `:121` | `object:modified` → `hideAngle` / `hideSize` |
| `selection-inspector/index.ts:306` | `object:modified` → `render` |
| `layer-panel.tsx:229` | `aria-label={\`${uiCopy.panels.rename} ${row.name}\`}` — Plan B Task 5's field, present |

**All sixteen exact.** The brief's two riskiest claims — that a `"ArrowLeft"` binding
matches nothing, and that `save()`'s early-return means a suspend/release burst records
nothing on its own — are both confirmed against the source rather than assumed. The
second is load-bearing: it is why the brief's Step 5 has a redo assertion, not just an undo.

Note this is the third brief to come back clean (Task 8, Task 6 here). The six "stale
citation" findings the failed sweep produced are now all measured false.

## Task 5's brief re-verified against the post-Task-4 tree

| Citation | Verified content |
|---|---|
| `editor-shell.ts:121` | `function artboardScreenRect(` — module-local, returns canvas-relative `left: vpt[4], top: vpt[5]` |
| `editor-shell.ts:125-132` | the body: `const vpt = canvas.viewportTransform`, `left: vpt[4]`, `top: vpt[5]` |
| `editor-shell.ts:365` | the `mountBackgroundMedia({ host: container, ... })` call |
| `editor-shell.ts:375` | `media?.setBounds(artboardScreenRect(editor.canvas, currentArtboard));` |
| `viewport-manager/index.ts:109-113` | `commit(scale, (viewport.width - board.width * scale) / 2, (viewport.height - ...) / 2)` |
| `node_modules/fabric/dist/src/canvas/SelectableCanvas.d.ts:126` | `selection: boolean;` — marquee already on, as the brief claims |
| `editor.spec.ts` | still a modified file (the marquee test is not yet written) |

**All exact.** The brief's central correction stands measured: `vpt[4]`/`vpt[5]` are (0, 121)-ish
near the canvas origin, **not** client (357, 193). That is the difference between a marquee test
that proves the marquee works and one that drags past the canvas and passes vacuously.

## Cross-plan file-set matrix (built because three plans now run interleaved)

Per-task file sets extracted from all three plan files. Only collisions matter — a task list where
each file has one writer needs no coordination.

**Fully serial (safe):** every Plan C task but T9/T10 is confined to `snap-manager/**` — distinct
files, and where two tasks share one (`index.ts`: C1, C2, C7) they are sequential within the plan.

**Repeated single-writer files (safe):** `editor.spec.ts` (A5, A6, A10 in Plan A only),
`editor-shell.css` (A2, A4, A5, A9 + B9), `ui-copy.ts` (A4, A9, B4, B7).

### One real conflict: `snap-manager/guide-renderer.ts` — A10 and C7

- **A10** modifies it "only if Step 2's inspection finds a defect" (guide width at non-1 zoom).
- **C7** modifies it "only if the fork's scale-guide shape needs it" (rendering the ported scale
  guides).

Both conditional, both on the same file, in different plans. If both fire, the second implementer
writes a file the first restructured, and neither brief can see the other's change.

**Ruling: Plan C Task 7 runs before Plan A Task 10.** C7's change is a *consequence of the port* —
it cannot be authored before the ported scale-guide shape exists, so it is pinned to Plan C's
chain. A10's change is *verification-driven* (it inspects first, and may legitimately find nothing
to fix), so it is the one that can absorb whatever C7 left. Ordering the verifier after the
constructor is also what the two briefs already assume about each other.

**Cost if wrong:** if A10's inspection would have found a defect C7 then reintroduced, the defect
reappears after the verifier passed — caught by Plan C Task 10's full gate, which runs last.
Cheap to detect, cheap to re-fix. The reverse order would instead have C7 rewriting a file A10 had
just amended, with the same detection point but a lost cycle in between.

### `indicator-manager/index.ts` — A10 only (conditional), no conflict

Listed here because the matrix raised it: C7 does not touch it, so A10 is its sole potential writer.

### Standing order within Plan A, unchanged

A5 (running) → A6, because both own `editor.spec.ts` and the marquee test's drag derivation lands
first. A7 and A8 are free of that file. A9 re-takes `editor-shell.css`.

## Task 5 DONE_WITH_CONCERNS — commit `06655e6`; gates run by me, all clean

`npm run typecheck` 0 errors, `npm run lint` clean (317 files) at `06655e6`. Applied the standing
ruling rather than trusting the report.

The implementer raised three concerns, and **concerns 1 and 2 are corrections to the brief, not
defects in the work** — verified against the tree, not accepted on narrative:

1. **The brief's `read()` was a broken instrument.** It compared raw `left`; a marquee puts its hits
   in an `ActiveSelection`, whose `enterGroup` rebases every child's `left` (measured: 26 objects
   shifted a uniform −640.5 with world positions unchanged). `toEqual(before)` on raw `left` fails on
   a *working* marquee, so the brief's own test could not have passed. Replacing it with
   `getBoundingRect()` (world space) is correct and was necessary.
2. **The brief's assertion left a vacuity hole.** Measured: with all three guards bypassed, an
   off-canvas drag **passes** the rects comparison; only the added `selected > 0` line goes red. The
   implementer added it. This is the second time this plan's marquee test has been the vacuity
   carrier — Task 5's own brief exists to remove that class, and the brief reintroduced one.
3. **No `editor-shell.css` change, and I accepted that.** The brief listed the file and demanded the
   covering rect "be dealt with". I checked the spec instead of the brief:
   `2026-09-25-editor-viewport-and-mechanics.md:48,58` attributes reachability to the canvas-sizing
   change (Task 2), and `:18` describes the covering-rect cause as the thing that change removes.
   The behaviour is achieved; the brief's demand was stricter than the spec it argues from.

**Ruling: concern 3 accepted, CSS gap is not a Missing finding.** The spec is the binding authority
and it does not require a CSS edit; a second edit would be churn against an already-passing test.

**Ruling: concerns 1 and 2 are recorded as brief defects, and the pattern is now three-for-three**
— C1's `IGNORED_IDS`, A5's `read()`, A5's assertion. In each case the brief's *prose* was right and
its *fixture or instrument* was wrong. That is the failure mode to expect: these plans were written
from source reading, and a test harness is the one thing reading source cannot validate.

## Task 6's brief amended — two defects, one of them a wrong object

A5 deleted the local `artboardScreenRect` and shifted `editor-shell.ts` by −17, so A6's citations
`editor-shell.ts:139-156`, `:222` and `:232` were all stale (now `:122`, `:205`, `:215`). De-lined
them to symbols, since A6 itself will rewrite that file.

More importantly, **A6's Step sketch named the wrong object.** It said select-all must not select
"the artboard plate" because `artboardPlate` is `selectable: false`. But `artboardPlate` is assigned
to `canvas.backgroundImage` (`applyArtboardPaint`), so it never appears in `getObjects()` and
select-all cannot see it. The object that actually needs the filter is the starter theme's
`rect("background", 0, 0, 1280, 720, ..., backgroundOnly, "scene")` — id `"scene"`, artboard-sized,
`selectable: false`, and genuinely in `getObjects()`.

The consequence the brief got backwards: an unfiltered select-all does not "move the artboard
itself", it **moves the background off the artboard**, since the rect is a scene object with a real
`left`/`top`. Same fix, opposite reason — and a reason matters, because it is what tells the next
reader whether the filter is still load-bearing.

## Task 5's marquee test independently read — non-vacuous, and the implementer's concerns 1-2 confirmed

I read the diff myself rather than waiting for the review seat, because this test's whole purpose is
removing a vacuity class and the brief had already shipped one vacuous assertion. Findings:

**Concern 1 confirmed.** `read()` uses `getBoundingRect()` (world space) plus a `selected` count,
and its comment states the reason — an `ActiveSelection`'s `enterGroup` rebases each child's `left`,
so raw-`left` comparison reports a move for an object that never moved. The brief's `toEqual(before)`
on raw `left` could not have passed on a working marquee. Correct instrument.

**Concern 2 confirmed and closed properly.** `expect(before.selected).toBe(0)` plus
`expect((await read()).selected).toBeGreaterThan(0)` means the assertion pair fails if the drag
reached nothing. Without it, "nothing moved" is satisfied by a drag that selected nothing at all.

**The third assertion is the real guard, and it is stronger than the brief asked for:** the same
gesture started *inside* `time-card` must move it (`rects).not.toEqual(before.rects)`). That catches
a canvas that ignores pointer input entirely — which would otherwise satisfy every "nothing moved"
assertion in the test. The `time-card` choice is deliberate and documented: `(70,450)` avoids
`header-wash`'s 0..142 band, so the guard does not depend on Step 3's offered fix being taken.

**The canvasBox offsets are present and load-bearing**, with the measured `fitScale()` contain-fit
reasoning (626x352 artboard in a 626x594 canvas, scale 0.489) stated inline.

**Production diff is exactly what the brief required:** `artboardScreenRect` moved onto
`ViewportManager` (`viewport-manager/index.ts`, with the canvas-frame contract in the doc comment)
and the module-local copy at `editor-shell.ts:121` is **deleted**, with the one call site now
`editor.viewport.artboardScreenRect()`. One owner, achieved.

## Task 6 DONE — commit `a0a44ff`; gates run by me, all clean

`npm run typecheck` 0 errors; `npm run lint` clean (317 files); `npm run format:check` clean (317
files). Applied the standing ruling.

Diff: 6 files, +300/-25 — `editor-session.ts` (+104, the nudge/burst machinery),
`shortcut-manager/index.ts` (+38/-…, the new bindings), two test files, `editor.spec.ts` (+87).

**Its extra teeth check independently confirms the `scene` rect finding from C1 and A6:**
"drop `selectable` filter → `background` (1280x720 scene rect) enters selection. Restored." That is
the same object I found by reading `new-fabric-theme.ts`, measured now by an independent agent
through the actual select-all path. Three separate confirmations that the filter is load-bearing.

Other measured teeth checks: deleting the second `history.save()` fails at the first undo
(`expected +0 to be 1`); removing `canvas.select-all` from the deferred set fails the Ctrl+A
assertion (`Expected: 1 / Received: 45`). Inter-press gap measured **37 ms** against the 300 ms idle
window — a 8x margin, which is the number that makes the `waitForTimeout(400)` defensible rather
than superstitious.

Concerns raised, for the review seat to adjudicate: the brief's `expect(before).toBeTypeOf("number")`
does not exist in Playwright (correct — it is a Vitest matcher); a positive Ctrl+A assertion was
added beyond the brief; and `canvas.front`/`canvas.back` have no test.

## Task 5 CLOSED — review Approved, no Critical and no Important findings

Commit `06655e6`. The reviewer adjudicated concern 3 (the untouched `editor-shell.css`) **in the
implementer's favour** on the same grounds I reached independently: the spec attributes marquee
reachability to the canvas-sizing change alone, and reachability is demonstrably achieved by a
rendered browser measurement whose press lands at the canvas bottom and produces an `ActiveSelection`.

It verified concern 1 against Fabric's actual source rather than the report's narrative, which is the
check that mattered: `ActiveSelection` extends `Group`; `groupInit` runs `enterGroup` then
`LayoutManager.performLayout({type: LAYOUT_TYPE_INITIALIZATION})`, whose `layoutObject` does
`object.set({ left: object.left + offset.x, ... })`. So **a working marquee truly does rewrite every
hit child's `left`** — the brief's raw-`left` comparison was a false red, not a strict test.

One-owner check passed by grep: exactly one `artboardScreenRect` implementation
(`viewport-manager/index.ts:86`) and one production consumer (`editor-shell.ts:358`).

## Four Minors parked, with rulings — A5 is closed, so they do not gate it

| Minor | Ruling |
|---|---|
| `editor.spec.ts:~2028-2036` comment archaeology — "An earlier revision of this step claimed 'about 240px of pasteboard…'" | **Fold into Plan A Task 10**, which owns `editor.spec.ts` and must walk it anyway. This one is an explicit AGENTS.md rule ("Never write diary-style comments, debugging chronology or long implementation narratives into source"), so it is a real defect, just not a gating one. |
| Same rationale stated twice more (`:2016-2019`, `:2042-2045`) | Same fold: trim to the invariant (canvasBox offsets added once; every X in the below-artboard band is pasteboard). |
| `viewport-manager/index.ts:86-101` re-decodes `canvas.viewportTransform` where `transform()` already does it 20 lines above | **Accept as-is, do not churn.** Real duplication, but it is four field reads with no behavioural risk, and A5 is closed with its review spent. Recorded so the final whole-branch review sees it as a known, deliberate acceptance rather than an oversight. |
| The same 4-field inline rect type written twice in one file | Accepted, cosmetic. `ArtboardScreenRect` is a bigger change than the duplication costs. |

**Ruling: no fix round for A5.** All four are Minors, the skill treats Minors as non-gating, and the
two that matter are comment trims that belong with a task already visiting those files. Cost if
wrong: the archaeology comment ships one task longer than it needed to.

## Task 6 — fix round 1 prepared, and it is a repo-guardrail crossing the review under-rated

Brief: `task-6-fix-brief.md`. Two findings, one remedy.

**Fix 1 (Important, plan-mandated), verified by me twice.** The plan's own measured table says the
break is invisible: with `endBurst`'s `saveState` deleted, both e2e assertions still pass, because
the `Control+z` handler's own `undo()` → `reviveScene` → `object:modified` → `save()` re-records
before stepping back. I separately traced `EditorHistory` to confirm the reviewer's proposed
instrument has teeth: deleting the explicit `saveState` leaves `#entries` at length 1 (nothing was
recorded while suspended, and `undo()` at index 0 is a no-op), so `canRedo` stays `false`.

The brief's remedy — a unit test on `EditorHistory`'s `suspend`/`save`/`undo` primitives — is **not
the wiring's test**. It exercises code this task did not modify and never reaches `endBurst`, the
300 ms timer, the `release` pairing, or the registration. Disabling the mechanism today leaves the
whole suite green, which AGENTS.md's "a new regression test should fail when the fix is disabled"
forbids outright.

**Fix 2 (repo guardrail).** `wc -l editor-session.ts` → **815**. AGENTS.md: "500 lines is a signal
and 800 is a stop for normal source files." This task's +104 took the file from 711 to 815. The
review listed the ~70-line nudge cluster as Minor ("not a defect"); **by this repo's binding rule it
is a stop, and I am treating it as one.**

**Ruling: Fix 1 and Fix 2 ship as one round, because they have one remedy** — extract the nudge/burst
machinery to `canvas-nudge.ts` (beside `arrange.ts`, following the repo's `createXManager(canvas,
save)` factory idiom), which both returns `editor-session.ts` under the stop and gives the wiring a
testable seam. The brief specifies a jsdom unit test driving the extracted factory with doubles and
asserting `suspend` once / `saveState` zero while open, exactly one after 300 ms, plus an
idle-boundary case; and mandates two measured teeth checks (delete `saveState`, then delete
`release`) before the round can be trusted.

**Cost if wrong:** the extraction is the largest mechanical change to this file in the plan, and if
the factory's options shape proves awkward the implementer will have spent a cycle moving code. The
alternative was to ship a bare `canRedo` assertion on the bridge surface — smaller, but it leaves an
815-line file past a hard stop and tests the aggregate rather than the mechanism, and the extraction
is needed either way.

Also folded in: the stale comment the review found in `shortcut-manager/index.dom.test.ts`
("takes no argument today" — false as of this same commit), since the file is already being edited.
Explicitly out of scope, with the review's reasoning accepted: a test for `canvas.front`/`canvas.back`.

## Task 6 fix round 1 dispatched

BASE `8be1364`. Brief `task-6-fix-brief.md`. Dispatch carries the `STATUS.md` obligation the Plan C
briefs omit, and forbids the usual temptations (no `helpers/`-style folders, no re-testing
`canvas.front`/`back`, keep the two load-bearing comments).

**One thing I am watching:** the fix is a large mechanical move of ~70 lines, and the review found
the *original* problem precisely because a mechanism existed with no test that could fail. The teeth
checks are therefore the acceptance criterion, not the green suite — a round that extracts cleanly and
still leaves `endBurst`'s `saveState` unobservable has not fixed anything.

Recorded for the final review: A5's two cosmetic Minors and A6's `canvas.front`/`canvas.back` gap are
**deliberate acceptances**, so the whole-branch reviewer does not read them as oversights.

## Task 6 fix round 1 committed `49080b0` — and I have ruled on the `endBurst` question the implementer raised

The implementer reported the round complete and raised one concern: **`endBurst` is exported and has
no caller.** I measured it rather than reasoning about it:

- `grep -rn "endBurst"` → `canvas-nudge.ts:32` (interface), `:69` (declaration), `:86` (the
  `setTimeout(endBurst, NUDGE_IDLE_MS)`), `:92-93` (comments), `:96` (return); plus one comment in
  `history-manager/index.test.ts:46`. **No production or test caller uses the export.**
- The new test drives it **through the timer only** (`vi.advanceTimersByTime(NUDGE_IDLE_MS)`), never
  the export.
- The plan's prose at `:1165` says "resume on a short idle timeout (~300ms) **or on any other action**,
  whichever comes first", and the retained comment at `canvas-nudge.ts:74` repeats it. **Only the
  timer half is implemented.**

### Ruling: wire `endBurst` into the undo/redo handlers — it closes a real authoring defect the plan documented and then worked around

I considered two options and rejected the smaller one.

**Rejected — remove the export and narrow the comment to the idle window.** It makes comment and code
agree and removes surface, and it is what I first drafted. I rejected it because the plan's own text
records the hole it papers over.

**`plans/2026-09-25-editor-viewport-and-mechanics.md:1309`, written by the plan's author:** *"A
`Control+z` inside the 300ms window does nothing, because `release` has not run and no entry exists
yet — measured: the object stays at `before + 11` and the undo is a silent no-op. Do not remove the
wait on the grounds that the presses 'usually' finish in time."*

That is a **product defect, not a test flake**, and the plan's remedy was a `waitForTimeout(400)` in
the test — the test waits out a window in which the shipped editor ignores the author's Ctrl+Z. The
authoring experience is: nudge an object, immediately press Ctrl+Z, nothing happens, press it again and
it works. The goal for this branch is authoring UX comparable to Figma, so a documented silent no-op on
the most-used undo keystroke is exactly the class of defect this work exists to remove.

**Ruling: fix round 2 adds `this.#nudge.endBurst()` at the top of the `edit.undo` and `edit.redo`
handlers** (`editor-session.ts:278-283`), with a unit test that a nudge followed immediately by undo
restores the object to its pre-nudge position. `#nudge` is assigned at `:328`, after those
registrations at `:278` — that is fine, the callbacks run later, and `readonly #nudge: CanvasNudge`
is already declared at `:122`.

**Why this is the right size.** It is two calls and one test, it gives the export its caller, it makes
the existing comment true instead of narrowing it, and it removes the need for the `waitForTimeout(400)`
in the browser test — which Task 10 should then be able to drop and re-measure.

**The alternative I rejected, recorded so it is not re-proposed:** closing the burst on `mouse:down`
(the repo's gesture-start idiom, `snap-manager/index.ts:264`). It would make "any other action" true for
drags, but it does **not** fix the Ctrl+Z symptom, which is the one the plan measured — and it adds a
second listener to a module that currently owns only a timer.

**Cost if wrong.** If the burst's history entry lands earlier than an author expects, the visible
effect is one extra undo step after a fast Ctrl+Z; the test pins the restore, so it would fail loudly.
The alternative costs a shipped silent no-op on the most-used keystroke in the editor.

**Sequencing, because of the one-implementer rule:** C1's fix round is running now and its scope
includes `editor-session.ts` (a stale comment). Task 6's fix round 2 queues behind it.

Also recorded: the re-review of `49080b0` was dispatched with this question named explicitly, so its
verdict on `endBurst` either confirms the measurement above or corrects it, in which case I will
re-rule before dispatching round 2.

## Correction to my own Task 7 ruling: the conclusion holds, the mechanism I named was wrong, and there is a tripwire I missed

While the Task 6 re-review and the Plan C fix round run, I verified the serialisation claim my Task 7
ruling rests on — that setting `subTargetCheck`/`interactive` for group entry cannot leak editor state
into a saved document. **My stated mechanism was wrong. The conclusion is right, and the real
mechanism is stronger.**

**What I claimed:** "`scene-fabric/persist.ts:58` sets `includeDefaultValues = false` before every
serialisation, so a property equal to its default is not written."

**What the code says.** `includeDefaultValues = false` is real (`persist.ts:58`), and it is what makes
Fabric's own `toObject` omit default-valued keys — that half is right. But `persist.ts:27-36` is not a
mechanism that strips: `SCENE_PERSISTED_PROPERTIES` is a **whitelist of Vigilia's own keys**
(`id`, `vigiliaText`, `vigiliaPaint`, `vigiliaAsset`) plus the three authored interaction flags
(`selectable`, `evented`, `locked`). It governs a different key set from the one my ruling relies on.
Two mechanisms, and I named the wrong one.

**The tripwire I did not know about — and it is exactly this task's failure mode.**
`persist.dom.test.ts:229-268` is a two-case pin, and its header comment says the key sets are `toEqual`
"never `toMatchObject`" because every key this format had to exclude was one nobody thought to look for:

- `:230-242` — a plain group: `Group.toObject` **forces** `subTargetCheck` and `interactive` into its
  output unconditionally, and default-stripping is what removes all three ("there is no filter").
- `:244-268` — the same group constructed with `subTargetCheck: true, interactive: true`: the keys
  **are** persisted, asserted as an exact list. Its comment is the tripwire, in the test's own words:
  *"Spec 0013 stage 4 adopts `subTargetCheck` + `interactive` for group entry/exit, which makes them
  non-default and therefore persisted — editor state in a portable document. This test is how that
  arrives: as a failure naming the keys, in the commit that causes it, rather than as a surprise in a
  saved file."*

So the repo anticipated this task and wrote the test that catches its worst failure. My ruling —
set the flags on enter, **restore them on exit** — keeps that test green, because a group whose flags
are restored to `false` serialises as default-valued and the keys vanish. Had I ruled the alternative
I explicitly rejected ("enable both flags permanently on every group"), this test would have gone red
by name in the commit that caused it.

**Correction recorded rather than quietly fixed, because the reason is what a later reader uses.** The
practical consequence is one addition to Task 7's brief: name `persist.dom.test.ts:244-268` as the test
that must stay green, and state that it is the tripwire for the ruled-out alternative. That turns a
correct-by-argument ruling into a correct-by-test one, which is the standard this repo's evidence rule
asks for.

## Task 6 fix round 1 re-reviewed — CLOSED, no new Critical or Important

Re-review of `review-8be1364..49080b0.diff` (1 commit, 20492 bytes). Verdict: **all findings
ADDRESSED, no new Critical/Important breakage.** Both findings closed, and the reviewer verified them
by reading the mechanism rather than by trusting the report:

- **The teeth checks genuinely bite, derived independently.** `saveState` has exactly one call site in
  the module, so case 1's `toHaveBeenCalledTimes(1)` is deterministically 0-vs-1 when the line is
  deleted. Deleting `release()` leaves the depth assertion at 1 (case 1) / 2 (case 2) against the
  expected 0. Both halves of `endBurst` are pinned, not just the one my brief named.
- **Not double-theatre.** The `fakeHistory()` double mirrors `EditorHistory`'s real counter and
  idempotent release, so `depth()` reads a genuinely released burst rather than a stub's bookkeeping.
- **815 → 765 lines**, machinery verified gone (the four registrations delegate to
  `this.#nudge.nudgeBy`, assignment at `:328`, `dispose()` in the existing destroy block). The brief's
  "ideally under 750" was not met and the implementer said so rather than reporting the number as fine.
- **Extraction is behaviour-preserving where it matters:** per-key sign convention byte-identical, the
  `getCenterPoint`/`setPositionByOrigin` pair and the `locked` skip carried over, the
  `active === undefined` guard still above `suspend()`, `object:modified` payload unchanged, no
  unused-import residue.

### The `endBurst` Minor: the reviewer found the same fork I did, and my ruling is the stronger remedy

It rated the dead export **Minor** and offered the same two options I weighed — drop it from the
returned surface and narrow the comment, or wire a caller — adding that it "cannot corrupt state, and
it is the intended seam if a future 'any other action' cancels a burst."

**My ruling above stands unchanged, and I am taking the second option.** Minors are non-gating, so this
is me choosing to spend one small round rather than parking it; the reason is that the plan's own text
(`plans/…:1309`) documents the shipped symptom as a *measured silent no-op on `Control+z` inside the
300 ms window*, and the plan's remedy was a `waitForTimeout(400)` in the test. Closing the burst on
undo removes the mechanism that creates that gap instead of waiting it out. The reviewer was not asked
to weigh the authoring symptom, only the dead surface; on the dead surface alone its Minor rating is
right.

### Out-of-scope observations parked, none blocking

| Observation | Ruling |
|---|---|
| `canvas.front` / `canvas.back` untested (`editor-session.ts:302-306`) | **Parked**, already a deliberate acceptance from round 1. Fold into Task 10, which owns the e2e file. |
| The e2e covers nudge-right only; nudge-up/down untested | **Parked to Task 10**, same reason and same class as the row above — the four registrations are literal duplicates, so a sign error in one is caught by nothing today. Task 10 already extends `editor.spec.ts`. |
| `canvas-nudge.dom.test.ts`'s double never exercises the `ActiveSelection` or `locked` branches (`canvas-nudge.ts:45-48`) | **Parked.** Moved-unchanged code; the branches are pre-existing behaviour this task relocated, not behaviour it introduced. Add when a task next touches the nudge filter. |
| Round 1's `history-manager/index.test.ts` suspend/save case is now partly redundant | **Keep.** The brief did not ask for removal and redundant coverage of a counter costs nothing. |

## Task 6 fix round 2 brief prepared and QUEUED — the burst must close on undo, and the browser test's wait should come out

Brief `task-6-fix2-brief.md`, held behind C1's fix round by the one-implementer rule. It is written
now because the re-review's Minor and my `endBurst` ruling (recorded above) settle into one small,
verifiable round.

**The remedy is two statements plus one test:** `this.#nudge.endBurst()` as the first line of the
`edit.undo` and `edit.redo` handlers, with a test that captures the registered handlers from
`editor-session.dom.test.ts`'s existing `ShortcutManager` mock and drives nudge → undo.

**I checked the seam exists before writing the brief, because that is the defect I keep shipping.**
`editor-session.dom.test.ts:36-41` mocks `./shortcut-manager/index.js` with
`class { destroy = vi.fn(); register = vi.fn(); }`, so `register.mock.calls` yields the `(id, handler)`
pairs and the `edit.undo` handler is directly invocable. Had the mock been a module-level
`vi.mock` returning a bare object, or had the file used a real `ShortcutManager`, this round would have
needed a different seam and the brief would have been wrong.

**The part I am least sure of, and how the brief handles it.** My ruling predicts that with the fix,
A6's browser test passes **without** `await page.waitForTimeout(400)` — the measured inter-press gap is
~37 ms against a 300 ms window, so the burst is open when Ctrl+Z arrives and, with the fix, closes just
before the undo runs. But I derived that from reading the handler order, not from running it. So the
brief does not assume it:

- It instructs the implementer to try removing the wait and run it.
- **Passes** → remove the wait *and its comment*, because that comment would otherwise document a
  defect that no longer exists.
- **Fails** → restore the wait, report the failure output, and I re-rule.

That is deliberate: it makes my prediction the thing under test rather than a premise, and both
outcomes are recorded. If it fails, the honest fallback is that Ctrl+Z inside the window still needs a
flush the dispatcher cannot do — and the wait stays with an accurate comment instead of a stale one.

**Cost if wrong.** One extra round on a file already open, and a browser test that either loses a
`waitForTimeout` it did not need or keeps one it does. The alternative is the shipped behaviour as it
stands: a documented silent no-op on the most-used keystroke in the editor.

## A7's brief gains the ordering constraint A8's ruling imposed on it — cross-task dependency closed

Reading the middle of this ledger (the A8 ruling) surfaced a cross-task dependency that pointed the
wrong way. That ruling derived, from Fabric's source, that `setActiveObject` fires `selection:created`
**synchronously**, so the layer panel renders the instant the active object changes — and therefore
**Task 7's `enterGroup` must record the context *before* it changes the active object**. The ruling
recorded that as "a constraint on Task 7, not a finding against it" and said it would be carried
"where the consumer notices it" — i.e. in Task 8's text.

**That is the wrong place, because Task 7 runs first.** A constraint Task 7 must satisfy, written only
into Task 8, is invisible to the implementer who has to satisfy it. Task 7's brief stated the order
only implicitly ("sets the child active and records the ancestor path" — which reads as the wrong
order, and at best is ambiguous about which happens first).

**Amended Task 7's brief to state it explicitly, with the mechanism:** record first, then activate;
`selection:created` is synchronous; the bridge notifies on it; the store re-reads on every notify. The
symptom is named too (a one-notification-late tree that reads like a React batching bug), because that
is what makes an implementer keep the order rather than "simplify" it back.

**Cost if wrong.** One paragraph. The alternative is the exact defect the A8 ruling predicted,
reached by the one path the ruling did not cover because it was looking at the consumer.

## A7's persist claim was false, and the fix belongs in the plan — brief-only amendments do not survive

Pre-verifying A7 against source found a defect in *my own* text. The brief said
`persist.dom.test.ts:244-268` "must stay green, and `:230-242` must too... a group left with the flags
set is precisely the failure those two cases exist to catch." **Read them: both build their own
fixtures** — `:230-242` a default `new Group([...])`, `:244-268` one *constructed with*
`subTargetCheck: true, interactive: true`. Neither serialises a group the editor entered. **Neither can
go red from a leaked flag.** The claim was the opposite of the truth.

What they actually pin is the serialiser's contract, and `:244-268`'s exact-key list is the useful half:
a non-default flag pair **is** persisted. So the plan's own sentence at `:1430` — "Both flags are
defaults-only, not persisted, so setting them is safe" — was wrong for the same reason, and it is the
line an implementer would trust.

**Ruling: corrected in the plan, not just the brief.** The plan is what `task-brief` regenerates from,
and I had already watched a brief-only amendment evaporate: three earlier A7 corrections (the ordering
constraint, the tripwire paragraph, `persist.dom.test.ts` in Step 4) were written into
`task-7-brief.md`, and running `task-brief` to pick up this fix **overwrote all three**. The brief is a
build artifact; the plan is the source. Every correction now goes to the plan and the brief is
regenerated from it.

| Ruling | Cost if wrong |
|---|---|
| **A7's persist paragraph and Step 4 go into the plan**, stating that a `true` flag is persisted, that `persist.dom.test.ts` builds its own fixtures and therefore cannot catch a leak, and that Step 1's direct flag assertions are the guard. | One paragraph. The alternative is an implementer reading a green `persist.dom.test.ts` as proof that entry and exit are symmetric, and shipping a saved document carrying editor state. |
| **The A7 ordering constraint goes into the plan** for the same reason. | The one-notification-late tree the A8 ruling predicted. |

**Cost if wrong.** Both are text. The alternative was already paid once this session, silently: three
corrections I believed were in place were gone at the next regeneration, and I only noticed because I
grepped the regenerated file instead of trusting the write.

### A7's brief is now verified clean

242 lines, regenerated from the amended plan, all three amendments confirmed present at `:98`, `:104`,
`:109`. Every other citation in it was checked earlier against source (`fabric-nodes.ts:194-195` exact,
`text-manager/index.ts:30` exact, `history-manager/index.ts:75` exact). Ready to dispatch when the
single-implementer slot frees.

### A9's brief adjudicated — D7 holds exactly

Closed the last open question on Plan A Task 9. Read `object-actions.ts`'s eligibility predicates for
all 12 ids against the fixture target `{kind: "object", locked: false, memberCount: 1, isGroup: false}`:
`unlock` needs `t.locked`, `group` needs `t.kind === "group"`, `ungroup` needs `t.isGroup` — so the
eligible set is exactly the nine the brief enumerates, and `ActionGate` has no `can` member as D7
claimed. No amendment needed.

## A6-fix2's `editor-session.ts` citations had rotted before dispatch — caught by re-measuring

Swept the queued fix-round-2 brief against the current tree while C1's uncommitted edit sits in
`editor-session.ts`. Its `canvas-nudge.ts` citations are all exact (`:32` interface member, `:69`
declaration, `:86` the idle timer, `:96` the return, `:66-67` the comment under challenge). Its
`editor-session.ts` ones are not:

| Brief said | Actual |
|---|---|
| handlers at `~:278-283` | `:278` and `:281` — the range is close but the file is being actively edited |
| `#nudge` assigned at `:328` | **`:329`** — off by one, because C1's uncommitted edit shifted the file |

The `:329` drift is exactly the standing ruling's case — a citation into a file an earlier task is
rewriting — and C1 has not even committed yet, so the number would move again. Rewrote both references
to name the **symbols**: the handlers registered as `"edit.undo"` / `"edit.redo"`, and `#nudge` as the
field assigned by the `createCanvasNudge` call that follows them. Line numbers gone, nothing lost.

**Cost if wrong.** None — the text is strictly more precise. The alternative is an implementer editing
the wrong two lines in a 765-line file, or concluding the brief is stale and improvising.

I also checked the standing concern this file's own note raised: the fix mirrors round 1's mechanism
(explicitly calling `endBurst` at the two history entry points) rather than relying only on the idle
timer, so a drag longer than the window cannot leave the burst open across a Ctrl+Z.

### Ledger gap found: implementer agent identities were never recorded

The skill says "Record the implementer's agent identity from the dispatch result — fix-loop rounds 1-3
resume this agent." **This ledger never did.** `grep` for agent ids across it returns nothing but
commit SHAs. That was invisible until now because every fix round so far has been written as a
self-contained brief anyway; it bites the moment a round *needs* the original agent's context.

**Consequence for this round:** Task 6's fix-round-1 implementer is unidentifiable after compaction, so
round 2 dispatches a **fresh implementer**. Acceptable here and specifically because the brief is
self-contained — it names the two handlers, the exact statement to add, the mock seam in
`editor-session.dom.test.ts:36-41`, the teeth check, and both acceptable outcomes for the browser wait.
Nothing in it depends on the previous agent's memory.

**Ruling: agent identities are recorded from this point on, and briefs stay self-contained regardless**
— the second is what makes the first non-load-bearing. **Cost if wrong:** one fresh context per fix
round instead of a resume; the brief already carries the work, so the cost is tokens, not correctness.

## Task 6 fix round 2 DISPATCHED — fresh implementer, BASE `69e5121`

Agent identity recorded at dispatch (per the ruling above). Brief `task-6-fix2-brief.md`, corrected
before dispatch: its `editor-session.ts` citations now name the `"edit.undo"` / `"edit.redo"` handlers
and the `#nudge` field by symbol rather than by line, because C1's edit to that file had already moved
the assignment from `:328` to `:329`. Its `canvas-nudge.ts` citations (`:32`, `:66-67`, `:69`, `:86`,
`:96`) were re-measured and are exact.

Dispatch carries: the format:check-is-clean baseline, the do-not-touch-other-files rule for the
concurrent C1 re-review, and an explicit instruction not to change `canvas-nudge.ts`'s behaviour.

## C1 fix round 1 re-review DISPATCHED (read-only, concurrent)

`review-8be1364..69e5121.diff` (2 commits, 25514 bytes) against `task-1-fix-brief.md`. Dispatched with
two extra questions the brief's own reviewers should answer rather than accept:

1. Confirm the derived fixture id can only resolve to the plate — the lookup is
   `objects.find((object) => object["selectable"] === false)?.["id"]`, which returns the **first**
   match, so it is correct only if the theme emits exactly one non-selectable object. I verified that
   myself (`backgroundOnly` is the only `selectable: false` in `new-fabric-theme.ts`, spread top-level
   by the `rect` helper, exactly one call site at `:328`), but the reviewer should confirm it
   independently rather than take my word — this is the exact class of error that opened this round.
2. Whether the three claimed teeth checks are credible from the diff. The implementer reports all three
   red (empty `IGNORED_IDS` → `expected 160.5 to be 158`; reinstated `selectable` gate → `98 to be 100`;
   fixture pointed at `wordmark` → `160.5 to be 158`). Reviewer must not re-run them, only judge whether
   each would redden what it claims.

### The implementer's concern 4 is accepted, and one of its concerns is already closed

- **format:check (concern 1) — RESOLVED, and it was not the implementer's to fix.** It reported
  `packages/editor/src/canvas-nudge.ts` failing `format:check`. Root cause measured: `.gitattributes`
  sets `* text=auto eol=lf` and `*.ts text`, but that one file sat in the worktree with **CRLF** while
  its blob was LF — the only such file in a 50-file sample. Git's normalization made `git diff` report
  the file as unchanged (verified empty), so the mismatch was invisible to every check except Biome,
  which reads raw bytes. **Rewrote the worktree copy to LF; `git diff HEAD` for the file is still
  empty** — git stored the same bytes all along. `npm run format:check` is now clean repo-wide:
  `Checked 319 files in 111ms. No fixes applied.` This would otherwise have gone red at Task 10's gate.
- **Concern 2** (the browser test asserts nothing about guides) is correct and already known: it is the
  reason the plan's later behaviour matrix exists. Not a new finding.
- **Concern 3** (the capture is modified but unstaged) is correct and deliberate — `docs/` is outside
  that brief's scope. The capture is evidence and will be staged with the task that owns the docs, not
  smuggled into a fix commit.
- **Concern 4** (no teeth check for the comment fix) — accepted; a prose change has no mechanism to
  break.

## Task 6 fix round 2: complete (`aad9d5f`)

Re-review verdict: all five brief requirements ADDRESSED, 0 Critical, 0 Important, 2 Minor (both parked:
the unit test pins both effects but not their order — only the e2e catches a reordering; and a
pre-existing 300 ms inter-press timing fragility the removed wait never protected). Teeth confirmed
causally dependent on `endBurst()` — the `suspended === 1` guard at `editor-session.dom.test.ts:402`
rules out a vacuous pass.

The `waitForTimeout(400)` came out because the test genuinely passes without it. The comment that
documented the old silent no-op is gone with it. Task 6 is closed.

## Ruling: a phantom `M canvas-nudge.ts` was a stale stat entry, not a dirty file — cleared with `git add`

`git status` reported `canvas-nudge.ts` modified in every check this session, including the A6-fix2
implementer's. It was not: the worktree content is byte-identical to HEAD's blob (`edc98f5a…`),
`git diff` was empty, and `git diff-files --name-only` also listed it.

Cause, measured: this is the file a previous session rewrote from CRLF to LF via
`tr -d '\r'`. `git hash-object` on path form filters the worktree through `.gitattributes`
(`* text=auto eol=lf`), so the hash matched while git's *stat cache* still held the old size with
`CE_MATCHED`/`CE_UPTODATE` unset — the stat stays "dirty" until something forces a re-hash.
`git update-index --refresh` did not clear it; `git add` did, and staged nothing (blob identical).

**Cost if wrong.** None — `git add` of an identical blob is a no-op and the empty `git diff --cached`
proves it. The alternative was leaving a permanently dirty-looking file in a branch whose every
subsequent dispatch reads `git status` to decide what it owns, which is how a future implementer
talks itself into `git checkout --` on someone else's work.

## A10's "exactly seven mapping sites" was eight — and the seventh was already correct

A10 Step 1 told the implementer to repoint "all seven" `box.x + (n / W) * box.width` sites and confirm
the set with a grep. Measured with that grep today: **eight** sites, and the extra one is not a
straggler.

`editor.spec.ts:1983-2020` — inside the marquee test — **already does this correctly**, and documents
why. It calls `artboardScreenRect()` through the bridge, adds the canvas box once, and carries a comment
saying the offset is the difference between a real drag test and one that lands off-canvas and passes
vacuously. It is the same fix A10 Step 1 exists to make, written earlier, and it is where `sceneToClient`
should be lifted *from*.

Two corrections landed in the plan:

1. Step 1 now opens by telling the implementer to read that block first as the convention authority,
   and it now says **three** helpers (`artboardRect`, `sceneToClient`, `clientOfScene`) rather than two —
   Step 3's code calls all three.
2. The site table is now the grep's eight, and it carries an explicit warning **not to flatten the
   seventh**. Folding the canvas box into that test's canvas-relative `rect` would double-count the
   offset in its `rect.height` guard at `:2043` — a guard that compares a client `sy` against
   `canvasBox.y + rect.top + rect.height` — turning a real vacuity guard into one that passes on a
   marquee that selected nothing. The earlier instruction ("do not keep any `box.x + …` arithmetic")
   read literally would have done exactly that.

Also corrected: the `selectStarterChart` precondition now says *where* the assertion goes (between the
click and `openInspectorTab(page, "Data")`, `:2334`) instead of leaving the implementer to guess, and
the function's real location (`:2334`, not `:1903-1918`) is named.

**Cost if wrong.** Zero to the algorithm — this is one e2e file's helper placement. But following the
old text would have converted a working vacuity guard into a broken one and still reported "all seven
repointed", which is the worst shape a finding can take: green, and wrong.

## A11's brief amended — the gate step pointed at captures the gate will not produce

Pre-verified A11 while A7 runs. It is a verification-only task, so a defect here costs a dispatch that
reports "captured and open" over an empty directory.

- **Step 4's captures have no path to existing.** `captureVisualReview` returns immediately unless
  `VIGILIA_CAPTURE` is set (`editor.spec.ts:2394`), and the step said to "rebuild, then capture and
  open" five outcomes. Two of them have registered names — `editor-zoom-readout` and, for the
  menu-against-dock comparison, `editor-toolbar` — and three (centring, marquee, group entry) have
  none. Amended: name the two registered ones with the actual `--grep` invocation under the gate, and
  route the other three through the interactive host walkthrough, with the explicit note that inventing
  a capture title in the plan's last commit is not acceptable evidence. Also folded in AGENTS.md's
  PowerShell trap — the `|` in the grep needs the whole pattern single-quoted there — because the
  command as written works in Bash and silently misparses in PowerShell.
- **"The five below" named no names.** The step listed the outcomes as prose and never said which were
  capturable, so an implementer would have discovered this at the end of the gate run.
- **Review Focus item 5 pointed at this task.** "A context menu whose entries disagree with the dock →
  Task 11" — but Task 11 creates nothing and owns no menu code; the menu is Task 9 Step 1, and the
  brief's own Review Focus coverage line already said "item 5 → Task 9 Step 1". The section header was
  the stale half. Amended to Task 9 and cross-referenced to the line that had it right.

Checked and left alone: Step 3's player claim (`packages/player` imports neither `viewport-manager` nor
`editor-shell`) is a readable invariant and `npm run size` is already in Step 1; Steps 1–2's gate
commands and the two phone-chromium measurements are correct; Step 6 stages only `STATUS.md`, which is
all this task writes.

No other Plan A brief is outstanding: 8 and 9 were verified earlier this session and 10 was amended.

## All four outstanding briefs re-verified against the plan they claim to come from

Timestamp sweep across all three workspaces: every brief whose file was older than its plan had a
regeneration owed. Three were stale and one was owed by a plan edit I had just made, so all four were
regenerated and then checked for the amendment's presence by grep.

| Brief | Plan edit it was behind | Amendment found at |
|---|---|---|
| A10 | this session's helper/`selectStarterChart` corrections | the three-helper paragraph and the eight-row site table |
| A11 | this session's Step 4 capture fix and Review Focus item 5 | `task-11-brief.md:37`, `:41` |
| C9 | this session's `artboardScreenRect` mapping fix | `task-9-brief.md:25` |
| C10 | this session's five close-out corrections | `task-10-brief.md:37`, `:47`, `:57`, `:61` |

A7's brief is newer than its plan and correctly untouched while its implementer holds it.

**This sweep is the ledger's one recurring failure mode, and it now has a mechanical check.**
Regeneration is not optional after a plan edit: `task-brief` reads the plan, so a brief left alone
silently executes superseded text, and nothing in the brief says which revision it is. `ls -la` on the
pair is the whole check. All four now carry their plan's mtime or later.

## Doc corrections are held, not committed, while A7 holds the tree

Twelve paths are dirty: the three plans, two specs, three screenshots, and A7's four in-flight files
(`editor-session.ts`, `editor-shell.ts`, `grouping-manager/index.ts`, `shortcut-manager/index.ts`) plus
its new `group-entry.dom.test.ts`.

The docs half is finished work — this session's and earlier sessions' plan/spec corrections, each made
because a pre-dispatch read found the text wrong. It would normally be committed now as one
`docs(superpowers): …` commit. **Held instead**, because staging explicit paths while an implementer is
mid-commit does not protect the index: two writers interleaving `git add` and `git commit` can put one
writer's paths into the other's commit, and the loser's files land under a message that does not
describe them. The window is short and the cost is a confusing, hard-to-attribute commit on a branch
whose history is the record.

They commit the moment A7 reports, before its review package is generated. Nothing is lost by waiting:
the working tree keeps them, and both `git log` and the ledger name them.

Three screenshots (`editor-desktop`, `editor-background-media`, `editor-snap-guides`) are dirty from
re-captures during earlier tasks. They get opened and inspected before they are staged — AGENTS.md
requires selected visual evidence to be seen before it is committed, and a re-captured PNG is exactly
the case that rule is for.

## A7's live diff exposed three stale references in the tasks behind it — a constant Task 6 renamed

Reading the plan against A7's *uncommitted* tree (rather than against HEAD) found something HEAD alone
would not: A7 has already landed Step 5's `view.exit-group` binding — `ProductShortcutId` member,
`CONTEXT_SHORTCUTS` entry, `editor-session.ts` registration — and the plan text around it had not caught
up.

- **`TEXT_ENTRY_DEFERRED_ACTIONS` no longer exists.** Task 6 renamed it to
  `MODIFIED_KEY_DEFERRED_ACTION_IDS` and added `canvas.select-all` (verified in `a0a44ff`'s own diff:
  `-const TEXT_ENTRY_DEFERRED_ACTIONS` / `+const MODIFIED_KEY_DEFERRED_ACTION_IDS`). Three places kept
  the dead name: the Global Constraints rule, Task 6's own ruling paragraph, and A7 Step 5. Fixed all
  three, each keeping the historical name only where the sentence is explicitly about the rename.
- **A7 Step 5's instruction was not just stale, it was wrong.** It said to register Escape *with* the
  deferred set if a focused text field needs it. That set is consulted **only** for modifier bindings,
  and `escape` carries no `modifier` — so membership would change nothing, and the `!binding.modifier`
  branch already defers it. Replaced with the array it actually belongs in (`CONTEXT_SHORTCUTS`, for
  bindings dispatched but never displayed) and an explicit *do not* on the deferred set, plus the reason
  the behaviour is free.
- **"the existing eleven handlers" is eighteen, and was wrong before my edits too** — 18 at `a0a44ff`,
  18 at `HEAD`, 19 with A7's new registration. The count is now removed rather than corrected: Task 3 and
  Task 6 each add registrations, so any number written here decays by design.
- **A7's Files block was missing two files** — `shortcut-manager/index.ts` (Step 5) and
  `tests/e2e/editor.spec.ts` (Step 6) — while Step 7's `git add` omitted `shortcut-manager` entirely. An
  implementer following the block literally would edit a file the task never declared and leave it
  unstaged, which is how a commit lands that does not compile for the next task. Both fixed.

**This is the case the standing ruling was written for.** Two of these (`TEXT_ENTRY_DEFERRED_ACTIONS`,
the Files block) were invisible at HEAD and only readable against the in-flight tree; a task dispatched
from the pre-Task-6 text would have edited a constant that no longer exists.

## A9's test asserted the menu against the function the menu is told to call — the oracle was self-referential

A9 is the task that puts the object actions in a second surface, and Review Focus item 5 is "a menu whose
entries disagree with the dock". Its Step 1 expected set was derived with
`OBJECT_ACTIONS.filter((a) => actionEnabled(gate, a.id))` — which is **the exact call Step 3 instructs the
menu to make**. A menu that ignored the registry and rendered any list produced by `actionEnabled` would
match the expectation built the same way, so the one property the test exists to pin is the one it cannot
fail on. Amended to derive from `action.eligible(gate.target())`, the per-action predicate every registry
entry carries (`object-actions.ts:84-175`), which is an independent oracle: it still asserts what the dock
would enable, but through a different function than the menu uses.

Two more defects in the same fixture, both found by reading the file it cited:

- **`satisfies ActionGate` could not survive the edit it takes.** The comment says the stub is "a full
  `EditorShellBridge`, so passing it as the prop works structurally" — but `satisfies ActionGate` type-checks
  the literal against a **different, two-member** interface, and `satisfies` has the same source-contextual
  typing as a type annotation: the literal's `kind` widens to `string` and no longer matches `ObjectTarget`.
  The comment described the right intent and the code would not have compiled. Amended to annotate `target`
  as `ObjectTarget` and cast the outer object `as EditorShellBridge`, which is what a partial double of a
  thirty-member interface actually is. (This is a *different* case from B10's cast fix, where the cast was
  the defect; here the cast is the honest shape and the narrowing was missing.)
- **The claimed "nine labels" set is right, and the test could not have said so.** Verified against
  `editor-session.ts:231-233`: `getActiveObjects()` includes an `ActiveSelection`, so memberCount is ≥ 2 and
  `!t.isGroup` holds — `group` is ineligible, and unlock/ungroup need flags the fixture does not set. Nine
  the comment named are exactly the nine `eligible` admits. Added `expect(expected).toHaveLength(9)` so a
  menu rendering nothing fails on the count instead of comparing two empty arrays.
- **Step 4's capture instruction had no path to the image**, same as A11's. The grep it names is the dock's
  capture, which is not the menu; amended to say so, to require a non-zero test count, and to route the
  menu check through the host with its own capture and README row landing in this task's commit — the menu
  is a new visible surface and this is the task that creates it.

## A10's site table was cited by line number, and the line numbers had rotated through three separate values

A10 is the coordinate-mapping repair: every e2e point that mixes a canvas-relative `box` with a scene
coordinate. Its site table was rewritten by line number on each of three revisions, and the set measured
**seven**, then **eight**, then **nine** — because A7 and A11 each add e2e cases to `editor.spec.ts`, and
inserting a test moves every citation below it. Rather than correct the count a fourth time, the table is
now **by description, not by line, with the grep named as the only authority**:

```
grep -n 'box\.\(x\|y\|width\|height\)' src/web/tests/e2e/editor.spec.ts
```

Whatever that lists when the task is done is the set; a line-number table would be stale again by the time
the implementer read it. Two more findings came out of the same measurement:

- **The already-correct `artboardScreenRect()` consumers are two, not one.** An earlier revision called
  them "the marquee test", singular, and told the implementer to flatten it. There are two — one in an
  interaction-flags test, one in the marquee test — and flattening either folds the canvas box in twice and
  turns a vacuity guard into one that passes on a marquee that selected nothing. Green, and wrong; the
  exact shape AGENTS.md's teeth rule exists to prevent. The step now names both and forbids the flatten.
- **One `box.x`/`box.y` site is UI chrome, not a scene point.** It reads `viewportTransform` from the debug
  handle and maps `box.x + panX + zoom * x`, so it is already camera-aware. A blanket "map every site"
  instruction would have "fixed" a correct block. The step now carves it out by description.
- **The last two rotted citations were removed by name, not renumbered**: `selectStarterChart` cited at
  `:2334` is at `:2495`; `setThemePackage` cited at `:2043` is at `:2449`; and the step referenced an
  `openStarterTheme` helper that exists nowhere in the repo. Each is now given by symbol with the note that
  the line has moved and that tests needing a different scene call `setThemePackage(page, name, envelope)`.

**Ruling: every citation into `editor.spec.ts` from here on is by symbol or by grep, never by line.** Three
tasks write to that file and each one moves the others' citations; a line number there has a half-life of
one dispatch. Cost if wrong: an implementer edits the wrong block in a file where a wrong edit is a green
false pass, which is not visible in a test run and only shows up in a review of the diff.

**A10 brief regenerated and verified after this round** (289 lines). A8 and A9 hold up unchanged; A10 and
A11 are the two amended this session.

## A7's Files block named a file it does not edit, and omitted the file that binds the event

Found while reading the in-flight implementer's tree, which is what makes it worth recording that the brief
had already been pre-verified once: the defect was not in the prose, it was in the **file list**, and a file
list reads as boilerplate right up until Step 7 commits from it.

- **`editor-interaction.ts` is listed as "Modify" and no task step edits it.** Widening `GroupingManager`
  flows through it — `editor-interaction.ts:46` only *consumes* the interface — so an implementer following
  the block hunts for an edit that does not exist. Removed.
- **`editor-shell.ts` was in neither the Files block nor Step 7's `git add`.** It is the only place the
  canvas and the managers coexist, so it is where `canvas.on("mouse:dblclick", …)` for `enterGroup` has to
  be bound and unbound (`destroy`), and the in-flight tree has exactly that edit. A literal Step 7 stages
  five paths and leaves the sixth dirty: the commit does not compile for Task 8, and the failure surfaces
  one task later in someone else's dispatch. Added to both.

This is the second instance of the same defect class in this task — the `shortcut-manager` omission fixed
earlier — and both were found by comparing the brief against a tree rather than against itself.

**Ruling: a task's Files block is verified against its own steps before dispatch, and any path its steps
write must appear in both the block and the `git add`.** Cost if wrong: an unstaged edit that compiles
locally and breaks the next task's base commit, which no test in the offending task can catch.

## A8's prose and A8's own test disagreed on how much the context marks

The step's test asserts `data-context="true"` on three rows — `group`, `child` and the negative case
`other` at `"false"` — and the guarding sentence said "Mark **the owning group row** `data-context="true"`
and give rows outside the context a muted style." An implementer doing exactly that fails the test in the
same step: `child` is inside the context and would stay unmarked. This is the class where the plan is
self-contradictory rather than merely vague, and the fix is the one-line narrowing of "the owning group
row" to "every row inside the current context — the group *and* its descendants".

The correctness argument is the test's own comment: entering a group is precisely what makes its children
individually selectable, so the mark has to cover them or it marks nothing the user acts on.

Two line citations in the same step were checked against source and hold: `bridge.ts:77` is `notify` and
`:85` the `canvas.on(event, notify)` subscription, and the `layer-panel.tsx` store reads are at `:42`
(`this.#rows = bridge.layers()` at setup) and `:43-45` (the subscribe callback), with the cached `#rows`
field at `:34` and `get` at `:67`. The step's own parenthetical already flags two earlier off-by-ones in
that range, so this one is now the third value written there and the only one that matches.

**Ruling: where a step's prose and its test disagree, the test wins and the prose is corrected — never the
other way round.** A test is executable and a sentence is not; the implementer runs the test, and the
sentence is what they will edit to make it pass. Cost if wrong: the implementer weakens the assertion to
match the prose, and the one property the step exists to pin is gone with a green suite as the evidence.

## A7's teeth checks could not bite, and one of them named a test that never runs the code

Both "verify by breaking it" instructions in Step 6 were wrong in the same direction: each named a witness
that is green under the break.

**Check 1 — "drop the post-restore re-apply and the `Control+z` step fails."** It does not. `childLeft` is
read off `canvas.getObjects().find(o => o.id === "grp").getObjects().find(o => o.id === "child").left` — a
property of an object the *scene* rebuilt on undo, so it returns `before` whether or not the context
re-resolved. And the two assertions that follow are by `id`, which a revived object keeps: a context still
holding the **pre-undo, detached** instance satisfies `active === "grp"` just as well as a re-resolved one,
and `groupPresent` reads the revived canvas either way. So the whole test passes with Step 5's re-apply
deleted, which makes the re-apply look optional when it is the task's Review Focus item 4.

Fixed by adding the identity check that can distinguish them: after Escape,
`expect.poll(() => getObjects().includes(getActiveObject())).toBe(true)`. For a one-object selection Fabric
sets `activeObject` to that object, so identity *is* observable through the bridge's public surface, and
`exitGroup`'s `setActiveObject(target)` is the only path that reads the group off the canvas. The plan now
says to verify this one by actually breaking it, in those words.

**Check 2 — "remove the context-clearing in `ungroup()` and the undo case fails."** The Step 6 test never
calls `ungroup()`. A change confined to `ungroup` cannot redden it, so an implementer who broke `ungroup`,
watched the test stay green, and did not think to question the instruction would conclude their correct fix
was ineffective. Repointed at the unit test's own `expect(manager.exitGroup()).toBeUndefined()`, which is
what actually fails.

**The generalisable shape: a teeth check is itself a claim, and it gets verified only by breaking the code.**
Both of these were written from "what would go wrong" rather than from "what does this test read", and the
gap between those is exactly where a green-for-the-wrong-reason test lives. Cost if wrong: the task ships
with its central guard unproven, and the evidence that it is unproven is a passing test run.

## Dispatch readiness — Plan A, all briefs regenerated and verified

| Task | Brief | State |
|---|---|---|
| 1–6 | — | **Complete.** A6 fix rounds 1 (`49080b0`) and 2 (`aad9d5f`) closed. |
| 7 | `task-7-brief.md` (276 lines) | **In flight**, implementer `aba7a8c5ba8a51c07`, BASE `aad9d5f`. Two corrections sent mid-flight: the Files block (`editor-shell.ts` added, `editor-interaction.ts` removed) and Step 6's teeth checks. |
| 8 | `task-8-brief.md` (80 lines) | Verified. Amended this session: the context mark covers the group **and** its descendants. Depends on UI-polish Tasks 1–6 (registry + layer panel). |
| 9 | `task-9-brief.md` | Verified. Amended earlier: the eligibility oracle is `action.eligible(...)`, not the self-referential `actionEnabled(...)`; `toHaveLength(9)`; Step 4's capture is gated and the menu's own capture lands in this task. |
| 10 | `task-10-brief.md` (289 lines) | Verified. Amended this session: the site table is by description with the grep as sole authority; two already-correct `artboardScreenRect()` consumers named; the UI-chrome site carved out; the last two rotted citations removed by name. |
| 11 | `task-11-brief.md` | Verified. Amended earlier: Step 4's gated capture command, the PowerShell quoting trap, Review Focus item 5 repointed from Task 11 to Task 9. |

**Every brief in this plan has now been read against source and regenerated from the current plan.** The
amendments above are committed to the plan file, not just to the briefs, so a regeneration reproduces them.

## A9's "nine labels" is right, verified independently — and its line range was not

The nine-label claim in A9 Step 1 is the load-bearing one (`expect(expected).toHaveLength(9)` exists so a
menu rendering nothing fails on the first line rather than comparing two empty arrays), so it was re-derived
from the registry rather than trusted. Parsing every entry of `OBJECT_ACTIONS` and evaluating each
predicate against the fixture target `{kind:"object", locked:false, memberCount:1, isGroup:false}`:

```
eligible   duplicate, copy, cut, front, bring-forward, send-backward, back, lock, delete   → 9
ineligible unlock (needs t.locked) · group (needs memberCount>1 && !isGroup) · ungroup (needs t.isGroup)
```

Twelve entries, nine eligible — the comment's named set is exactly right, and the three exclusions it names
are the three the predicates exclude. No amendment needed.

**The line range in the same comment was wrong.** `object-actions.ts:84-175` cites 92 lines for an array
that runs `:81-174`, and this is the third range citation into that file I have found rotted — the array
moved when entries were added, so any reader following it lands past the beginning of the array. Replaced
with the symbol: "the `OBJECT_ACTIONS` array". Cost of leaving it: an implementer greps the range, finds the
last three entries only, and concludes the registry has three actions — on the one step whose whole point is
that the registry is the independent oracle for the menu.

**Ruling (already in force, now with a fourth instance): citations into a file another task edits are given
by symbol, never by line.** Both files this rule has been applied to — `editor.spec.ts` and
`object-actions.ts` — are edited by multiple tasks in this plan.

## I raised a false finding against correct guide-renderer code, and caught it before dispatch

The spec claims the guide renderer is "zoom-aware already and needs no change" because it divides guide width
by zoom. Reading `guide-renderer.ts` I saw that `drawSpacingGuide` strokes at `:142` without assigning a
`context.lineWidth`, and that `renderSnappingGuides` had a `context.save()`/`restore()` pair at `:32`/`:43` —
so I concluded spacing guides were stroked outside the width-setting block, inheriting the restored width,
and wrote a new Step 1b asserting a real defect with "finding it is the expected outcome rather than a
surprise."

**It was wrong, and the file itself said so on the next read.** `drawSpacingGuides` is called at `:41`, which
is *inside* the block: the sequence is `save()` `:32` → `transform` `:36` → `lineWidth = GUIDE_WIDTH / zoom`
`:37` → `drawLineGuides` `:40` → `drawSpacingGuides` `:41` → `restore()` `:43`. The spacing pass already has
the right width and the right transform, and the spec's "needs no change" is correct.

Step 1b is rewritten to the true position: the spacing pass **inherits** its width, and the invariant worth
pinning is that it stays inside the transformed block. The teeth check is now "move the `:41` call below the
`:43` restore and watch the test fail" — which does bite, because that move is the real regression. The
original instruction would have sent an implementer to write a failing test for behaviour that already works,
and then to "fix" working code to satisfy it. That is the most expensive false finding there is: it does not
merely cost a round, it damages the code.

**This is the third false finding this session** (B9's quoted capture title; the `openStarterTheme` line;
this one), and the pattern is identical each time: I reasoned from the shape of two anchors I had seen
(`save`/`restore`, `stroke` with no width) without reading the lines between them. The probe that would have
settled it is one `sed -n '28,48p'` — which is exactly what I ran, one step too late.

**Ruling: before writing a step that asserts a defect, read the enclosing function in full — not the lines
that suggest the defect.** Cost if wrong: an implementer modifies correct code to make a fabricated test
pass, and the change is invisible in review because the new test "proves" it was needed.

## Task 7: complete — `fb3aa92` (implementer `aba7a8c5ba8a51c07`, BASE `aad9d5f`)

Committed `fb3aa92` — `feat(editor): enter and exit a group from the canvas`, 11 files, +468/−23. Files:
`grouping-manager/index.ts` + new `group-entry.dom.test.ts`, `canvas-nudge.ts` + its two test doubles,
`editor-shell.ts`, `editor-session.ts` + `editor-session.dom.test.ts`, `shortcut-manager/index.ts` + its dom
test, `tests/e2e/editor.spec.ts`, `STATUS.md`. `editor-interaction.ts` correctly untouched.

Implementer's evidence: `npm test` 1330/1330 pass across 125 files; e2e "enters a group" pass; typecheck,
lint, format:check, build, status:check all clean; full report at `task-7-report.md`.

**Both teeth checks reproduced red, and check 1 reddened on the *correct* witness.** Dropping the
post-restore re-apply failed the `inCanvas` identity poll (`Expected: true, Received: false`, 5000ms
predicate timeout) — the assertion the mid-flight correction added, and the only one that separates a
re-resolved group from the destroyed instance. The implementer also confirmed, unprompted, that the
*obsolete* `Control+z` witness stays green under that same break, exactly as the correction predicted.

**Three real defects the brief had, found by the implementer and now fixed in the plan:**

1. **A single double-click could never resolve to the child.** Fabric hit-tests *before* the handler runs and
   a group is opaque to the pointer until `subTargetCheck`/`interactive` are on, so the entering gesture's
   own target is always the group. `enterGroup` now takes the event's `scenePoint` and re-resolves the
   deepest target after arming — which is what the spec's own wording ("selects the child under the
   pointer") requires. The brief's unit test never caught this because its second `enterGroup` call runs
   with the flags already on. Step 3 now states the order and the optional `scenePoint` argument.
2. **Step 6's fixture was broken three ways**: a raw `fill` with no `vigiliaPaint` is rejected by the
   validator; a Group with no `width`/`height` revives 0×0 so its `aCoords` collapse to a point and no
   target is ever found; and `toBeTypeOf` is Vitest's matcher, absent from Playwright's `expect`. All three
   corrected in the plan's fixture, and the `toBeTypeOf` fix applied to **both** sites (Task 6's test had it
   too).
3. **Step 1's `new Group([child], { id })` does not typecheck** (`id` is not a `Partial<GroupProps>` key) and
   its second test was internally inconsistent — its comment said "activate it before entering" while the
   fixture never did, so `ungroup()`'s Group precondition failed. Both fixed; `canvas.setActiveObject(group)`
   is now present.

**Task 6's latent nudge bug, confirmed independently before this entry was written.** `canvas-nudge.ts` read
`getCenterPoint()` (canvas plane, mapped through the group) and wrote `setPositionByOrigin` (local plane), so
`ArrowRight` on a grouped child moved it to `left: 41` instead of `1`. Fabric's own typings settle it:
`ObjectGeometry.d.ts:306` documents `getCenterPoint()` as "relative to canvas" and `:311`
`getRelativeCenterPoint()` as "relative to it's parent". Fixed to `getRelativeCenterPoint()`; identical for
unparented objects, which is why Task 6's tests could not have caught it. Plan gained Step 3b and the three
files joined A7's Files block and `git add`.

## Ruling: Task 7 skips its task review — the user stopped the session here

The review package was generated (`review-aad9d5f..fb3aa92.diff`, 1 commit, 34,823 bytes) and the user then
stopped the session: *"Stop after this task is finished and check it in. No need to run the full suites."*

**Ruling: Task 7 is marked complete on the implementer's evidence, with no task-review gate.** The standing
process says never skip the task review; the user's instruction overrides it, and the alternatives are both
worse — reviewing now contradicts a direct stop, and re-dispatching A7 in the next session would rebuild a
tree that is already committed and green. Cost if wrong: A7 ships with only its implementer's judgement
behind it. The mitigation is that its diff is the *first* thing the next session's reviewer sees, and that
Task 8 consumes `groupContext()` directly — a wrong signature or a leaked flag fails loudly and immediately
in the next task rather than silently.

**The three corrections above are compensating evidence, not a substitute for review.** They were made
against the committed tree and are the classes a reviewer would hunt for. What remains genuinely unreviewed:
the `scenePoint` interface widening (it is a new optional argument the plan never specified), and whether
`onHistoryLoaded`'s `flagsSet.clear()` leaves an author's own flags stranded.

## Resume point

**Plan A: Tasks 1–7 done (1–6 + two fix rounds, 7 at `fb3aa92`). Tasks 8–11 pending, all briefs regenerated
and verified.** Next dispatch order, locked by ruling: **C4+C5 as one unit first** (the snapping plan's
standing "dispatch immediately when A7 commits"), then **B8**, then the remaining Plan A tasks.

`STATUS.md` is at `fb3aa92`'s text and `npm run status:check` passes. Working tree clean at `3f4d49e`.

## CORRECTION to the ruling above: Task 7's review DID run

The section immediately above says Task 7 skips its review because the user stopped the session. That
entry was written at the stop and then contradicted by what actually happened: on resumption the review
was dispatched and completed. **The ruling above is void — do not cite it.** The record below supersedes it.

## Task 7 task review: Spec ✅ compliant, quality Approved, one Important finding

Reviewer dispatched on `aad9d5f..fb3aa92` with the regenerated brief (hash `d0ecdfbaab2509ce`, identical to
the one the implementer worked from) and the report. Verdict: **spec compliant** — all seven files in the
Files block have their hunks; `editor-interaction.ts` correctly untouched. **Task quality: Approved.**

Reviewer's named-risk checks, all clean, recorded because they settle questions the plan left open:
`ProductShortcutId` has no display registry, so `CONTEXT_SHORTCUTS` is safe; `ownerGroup = object.parent`
holds against `Group.mjs:230/:254` and `ActiveSelection.mjs:79`; the e2e identity assertion holds against
`SelectableCanvas._setActiveObject`; `SelectableCanvas.mjs:565-585` independently confirms the `scenePoint`
re-resolution reasoning the implementer derived.

**The Important finding is real. I verified it end to end rather than trusting the report:**

- `Group.toObject` (`fabric/dist/src/shapes/Group.mjs:375-384`) spreads
  `super.toObject(["subTargetCheck", "interactive", ...])` — both flags are forced into the output
  unconditionally, on every Group, armed or not.
- `Group.ownDefaults` (`:25-26`) is `subTargetCheck: false, interactive: false`, and
  `persist.ts:58` sets `includeDefaultValues = false`, which strips only values **equal to their default**.
  An armed `true` is a non-default and therefore survives.
- `SCENE_PERSISTED_PROPERTIES` is an allow-list of *extra* keys, and `removeRuntimeText` is the only
  post-serialise walk — it strips sampled text and nothing else. **There is no key filter.**
- `flagsSet` is transient and empty at serialise time, so `clearThroughFlags()` cannot help there.

So: an author who double-clicks into a group and saves persists both flags, and the reopened document has a
group that is permanently pointer-transparent — clicking inside it selects the child and bypasses the layer
tree's own rule. That is §67 violated by a code path this task created.

**Ruling: fix it, in `persist.ts`, as a strip-at-serialise.** Not in `shell.snapshot()` — `snapshot` is a
read path as well as a save path (`editor-session.ts:439` and `:466` return it from public methods), so
clearing the group context there would silently drop an author out of their group on a read. The strip
mirrors the existing `removeRuntimeText` recursion: delete `subTargetCheck` and `interactive` from every
object in the serialised tree, `Group` or not — Fabric only ever forces them in from `Group.toObject`, so
delete-if-present needs no type test and cannot miss a nested group.

Three facts make the strip safe rather than a behaviour change: Fabric's own default for both is `false`, so
stripping restores exactly what an author authored; the flags have **one writer**, the grouping manager
(`grouping-manager/index.ts:54-63`, `:131-132`), with `fabric-nodes.ts:194-195` only seeding the default;
and the serialiser's own docblock (`persist.ts:32-36`) justifies persisting `selectable`/`evented`/`locked`
precisely because they are *authored*, which these two are not.

**The sibling test is a tripwire that must be inverted, not deleted.**
`persist.dom.test.ts:243-268` ("lets them straight back in once the editor enables group entry") pins the
exact persisted key list *including* both flags, with a comment saying it exists so the leak "arrives as a
failure naming the keys, in the commit that causes it". It came from `9067a96`, which predates this task.
It worked exactly as designed. The fix rewrites that case to assert the flags are absent **even when armed**
— which is a real regression test: it fails the moment the strip is removed.

**Cost if wrong.** The strip is about six lines and one rewritten test case. If some future feature ever
wants an authored through-selectable group, it needs a different mechanism than a runtime flag — but that
feature does not exist, the spec's Group entry acceptance is one level and says nothing about it, and
persisting editor state into a portable file is the failure this branch was already warned about once.

## Two plan-text claims this review proved false — correct both

1. **`docs/superpowers/plans/2026-09-25-editor-viewport-and-mechanics.md:1105` is wrong**, and the reviewer
   repeated it as a ⚠️. The paragraph asserts the `getCenterPoint()` + `setPositionByOrigin(..., "center",
   "center")` pairing in `arrange.ts` is the idiom and warns not to "fix" it — but it is cited in a *nudge*
   context, and the arrangement it describes cannot be reached for a grouped child at all:
   `applyArrange` returns false unless `active instanceof ActiveSelection` (`arrange.ts:24`) and `canArrange`
   at `:50` does the same, and `move()` is reached only from `distribute()` over `active.getObjects()` —
   members detached from any group. So `arrange.ts` is **correct** and needs no change; the defect class the
   reviewer flagged there does not exist. Add the guard to the paragraph so the next reader does not
   re-raise it.
2. **`:1455` overstates its own safety claim.** "Setting them is safe only because you restore them" is true
   of exit and undo, and false of the save path — which is the finding above. Amend it to name the third
   path and point at the strip.

Both are corrections to *current* doc truth, and the second is the rationale for the fix, so they land with
the fix commit rather than separately.

## A7 fix round 1 dispatched — implementer `a60027ec4fed41312`, BASE `7f51e20`

Plan corrections committed first as `7f51e20` (`docs(plans): correct the flag-leak claim and the
arrange/nudge citation`) so the fix branch does not carry a docs diff in its review package; the brief was
regenerated after that commit (`d0ecdfbaab2509ce` → `7808900192725a63` — the change is exactly the two
corrected paragraphs, which is the hash check doing its job).

Round scope, deliberately narrow: strip `subTargetCheck`/`interactive` in `persist.ts` beside the existing
`removeRuntimeText` walk; rewrite `persist.dom.test.ts`'s tripwire case at `:243-268` to assert absence
*while armed*; teeth check = comment the strip out and confirm that case goes red naming both keys. No full
suite, no build, no e2e — the user's instruction and the fact that a gate task owns those. Focused vitest
plus `typecheck` and `format:check` are this round's proof.

## Ruling on Task 7's five Minors: all five parked as accepted, none folded into fix round 1

None is load-bearing for the Important finding, and folding unrelated edits into a fix round is how a
verified fix becomes an unverified one. Each is parked with what it would take:

1. **`grouping-manager/index.ts:86` — the `editor:history-state-loaded` listener is never removed.** Real,
   but the `GroupingManager` interface has no teardown at all (no `destroy()`), while the `mouse:dblclick`
   listener *is* removed via the shell's own `destroy()`. Fixing it properly means adding a teardown to the
   manager's interface and calling it from the shell — a small interface change, not a one-liner. Parked.
2. **`grouping-manager/index.ts:177` — `groupContext` returns the live `context` array.** One-line fix
   (`[...context]`). Parked only because nothing mutates the returned array today: every caller in
   `editor-session.ts:392-393` reads it. Fix it in the first task that adds a mutating consumer.
3. **`grouping-manager/index.ts:148,159` — a plain top-level object is recorded as the context.** So Escape
   after double-clicking a *non-group* pops it and re-selects the same object: a no-op that still fires
   `selection:created`. Harmless today (it re-selects what was already selected) but it means the context
   means "the object to restore", not "the group stack". Parked; if a later task reads the context as a
   group stack, gate the record on `entry instanceof Group`.
4. **Nested entry stops at one level.** Latent, and **not in scope**: the spec's Group-entry acceptance
   (`specs/2026-09-25-editor-viewport-and-mechanics.md:81`) is one level — "Double-click enters a group and
   selects the child under the pointer; Escape steps back out" — and says nothing about entering a group
   inside a group. The array return type suggests more than the implementation delivers, but no acceptance
   item asks for it. Parked; if nested entry is ever wanted it needs a spec line first, not a silent plan
   amendment.
5. **`shortcut-manager/index.ts:66` — `[...PRODUCT_SHORTCUTS, ...CONTEXT_SHORTCUTS]` allocates per keydown.**
   Real but negligible: two small array spreads on a keydown, not a hot loop. Hoist to module scope in the
   first task that touches that file.

**Cost if wrong.** Minor 1 and 3 are the ones that could bite: a never-removed listener on a manager that is
created once per editor, and a context that reads as a group stack but is not one. Both are bounded by the
editor's own lifetime today — the manager is a singleton for the session, so the listener cannot accumulate,
and the no-op Escape re-selects what was already selected. Neither can lose authored content.

**Where each parked Minor would be reachable, so a later session does not have to re-derive it.** Both
files have exactly one later owner each, and both are **already-committed** tasks (A6 at `:965` for
`shortcut-manager/index.ts`, A7 at `:1333`/`:1337` for both) — so nothing pending in this plan touches
either file again. There is no future step to fold these into without inventing one.

That changes the disposition from "fold into the owning task" to a choice, and the choice is: **accept them
as they are, or make them a small dedicated cleanup commit.** They are all sub-ten-line changes. Nothing
below Plan A Task 11 owns these files, and Plans B and C do not list them at all, so a cleanup commit is the
only route if they are to be fixed at all. Deferring this decision costs nothing today; the ledger records
which is which, so it can be made once, deliberately, rather than by drift.

**Reachability check, done rather than assumed:** `grep -ln` for each filename across all three plans
returns the viewport plan only, and the grep for the actual `Modify:` lines returns A6 and A7 — both closed.

## A7 fix round 1 landed — `8292477`. Scoped re-review dispatched (re-reviewer `a1682948ce104a5e5`)

Commit `fix(scene-fabric): strip group-entry flags from a saved scene`, 3 files, +38/−20: `persist.ts`,
`persist.dom.test.ts`, `STATUS.md`. Attribution line present, single commit, the amended-message concern was
real (a literal `@` line from a PowerShell here-string) and is resolved.

**I verified the diff against my own ruling before dispatching the re-review, rather than forwarding the
implementer's summary.** The added walk is exactly what the ruling specified:

```ts
function removeGroupEntryFlags(
  objects: readonly Readonly<Record<string, unknown>>[],
): void {
  for (const object of objects) {
    delete (object as Record<string, unknown>)["subTargetCheck"];
    delete (object as Record<string, unknown>)["interactive"];
    const children = object["objects"];
    if (Array.isArray(children))
      removeGroupEntryFlags(children.filter(isRecord));
  }
}
```

Called at `persist.ts:71`, immediately after `removeRuntimeText(scene.objects)`. Recursive, delete-if-present,
reuses the file's own `isRecord` and mirrors the existing walk's shape. **It did not take the ruled-out route**
— `shell.snapshot()` is untouched, so a read of the envelope still cannot drop an author out of their group.
The serialiser docblock gained the contrast paragraph the ruling asked for (`persist.ts:38-42`), and it is
accurate: it names `includeDefaultValues = false` as unable to help *because an armed `true` differs from
Fabric's `false` default*.

**The tripwire was inverted into a stronger test than I specified.** I asked for absence-while-armed; the
implementer wrote an exact-key-list assertion (`persist.dom.test.ts:244-266`, renamed "strips them again when
a save happens while the editor has group entry on") — the same technique the original tripwire used, so it
also catches a *new* key appearing. That is better than two `not.toContain`s.

**Reported evidence:** 31 passed / 0 failed on `persist.dom.test.ts`; red when the strip is commented out,
naming both keys; green restored; typecheck, format:check, lint, status:check all clean.

**Review packaging correction worth keeping:** the first `review-package fb3aa92 8292477` swept in
`3f4d49e` — the docs commit carrying three binary screenshots — producing a 328,245-byte package for a
one-commit fix. Repackaged as `7f51e20..8292477` (9,269 bytes). **The lesson generalises: BASE for a fix round
is the head the previous review saw OR the last commit that touched the same subsystem, whichever is later —
`fb3aa92` was the review's head, but the docs commit sat between it and the fix.** Pick the base that makes
the package the fix and nothing else, and delete the bad package rather than leaving two on disk for the
final review to mis-pick.

**Implementer's own stated limits, carried forward rather than silently dropped:** the fix is proven at the
serialisation unit boundary only, with no browser save-while-inside-a-group evidence (scope assigned that to
the gate task); and the strip was exercised against a plain `Group`, not a chart nested inside an entered
group — the recursion is shared with the already-covered `removeRuntimeText`, so the risk is low, but it is a
real coverage gap and Plan A Task 11's gate is where it closes.

## Task 7: COMPLETE — `8292477` (fix) on `fb3aa92` (feature). Re-review verdict: all findings addressed.

Re-reviewer `a1682948ce104a5e5`, scoped to the fix diff `7f51e20..8292477`. Verdict: **"All findings addressed,
no new Critical/Important breakage."** The Important finding is **ADDRESSED**, and the re-reviewer confirmed
the ruled-out route was not taken by checking `editor-shell.ts:394-410` directly rather than trusting my
summary. It also independently re-derived the only-writer claim by grep and added two facts I had not:

- `_removeDefaultValues` keeps any value `!== baseValue` (`shapes/Object/Object.mjs:1056-1065`), which is the
  mechanism behind "an armed `true` survives" — stronger evidence than my own reading of `Group.mjs` alone.
- `interactive` is not a property of any non-`Group` Fabric class (`shapes/Object/defaultValues.mjs:78-108`
  has no such key), so the blanket delete cannot clobber an invented key on another type.

Teeth check **CONFIRMED as genuinely load-bearing** by reading the code path, not the claim: with the strip
disabled both keys differ from the `false` defaults, so default-stripping keeps them and `toEqual` fails. The
re-reviewer also validated the test count arithmetically (25 `it`/`it.each` sites, one `it.each` expanding
7 → 31). Commit hygiene clean: `rev-list --count 7f51e20..8292477` = 1, correct parent, trailer present.

**One out-of-scope observation I acted on rather than parking**, because AGENTS.md makes it a rule rather
than a preference: "propagate a changed decision to contradictory current docs/tests together." Two plan
paragraphs still asserted `persist.dom.test.ts` "cannot catch a leaked flag" / "cannot go red from a leaked
flag" because its cases build their own fixtures. True before the strip, false after it. Corrected in
`3631900`, with the fixture point kept in weakened form (the test pins the serialiser's contract, not the
gesture — Step 3's assertions still hold the gesture side). The re-reviewer's line citation for the second
one (`:160`) was wrong — that line is pan-constraints — so I located the real sentence by grep before editing.

**A7 is closed.** Feature `fb3aa92`, fix `8292477`, docs corrections `7f51e20` + `3631900`. Two Minors-class
coverage gaps remain open and are assigned to Plan A Task 11's gate: no browser save-while-inside-a-group
evidence, and the strip's recursion not exercised against a chart nested in an entered group.

## RESUME POINT (supersedes the one written earlier — the earlier one is stale)

**Plan A: Tasks 1-7 COMPLETE.** 1-6 plus two fix rounds; Task 7 feature `fb3aa92` + fix `8292477`, both
reviewed, with docs corrections `7f51e20` and `3631900`. **Tasks 8-11 pending**, all briefs verified
hash-stable against the committed plan.

**The locked dispatch order is now in motion:** A7 → **C4+C5 (dispatched, implementer
`a9ae32ea012cbf399`, BASE `3631900`)** → **B8** → the remaining Plan A tasks. Recorded here as well as in
the snapping ledger because a session that reads only this file must still know C4+C5 is already out and
must not re-dispatch it.

**Do not re-dispatch A7.** It is complete at `8292477` and its review loop closed clean.

Open at the next gate (Plan A Task 11): the two coverage gaps from the flag-strip fix — no browser
save-while-inside-a-group evidence, and the strip's recursion not exercised against a chart nested in an
entered group.

## Task 8 pre-dispatch verification: clean, and its load-bearing dependency is already satisfied

A8 is the next dispatchable task in this plan (A1-A7 complete; A8 consumes A7's `groupContext()` and the
UI-polish plan's Task 5 `LayerPanel`). Verified against current source before dispatching.

**A8's one load-bearing constraint is already met by shipped A7.** A8 argues at length that `enterGroup` must
record the context **before** it changes the active object, because `setActiveObject` fires `selection:created`
synchronously and the bridge re-reads the tree on it — a context recorded afterwards is one render late, and
A8's own browser check would then see an unmarked tree. It offers a conditional: *"If Task 7 shipped with the
record after the selection change, fix it there."* **It did not.** `grouping-manager/index.ts` records
`context = [entry]` at `:158` and calls `setActiveObject(selected)` at `:159`, with a comment at `:156-157`
stating the identical reason. So no fix is owed and A8 does not need to compensate in the panel. This closes the
open item A8's brief raised rather than leaving it to a reviewer to discover.

**Every citation checked, and the brief self-corrects two of its own inline — both corrections are right.**

- `layer-panel.dom.test.tsx:9` is `function bridge(rows, overrides = {}): EditorShellBridge`, spreading
  `...overrides` before the closing cast. Exact, and it is why the brief can say the test compiles once the
  member exists.
- `bridge.ts` — the brief says its earlier cite `:74-79` was the `createEditorShellBridge` signature into
  `notify` and that `:85` is the subscription. Both halves confirmed: `:74-76` is that signature and `notify`'s
  definition, and **`canvas.on(event, notify)` is the loop at `:85`**. The events array is
  `["selection:created", "selection:updated", "selection:cleared"]` (`:80-84`), so `setActiveObject` really does
  notify synchronously through a subscription that already exists.
- `layer-panel.tsx:28-31` is the "cached rather than rebuilt per `getSnapshot`" rationale with the `Object.is`
  reason, `:34` is `#rows`, `:67` is `readonly get = ()`. The brief's original `:42-45` read is corrected inline
  to `:41-45`, and the true split is `:42` (`this.#rows = bridge.layers()`) and `:43-45` (the subscribe
  callback) — the correction is right.
- `bridge.dom.test.ts:212-217` is `it("selects a group child through its owning group, not the child")`,
  asserting `expect(setActiveObject).toHaveBeenCalledWith(group)` over a real `Group`+`Rect` via `bridgeFor`.
  Live, and exactly the assertion A8 says a bare "select the child" rewrite would turn red.
- `bridge.ts:150` is `canvas.setActiveObject(ownerOf(root, id) ?? target)` with the "child is selected through
  its owning group" comment at `:147-149`. The brief's original `:144` read is the `const root = ...` three lines
  above, as its correction says.

**Ruling: no plan edit for A8.** Its citations are exact now, its two stale line reads are corrected in place,
and its ordering dependency is verified satisfied rather than merely hoped for. Cost if wrong: an implementer
re-greps two already-corrected references.

**Not dispatching A8 yet, and this is a deliberate hold rather than a stall.** A8 writes
`editor-shell/bridge.ts`, `editor-shell/layer-panel.tsx` and their DOM test — files in the **Plan B** package
that B8's reviewer is currently reading and that a B8 fix round could touch. The standing exception permits one
writer at a time unless file sets are **provably disjoint** and the earlier implementer has already committed;
neither condition holds against an in-flight Plan B review. C6's implementer (Plan C, `snap-manager/scaling/**`)
is running and is disjoint from B8's files, which is why that dispatch was permitted. A8 goes out as soon as
C6 reports, in parallel with B8's review if that is still open — A8 vs B8's reviewer is disjoint the same way.

## Task 8: dispatched

Commit landed as `e66b854`; BASE for this task is `abd5713` (the branch tip after C6 committed). Implementer
dispatched on `sonnet` with the brief at `.superpowers/sdd/2026-09-25-editor-viewport-and-mechanics/task-8-brief.md`,
report to land at `task-8-report.md`.

The dispatch carries four pre-resolved decisions: Task 7 already shipped the record-before-`setActiveObject`
ordering so there is nothing to fix there and no compensating listener is to be added; the two `groupContext`
signatures (objects from the manager, ids from the bridge) must not be blurred and anonymous objects get no
mark; the existing `bridge.dom.test.ts` group-resolution assertion must keep passing so the new branch is *only*
"the child's group is the current context"; and `data-context="true"` goes on the group **and its descendants**,
because the brief's own test asserts both rows.

**One-writer rule: three agents are now in flight.** B8's fix round (resumed implementer) writes
`artboard-panel.ts`, `editor-shell/controls/**`, `ui-copy.ts`, `editor-shell.css`. C6's task reviewer is reading
`snap-manager/scaling/**`. A8's implementer writes `editor-shell/bridge.ts`, `editor-shell/layer-panel.tsx`,
`editor-shell/layer-panel.dom.test.tsx`. A8's set is disjoint from both B8's and C6's — different files in the
same `editor-shell/` directory, no shared path — and C6's agent is read-only by its own contract. Cost if wrong:
A8's diff and B8's fix round both touch `editor-shell/`, so a rebase or re-verify, and C6's review verdict is
invalidated and re-run.

## A8's recorded BASE is contradictory — resolve it from A8's own commit, not from the ledger

Two entries in this ledger disagree. The "Task 8: dispatched" section says *"BASE for this task is `abd5713`
(the branch tip after C6 committed)"* and then names `e66b854` in the same paragraph, while the later
standing-constraint entry says A8's implementer was dispatched at BASE `22639a3`. Both cannot be true, and the
difference is not academic: `abd5713` predates B8's task commit (`e66b854`), B8's fix round (`22639a3`) and B9's
commit (`66506e6`), so a package built as `review-package … abd5713 HEAD` would carry **three commits belonging
to two other plans** under A8's name — exactly the packaging error already made once this session.

A8 had not committed as of `66506e6`, so there is nothing to re-package yet. **Ruling: do not trust either
recorded BASE. When A8 reports, derive it as `git rev-parse <A8's first commit>~1`** — the fix-base rule already
standing in the snapping ledger — and verify the resulting package holds exactly A8's commits and only its files
(`editor-shell/bridge.ts`, `editor-shell/layer-panel.tsx`, `editor-shell/layer-panel.dom.test.tsx`) before the
path is named in any dispatch. If A8 made one commit, BASE is simply its parent.

**Cost if wrong:** an oversized package that shows a reviewer three unrelated commits and invites findings
against other plans' code — which is how the earlier 328,245-byte packaging error was caught, by size alone.

## A8's edit to `shell-layout.dom.test.tsx` inspected — necessary, not overreach, and no B10 collision

`git status` showed A8 modifying a file outside its brief's three. I read the diff before drawing any
conclusion. It is **one added line** — `groupContext: () => [],` at `shell-layout.dom.test.tsx:47` — inside
`bridgeStub`'s stub object, immediately after `layers: () => []` at `:46`.

That is exactly what A8's brief requires: A8 adds `groupContext` to `EditorShellBridge`, and `bridgeStub` is a
full-object literal (not a cast), so without the member the file stops compiling. The brief's own
`layer-panel.dom.test.tsx:9` note establishes the same pattern for the other test file. This is a compile
consequence of the interface A8 owns, not scope creep, and it is the smallest possible form of it.

**The B10 collision I was watching for does not exist.** B10's Step 0 touches `:57-66` — the `editor: { viewport: … }
as unknown as EditorShellBridge["editor"]` cast and the comment above it. A8's line is `:47`, ten lines earlier,
so the two hunks do not overlap and neither task invalidates the other. The ordering ruling (B10 before A9)
still holds on its own merits — A9 rewrites `shell-layout.tsx` — but it is no longer also a collision repair.

**Ruling: no action.** A8's file set is `bridge.ts`, `layer-panel.tsx`, `layer-panel.dom.test.tsx`, and this one
stub line; its BASE will be derived from its own commit, so the extra path is documented here rather than
silently absorbed. Cost if wrong: none — if a reviewer judges the line unnecessary, removing it is one line.

## Task 9 pre-dispatch verification: clean, including its cross-plan premise

A9 creates `canvas-context-menu.tsx` + its DOM test and modifies `shell-layout.tsx`,
`editor-shell.css` and `ui-copy.ts`. Its two consumed interfaces and its one cross-plan claim all check out:

- **`arrangeActions` really is already on the stage toolbar**, which is the premise A9's Interfaces block
  rests on for *not* rendering arrange in the context menu. `shell-layout.tsx:140` maps
  `arrangeActions()` into toolbar buttons and `:8` imports it alongside `arrangeEligible`; the count is
  pinned by `shell-layout.dom.test.tsx:164`. Plan B's Task 7 shipped this, so A9's ruling is correct as
  written rather than an assumption about work that might not have landed.
- **`OBJECT_ACTIONS` and `actionEnabled` are live and shared.** `object-actions.ts:197` exports
  `arrangeActions()` and the action registry is consumed identically by `canvas-dock.tsx:35`
  (`OBJECT_ACTIONS.filter((action) => actionEnabled(bridge, action.id))`) and `layer-panel.tsx:320-321` —
  and `layer-panel.dom.test.tsx:234-235` already pins "exactly what the dock would enable" against the same
  expression A9's Step 1 test pins. So A9's assertion is a third consumer of one list, not a new
  agreement between two.
- `EditorShellBridge` is available to the menu (`bridge.ts`), and `bridge.ts:127` shows `actionEnabled(gate,
  action)` taking a target-shaped gate — matching A9's `const gate = { … }` stub rather than the bridge
  itself, which matters because A9's test double supplies two members, not thirty.

**Ruling: A9 dispatches as briefed once B10 has run, no plan edit.** Cost if wrong: a duplicated arrange
entry, which the shared-list assertion in its own Step 1 would catch as a mismatch against the dock.

**Ordering note carried forward:** A9 modifies `editor-shell.css`, which B9 has just changed (`66506e6`,
+45 lines of motion/focus rules). No conflict in principle — different regions of the file — but A9's
implementer must re-read the file rather than appending blind, and B10 running first means any B9 review fix
to that stylesheet is already settled before A9 touches it. That is the second reason for B10 → A9.

## Task 8 implementation landed (`da5f0b2`); BASE derived, not inherited from the ledger

Commit `da5f0b2` — "feat(editor): layer tree reflects the group context", 6 files, +115/−15:
`bridge.ts` (+18/−5), `bridge.dom.test.ts` (+37), `layer-panel.tsx` (+26), `layer-panel.dom.test.tsx` (+25),
`shell-layout.dom.test.tsx` (+1, the stub member I inspected earlier) and `STATUS.md` (+5/−9).

**BASE was computed as `git rev-parse da5f0b2~1` = `12f65a7`**, which is what the contradiction recorded
earlier required: the ledger said `abd5713` in one entry and `22639a3` in another, and neither is right —
`abd5713` would have carried B8's task commit, B8's fix round and B9's commit into A8's package under A8's
name. Package `review-12f65a7..da5f0b2.diff` written and its `git diff --stat` verified to list exactly the
six files above, one commit. This is the first dispatch in this plan where the base came from the fix-base
rule rather than a pre-dispatch `HEAD` read, and it is what that rule is for.

**A8 updated `STATUS.md` and I am letting it stand.** It replaced "Last completed change" with two bullets
about `groupContext()`/`selectChild`, +5/−9, which is AGENTS.md's rule followed literally — and it *replaced*
rather than appended, so the anti-append rule holds. This contradicts the batching ruling recorded in the
UI-polish ledger ("batch it while three plans run"). Ruling: **the implementer's action is correct and the
batching ruling is the one that yields.** AGENTS.md is a checked-in project instruction and outranks my
convenience ruling; the cost of A8 having done it right is that B9's and C6's summaries never made it into
STATUS.md, and those are recoverable from `git log` at the plan boundary, which is the same place I intended
to write them anyway. Cost if wrong: none.

**Four implementer concerns were passed to the reviewer to adjudicate rather than accepted**, the substantive
two being the inline `opacity: 0.45` versus a `data-context`-keyed stylesheet rule (the row already carries
`data-context`, so the magic number has a clean home in the file that owns visual language), and the
"empty context dims nothing" reading, where I asked the reviewer which reading an author actually needs —
a literal reading would grey out the whole tree whenever no group is entered.

**One-writer state at this moment:** C6's fix round writes
`snap-manager/scaling/rectangular-scale-gesture-projection.ts` — disjoint from A8's committed files and from
`editor.spec.ts`. A8's and B9's reviewers are read-only by contract. C2, C3 and C7 wait: C2 and C7 on
`editor.spec.ts`, C3 on nothing except the `snap-manager` directory-level staging hazard with C6's fix.

## Task 8 review: spec PASS (two interpretation gaps) / quality GOOD — 0 Critical, 2 Important, 3 Minor

**The headline finding is real and I verified it by grep rather than acceptance.** The dimming has no test:
`layer-panel.dom.test.tsx:200-204` asserts `data-context` on three rows and **never asserts the opacity**.
Delete `opacity: dimmed(row.id) ? 0.45 : undefined` from `layer-panel.tsx:213` and the suite stays green
(reviewer measured 10/10). The brief's "dims the rest" requirement is therefore unprotected — and the
reviewer's sharp addition is that the *natural* fix for its other finding (move the opacity into
`editor-shell.css` keyed on `[data-context="false"]`) is a **pure deletion of that exact line**, which today's
suite would wave through. So the test must land with the move or the move is a silent regression risk.

**Important 1 (inline opacity) is a real defect, and the implementer's stated reason had expired.** It kept
the value inline because `editor-shell.css` had another task's uncommitted changes in flight — true when it
started, false when it committed: B9's stylesheet commit `66506e6` landed **before** `da5f0b2`. The reviewer's
line, which I accept: inline is the established pattern for *values handed to CSS* (`--layer-depth`,
`paddingLeft`'s calc), not for a *declaration*; and `data-context` already exists on the row, so the magic
number has a clean home in the file that owns the visual language.

**Important 2 is the missing test above.** Both must land together.

**The reviewer adjudicated the empty-context reading in the implementer's favour, and I agree with the
reasoning it gave:** with no group entered every top-level row *is* reachable, so dimming all of them would
assert the opposite of the truth. The brief's test is too weak to decide it — one empty-context case fixes that.

**Its re-derived teeth checks all held**, which is the part that makes the rest trustworthy: mutating
`data-context` to always-true reddens at the `other` row; reducing `contextRows` to `new Set(entered)` reddens
at the `child` row (`:204`); removing the `selectLayer` branch reddens `bridge.dom.test.ts:239`. It also probed
`data-context` at depth 3 through a `group>mid>leaf` fixture, confirming the single forward pass reaches any
depth rather than assuming the parent-before-children invariant.

**CRLF: clean.** Reviewer measured `CR=0` in all six files and `i/lf w/lf`; the +115/−15 is proportionate and
there is no whole-file line-ending churn. The implementer's normalization did not introduce a hidden rewrite.

**Ordering ruling: A8's fix round QUEUED behind B9's fix round.** A8's fix needs `editor-shell.css` (the
opacity move) and `editor.spec.ts` (the missing browser leg for the no-context tree click, which the reviewer
showed is cheap — Task 7's committed `editor.spec.ts:1420-1605` already has the fixture, camera mapping and
dblclick). **Both files are held right now by B9's fix round** (`ab4dc6733155df5d6`), which edits exactly those
two. Dispatching A8's fix concurrently would be two writers on two files. C2 and C7 are behind the same file.
So the queue is: B9 fix (in flight) → A8 fix, then C2/C7 one at a time. C3's implementer (`snap-manager/**`)
is the only writer disjoint from all of it and is already running.

**Cost if wrong:** one serialization delay on a fix round that has no deadline. The alternative — letting two
agents edit `editor-shell.css` and `editor.spec.ts` simultaneously — produces a commit that mixes a motion fix
with a group-context fix and a `git add` that cannot be scoped to either.

## A8 fix brief composed and queued — and the review's central premise is false

**The A8 review's I2 asked for the `opacity` move into `editor-shell.css` and called the `context.size > 0`
guard "redundant once the rule is CSS". The move is right; the redundancy claim is false.** React does not drop
a `false` boolean attribute — it writes the string `"false"`, and **`layer-panel.dom.test.tsx:201` in the
already-passing suite asserts exactly that** (`getAttribute("data-context")` is `"false"` for the `other` row).
So with no group entered `context.has(id)` is false for every row, every row renders `data-context="false"`, and
a bare `[data-context="false"]` rule dims the entire tree the moment the editor opens with nothing entered —
which is the precise regression the guard was written to prevent, and the opposite of the truth when every
top-level object *is* selectable. The reviewer reasoned from "an absent attribute matches nothing", which is
true of the attribute but false of this one, because it is never absent. **The guard stays.**

**Ruling: the review's suggested fix is adopted except where it would delete the guard.** The plan
(`5917e3f`) now states the guard is load-bearing and why, so a future implementer regenerating Task 8 from the
plan cannot re-derive the reviewer's reading. Cost if wrong: the tree dims everything on open with no group
entered, and the attribute says "unreachable" about every reachable object.

**Also recorded in the plan and previously missing:** Task 8's Files list and `git add` omitted
`editor-shell.css` and `tests/e2e/editor.spec.ts`, the two files its own fix now needs. And **jsdom cannot pin
the stylesheet** — `editor-main.ts:19` is the only importer of `editor-shell.css` and no test reaches it, so
the jsdom half can only assert the attribute the rule keys on. The computed-opacity assertion therefore belongs
in Task 7's committed `editor.spec.ts:1450` case, which already carries the `grouping.vigilia-theme` fixture,
the camera-mapped `at(x, y)` and a landed `dblclick`; the fix extends that case rather than adding a spec.

**A8's fix-round implementer cannot be resumed.** The agent list holds only `a0fc592e72d79a935` and the running
B9 fix; A8's implementer has been reaped, and the ledger never recorded its identity (the "Ledger gap found"
entry already notes the skill wanting that recorded). So fix round 1 is a **fresh implementer with its own
BASE**, not a resume — which also means round 1 rather than round 2 for the escalation counter.

**Brief written to `task-8-fix-brief.md`, deliberately un-dispatched.** B9's fix round
(`ab4dc6733155df5d6`) still holds both `editor-shell.css` and `editor.spec.ts`. Every input the dispatch needs
is now on disk, so it fires the moment B9 commits.

**Cost if wrong:** one serialization delay on a fix round with no deadline, against the alternative of two
agents committing into the same two files.

## Ruling: A10 runs BEFORE B10, because B10 is a gate and A10 is what clears its red

**The conflict.** B10 (plan B's full gate) carries the instruction *"No known-failing tests are carried into this
gate — a red suite is a failure to investigate, not to accept"*, plus *"Report any red test with its output and a
base-commit run proving when it started. Do not classify a failure as pre-existing without that proof."* But this
plan's **A10 owns two red e2e tests** — `persists an ordinary drag and restores it through undo`
(`editor.spec.ts:1356`) and `rehydrates a chart runtime after undo` (`:1635`) — and A10's own brief opens by
naming them: *"This task also owns two e2e tests that Task 2 turned red — they are yours to fix, not Task 2's."*
So B10 dispatched in plan order (B → A) runs Step 2's `npm run test:e2e` against a suite that is known-red, and
its two permitted outcomes are both bad: the gate fails, or the implementer spends a base-commit bisect proving
what this ledger already records.

**Ruling: A10 is dispatched before B10.** A10 has no dependency on any plan B task — it consumes the camera
(Tasks 1–2, done) and `ViewportManager.artboardScreenRect()` (Task 5, done), both Plan A — and it is the task
that makes those two tests green. B10 then gates a suite that is actually green, which is what a gate is for.
A9 stays after B10 and is unaffected either way: it touches `editor-shell.css`, `shell-layout.tsx`, `ui-copy.ts`
and the new context menu, none of which B10 modifies (B10 modifies `shell-layout.dom.test.tsx` and `STATUS.md`).

**Revised sequence:** A8 fix (in flight) → **A10** → **B10** → A9 → C2 → C7 → A11.

**Cost if wrong:** B10's gate covers a wider commit range than "plan B alone" and A10 lands before A9, which is a
plan-order deviation for two tasks with no dependency between them. The gate is still run, still on a built
bundle, and still at a milestone boundary — it is later in wall-clock and no weaker as evidence.

**Ruling recorded in both ledgers** so neither plan's reader sees the other's ordering as a mistake.

## A9's brief generated and ready; A8's fix still holds `editor-shell.css`

`task-9-brief.md` (118 lines) is written. A9 does **not** touch `editor.spec.ts` — checked by grep, zero hits —
so it is not behind the four-way serialization point. It *is* behind A8's fix, which holds `editor-shell.css`
(B10 also modifies that file, so the hold chains through both). Cost if wrong: an A9 dispatched early would pick
up an unstaged `editor-shell.css` and commit a motion fix under a context-menu message.

## A10's brief carried the same false Fabric origin premise that broke C3 — `92e846a`

Reading A10's brief before queueing it, `clientOfScene`'s comment justified its centre maths with *"`left`/`top`
are origin-relative (Fabric's default origin is `left`/`top`)"*. **Fabric 7's default origin is CENTER** —
`shapes/Object/defaultValues.mjs` holds `originX: CENTER`, applied by the constructor — which is the identical
wrong premise that made C3's spacing fixture unmeasurable two tasks ago, and which cost a fix round and a plan
commit (`ffe8f40`) there.

**The formula is unaffected and needed no change.** Every fixture A10 touches sets `originX`/`originY`
explicitly, so `left`/`top` genuinely is the origin at those call sites and
`left + getScaledWidth() / 2` is the correct centre. What was wrong is the *reason stated for it*, and that
matters because the comment is what a future implementer generalises from: a fixture added without origins would
put `left` at the shape's centre and make the helper aim half a width too far right, silently, in a test whose
whole job is to land a pointer on a target. The corrected comment says the fixtures set the origins and names the
CENTER default as the reason they must.

**Ruling: the correction goes in the plan.** Briefs regenerate from the plan, so a fix living only in A10's
generated brief is lost on the next regeneration — the standing rule already applied to C3's fixture and to
plan C's staging defect. Cost if wrong: none.

**This is the second time this session that a plan I wrote or inherited asserted a Fabric-7 default from memory**
and the source said otherwise. The pattern is worth naming: I verified C3's `originX: CENTER` by reading
`defaultValues.mjs` only *after* an implementer contradicted me. Both instances were in fixture geometry —
the same class as this ledger's earlier finding that checking a test's *references* is not checking that the
test can observe anything.

## A10's site count was a line count, and its "leave it" case was wrong twice over — `857804e`

A10's Step 1 claimed `rg -n 'box\.(x|y|width|height)'` returns **"nine `box`-relative arithmetic sites"**. Run at
HEAD it returns **14 lines — seven x/y pairs**, and it returned 14 lines *before* A8's uncommitted fix touched
the file too. The old text explained the number as drift ("seven, then eight, then nine") caused by other tasks
adding e2e cases; that story is false, because a line count was mistaken for a site count and the drift was in
the counting method, not the file.

**My first correction to this was itself wrong, and the second reading caught it.** I initially wrote that
`:1730-1731` should be *excluded* — reasoning that it "already applies `panX + zoom * x` explicitly, so it is a
camera-aware mapping and repointing it would replace the thing under test with the thing that computes it, making
the assertion vacuous." Reading the surrounding code rather than the two lines: it reaches the editor through
`Object.entries(window).find(([key]) => key.startsWith("vigilia-fabric-editor-"))` — a **private-instance probe
that bypasses the bridge** — and then hand-rolls `box.x + panX + zoom * x`. That is a **second copy of the
camera's transform**, which is the specific thing A10 exists to delete, and the test it belongs to verifies the
marquee's reachability, not the transform. So it is in scope, and the plan now says so and explains why, rather
than leaving an implementer to reach my first conclusion unaided.

**Verified the repoint is behaviour-preserving, from the owner's source rather than by reasoning.** Codegraph
reads of `viewport-manager/index.ts:86-101`: `artboardScreenRect()` returns `left: vpt[4]`, `top: vpt[5]`,
`width: board.width * scale`, `height: board.height * scale`. `vpt[4]` **is** the transform's `tx` — the value
`:1730` names `panX` — so `box.x + panX + zoom * x` and `box.x + rect.left + x * (rect.width / sceneWidth)` are
algebraically the same expression. The owner's own doc comment (`:19-21`) says "Add the canvas's own client offset
for page coordinates", which is exactly what `sceneToClient` does, so the helper matches the published contract.

**Ruling: the six naive sites plus `:1730` are all repointed; the plan names `:1730` explicitly so the
"obviously already correct" reading cannot win.** Cost if wrong: the marquee test's mapping changes and could
break, which is exactly why the step keeps its teeth check — with the old mapping restored the two drag tests
must fail as they did at `093b3ec` (40 and 432).

## Dispatch-ready state, all briefs regenerated from the corrected plans

| Task | Brief hash (sha256, first 16) | Blocked on |
|---|---|---|
| A8 fix (in flight) | `task-8-fix-brief.md` | — |
| A10 | `960beb1978fb2e09` | A8's fix (`editor.spec.ts`) |
| B10 | unchanged | A10 |
| A9 | `9d494001f39e1af2` | A8's fix + B10 (`editor-shell.css`) |
| C2 | `47fa9ea19ec7efb1` (unchanged, verification holds) | A8's fix (`editor.spec.ts`) |
| C7 | `9ce41eff9a1b79b2` (re-read done) | A8's fix (`editor.spec.ts`) |

A10's regenerated brief carries both corrections — the 14-lines-not-nine-sites count at `:119` and the
`:1730-1731` camera-copy finding at `:124` — so the amendments reached the artifact an implementer actually
reads, which is the whole point of correcting the plan rather than the brief.

**A10 is behind A8's fix, not merely behind B10.** A8's fix modifies `editor.spec.ts` (the browser leg for the
muted style) and A10's Step 1 rewrites the mapping helpers in that same file. So the serialization point holds
two more tasks than the earlier note recorded, and the order is A8 fix → A10 → B10 → A9 → C2 → C7 → A11.

## A8 fix landed — `f5109c9`. Its two concerns are both resolved, and one is a plan defect it found in my text.

**Concern 1 — the brief contradicted itself, and the implementer was right.** It reported that the brief's
preamble (and plan `:1744`) say keep `context.size > 0` because a bare `[data-context="false"]` rule would dim the
whole tree, while the brief's own verbatim Change 2 asserts `data-context` is `"false"` on every row in the empty
context — which is precisely the state that rule dims. Both cannot hold, and it is my text, not its
implementation, that was wrong.

**It resolved it better than either requirement as written.** It moved the condition into the attribute
expression — `data-context={context.size > 0 ? context.has(row.id) : undefined}` — so with no context the
attribute is *omitted*, the rule matches nothing, and the tree stays undimmed. That deletes the `dimmed()` helper
outright. The result is strictly better than what I wrote: **one fact (is the attribute present) is now the single
thing both the rule and the markup read**, where my version had a JS predicate and a CSS selector that could
disagree — the second-owner pattern `AGENTS.md` warns about.

**My "keep the guard" ruling was right in verdict and wrong in placement, and the plan now says so at length**
(`874dc08`). The review's "redundant once the rule is CSS" is *nearly* right: an absent attribute genuinely
matches nothing, so the rule needs no guard. But a condition is still needed to keep the attribute from being
written, and deleting it is what dims the tree. The condition moved; it did not disappear.

**Both teeth checks hit their own assertions, verbatim:**

| break | result |
|---|---|
| CSS rule commented out | e2e red at `editor.spec.ts:1606` — `Expected "0.45", Received "1"` — not a missing locator |
| guard reverted to always writing the attribute | dom red — `expected 'false' to be null` |

The first is the one that matters: it fails on the *computed opacity*, so the stylesheet rule is proved to select
the row rather than merely to exist. The e2e case also asserts the child's opacity is `"1"`, which stops a rule
that dimmed every row from passing.

**Concern 2 — a concurrent writer touched `editor-shell.css`, and it nearly reverted `2d46dc9`.** The implementer
reports the file changed on disk twice outside its edits, and that at one point its worktree content had lost
2d46dc9's portalled-classes block (`editor-shell-menu-popup`, `editor-shell-positioner`, `editor-shell-tooltip`)
from the reduced-motion query. It caught this in the staged diff and **unstaged rather than committing it** —
exactly the right call, and the reason the file is not silently reverted now.

**I verified from git rather than accepting the reassurance, because the failure mode is silent.** `2d46dc9` is
an ancestor of HEAD; `f5109c9^` is `857804e`, not `2d46dc9`, so it is a normal child commit and not an amend of
B9's; and `git diff --numstat 2d46dc9..f5109c9` on that file is **`6 0`** — six insertions, zero deletions. So
B9's portalled-classes block, its `transition: none` line and its `:where([role="tabpanel"])` narrowing all
survive byte-for-byte. **Nothing was lost, and the 6/0 shape is the proof**, not the implementer's word.

**The cause is mine, and it is the packing error this ledger has now recorded three times.** The reflog shows
`HEAD@{16:26:11} commit: @` — a commit made with a placeholder message (GitHub Desktop's convention) — amended 17
seconds later into `f5109c9`. That is a git GUI in this checkout operating on the same branch head. I dispatched
a **read-only** re-review concurrently with a **writing** implementer on the theory that read-only does not
contend; what actually contended was the git index, reached by two processes, one of them a GUI I do not control.

**Ruling: no more concurrent dispatch on this branch. Serialize every agent from here.** The saving was one
re-review's wall-clock against a silent revert of a committed fix — a bad trade, and the near-miss here is the
evidence rather than a hypothetical. Cost if wrong: the remaining queue (A10 → B10 → A9 → C2 → C7 → A11) loses
whatever overlap remained, which after this note is none anyway; every queued task already shares a file with the
one before it. **Also ruled: the re-review of this fix is dispatched, but nothing writes until it returns** — the
same serialization, applied to the one pair I had not yet serialized.

## A8 fix re-review returned — PASS/PASS. My deviation call confirmed on merit, 2 Minor.

`task-8-fix-rereview.md`. **All findings addressed: YES. No new load-bearing findings: YES.**

Both teeth checks reproduced independently and land where the fix claimed: comment out the CSS rule and rebuild →
`editor.spec.ts:1612` `Expected: "0.45"` / `Received: "1"` (a real rule effect disappearing, not a missing
locator); revert the attribute to bare `context.has(row.id)` → `layer-panel.dom.test.tsx:223` `expected 'false' to
be null`. Both files restored hash-identical to the committed blobs.

**The deviation is adjudicated correct, and for a reason I had not articulated.** I recorded it as "one fact
instead of two that could disagree". The reviewer sharpened it: under the `"false"`-plus-helper form the DOM
cannot distinguish *no group entered* from *outside the group* — both read `"false"` — so the rule dims both and
the only thing keeping the JS guard and the CSS rule consistent is that they happen to agree. That is the
two-owners defect I2 was about, moved rather than fixed. Worse, `data-context="false"` on a row that is outside no
context is false as an assertion: the guarded form writes a lie into the DOM to avoid a rule that would then
believe it. The React re-render concern I raised is retired by a probe, not an argument — React 19.3.0,
absent → `"true"` → `"false"` → absent, attribute removed cleanly, so an enter/exit-group round trip leaves no
stale `"false"`. It also grepped every tracked file for `data-context`: one consumer, which keys on the value
`"false"` and still matches every outside row. **My ruling was right in verdict, wrong in reasoning, and the
implementer's placement was better than the placement I specified.**

**Review item 3's browser `child` row click was NOT implemented, and the adjudication is accepted**: the
`selectLayer` branch has direct coverage at `bridge.dom.test.ts:225` (`selects the child itself when its group is
the entered context`), which came in with `da5f0b2`, the original Task 8 commit — so the branch is pinned
independently. My brief scoped the fix to five polls and dropped the click; that was accurate to the brief.

**Two minors, and I am taking both — they are one line each and one of them is mine.**

- **Minor 1 — the row `onClick` → `selectLayer` wire is uncovered on both legs.** Change
  `bridge?.selectLayer(row.id)` to `selectLayer(row.id + "X")` and all 11 jsdom tests still pass. No case clicks a
  row to select: `layer-panel.dom.test.tsx:323` asserts `selectLayer` was *not* called and `:266` proves a refused
  drop does not select — neither asserts a positive call with the clicked row's own id. The reviewer rates it
  small (a wholesale break would be caught elsewhere) and suggests the browser click. **I am fixing it in jsdom
  instead**, because the demonstrated mutant is the wiring itself and a jsdom click on the row kills that mutant
  directly — the browser form is stronger by also covering the branch, but the branch is separately pinned at
  `bridge.dom.test.ts:225`, so the extra strength is already paid for. Cost if wrong: a browser-only break (the
  row's click handler not attached in the real DOM) stays uncovered; the browser path is exercised by five other
  e2e cases that click layer rows and assert a downstream effect.
- **Minor 2 — the new empty-context case can pass vacuously.** The loop over `querySelectorAll` runs zero times on
  a zero-length result. The reviewer calls it a tidy-up rather than a hole, because the preceding case at `:200–205`
  reads attributes off the same fixture through `?.getAttribute(...)` and would already be red. `toHaveLength(3)`
  before the loop closes it.

**Ruling: A8 fix round 2 runs for both minors, as a jsdom-only round in `layer-panel.dom.test.tsx`.** Cost if
wrong: one small dispatch-and-re-review cycle on a task that is otherwise closed, and two lines of test in a file
nobody else is writing. Against that: parking a demonstrated mutant — `selectLayer(row.id + "X")` surviving green
— is exactly the shape I have ruled against twice today.

**Ruling: this round is queued behind B9's fix round 2, not run alongside it.** Both write the git index; that is
the resource the earlier near-miss contended. Cost if wrong: A8's close-out waits one round. The jsdom round would
not contend for `dist` the way B9's build-and-playwright teeth checks do, but the index is enough on its own —
that is the lesson the reflog already taught once.

## A10 and A9 plan text corrected (uncommitted, held behind B9's writing agent)

**A10: the step told the implementer to overwrite a live registry row.** The plan read "Replace that row's third
cell with `editor-guides-at-2x-zoom` / `keeps guides on the artboard while zoomed`", against
`docs/evidence/screenshots/README.md`'s `| Viewport | Resize or change zoom | add when changed |`. **That row is
not a placeholder.** It already reads `` `editor-zoom-readout` / `tracks the camera's zoom in the stage readout` ``
— a live capture backed by a live test at `editor.spec.ts:2169` owning
`editor-zoom-readout-desktop-chromium.png`. The replacement name `editor-guides-at-2x-zoom` has **no test behind
it**, so the row would have pointed the next reader at an image nothing regenerates: worse than the placeholder
it replaced. A10's subject is also arithmetic — the hairline stays one screen pixel, the clamp is to the artboard
— and both are pinned as unit tests against the context spy in Steps 2 and 1b, where a browser test could only
assert on pixels. Guides are painted straight onto `canvas.getSelectionContext()` and were never Fabric objects,
so no capture can see them regardless. **Ruling: A10 registers nothing and its `git add` names three source paths
only.** Cost if wrong: a guides capture a future reader might have wanted does not appear; the arithmetic stays
pinned by the two unit tests that were always the right place for it.

**A10 also staged `docs/evidence/screenshots` as a directory** — the same defect I corrected twice in plan C
(`ea8f3fb`), and here it would have swept the unowned modified `editor-desktop-chromium.png` into a commit whose
message is about camera zoom. Replaced with named paths plus an explicit do-not-stage-the-directory note.

**A9: the step asked for a capture it gave the task no way to produce.** "Then add the menu's own capture and its
`README.md` row in Step 5's commit, since this task is what creates it" — against a Files list with no
`editor.spec.ts`, a `git add` with no PNG, and no test to write one. The menu is a genuinely new visible surface
with no registered name, so the intent was right and the mechanism was missing; and per AGENTS.md a new visible
surface needs rendered/browser inspection, which a hand walkthrough of the host does not satisfy to the standard
the rest of this plan is held to. **Ruling: the plan gains the mechanism rather than dropping the requirement** —
`editor.spec.ts` and `README.md` are added to Files, and Step 4 specifies the capture test's machine-checkable
requirements: `clientOfScene` for the gesture mapping, `selectStarterChart` before the right-click so it cannot
silently hit empty canvas, an `expect(...menuitem, { name: "Duplicate" })` visible-assertion **before** the
capture so the image is evidence of an opened menu rather than of the editor, and the `Editor mechanics` row for
registration. Cost if wrong: A9 is a bigger task than the plan implied, and its capture is one more e2e case on a
file that already carries two known-red tests — both of which A10 turns green before A9 runs.

**The `clientOfScene` requirement is the part that matters most.** A9 runs *after* A10, whose entire deliverable
was deleting box-relative scene→client mappings from `editor.spec.ts`. A capture test written the old way
(`box.x + (180 / 1280) * box.width`, the shape still visible in the dock capture at `:2065-2066`) would
reintroduce that defect one task after it was removed — and it would land *after* A10's grep-derived sweep, so
nothing would catch it. The task now declares `sceneToClient`/`clientOfScene` as consumed interfaces.

**Swept both plans and both remaining briefs for the same defect class** — a step naming a capture with no test,
or a directory-wide `git add`: A9's brief inherits the plan fix on regeneration; A10's brief was regenerated
already; plan C is clean (every name it references, `editor-snap-guides` and `editor-snap-resize`, has a test,
and the two I fixed earlier stage by glob over `*snap*.png`, which is this plan's own naming convention); the
`Editor mechanics` row's other names all resolve. **No third instance found.**

**A10's brief contradicted itself about the `panX` site, and the contradiction was mine.** Two paragraphs, both
about `editor.spec.ts:1778-1792`: the first calls it "the seventh, `:1730-1731` … **Repoint it like the rest**";
the second says "**A `box.x` with no `box.width` beside it is a UI-chrome measurement, not a scene point — do not
touch it.** … if the grep lists it, leave it." There is exactly **one** `box.x + panX + zoom * x` site in the file,
and it is the second paragraph's own identifier — a `box.x` with no `box.width` — so both paragraphs name the same
lines and give opposite instructions.

**The "leave it" paragraph is the wrong one, and its own subject contradicts it.** The site's comment reads
*"Artboard coordinates to page pixels, through the live camera"*: it is a scene mapping, not chrome. That paragraph
was written before I corrected the other one from "deliberate exclusion" to "in scope", and it was never
reconciled — the tell is that its description ("reads `viewportTransform` from the debug handle") is the very
evidence the first paragraph uses to condemn it. **Ruling: the instruction is deleted, the site is repointed.**
The paragraph's closing clause — "if you conclude otherwise, say why in the report rather than leaving it silently
unlisted" — is kept in substance, because a silent skip is the failure this whole step exists to prevent.
Cost if wrong: if some pair in that file genuinely is chrome, the implementer repoints it and the report says so;
the alternative cost is two mutually exclusive instructions in one dispatch, which is how an implementer talks
itself into the wrong one. Brief regenerated: the string "leave it" now appears zero times in `task-10-brief.md`.

**Revision to my A8 ruling, on evidence I did not have when I made it.** I ruled "take both minors" and queued a
dedicated jsdom round. Having now read the surrounding tests, one of them does not deserve a round and the other
does not deserve its own:

- **Minor 2 (the vacuous loop) is parked, and now provably rather than by judgement.** The case immediately
  before it (`layer-panel.dom.test.tsx:202-205`) reads the same fixture's attributes through
  `?.getAttribute(...)` compared with `.toBe("true")` — a missing row yields `undefined`, which fails. So a panel
  that rendered zero rows is red one test earlier, exactly as the reviewer said, and the loop cannot be the only
  thing standing between a broken panel and a green suite. **Ruling: park with this note; no `toHaveLength(3)`.**
  Cost if wrong: the vacuity is real but unreachable while the preceding case exists, and that case is about the
  group context — a behaviour someone would have to delete deliberately.
- **Minor 1 (the row `onClick` → `selectLayer` wire) stays, but folds into B10's Step 0 dispatch instead of a
  round of its own.** `bridge.dom.test.ts:225` pins the branch (`selectLayer("child")` → `setActiveObject(child)`),
  so what is uncovered is the wire carrying the clicked row's own id — and that is worth pinning here, because
  this codebase is actively adding group-context work where passing a parent id instead of the child's is a
  plausible refactor. B10's Step 0 already lands Task 7's held cast fix in `shell-layout.dom.test.tsx`; both are
  small test-only edits of the same shape, which is what the process's batch rule is for. **One dispatch, one
  review, and B10's gate still covers both.** Cost if wrong: a code fix rides inside a gate task, which is what
  B10's Step 0 already does by design.

## A10 brief audit — four defects found and fixed before dispatch

While the B9 closing re-review ran, I audited A10's brief rather than dispatching it. Four defects, and
**three are the same error class as the three broken teeth checks in B9**: a check or an assertion specified
without first confirming the mechanism it depends on. That is now five instances across two tasks, all mine.

1. **Step 1b's assertion could not fail, and its teeth check could not either.** It read
   `context.lineWidth` after moving `drawSpacingGuides` below `context.restore()`. `contextSpy`'s `restore`
   is a bare `vi.fn()` (`guide-renderer.dom.test.ts:9`), so it does not put `lineWidth` back; nothing in the
   spacing path assigns it either — `drawSpacingGuide` strokes without setting it, and `drawGuideLabel` sets
   `lineWidth / safeZoom` inside its own save/restore pair. So `lineWidth` reads `1 / zoom` either way.
   **Ruling: assert call ORDER instead** — `context.stroke.mock.invocationCallOrder[0] <
   context.restore.mock.invocationCallOrder[0]`, which is what "painted under the same transform" actually
   means and which inverts under the break. Cost if wrong: if the ordering assertion is itself vacuous, the
   spacing pass stays unpinned; the implementer's expected-PASS run and the teeth check both report it.
2. **Step 1's teeth-check parenthetical named the wrong iteration.** It said the failure reads `2` where
   `0.5` is expected "at 4x", but the loop is `[0.5, 1, 2, 4]` and fails on the first iteration, zoom 0.5,
   reading `expected 2, received 0.5`. An implementer matching the literal text would think the run was
   wrong. Corrected to name the first iteration.
3. **The clamp test had no teeth check while every other test in the plan has one.** Added: drop the
   `guideBounds ??` at `guide-renderer.ts:28` and confirm `37.5` where `720` is expected. **The `37.5` is
   measured, not derived** — I probed Fabric in jsdom (`new Canvas(document.createElement("canvas"))` gives
   a 300x150 backing store) rather than reasoning from the 720-tall canvas the test passes. My first draft of
   this check said `180`, which is what a 720-tall canvas would give; the probe is why that number is not in
   the plan. The same probe corrected the clamp test's own comment, which had claimed `0-to-180`.
4. **The task's spec claim about indicators had no step behind it.** The title, the Files list and the spec's
   acceptance item all name `indicator-manager`, and no step touched it — the claim was carried by the title
   alone. Added Step 3, pinning that the size readout reports **scene** units at a non-1 zoom. That is the
   real risk: multiplying by `canvas.getZoom()` there reads like the same "convert to screen units" instinct
   that `GUIDE_WIDTH / zoom` correctly implements in the guide renderer, and would be wrong.

**Ruling: Step 3 (indicators) is inserted before the spacing step, and the steps are renumbered 1-4.** The
plan's own correction note at `:2412` already asserted "Task 10's steps are numbered 1-4", so the insert
restores a numbering the plan claimed and did not have. Cost if wrong: an implementer reading a step out of
order; the brief is regenerated and the numbering is contiguous, so that is not reachable.

**Ruling: `selectStarterChart`'s call-site count corrected from "five … covers four tests" to six, each in a
different test.** The six sites are `:266`, `:285`, `:739`, `:868`, `:897`, `:1740`, each in its own `test(`.
Cost if wrong: a stale count in a sentence about coverage; the sentence now names the grep as the authority.

Brief regenerated at 377 lines (was 318, 309, 290 across this session — each regeneration is a correction).
A10 remains dispatch-ready and is still first in the queue, ahead of B10.

**Fifth defect in the same audit, found by probing rather than reading.** Step 4's test could not have run at
all: `contextSpy` defines no `quadraticCurveTo`, and `drawRoundedRectPath` (`guide-painting.ts:23`) calls it for
the badge's rounded corners, so a non-empty `spacingGuides` throws
`TypeError: context.quadraticCurveTo is not a function`. The test would have died on the crash, not on its
assertion — and an implementer could easily have read that as "the step's premise is wrong" rather than "the spy
is short one method". Added `quadraticCurveTo: vi.fn(),` to the step, and noted it is safe for the file's
existing cases because they all pass `spacingGuides: []`.

**Both of Step 4's halves are now measured, not reasoned.** Probe 1 (unbroken): `strokeOrder [10]`,
`restoreOrder [27, 44, 45]` — the assertion holds. Probe 2 (with `drawSpacingGuides` moved below the outer
`restore()`): `strokeOrder [11]`, `restoreOrder [5, 28, 45]` — the assertion inverts to false. So the check
discriminates, which is the thing four earlier versions of it did not. The broken state is recorded in the plan
so an implementer sees the expected numbers rather than having to judge whether a failure is the right one.

**Ruling: I probe before writing a teeth check from now on, and the plan records the measured numbers.** Five
defects in one task, four of them a check specified without confirming its mechanism, is a pattern rather than
bad luck. A two-minute probe in a scratch test file outside the repo's tracked paths is cheaper than a fix
round, and it has already caught two wrong numbers (`37.5` not `180`; the spy's missing method) that reading
alone produced. Cost if wrong: probing costs a couple of minutes per check on checks that would have been fine.

`guide-renderer.ts` was temporarily patched for probe 2 and restored — `git diff --stat` on it is empty, and no
probe file remains in the tree.

**Sixth defect, and the only one that would have shipped a wrong test rather than a weak one.**
`clientOfScene` — the helper Step 1 introduces and the two red tests depend on — computed the centre as
`left + getScaledWidth() / 2`, and its comment justified that by claiming `getCenterPoint()` "returns the origin
itself and would aim at the top-left corner". **The claim is backwards.** `getCenterPoint()` calls
`translateToCenterPoint(left, top, originX, originY)`, so it converts from whatever origin the object actually
has; the manual form is what assumes an origin.

**The assumption fails on the exact object the helper targets.** The starter scene's `chart()` helper sets
`originX: "center"` / `originY: "center"` (`new-fabric-theme.ts:730`), `VigiliaChart`'s own defaults repeat it
(`chart-object.ts:57-58`), and `load-gauge` is a chart. Measured on a 112x88 object at `left: 432, top: 418`:
manual gives **(488, 462)**, `getCenterPoint()` gives **(432, 418)** — the manual form aims half a width and half
a height past the centre, at the shape's bottom-right corner.

**Why this one matters more than the other five.** The five before it were checks that could not fail; this is a
test that would have failed to exercise what it claims. It would still have gone green — the corner point sits
inside `gauge-card`, so the drag would have grabbed the parent card, which is the exact failure the paragraph
above it describes as the reason `rehydrates a chart runtime after undo` was red in the first place. The fix
would have re-created the bug it was written to remove, with a comment explaining why.

**Ruling: use `getCenterPoint()`; the comment now records the correction and the measured numbers.** The old
comment's Fabric-default-origin observation was true but irrelevant — it was about fixtures that omit origins,
and the object in question sets them explicitly, to `center`. Cost if wrong: if some object this helper is
pointed at has an unusual origin, `getCenterPoint()` still returns its true centre, so the failure mode is not
reachable by construction.

**The near-miss numbers in the paragraph above it check out, and I verified them rather than trusting them.**
Old mapping lands at scene y ≈ 458; `load-gauge` spans 374–462 (centre 418, height 88). So 4px from the bottom
edge, inside the `gauge-card` overlap — as written. That paragraph was right; the helper under it was not.

Six defects in one task's brief, all mine, all found by probing before dispatch. A10 is still the next dispatch.

**Audit complete: six defects, every remaining premise measured rather than reasoned.** The last three checks I
ran on A10, and their results:

- **The `/320`+`/180` shape is ambiguous on its own.** A *correct* block at `editor.spec.ts:1609` also divides by
  320 and 180 — against `rect.width`/`rect.height` rather than `box.width`/`box.height`. My shape list named only
  the numbers, so an implementer could have "found" the correct block and either repointed it wrongly or
  concluded the list was wrong. Both the prose and the shape table now say **against `box.width`/`box.height`**,
  and the prose adds that the grep is what tells them apart. Cost if wrong: a correct block gets flattened.
- **The grep's returned set is exactly the seven pairs the plan describes.** Ran it: `:1484`, `:1746`, `:1828`,
  `:2041`, `:2071`, `:2103`, `:2668`. Six naive pairs plus the `panX` one, matching the shape list one for one.
  The two plain `/1280`+`/720` pairs at `:2041` and `:2071` are in different tests (`editor-snap-guides` capture
  and the rotation-indicator test), so "two more, each in its own test body" is accurate.
- **The `panX` repoint is genuinely behaviour-preserving.** Its destructure is
  `[zoom = 1, , , , panX = 0, panY = 0]` — indices 4 and 5, which is `vpt[4]`/`vpt[5]`, which is exactly what
  `artboardScreenRect()` returns as `left`/`top`. And `zoom * x` matches `rect.width = board.width * scale` when
  the artboard equals the scene. So `rect.left + x * (rect.width / sceneWidth)` computes the same point. The
  plan's claim is correct, which matters because that paragraph exists to stop an implementer talking itself out
  of repointing it.

**Six defects, one task, one dispatch not yet sent.** Five were checks that could not fail; the sixth
(`getCenterPoint`) would have shipped a test that re-created the bug it was written to fix. All six were found by
probing the mechanism before writing the assertion, and none by re-reading my own prose — which is the argument
for the probe ruling above.

## A10 landed — `b206070` (+ fix round 1 `a20d0de`). Review: COMPLIANT / APPROVED. Re-review: 2 Minor, loop CLOSED.

`task-10-report.md`, `task-10-review.md`, `task-10-rereview.md`. Three new guide-renderer unit tests plus one
indicator test, all with teeth confirmed by the reviewer against source (hairline `1/zoom`, bounds clamp reading
`37.5` vs `720`, spacing-guide ordering, scene-vs-screen size readout). All seven box-relative mapping pairs
repointed through the shared `sceneToClient`; the private `panX`/`panY` camera-transform copy is **deleted, not
moved**. No defect found in `guide-renderer.ts` or `indicator-manager/index.ts` — both byte-identical after the
teeth-check reverts, so no production source was edited to make a test pass.

### My brief's `invocationCallOrder` numbers were right; the implementer's run was different for a reason worth keeping

The implementer reported the brief's `stroke [10]`/`restore [27,44,45]` did not reproduce, measuring
`[64]`/`[81,98,99]`, and correctly did **not** adjust the assertion to match. The reviewer settled it: run that
test **in isolation** and the brief's numbers appear exactly — the implementer had run the whole file, and
`invocationCallOrder` is a counter shared across all mocks in a module. **Ruling: the assertion stays as written
and the explanation is recorded in the report, not in the test.** Cost if wrong: a future reader running the file
rather than the test sees different integers and may think the check drifted — mitigated by the report now saying
which invocation produces which. This is the same class as the earlier defects (a check specified without
confirming the mechanism), but this time the brief was right and the *measurement context* differed, which is a
distinction I had not been making.

### **The `display-fabric.spec.ts` red pair is a machine-speed timeout, not a regression — measured, not argued**

The reviewer found the desktop-chromium suite red at `:322` and `:359` and correctly refused to call them
pre-existing without a base-commit run; B10's Step 2 forbids accepting red. I ran them down rather than park them,
because they gate B10. Sequence, all on this machine at `a20d0de`:

1. Serial, desktop-chromium, default 30s → **both TIMEDOUT at 30216ms / 30220ms.**
2. Both projects, same grep → desktop **and phone** timed out at ~30.2s. **The phone project — the one the ledger
   measured GREEN earlier — now fails too**, which is what ruled out "the editor change broke it": these are
   player tests, and a regression I caused would not have flipped phone-chromium and desktop together at the same
   ceiling.
3. Same two tests, `--timeout=120000` → **both PASSED, 44738ms and 34968ms.**

**So they are slow, not hung and not broken.** The real error under the timeout was
`page.clock.runFor(4000)` never resolving before the 30s ceiling, surfacing as `Target page, context or browser
has been closed` — the teardown of an already-timed-out test, which is why the first error line reads like a
browser crash and sends you looking in the wrong place.

**The ledger's earlier "both pass" measurement was true and is now misleading.** It read `28.5s` and `29.4s`
against the same 30s cap — passing by 1.5s and 0.6s. Nothing changed in the tests; the margin was never real and
the machine's speed decides it. Recording that here because the plan's Task 11 now cites those two runs as proof
the suite is green, and **they do not establish that on their own.**

**Ruling: I do not edit the tests or the config.** Cost if wrong: the gate stays red on slow machines until
someone raises the timeout. Against that: (a) `playwright.config.ts` sets `timeout: 60_000` per project and these
two are apparently not inheriting it as expected — I have not confirmed why, and a timeout fix written without
that mechanism confirmed is exactly the defect class this whole session has been about; (b) `retries: 0` and
`workers: 1` are deliberate; (c) the fix belongs to whoever owns the player suite's speed, and the measurement
above is the evidence they need. **Flagged to B10 and A11 in both ledgers rather than silently absorbed**, since
both plans' gates instruct the reader to treat red as a failure to investigate, and now the investigation is done
and its answer is "slow". A11's Step 2 carries the same two tests as must-pass and needs this same note.

### The two Minors, parked

- **N1** — `editor.spec.ts:1705` says "`rect` is canvas-relative" where the file's own helper docblock at `:20`
  says "CANVAS-element relative". Pre-existing (from `fb3aa92`), the sentence's causal claim is true, and the
  identical phrase sits at `:2418`, which the review did not flag. **Parked**: harmonizing the file's vocabulary
  is a tidy for A11, and fixing one site while leaving the other would trade a nit for an inconsistency.
- **N2** — `task-10-report.md`'s concern 4 states the fake-timer cause as fact while conceding pre-existence
  unproven. **Superseded by the measurement above**, which replaces cause-by-inspection with a run: the tests pass
  given more time, so the cause is duration, not teardown. The report is untracked scratch and this ledger is the
  record.

**Plan A position: A1–A8, A10 complete. Remaining: A9, A11.** A9 is next in queue after B10.

## RECONCILIATION 2026-09-25 (session resumed)

The plan file was **rewritten** at `e12d804` (20:16) from the 2489-line Task 1–11
form into the current 71-line Phase 1 / Phase 2 form. The ledger's A-numbering is
therefore historical: **A9 = Phase 1 (canvas context menu)**, **A11 = Phase 2
(gates and handoff)**. A10 (guides at non-1 zoom) and B10 (plan B's gate) both
landed before that rewrite. Plan A position on resume: **Phase 1 not started.**

Also reconciled: the plan file's own "State" paragraph still said camera,
navigation, marquee, keyboard, group entry and non-1x snapping are landed, which
matches `a20d0de`/`da5f0b2` in git and the ledger. No contradiction.

**A9's brief (`task-9-brief.md`, 16:53) predates the rewrite and is dead.**
Archived to `archive/task-9-brief.stale-2489line-plan.md`. It was generated from
the 2489-line plan and `scripts/task-brief` cannot regenerate it: the current plan
has no `Task 9` heading (grep count 0). **Ruling: Phase 1 is briefed fresh from
the current plan text.** Cost if wrong: a brief written by the controller rather
than extracted by the script — mitigated by writing it to the plan first, so the
plan stays the one authority and a later extraction yields the same text.

### The stale brief's core mechanism is disproven — measured, five probes

The brief told the implementer to wrap the canvas in a `ContextMenu.Trigger` and
let Base UI open the menu on the canvas's own `contextmenu`. That cannot work
here, and the reason is a collision between two owners of one event. Probes run
at `98664d7`, jsdom 26.1, Base UI 1.8.0, fabric 7.4.0:

| Probe | Result |
|---|---|
| Trigger wrapping an element that calls `preventDefault`+`stopPropagation` on its own `contextmenu` | **0 menuitems.** Trigger never opens. |
| Listener A (`preventDefault`+`stopPropagation`) then listener B, **both on the same element** | **both fire**, `["fabric-like","menu"]`. Same-element listeners are not stopped by each other. |
| `Root open` + `Portal` + `Positioner anchor={virtual}` at (10,20) | popup renders, `menuitem` in `document.body`, positioner `transform: translate(5px, 5px)` |
| `Positioner` with **no** `Portal` ancestor | throws `Base UI: <Menu.Portal> is missing.` |
| `act()` around an anchored positioner's render | **times out** (35s); without `act`, settles in <50ms |

Fabric's `stopContextMenu` defaults to `true` (`index.mjs:10600`) and
`__onContextMenu` calls `stopEvent` = `preventDefault` + `stopPropagation`
(`index.mjs:12137`, `:2894`). Fabric binds it on `canvasElement` =
`this.upperCanvasEl` (`index.mjs:11867`). The repo does not override the
default (grep `stopContextMenu`/`fireRightClick` across `packages/*/src`: zero
hits). So a Trigger on an ancestor is dead by construction.

**Ruling: Phase 1 opens the menu from its own `upperCanvasEl` listener with a
controlled root and a virtual anchor, and the plan now says so in a
"Phase 1 mechanism (measured)" block.** Cost if wrong: an implementer follows
the measurements instead of re-deriving them, and if a future fabric or Base UI
release changes either behaviour, the plan's stated mechanism is stale — the
probes above are the counterfactual and are re-runnable in one file.

**Second finding, same measurement: the menu kind follows the pointer, not the
selection.** Fabric's `__onMouseDown` returns before any selection logic when
`button` is truthy (`index.mjs:12442-12445`), so a right-click never changes the
selection — right-clicking an *unselected* object would otherwise open the
selected object's menu, or none. The plan now requires `findTarget(event)` to
decide the kind and to select a hit before opening. Cost if wrong: the menu and
the dock disagree for the same pointer position, which is the first failure mode
Phase 1 already names.

**Third finding: the brief's Step 1 test could not have passed as written.**
`host.querySelectorAll('[role="menuitem"]')` reads the render host, but the
Portal appends to `document.body` — measured `inHost: 0, inBody: 1`. And the
`await act(...)` wrapper it specifies times out on an anchored positioner. Both
are in the mechanism block now.

### Pre-flight scan (re-run for the rewritten plan)

The rewritten plan has two phases and two tasks. Rows, per the skill's shape:

| Pair | Produces vs consumes | Finding |
|---|---|---|
| Phase 1 → Phase 2 | Phase 1 creates the menu, its DOM test, the e2e capture and the registry row; Phase 2 names the capture in its acceptance set | **Consistent.** Phase 2's "context menu" item is exactly Phase 1's surface. |
| Phase 1 internal | Step 1's DOM test asserts the registry-derived label set; Step 3 says call `actionEnabled` | **Conflict, ruled.** The stale brief's own D7 resolved this: derive the expectation from `action.eligible(target)`, never from `actionEnabled`, or the assertion is self-referential. Carried into the new brief. |
| Phase 1 internal | Failure modes say "arrange actions leak into the menu"; `OBJECT_ACTIONS` holds no `arrange:` id | **Consistent.** `arrangeActions()` is separate and `arrange:` ids are absent from `OBJECT_ACTIONS` (verified at `object-actions.ts:82-174`, `:197`). |
| Phase 1 ↔ Phase 2 | Phase 2 runs the full browser suite; Phase 1 adds one e2e case | **Consistent**, with the known five slow `display-fabric.spec.ts` tests recorded below. |
| Phase 1 own text | Files list vs `git add` vs capture name | **Consistent** in the new brief; the stale brief's `:2049` citation for the dock capture was wrong (actual `:2142`). |

**Known-red premise carried forward, and it changed.** Plan B's ledger measured
five `display-fabric.spec.ts` cases at 30.2–47.7s against a 30s cap: slow, not
broken, passing at `--timeout=180000`. Plan A's Phase 2 Step 2 tells the reader
not to label red pre-existing without base-commit evidence — that evidence now
exists in two ledgers and is the machine's speed, not this branch. **Ruling: a
red `display-fabric.spec.ts` in Phase 2 is diagnosed, not a Phase 1 regression,
and Phase 2 must report true counts and change no timeout.** Cost if wrong: a
genuine player regression hidden behind a timing diagnosis — against that, both
projects failed at the *same* ceiling on player tests this branch never touched.

## Task 1 dispatched — BASE `f783a6d`, agent `a7f42431f6a4586d7`, model sonnet

Brief `task-1-brief.md` (69 lines, extracted). Dispatch record written at
`dispatch-a7f42431f6a4586d7.md`. Report file `task-1-report.md`.

Plan amended before dispatch (`f783a6d`) with the measured mechanism block. The
amendment is the whole reason this dispatch is not a re-run of the stale brief:
the archived brief's Trigger design cannot open a menu at all.

### Ruling: a second consumer of the arrow keys, found by reading and sent with the dispatch

`PRODUCT_SHORTCUTS` (`shortcut-manager/index.ts:50-53`) binds bare
`arrowleft/right/up/down` to `canvas.nudge-*`, and `#onKeyDown` (`:84-101`)
dispatches whenever a handler exists and the target is not a text-entry target.
It never consults `event.defaultPrevented`, and a Base UI menu item is not a
text-entry target. So an open menu plus an arrow press may both navigate the menu
and nudge the selection.

**I could not measure it, and I am not guessing.** Four jsdom probes at
`f783a6d` all hung: an anchored positioner never settles under `act()`, a
controlled harness with `setState` in a keydown listener hung, and the plain
recorder form hung as well. The interaction needs real event dispatch and a real
layout engine, which is Playwright, not jsdom.

**Ruling: the measurement goes in Task 1's browser test, with the fix
conditional on what it shows.** I sent the implementer the finding, the exact
owner (`ShortcutManager.#onKeyDown`), the forbidden placements (no listener or
global inside the menu component — that would make one surface responsible for
another owner's keys), and an explicit statement that "Base UI already stops it,
no code change" is an acceptable and expected outcome. Cost if wrong: one extra
browser assertion and possibly one guard in the shortcut manager that a later
reader must justify; the guard carries its own counterfactual requirement, so an
unnecessary one would have to survive a test that fails without it.

### Bookkeeping: the review range `f783a6d..HEAD` will contain one commit that is not the implementer's

I committed `faaaf06` (STATUS.md only) while Task 1 runs, after recording BASE
`f783a6d`. So the review package's range will list three commits, and `faaaf06`
is the controller's docs commit, not the task's work. It touches `STATUS.md`
alone, so it cannot collide with the task's files, but the reviewer must not
read it as scope the implementer invented.

**Ruling: the review package is generated `f783a6d..HEAD` and the reviewer is
told which commit is the controller's.** Cost if wrong: one docs-only commit
reviewed as if it were task scope — cheap, and the alternative (re-basing BASE
forward) would drop the task's earlier commits from the range, which is the
failure the skill explicitly warns about.

## Plan artifacts restored from before the fold — `e12d804`

The user asked for the pre-fold plan artifacts back, with the active plan updated
to current state and queued plans restored as-is.

**What `e12d804` folded:** 28 deletions under `.claude/skills/` and
`.agents/skills/` (agent-framework work, explicitly **not** restored), plus the
two plans. `docs/README.md` and `AGENTS.md` changes from that commit were
prose-consistency edits about one-active-plan, not folds, and are left alone.

**Ruling: the agent-framework deletions and the README/AGENTS prose stay.**
Restoring them was explicitly out of scope and the README edit still matches
`STATUS.md`'s actual rule. Cost if wrong: three docs lines a future reader may
want reverted; they are independent of both plans.

### `2026-09-25-snapping-fidelity.md` — restored verbatim, 87 → 1567 lines

`git diff` against `e12d804^` is empty: the file is byte-identical to the pre-fold
blob. Nothing in it had been amended after the fold, so "as-is" and "verbatim" are
the same artifact. Its queued banner, Global Constraints, Review Focus, the ten
task bodies and the Self-Review all return unchanged.

### `2026-09-25-editor-viewport-and-mechanics.md` — 2478 lines, updated

Restored from `e12d804^` (2430 lines) and folded to current state. Verified by
diffing each task region against the pre-fold file: **Tasks 1-8 and 10 are
unchanged character for character** apart from a one-line `**Landed** - <shas>`
marker and their step checkboxes being ticked. All 336 added lines are in the
preamble banner, Task 9, Task 11 and the Self-Review.

| Region | Change |
|---|---|
| Banner | Rewritten: active plan, Tasks 1-8 landed, Task 9 landed, Task 11 remaining, and do not re-dispatch a landed task. |
| Tasks 1-8, 10 | `**Landed** - <commits>` marker with every feature and fix-round sha verified against `git log`. Steps ticked. Bodies untouched. |
| Task 9 | The load-bearing change. Its Steps 1, 3 and 4 were wrong; the measured mechanism block replaces them (no Trigger, controlled root, virtual anchor, pointer-not-selection, jsdom `document.body` and the two selector stubs), the oracle rule is stated, and the arrow-key result is recorded as measured rather than assumed. Step 5's file list and commit message are the landed truth. |
| Task 11 | Marked the remaining task. Step 2's "no known-failing tests" claim replaced by the five-case slow-suite measurement. Step 4's capture list corrected from two names to three — `editor-canvas-context-menu` was added by Task 9 and the grep did not include it, so the gate would have run without producing the menu's own evidence. |
| Self-Review | A state-at-handoff note: what is landed, that Task 11's six boxes are the only unticked ones, and the one item verified by nobody but the implementing agent. |

**Ruling: Task 9's steps are corrected in place rather than marked landed.** A
`**Landed**` marker over text that describes a `ContextMenu.Trigger` design would
leave the plan asserting something measurably false. **Cost if wrong:** the plan is
longer than a marker would be, and a reader must notice the mechanism block is the
authority — stated in the banner and again in Step 3.

**Interleaving note.** `scripts/task-brief` reads this file, so any future brief is
extracted from the corrected text. No brief is regenerated now: Task 9 is landed and
Task 11 has no brief.

## Task 9 task review returned — Needs fixes; two Important adjudicated, one rejected

Reviewer `ad3a678b807a28b2d` (sonnet, read-only), range `f783a6d..199bb71`, package
`review-f783a6d..199bb71.diff`. Verdict: **spec ⚠️ issues found / quality Needs fixes**
— 0 Critical, 2 Important, 1 Minor.

**What the review confirmed by reading source, which is the part worth keeping:**
registry ownership is the dock's own expression verbatim (`canvas-context-menu.tsx:98-100`
against `canvas-dock.tsx:35`); `arrangeActions()` is never called and arrange cannot leak
because no `arrange:` id exists in the registry; the creation entries never enter
`OBJECT_ACTIONS`; the controlled Root + Portal + virtual anchor is what shipped and no
document-wide `preventDefault` exists; the oracle derivation is from `action.eligible` and
the length is asserted; the hit is selected before open, and `bridge.ts:110-121` re-reads
`canvas.getActiveObject()` live so `actionEnabled` sees it. It also read the capture itself
and matched the nine entries against the dock. `editor-shell.css` needed no change because
the popup reuses the positioner/menu classes Task 4 already added — the Files list naming it
is satisfied by reuse.

**Fix 1 — accepted, and it is the one that matters.** `editor.spec.ts:2253`'s
`expect.poll(activePosition).not.toEqual(before)` passes when a *lost selection* makes
`activePosition()` return `{left: null, top: null}`, because that differs from `before`. The
whole "no code change was needed" conclusion rests on that line. Ruling: replace it with an
exact-delta assertion, measured in the browser rather than derived, plus a counterfactual
(disable the `canvas.nudge-down` registration, watch the assertion fail on value not timeout,
revert).

**Fix 2 — mechanism rejected, comment defect accepted.** The reviewer argued
`editor.spec.ts:2256-2264` could fail for the wrong reason because a selection-clearing
Escape leaves `after` as `{null, null}`. **That cannot happen: `after` is read at `:2244`,
seven lines before the Escape at `:2246`.** I checked the order in the file rather than the
reviewer's description of it. Ruling: `after: before` stands as the primary assertion — it is
the requirement that an open menu blocks the arrow, which is the task's whole point. The two
real defects in that block are comment-level and go to the fix round: the comment calls the
assertion "recorded as evidence, not a requirement" while the code asserts an exact shape,
and `moved` restates `after: before` one line later. Cost if wrong: an assertion I defended
that a later run shows was fragile — it fails loudly, at the assertion, not silently.

**Fix 3 — rejected.** The reviewer asked for `aria-label` to come off `ContextMenu.Item`
because a screen reader "may announce the name twice". `aria-label` **replaces** text content
in accessible-name computation rather than appending to it, so there is no double
announcement, and the attribute is the stable handle both the DOM test and the e2e query by.
No change.

**Cross-checked, not taken on trust:** `nudge-down` is `nudgeBy(0, stepFor(event))`
(`editor-session.ts:355-357`) with `NUDGE_STEP = 1` (`canvas-nudge.ts:8`), so the expected
delta is `top: +1` — but `setPositionByOrigin(..., "center", "center")` writes a centre point
onto an origin-based pair, so the fix round measures it rather than assuming it. If the
observed delta is not `(0, +1)` that is a finding, not a reason to loosen the assertion.

### Fix round 1 dispatched

Implementer `a7f42431f6a4586d7` (sonnet) resumed — same agent, so it keeps its context on the
file it wrote. BASE `391f18c`. Scope limited to `src/web/tests/e2e/editor.spec.ts`: the
review found the component correct, so `canvas-context-menu.tsx` and its DOM test are out of
scope for this round. Dispatch record `dispatch-a7f42431f6a4586d7.md`.

**Standing constraint noted for the round:** the tree now carries three docs-only commits
above the implementer's work (`b1b99d6`, `391f18c`), which touch no source, so a source-only
diff against `391f18c` is the implementer's work alone.

## Task 9 fix round 1 landed — `1de5b8b`; scoped re-review dispatched

Implementer `a7f42431f6a4586d7` (sonnet), BASE `391f18c`, one file
(`tests/e2e/editor.spec.ts`, +22/-21). Focused case passes 1/1 in 5.2 s; format,
lint and typecheck clean.

**Fix 1, and the measurement I asked for rather than accepted from my own
derivation:** the implementer printed the real values from the browser —
`before = {left: 432, top: 418}`, after one ArrowDown `{left: 432, top: 419}`. So
the delta is exactly `(0, +1)` and `left` is untouched, which confirms
`NUDGE_STEP = 1` (`canvas-nudge.ts:8`) through `setPositionByOrigin(..., "center",
"center")`. Had they reported anything else, the arithmetic would have been a
finding rather than something to loosen the assertion around. `activePosition()`
now throws on a missing object instead of returning `{null, null}`, which is what
made the old comparison pass on a lost selection.

**Fix 2 applied as ruled:** `after: before` promoted to its own assertion with the
comment corrected to state that it is the requirement, and the redundant `moved`
key deleted. The reviewer's Escape mechanism was not implemented, correctly.

**Fix 3 correctly not implemented** — `aria-label` stays, and the implementer
independently agreed with the rejection and noted the labels are also the selector
handle both tests query by.

**Counterfactual: initially invalid, then valid — and the disclosure is the
useful part.** Their first attempt "passed with the break in source" because
Playwright previews the **built** bundle, so disabling the `canvas.nudge-down`
registration changed nothing until `npm run build`. After rebuilding, the
assertion failed as `top: 418` vs expected `419` — an exact-value mismatch, not a
timeout. That is a real counterfactual. AGENTS.md already carries the rule
("Playwright previews built bundles; rebuild affected bundles after source changes
and after reverting a deliberate break"), so **no doc change is owed** — the
implementer hit a documented trap and found it by measurement.

**Verified by me rather than taken on report:** the break was reverted
(`register("canvas.nudge-down"` count is 1 in `editor-session.ts`) and the built
bundle contains `canvas.nudge-down` with an mtime after the source's — so the
disclosed stale-build risk did not leave a broken bundle behind for later e2e
runs. Working tree clean; their transient `src/web/.pw.json/` is gone.

### Scoped re-review dispatched

Re-reviewer `a35dc4e3ee5c7d510` (sonnet), range `391f18c..1de5b8b`, package
`review-391f18c..1de5b8b.diff`. Pointed at the two places a fix of this shape goes
wrong: whether the new exact-delta assertion is non-vacuous (read order of
`before`/`after`/`nudged` against the Escape), and whether anything else was
weakened to get green. Also asked to judge whether the second counterfactual run
is convincing evidence given the first one was invalid.

## Task 9: COMPLETE — `1de5b8b` (fix round 1) on `199bb71`, plus `4d26a72`

Re-review `a35dc4e3ee5c7d510` (sonnet), range `391f18c..1de5b8b`: **all findings
addressed, no new Critical or Important breakage.** The loop is closed.

**What the re-review verified rather than accepted**, which is why the round was
worth running:

- Read order in the file, not from the report: `before` (2249) → press 1 with the
  menu open (2250) → `after` (2252) → Escape (2253) → menu hidden (2254) →
  `after === before` (2257) → press 3 (2263) → `nudged` (2264) → assert (2265).
  Nothing between 2253 and 2264 restores or re-selects, so `nudged` really is read
  after the Escape and after the third press.
- Non-vacuity worked through case by case against source: dead nudge → `418` ≠
  `419`; wrong step → `429` ≠ `419`; press-1 leaking past the menu → `420` ≠
  `419`; both presses firing → `420` ≠ `419` and also caught by `after === before`.
  Exact `toEqual` on both axes, no timeout escape. That is four distinct failure
  shapes reaching the assertion, which is the property the old
  `not.toEqual(before)` lacked.
- Confirmed nothing was weakened to get green: the deleted wrapper's
  `expect.any(Number)` clause is now enforced more strongly by the throw at
  `:2242-2247`, and the removed `not.toEqual(before)` was the vacuous one.

**Recorded, not fixed: the `+1` is a pinned constant, not a read-back.** It is
pinned to `NUDGE_STEP` and to the measured browser run, so a future `NUDGE_STEP`
change fails this test — that is the intended pin, not a defect. Noted because a
reader could otherwise mistake it for a derived value.

**One Minor new finding, fixed directly by me as `4d26a72`.** The comment at the
`activePosition` declaration still justified reading both axes with the *deleted*
control's argument ("reading `left` alone would report 'did not move'"). With the
exact-delta assertion, reading `left` alone would fail outright. Two-line comment
correction, no assertion touched; format and lint re-run clean. Not worth a fix
dispatch — the alternative is a second implementer round for a comment, and the
re-reviewer had already verified the code it annotates.

**Task 9's acceptance is therefore met:** the DOM test's registry-derived oracle,
the e2e's dock-DOM oracle, the capture read by eye against the dock's nine
entries, the four counterfactuals, and the now-exact arrow-key control.

**What remains on this plan:** Task 11, the full gate. Its six step boxes are the
only unticked boxes in the plan file.

## Task 11: Ruling: the full gate is met — plan closes

- **Step 1 broad gate:** format, lint, typecheck, 1447 unit tests, build and size
  all clean.
- **Step 2 browser suite:** 113 passed / 0 failed in ~88 s, five consecutive
  parallel runs. The one red suite found here was root-caused, not accepted:
  `canvas-probe.ts`'s ink guard spent a fixed *simulated*-time budget
  (`page.clock.runFor`) waiting for a paint that depends on *real*-time asset
  fetch and decode, so a slow asset under parallel load lost the race. Fixed by
  a real-time deadline in a shared `waitForInk`, with a `page.route` regression
  test watched RED against the old guard and then GREEN (committed `2868324`).
  The user's offer to disable parallel mode was not needed.
- **Step 3 player untouched:** size unchanged at 283.9 KB; no `viewport-manager`
  or `editor-shell` import anywhere under `packages/player`.
- **Step 4 rendered acceptance:** all five items inspected by eye, not counted.
  Three via their registered captures (`editor-zoom-readout`, `editor-toolbar`,
  `editor-canvas-context-menu` — the menu's nine entries match the dock's nine
  for one selection, in order). The two without a registered name were driven by
  hand against `vite preview`: the artboard centred with pasteboard visible, and
  the marquee, measured in world space because `ActiveSelection.enterGroup`
  rebases children's `left` — 0 → 26 selected with zero rects changed.
  Group entry was reproduced from the `grouping.vigilia-theme` fixture rather
  than the starter scene, which has no top-level Group: single click selects
  `grp`, double click makes `child` active with the layers tree showing it,
  dragging moves the child, Escape returns to `grp` with `Ungroup` re-enabled,
  and clicking the sibling `outside` still selects it.
- **Standing blocker closed:** the layer panel's bottom action row is now
  verified by eye as well as by its registry-derived DOM test — empty with no
  selection, nine actions for one object, ten for two, `Group` only for the
  multi-selection.
- **Step 5:** STATUS.md's "Last completed change" replaced (4 bullets), "Next"
  and "Blockers / unverified" updated, `npm run status:check` clean.
- **Step 6:** committed with STATUS.md, the six ticked gate boxes and the three
  regenerated baselines.
