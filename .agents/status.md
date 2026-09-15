# Status — 2026-09-14

A snapshot, and the one file here that goes stale on purpose. Every figure below
must have been printed by a command that ran — **update this file before every
commit and push** (AGENTS.md, "Commit and PR workflow").

Durable rules are in [`AGENTS.md`](../AGENTS.md), structure in
[`architecture.md`](architecture.md), decisions in
[`decisions.md`](decisions.md), lessons in [`lessons.md`](lessons.md).

## Works, end to end

A Node CLI host (`vigilia-dashboard`) serves real hardware telemetry over SSE to
the player, and the editor loads, edits and saves a theme. **TypeScript only** —
the C# tree, its solution, `global.json` and the paused CI backend job were
deleted on 2026-09-13 (26 files that had never compiled), along with
`contracts-mirror.test.ts`, whose subject no longer existed. Observed on this
machine: four baseline sensors, real readings, `cpu.load` reporting `missing`
with a reason on the first cycle and `ok` after, and an unsupplied `gpu.temp`
absent from the batch rather than zeroed.

The editor now exposes scalar chart settings for all four chart families. Rows
come from `renderer-core/src/charts/settings-fields.ts`; the inspector does not
re-list them. Same-family multi-selections show shared or mixed values, edits
are range-checked through the same descriptors, and mixed families show no
incompatible settings section.

| Check | Result |
|---|---|
| Unit tests | 1,131 passed across 54 files (2026-09-15) |
| Typechecks | six projects, clean |
| Browser tests (both projects) | 141 passed, 61 skipped, 0 failed at `--workers=2` (2026-09-14) |
| §47 size gate | 201.1 KB gzip / 400 KB (user-measured this session; player bundle byte-identical since — same content hashes in rebuild) |
| Host bundle | 34.36 kB, zero runtime deps |

**AGENTS.md is an operating manual again** (2026-09-15), remodelled on
fabric.js's own AGENTS.md at the user's request: how to work here, and nothing
about how the project is built or why. 360 lines to 289, with the architecture
summary, the four engine rules, the mirror, the blast radius and the design
principles deleted as duplicates of `architecture.md`, `lessons.md`,
`decisions.md` and `plan.md` — each verified present in its owner before
removal. `vigilia:conventions` was a 123-line third copy and is now a 28-line
pointer; it had already drifted, recommending `npm run typecheck` while
AGENTS.md still listed five hand-typed `tsc` paths, and carrying a boundary rule
a later decision reversed. The commands are now the workspace-derived npm
scripts, all five verified to exist and run. `AGENTS.md §2`/`§9` citations in six
files became named references, since numbered sections are what drifted.

Two defects fell out of the audit: old §8 required secrets to go through
`ISecretStore`, **an interface that exists nowhere in the repo** — a C#-era name
that outlived its runtime, with plan.md §101's "platform secret adapter" the
real rule; and the ownership registry pointed at four paths the manager refactor
had moved. Not claimed: no agent has yet started a session against the new file,
so whether it reads better in practice is unverified.

Style-name validation now rejects unknown properties on nodes and both text run
variants using the existing capabilities vocabulary. The schema enum is checked
against that owner. All five typechecks, 1,035 unit tests, all three builds and
the size gate passed on 2026-09-13. No schema version bump: this rejects
previously ignored unknown names while retaining the v1 property vocabulary.

Panel scrollbars no longer cover content and no panel grows a horizontal bar
(committed as `6f3b628`). One `scrollAreaStyle` owner in `button.ts`
(`overflow-y:auto` + `overflow-x:hidden` + `scrollbar-gutter:stable`); themed
thin bars via `--vigilia-scrollbar-*` tokens in `index.html`; overlay hexes now
reference panel tokens. Content padding moved from the sidebar shells onto the
scroll containers (14px leading, 6px trailing) so the bar sits close to the
panel edge. Verified: five typechecks clean, 1,045 unit tests pass,
editor+player+host build, desktop Chromium 100 passed / 1 skipped.

Chromium 1243 installed successfully, clearing the prior launch blocker. The
full browser run had two desktop timing failures: "animates by default, and not
when static is asked for" and "keeps the numeric readout stepping at the sample
rate, not interpolated". Both passed an isolated one-worker rerun. The full
suite is not clean; timing stability remains unverified.

## Next, in order

**0 — The Fabric migration. Stage 1 landed 2026-09-15.** What exists:

- **`packages/scene-fabric`**, a sixth workspace package, so Fabric is
  unreachable from `renderer-core` — whose barrel the Node host imports runtime
  values from. The boundary is structural, not a convention: there is no
  dependency edge from `host`, and the **host bundle stayed at 34.36 kB** after
  Fabric entered the workspace.
- **`VigiliaChart`**, a `FabricObject` over a detached ECharts canvas, with the
  invalidation hook, the resize flush, the render-scale cap and disposal that
  the prototype proved necessary. **Not yet wired into either display** — the
  player build is unchanged at **201.1 KB gzip of 400 KB**, because nothing
  imports it yet. Stage 2 is what moves that number.
- **`player/src/boundaries.test.ts`** — the import guard that did not exist
  before. Four rules: no bare `fabric` (95.0 KB gzip against 49.3 KB for
  `fabric/es`), no interactive `Canvas` in the display bundle (+31.0 KB it
  cannot use), no editor specifier, and a harness check that the list it scans
  resolves to real sources. All four were confirmed to **fail against a
  deliberate violation** before being trusted.
- **`toEngineOption`** in `renderer-core/src/charts/engine-option.ts` now owns
  the single `as unknown as EChartsCoreOption` cast; `mount.ts` had it inline
  and the Fabric renderer needed the identical crossing.

**A defect found on the way, and it was not small: CI's licence job has been
checking nothing since it was written.** It derived dependency names with
`require('src/web/package.json')` — a bare specifier to Node, so it threw
`MODULE_NOT_FOUND` for every manifest, left `names` empty, never entered the
loop and exited 0. Fixed with `resolve()`, and it now fails loudly if it derives
no names at all. With the fix it finds seven dependencies and all seven have
notices, `fabric` included. Every "licences ✓" in CI history before this is
meaningless.

Two smaller ones: `packages/player/tsconfig.json` had no route to the narrow
Node typings the new boundary test needs, and `vigilia:verify` told you never to
hand-type a `tsc -p` list directly above five hand-typed `tsc -p` lines.

Verified 2026-09-15: **six typechecks clean, 1,131 unit tests across 54 files**,
player + editor + host build, §47 gate 201.1 KB of 400 KB. Browser suite **not
run** since stage 1 touched no rendering.

**The persisted format was settled at the end of the session** (user,
2026-09-15): the **node tree moves to Fabric's own object serialisation** inside
Vigilia's envelope, so geometry, stacking, grouping, visibility and lock
round-trip with no conversion code and stage 3 writes **no write-back layer**.
Vigilia keeps `schemaVersion`, id, artboard, globals, assets and the semantic
layer, because `plan.ts` reads a `ThemeDocument` and replacing the envelope
would relocate translation rather than remove it. Three conditions are
requirements, now in §134: the envelope records Fabric's **pinned** major
version, a Fabric major upgrade is a `schemaVersion` migration that **refuses**
older scenes, and geometry carries an **explicit origin** — Fabric 7 already
moved the default to `center`, which would have shifted every saved scene by
half its size. **Not implemented**: the schema still describes the current node
tree, and the migration is stage 3.

Fabric 7.4.0 becomes the scene graph for
the editor *and* the player, `plan.ts` stays the only thing that decides a
frame, and `mount.ts`'s DOM applier is replaced by one shared adapter. This
supersedes the 2026-09-12 rejection: that judged two prebuilt Fabric *editors*
whose canvas would have rendered beside `mount.ts`, and §31 forbids two
renderers — making Fabric *the* renderer removes the second one rather than
waiving the rule.

`@anu3ev/fabric-image-editor` is a **reference, not a dependency** — its
property UI is demo-only and excluded from its own package, it ships no types,
and its snapshot-diff history would bake telemetry into undo entries.

Measured 2026-09-15, headless Chromium, **nothing on a device**:

| Probe | Result |
|---|---|
| Chart as a custom `FabricObject` over a detached ECharts canvas | works, incl. **rotation at 37° with no hack** |
| Live redraw while rotated | works — needs `zr.on('rendered')` → `dirty` → `requestRenderAll()`; without it, 0 renders and a frozen chart |
| 4 live charts at 1 Hz + 10 static | `renderAll` 0.28 ms mean DPR 1 · 0.86 DPR 2.75 · 0.19 Pixel 3 **emulated** |
| Chart disposal | 100 create+dispose = +82 KB heap; without `dispose()` = +15,955 KB (196×) |
| §89 styled runs in one Fabric text object | work, one shared baseline; naive `set('text')` shears the ranges, `removeChars`/`insertChars` does not |
| Player bundle | 201.1 KB today + 61.0 KB (`fabric/es`) − 4.6 KB = **~257 KB of the 400 KB gate** |
| Bare `fabric` vs `fabric/es`, identical imports | 95.0 KB vs **49.3 KB** gzip |
| Video **as a Fabric object** | **blocked** — full-canvas repaint per frame, 22.9–28.2 ms p50 against a 33.3 ms budget at 4× CPU throttle |
| Animated GIF through Fabric | **impossible** — `drawImage` yields frame 0 forever against a visibly animating `<img>` |

So: video is **one background on a DOM layer beneath the canvas**, positioned
and scaled, with the artboard as its cropping region and nothing else (user,
2026-09-15). GIF is deferred. Three settings are load-bearing, not tunable:
`objectCaching: false`, `animation: false`, and an explicit top-left origin
because Fabric 7 changed the default to centre.

**Not verified, and it is the whole risk:** no physical Pixel 3, and the E2E
suite's 57 structural assertions key on `data-node-id` / `data-vigilia-*`, which
a single-canvas scene does not have — so the safety net thins exactly when
stages 3–4 need it most.

**1 — The editor manager refactor.** PAUSED at Phase 3, and partly overtaken:
the managers Fabric replaces (selection, snapping, the transform half of
arrange) do not need finishing, while `DocumentManager`, `GlobalsManager`,
`InspectorManager` and `LayersManager` are exactly what the migration builds on.
Original plan below. Restructure
`packages/editor` as one manager per domain behind a composition root, modelled
on `fabricjs-image-editor`'s separation of concerns — see
[`decisions.md`](decisions.md) and the contract in
[`architecture.md`](architecture.md) §4. Adds no dependency. Seven phases: 0
conventions · 1 the `EditorCore` seam · 2 actions gain bodies · 3 a manager per
existing domain · 4 the DOM half · 5 the empty slots (tools, clipboard, file,
tick) · 6 the duplications the new rules forbid.

**Phase 0 — done, documentation only.** The manager contract, the
persisted/derived/transient taxonomy, folder roles, the filename vocabulary and
a 500-signal/800-stop size ceiling, plus the decision record.

**Phase 1 — done.** `EditorCore` is the composition root, with `NoticeManager`,
`DocumentManager` and `SelectionManager` behind it; `history.ts`,
`selection.ts` and `hit-test.ts` moved into `document/` and
`selection/domain/` unchanged and stayed pure. `MANAGER_REGISTRATIONS` is the single declaration — the key
union, the root's typed fields and construction order are all derived from it,
so adding a manager is one array entry. `destroy()` walks it in reverse, and a
manager that throws during `init()` unwinds what was already built.

Three of the four binding tests exist (`core/boundaries.test.ts`,
`core/editor.test.ts`): a manager may not import a peer's module, `core/` may
not reach a manager except through the table, the table must match the
filesystem, and no file may exceed 800 lines. The size rule is a **ratchet** —
`main.ts` is recorded at its current size and may not grow, and the entry is
deleted when it drops under the limit. Action coverage waits for Phase 2. **The
ceiling is editor-only so far**; it widens to every package in Phase 6, once
`renderer-core/src/theme/validate.ts` (1,138) is split.

Three defects closed as a side effect: a stale refusal message no longer
survives into the next drag (the status bar repaints on a `notice:changed`
event rather than at six call sites, two of which returned early); the
identity-refusal rule that decides whether an edit becomes an undo entry now
has one home in `DocumentManager.commit`; and `enteredGroups` can no longer be
omitted from a hit-test, because the manager supplies it rather than each of
the three call sites passing it by hand.

Verified 2026-09-14: 1,089 unit tests across 48 files, five typechecks clean,
editor + player builds, §47 gate 201.1 KB of 400 KB, `npx playwright test
--workers=2` 141 passed / 61 skipped / **0 failed**. Two guards were confirmed
the way lessons.md demands — the teardown-unwind test by disabling the unwind,
the peer-import rule by adding a real facade import — and both failed as they
should before being restored.

**Phase 2 — partly done.** The two wins that did not need later phases have
landed: `layer.toggle-visibility` and `layer.toggle-lock` are implemented once
rather than twice (the layer row passes its target to `runAction` as an
override instead of carrying its own copy of the body and undo labels), and
toolbar enablement walks the buttons the toolbars built rather than
`querySelectorAll('[data-vigilia-action]')` with a string cast back to
`ActionId`. **The `run(context)` registry migration is deferred until after
Phase 3** — most action bodies need arrange, transform and file managers that
do not exist yet, and moving them now would mean two dispatch paths.

**Phase 3 — in progress.** `GlobalsManager` is the first domain manager.
`applyGlobalAction` and `labelForGlobalAction` had been stranded at the bottom
of `main.ts`, *below* the `start()` call and three hundred lines from the panel
callback that used them; they are now the manager's `apply` and its label
table. The dependency that put them there is inverted too: `GlobalAction` and
the group metadata were declared in `globals-panel.ts`, the DOM module that
emits them, so the pure half depended on a panel's vocabulary. They now live in
`globals/domain/`, and the panel imports the contract.

Refusing a deletion also stops being the shell's problem — `refusalReason`
counts what still references a token, because "reassign those first" is part of
what refusing means (spec 0011 D3), not something a call site should recompose.

`ArrangeManager` is the second. `commands.ts` still answers only "what
document does this produce, or why not"; what the manager adds is the
five-step sequence four call sites each performed by hand — show the refusal,
commit, apply the new selection, prune, redraw. Getting one step of that
wrong is silent, and the order matters: the selection is applied *before*
pruning, or an operation that creates a group selects an id the prune then
removes.

`SnappingManager` is the third. `snapping.ts` moves to `snapping/resolver.ts`
unchanged; the manager owns the guides (wholly transient, cleared at the end
of a gesture rather than inherited by the next), the pixel threshold, and the
bounds measurement the shell used to do inline.

**One correction worth recording.** status.md has listed "snapping is computed
from the selection rather than what will move" as an open defect. Acting on
it, I added a helper expanding the moving set to include descendants — and the
test I wrote for it **passed with the helper disabled**. `collectSnapTargets`
already drops any node whose ancestor is excluded, so the helper was
re-implementing a guarantee that existed, which is the duplication rule broken
in the act of fixing something. The helper is gone. The manager now asks for
"what the gesture will transform" rather than "what is selected" because that
is the honest question, **not** because a reachable defect was demonstrated —
the two sets coincide in every case found so far, and the status.md entry
should be treated as unproven rather than fixed. The regression test stays,
reframed to pin the resolver's real guarantee, and it was confirmed to fail
when that guarantee is disabled.

`LayersManager` is the fourth, and deliberately thin: it owns one projection.
There is no layer state — a row's indentation, selectedness and effective
visibility are computed from the document and the selection every time they
are asked for, and the rows come from the **visible** document so the panel
tracks a drag rather than lagging a commit behind the canvas. Caching them is
how a layer panel ends up confidently stale.

**Not claimed:** the ratchet was **raised once by five lines** during the
Phase 2 work, before the domain managers took `main.ts` down to 1,192 (from
1,349); the raise is recorded next to the entry. The ratchet's measurement now
agrees with `wc -l`, which it did not for the first two updates. Phase 1
built the seam; the shrinking happens in Phases 2–4. The event map has exactly
one event in it, deliberately — events are added in the commit that adds their
first subscriber, so the other ~25 redraws are still explicit `render()` calls.
`collectIds` is imported from `commands.ts` by `selection/`; it is a pure
`ThemeNode` query whose real home is `renderer-core` beside `walkNodes`, and
moving it is Phase 3 or 6 work.

The safety net for phases 1–4 is `tests/e2e/editor.spec.ts`'s 57 structural
assertions, so **no `data-vigilia-*` hook may be renamed while they are in
flight**.

**DONE 2026-09-13 — a layer panel** (`8ede8d8`). Bottom-right panel below
the inspector (theme tab moved left); pure `buildLayerTree` over
`placeNodes` for effective visibility/lock, topmost-first; eye + lock toggles,
reorder via `layer.reorder-*` actions + shortcuts; hidden nodes reselectable
outside hit-testing. `ungroupNodes` now preserves `visible: false` (latent bug
fixed, tested). Shared chrome in `button.ts`, `nodeLabel` owner, colour tokens
in `index.html` CSS vars. Spec: [0012](specs/0012-editor-layer-panel.md).
Verified: 5 typechecks clean, 1,045 unit tests pass, editor+player+host build,
2/2 layer E2E pass; full editor E2E 55/57 under 10 workers with the 2 failures
passing in isolation (known timing-flake class).

**2 — Schema v2, as one change.** Sequenced *after* the refactor deliberately, so
it lands where the document model, globals and inspector each have one owner —
and so `resize-children.ts` is deleted rather than moved twice. Everything breaking together, so there's one
migration: group loses its stored transform; palette becomes rgba; gradients
become palette tokens; `fonts`/`fontSizes` become `typePresets`; a reserved
undeletable `palette.none`; `name` removed in favour of `id`; artboard
`width`/`height` editable. v1 is **refused, not migrated** (§141) — the five
in-repo fixtures get rewritten by hand. See [spec 0011](specs/0011-editor-property-model.md).

Two consequences to handle in the same change: group resize handles come off the
canvas (size isn't a group operation), which makes `resize-children.ts` dead
code; and `deleteGlobal` switches from refusing to reassigning with a
`palette.none` fallback.

**3 — The starter theme, and host theme storage.** Still the thing between this
and a usable product: the dashboard shows mostly dashes. `demo-theme.json` binds
five extended-tier keys needing LHM and hardcodes "32 GB installed" with a fixed
pie total of 32 — pointing it at real memory would render "63.7 / 32 GB", a
dashboard lying about the hardware. **Don't take that shortcut** (§97). Needs a
starter theme on real baseline keys, storage in `%APPDATA%/vigilia/`, and a menu
bar for open/save/activate.

**Then:** LAN opt-in with pairing codes (§7) · the LHM provider · disk and
network in the baseline provider (needs `systeminformation`, and a
THIRD-PARTY-NOTICES entry *first*) · a tray.

## Not verified — don't report these as working

- **No LAN bind has ever been exercised.** `--host`, the LAN address print and
  the editor's 403 for a non-loopback peer are source-level only.
- **No pairing, no revocable sessions.** `--host` is the only opt-in.
- **Nothing has run on a real phone.** A Pixel 7 viewport is not a Pixel 7.
- **Keep-latest has never met a slow socket.** Unit-tested against a fake; the
  `drain` path in `transport/sse.ts` is undriven.
- **The LHM tier is a contract with no implementation.** Every temperature, fan,
  power and clock key is unsupplied.
- **The browser suite never exercises the host.** Playwright previews each
  bundle on its own port; there is no HTTP test of the host at all. This is how
  the editor once shipped unable to boot while all five checks passed.
- **No pixel baselines**, deliberately — CI is Linux, development is Windows.
  Committed screenshots are *evidence*, refreshed with `VIGILIA_CAPTURE=1`; a
  capture lands mid-animation so they are never byte-reproducible.
- **Spec 0011 D0, D4, D6–D10 are specified, not implemented.** D1, D2 and D5
  have landed.
- **~25 editor defects confirmed by audit remain open**, each
  browser-reproduced: an entered group is never left by clicking outside it; a
  locked node can be grouped then moved through its group; snapping is computed
  from the selection rather than what will move; a multi-selection can't be
  rotated; distribute's refusal names the wrong number; every inspector edit
  commits even a no-op; invalid global values are accepted while the canvas
  keeps painting the old one; unsaved work is discarded silently on open; the
  editor never ticks, so binding readouts are frozen while authoring.
- **CI has not run since the host landed** until the most recent push.

## Needs a human

**Nothing.** The four design-document amendments that were blocking are written
into [`design/plan.md`](design/plan.md) directly — that document is agent-owned
as of revision 10, so approved changes no longer wait on a paste.

What is still wanted from the user is **goals, product taste, scope, and any
decision with external effect** — not architecture. See the plan's preamble.

---

Durable lessons from past sessions are in [`lessons.md`](lessons.md), not here —
this file is a snapshot and that one is not.
