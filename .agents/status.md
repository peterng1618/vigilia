# Status — 2026-09-15

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
| Unit tests | 1,237 passed across 63 files (2026-09-15) |
| Typechecks | six projects, clean, locally **and in CI** — the step runs `npm run typecheck` rather than a hand-written list (2026-09-15) |
| Browser tests (both projects) | 164 passed, 62 skipped, 0 failed — **three consecutive runs** (2026-09-15). Earlier runs needed a *third* attempt, each failing a different single test. **Root cause found and fixed**: `page.clock.install` does not stop time. See below |
| §47 size gate | **261.9 KB** gzip / 400 KB (2026-09-15) — Fabric is now in the display bundle, costing **+60.6 KB** |
| Host bundle | 34.36 kB, zero runtime deps (2026-09-15) |

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
two desktop timing failures recorded here — "animates by default, and not when
static is asked for" and "keeps the numeric readout stepping at the sample rate,
not interpolated" — were **diagnosed and fixed on 2026-09-15**; both were the
clock bug below. Timing stability is now three consecutive clean runs on this
machine, which is evidence rather than proof.

## Next, in order

**0 — The Fabric migration. Stage 3 was re-cut before it started (2026-09-15),
its three format questions are settled, and the first of its three pieces has
landed.**

**Landed: the persisted surface.** `scene-fabric/src/persist.ts` is the one
owner of scene ⇄ JSON — defaults stripped, `id` carried through
`propertiesToInclude`, `loadFromJSON` behind the same module so the
`classRegistry` registration cannot be bypassed. `VigiliaChart`'s `toObject`
override is gone, and `settings` is deep-frozen on assignment, which closes the
by-reference aliasing hole (`toObject().settings` **is** the live object) with a
mechanism rather than a replace-only convention.

`persist.dom.test.ts` asserts the exact emitted key set for all seven persisted
classes with `toEqual`, not `toMatchObject`; that `subTargetCheck`,
`interactive` and `layoutManager` are absent, **and** that they return the
moment a group sets them, so stage 4 inherits a failing test rather than a
comment; that identity survives a whole-canvas round trip including group
children; that matching is by id and never by position; and — a source scan —
that `persist.ts` is the only module in the package calling `toObject`, because
the way to break the rule is to not call it. Four guards confirmed by sabotage
before being trusted: stop stripping defaults → 9 failures, drop the `['id']`
argument → 11, remove the freeze → 1, add a stray `toObject` → 1.

`packages/scene-fabric/tsconfig.json` gained the shared narrow Node typings the
source scan needs — the same entry `player` and `editor` already carry.

| Check | Result (2026-09-15) |
|---|---|
| Unit tests | 1,235 passed across 62 files |
| Typechecks | six projects, clean |
| Builds | player, editor, host |
| §47 size gate | **261.8 KB** gzip / 400 KB |
| Host bundle | 34.26 kB |
| Browser suite | 162 passed, 62 skipped, **2 failed** — both the timing class, fixed by the commit below |

**Landed: the browser suite's flakes, diagnosed and fixed.** `page.clock.install`
does not stop time — measured, 1213 ms of drift over 1200 ms real; `pauseAt`
gives 0 ms. `tests/e2e/clock.ts` is now the one owner of the sequence, and 21
call sites that each open a player go through it. Three further measurements
shaped it: `pauseAt` alone is the whole call (pairing it with `install` races
under load and throws "cannot fast-forward to the past"), the clock is
**context**-scoped despite living at `page.clock`, and it survives navigation
exactly.

**Three things in `mount.ts` fell out of writing the first unit test that ever
mounted it**, and the second and third are worse than the one being fixed:

- The text branch had **no** update guard, so every text node's spans were
  destroyed and rebuilt on every 1 Hz tick. That is what detached Playwright's
  span handles mid-assertion — `getComputedStyle` on a detached element returns
  empty strings rather than throwing, which is exactly what the styled-run test
  checked.
- The **style** guard compared `previous.style !== node.style` by identity, and
  `resolveStyleMap` returns a fresh object every build — so it was true on every
  tick and never once prevented a write. The comment above it says identity
  cannot work here; the sibling `sameBox` compares fields.
- The `applied` map every guard compares against was **never seeded at mount**,
  so the first update after mount rewrote every box, style and text in the
  scene.

`mount.dom.test.ts` asserts span identity across an unchanged update, and the
counter-case. All three fixes confirmed by sabotage, with the counter-case
staying green each time.

**And the flake was hiding a recorded "limitation".** "Any frame with a chart in
it is not byte-reproducible" was measured on both ECharts renderers and written
into `screenshots/README.md`, spec 0013 and a test asserting it. It was
measuring the clock. With the clock stopped, chart frames are byte-identical;
the test is inverted and is now the regression guard for `clock.ts`. Pixel
baselines stay out for the reason that actually blocks them — CI is Linux,
development is Windows. Two dead links to a `gate-0.md` that no longer exists
were fixed in the same pass.

| Check | Result (2026-09-15) |
|---|---|
| Unit tests | 1,237 passed across 63 files |
| Typechecks | six projects, clean |
| §47 size gate | 261.9 KB gzip / 400 KB |
| Browser suite | **164 passed, 62 skipped, 0 failed — three consecutive runs** |

That last row is the point: the recorded state was a suite needing three
attempts with the cause unknown. **Still not claimed:** nothing here was run in
CI, `phone-chromium` runs nowhere but locally, and three clean runs on one
machine is evidence rather than proof.

**Stage 3 splits, because it asserted three things that cannot all hold** — the
same shape of problem as the stage 2/3 re-cut. It said the persisted `nodes`
tree becomes Fabric JSON *here*, that the editor moves at stage *4*, and that no
converter exists. Measured: `packages/editor` reads `ThemeDocument.nodes` in
**15 files**, five of them structurally (`commands.ts`, `arrange/commands.ts`,
`geometry.ts`, `inspector/apply.ts`, `layers/tree.ts`) — roughly a third of the
editor's 8,869 non-test lines. So the envelope change moves into **stage 4, with
the editor**, and stage 3 becomes *the player is the canvas*: the persisted
surface, then text parity, then the flip and the E2E port.

**Text parity comes before the flip** (user), inverting what stage 5 implied.
Ellipsis, the line clamp, vertical alignment and the font-load re-measure are
all `onUnsupported` gaps that `display.spec.ts` asserts today; flipping first
would ship them as regressions to the only product surface for two stages *and*
delete the assertions that would notice.

**Refuse, and strip defaults** (user), which was one decision rather than two.
Fabric's own origin migrator needs explicit origins; explicit origins need
`includeDefaultValues = true`, because stripping drops an origin equal to the
default and — measured — asking for it by name does not rescue it. So migrating
costs ~3× the document size, 7.4.0's default values baked into every object and
a hand-written filter for `subTargetCheck`/`interactive`/`layoutManager`, while
refusing gets all three for free. §134's explicit-origin condition changes
mechanism accordingly, and `VigiliaChart`'s `toObject` override is withdrawn.
Measurements in [`decisions.md`](decisions.md).

Ahead, in order: text parity · the flip and the E2E port
(of 44 cases per project, ~26 port directly, 8 need a probe surface the adapter
does not expose — a text segment's `status` has no canvas carrier — and ~3 are
DOM artefacts to delete rather than port).

**Stage 2 landed 2026-09-15**, behind an opt-in. What exists:

- **`scene-fabric/src/adapter.ts`** — `createSceneAdapter`, the one owner of
  `ScenePlan` → Fabric, imported by both ends. It reconciles a plan **onto** a
  canvas and creates an object only for an id it cannot find, which is the
  direction stage 3 needs; `adoptExisting` indexes objects already on the canvas
  by their `id`, so a scene revived by `loadFromJSON` will be configured rather
  than replaced. Every `PlanContent` kind except video, which was measured and
  rejected as a canvas object.
- **`?scene=fabric` in the player.** The DOM applier is still the default. Both
  return the same `SceneHandle`, so `main.ts` branches at one call and the flip
  deletes a branch — the stage 2/3 boundary was re-cut for this reason, recorded
  in spec 0013.
- **`tests/e2e/display-fabric.spec.ts`** — 9 tests, 8 running per project. It
  asserts what jsdom cannot: that ink lands, that all four chart families draw
  through a Fabric object in a real browser, that the artboard transform is in
  `viewportTransform` with a uniform scale and no skew, that each chart's
  detached canvas is oversampled by the device ratio, and that **both render
  paths draw the same node ids**.
- **`grid.ts`, `jsdom`/`canvas` declared, CI typechecking six projects, and a
  `StaticCanvas.loadFromJSON` test** — the four stage-2 housekeeping items from
  the review, all four closed, one of them ("labels reserve no space") corrected
  rather than fixed.

**Measured, not predicted:** the player bundle is **261.7 KB gzip of 400 KB**,
against the spec's estimate of ~257 KB. 1,218 unit tests across 61 files, six
typechecks clean, 164 browser tests passed with 0 failures.

**Then the two paths were put side by side, and five things were visibly wrong**
— none of which any test had caught. Every text run that inherited its colour
was invisible; a group with no authored size culled its whole subtree (three
levels of nesting gone, and a sizeless group is the *normal* case in this
format); every image inside a group was dropped; vector icons drew mangled at 1x
and not at all at 4x; and a corner radius clamped per axis rather than
proportionally. All five are fixed, each with a test verified by sabotage, and
the generalisable part is in [`lessons.md`](lessons.md) — including that the
first two ink measures were themselves vacuous.

**Two claims this stage disproved, both recorded where they were made.** The
review's `grid.containLabel` finding said axis labels reserved no space
anywhere; measured, the deprecated key laid out identically to its replacement.
And `chart-object.ts`'s "single most load-bearing line" — the ECharts
invalidation hook — is **masked on the player's path**: removing it changes
nothing in the browser suite, because the adapter re-renders every frame and
engine animation is off. It still protects a grouped chart whose siblings do not
change, and the editor, so it stays — but the assertion that covers it is a unit
test, not an end-to-end one.

**What is not verified.** The three chart-bearing fixtures and the assets
fixture have been compared against the DOM path by eye at 1x and 4x, and
`portrait-cover` has not. Text sits **about 2 px higher** than the DOM path at
the demo fixture's type sizes — a baseline difference, unmeasured and not
chased, since stage 5 owns text metrics. Text is deliberately incomplete: ellipsis,
the line clamp and the font-load re-measure are stage 5, and the renderer
reports each as a gap rather than approximating it. The monochrome image path
(§111) reports a gap and draws the artwork unflattened. Nothing has run on a
physical phone.

**Stage 1 landed 2026-09-15.** What it left:

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

As committed (`685a192`, 2026-09-15): six typechecks clean, 1,131 unit tests
across 54 files, player + editor + host build, §47 gate 201.1 KB of 400 KB.
**Superseded by the review below** — the chart object did not work, and the
current figures are in that section rather than here.

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
half its size.

That explicit origin is now **`center` rather than top-left**, and "explicit"
turned out to mean more than writing the value: Fabric strips any property
equal to its default and an instance cannot opt out, so the origin is re-added
after serialising and asserted with defaults stripped. See the review below.
**Not implemented**: the schema still describes the current node tree, and the
migration is stage 3.

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
2026-09-15). GIF is deferred. Four settings are load-bearing, not tunable:
`objectCaching: false`, `animation: false`, an explicit **`center`** origin
(Fabric 7 changed the default *and* deprecated every other value, so the
top-left conversion lives in the adapter), and `strokeWidth: 0` on charts.

**Not verified, and it is the whole risk:** no physical Pixel 3, and the E2E
suite's 57 structural assertions key on `data-node-id` / `data-vigilia-*`, which
a single-canvas scene does not have — so the safety net thins exactly when
stages 3–4 need it most.

### Stage 1 reviewed, and it did not work (2026-09-15)

Reviewed at the user's request before stage 2 could build on it. The chart
object **could not be constructed**: `option` was a getter with no setter, and
Fabric's only entry path (`_setOptions` → `set` → `this[key] = value`) therefore
threw a `TypeError` on every construction that supplied one. Nothing caught it —
no unit test instantiated the class, by a deliberate decision to leave mounting
to stage 2's browser tests, so the suite commit `685a192` recorded as green was
green over an unbuildable object. Reproduced against Fabric's exact code path
before fixing.

The deferral is now undone: `chart-object.dom.test.ts` mounts real charts under
`jsdom` plus the `canvas` package already in the tree, which needs no browser
and no new dependency. It constructs all four families, serialises, revives
through Fabric's own path, and asserts the grouped-cache invalidation. Nothing
in it compares a pixel; that stays Playwright's.

Four things Fabric already donates were hand-written, and each failed silently:

| Hand-written | Handed back to Fabric | What it would have cost |
|---|---|---|
| `toObject` override | `static customProperties` | A second list beside the declared one; also bypassed `includeDefaultValues` |
| `fromObject` override | inherited `fromObject` | Skipped `enlivenObjectEnlivables`, so a serialised `clipPath` or gradient revived as a plain object — and stage 2 clips to the artboard |
| `getDefaults()` **and** a constructor `set` | `static ownDefaults` | Defaults declared twice; `getDefaults()` was never called on construction, so only the duplicate ran |
| `this.dirty = true` | `this.set('dirty', true)` | `_set` is what propagates dirtiness to a parent. A Fabric `Group` caches by default, so any **grouped** live chart would have frozen |

Also corrected: `strokeWidth` was left at Fabric's default of 1, which is the
entire 1.4 px bounding-box error recorded above — `1 × (cos 37° + sin 37°)` is
1.4004 against a measured 1.4 on both axes, so it was a fixable defect read as
noise. And the `renderScale` cap was on the scale factor, which does not bound
memory (cost is `w × h × scale²`); it is now two ceilings, factor and pixel
area, and the area one never undersamples.

**The §67 guard was passing over the defect it existed to catch.** The chart
serialised `['family', 'option', 'renderScale']` and the test asserted no key
*name* looked like telemetry. Every name passed; the samples were inside
`option`, as `series[].data`. The surface is now `['family', 'settings']` —
`ChartContent`'s keys, authored values only — so no sample can be written at
all. `renderScale` also left, being device state in a portable document.

Three format decisions taken now rather than at stage 3, because stage 3 freezes
them (all three the user's, 2026-09-15): typed settings rather than the built
option; **§137's no-geometry rule dropped** so a Fabric `Group` persists with its
geometry; and the origin written as `center` rather than the deprecated `left`.

| Check | Result (2026-09-15) |
|---|---|
| Unit tests | 1,157 passed across 56 files |
| Typechecks | six projects, clean, locally **and in CI** — the step runs `npm run typecheck` rather than a hand-written list (2026-09-15) |
| Builds | player, editor, host all build |
| §47 size gate | 201.1 KB gzip / 400 KB — unchanged, nothing imports `scene-fabric` yet |
| Host bundle | 34.36 kB |
| Guard verified by disabling the fix | removing the `option` setter fails 13 assertions; reverting `set('dirty')` to a field assignment fails the grouped-cache test; removing the origin from `toObject` fails the stripped-defaults test; dropping a `ChartContent` key fails the typecheck, naming the key |

The browser suite was run three times. Runs 1 and 2 each failed exactly one
test, and **not the same one** — `display.spec.ts:390` (styled-run spans,
phone), then `display.spec.ts:850` (readout stepping, desktop). Both passed in
isolation, the first also passed in isolation with these changes stashed, and
run 3 was clean at 141 passed / 61 skipped / 0 failed. That is the timing-flake
class already recorded for the editor suite, not a regression. It is still not
a clean bill of health: **the flakes are unexplained, nobody has diagnosed
them, and a suite that needs three attempts is a suite that can hide a real
failure.** *(Diagnosed and fixed later the same day — `page.clock.install` does
not stop time. See the top of this file.)* Stage 1 imports into no rendering path, and the
size gate prints the same 201.1 KB as before — **no hash comparison was run**,
so that is unchanged in size, not proven byte-identical.

**Not verified:** nothing in this stage has been *rendered*. Every claim about
construction, grouping, disposal and the JSON round-trip rests on Fabric's
source and on Node-level assertions, not on pixels — the chart object is still
imported by nothing. The editor also still implements §137's old no-geometry
rule (`capabilities.ts`, `resize-children.ts` and its import in
`editor/src/main.ts`); that is stage 4 and is **not** done.

### Stage 1 reviewed independently, and the object held up (2026-09-15)

A second review, this one asked to form its own view and to verify by running
rather than reading. Ran the suite (1,157 across 56 files), all six typechecks,
the size gate (201.1 KB / 400 KB), and a throwaway jsdom suite against
`VigiliaChart` to try to falsify specific claims. **The object itself came out
clean** — the `toObject` origin override is load-bearing (falsified by calling
`FabricObject.prototype.toObject` directly: no origin survives), `fromObject` is
genuinely not overridden, `getDefaults()` composes correctly through
`InteractiveFabricObject`, and **every Fabric source citation in spec 0013
resolves**. The prototype-shape test and the `AssertNever` guard are both sound
mechanisms.

What the review found is around the object, and spec 0013 has been amended
throughout (marked *review 2026-09-15*). Ranked:

| Finding | Where it lands |
|---|---|
| **Fabric donates more than the migration map credited.** `fabric/extensions` ships `AligningGuidelines` (object snapping *with* guides), `installOriginWrapperUpdater`, crop controls and gradient controls; core ships `snapAngle`, `Collection`'s z-order methods, the `lock*` props and `Group.subTargetCheck`/`interactive` for group entry/exit. Four migration-map rows changed verdict | spec 0013, corrected map + new *What Fabric already donates* |
| **Node identity was not in the persisted format at all.** Measured: Fabric emits no `id` and drops one passed in; `CHART_SERIALISED_KEYS` has none. Bindings, `PlanIssue.nodeId`, the layer tree and the plan-to-object match all key on it | spec 0013, *Settle before stage 3* — blocks stage 3 |
| **Three claims cannot all hold**: `plan.ts` untouched, Fabric's format as the tree, no write-back layer. Resolved in favour of Fabric owning geometry and the plan being applied *onto* live objects; `planBox` narrows and `plan.ts` moves from KEEP to ADAPT | spec 0013, *After stage 3, Fabric owns geometry* |
| **`includeDefaultValues` defaults to `true`**, so a persisted object carries 33 keys, not 10 — and turning it off breaks §134's origin condition for every built-in class, not just the chart. Unchosen either way | spec 0013, *Settle before stage 3* — blocks stage 3 |
| ~~**`grid.containLabel` has been inert app-wide**~~ — **fixed, and the finding was half wrong.** The deprecation warning was real; "labels reserve no space anywhere" was inferred from it and is false. Measured: the deprecated key lays out *identically* to its replacement. The builders moved to `outerBoundsMode`/`outerBoundsContain` under one owner, `charts/grid.ts`, and `grid.dom.test.ts` measures the layout instead of asserting a key | done; table in `decisions.md` |
| **`subTargetCheck`, `interactive` and `layoutManager`** are forced into Fabric's own `Group.toObject` — editor state and engine internals in a portable document, with no rule governing them | spec 0013, *Settle before stage 3* |
| **Custom properties serialise by reference**: `chart.toObject().settings === the live object`, so a later in-place edit rewrites an earlier snapshot. Same defect class as the §67 rule, different door | spec 0013, *Telemetry* |
| ~~**`jsdom` and `canvas` are undeclared**~~ — **fixed.** Root devDependencies beside vitest, and in `THIRD-PARTY-NOTICES.md`. `canvas` is native, so npm continued silently when a prebuild was missing and the DOM tests lost their 2D context without failing | done |
| ~~**CI does not typecheck `scene-fabric`**~~ — **fixed**, by calling `npm run typecheck`. Residual: `--if-present` still skips a package with no such script, in silence | done, residual noted in spec 0013 stage 2 |
| ~~**`StaticCanvas.loadFromJSON` has no test**~~ — **fixed.** Verified by sabotage: dropping `classRegistry.setClass` fails the new test and leaves the other eleven in that file green | done |
| **The boundary test has three holes**, one asserted as intended (`* as fabric`), plus a comment about `fabric/extensions` that is factually wrong. Comment fixed on this branch | spec 0013 *Risks*; `boundaries.test.ts` |
| Prose corrections: §85's gap list does not contain the four canvas-text gaps; §126 is deferred, not "dropped"; §2 does not exist; `mount.ts` is 766 not 767 and `plan.ts` 692 not 687; the E2E DOM hooks are 233 lines / 71 `expect()` calls, not 57 | spec 0013, throughout |

**Raised, not changed:** whether a Fabric major bump should **refuse** every
saved theme (§134's condition and `decisions.md`, the user's decision on
2026-09-15) or run Fabric's own `installOriginWrapperUpdater`. The decision was
taken on the premise that Fabric has no migration story, and that premise is
false — Fabric stamps `version` on every object and ships the updater for
exactly the 6→7 origin change. Reversing a user decision is not an agent's call;
it is recorded in spec 0013's *Open, and not this spec's to close* and should be
settled before stage 3 bumps `schemaVersion` for the first time.

The full gauntlet was then run on the amended tree, and **the browser suite was
clean on the first attempt**: six typechecks, 1,157 unit tests across 56 files,
all three bundles built, the size gate at 201.1 KB / 400 KB, and
`npm run test:e2e` at 141 passed / 61 skipped / 0 failed in 1.9 min. One clean
first run does not explain the flakes recorded above — it is one more data point
against a suite that has needed three attempts, not a diagnosis. *(The diagnosis
came later the same day; see the top of this file.)*

**Not verified by this review:** nothing was rendered *by a Fabric object* —
the gauntlet exercises the existing DOM renderer, and `scene-fabric` is still
imported by nothing. So every visual and performance figure in spec 0013 remains
as measured by the prototypes, which no longer exist. The two worth re-measuring
before the stage that leans on them are `renderAll` (0.28 ms / 0.86 at DPR 2.75,
stage 2) and the video throttle figure (22.9–28.2 ms p50, stage 7). The
`+61.0 KB` Fabric projection is also still a projection; the gate prints
201.1 KB because nothing imports `scene-fabric`. Whether `fabric/extensions`
double-bundles Fabric is unmeasured and is the gate on adopting
`AligningGuidelines`. No physical device, and a Pixel 7 viewport is not a
Pixel 7.

**Spec 0013 stages 6–8 are still not described anywhere in this file** — live
telemetry, media, cleanup. Stage 5 is now named above (tokens, plus the text
§85 gaps left behind when text's layout half moved into stage 3), but a reader
of this file alone would still conclude the migration is a five-stage job.

**`vigilia:verify` is now tiered** (2026-09-15, the user's call after that
commit ran all five steps to check two prose files and a test comment). It grades
the paths being committed — PROSE / UNIT / E2E / FULL — and runs only what the
change can affect, safe because CI re-checks everything on push. Measured costs:
typecheck ~25 s, unit tests 17 s, three builds 22 s, size gate instant, browser
suite ~114 s. **Reports now name the tier**, so a figure that was measured can
be told from a step that was not run. The two CI gaps above are what bound it:
`phone-chromium` runs nowhere but locally, and CI typechecks five projects of
six. See `decisions.md`.

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
migration: ~~group loses its stored transform~~ (**reversed 2026-09-15** — a
group keeps its transform and gains Fabric's; see spec 0013's *Groups*); palette becomes rgba; gradients
become palette tokens; `fonts`/`fontSizes` become `typePresets`; a reserved
undeletable `palette.none`; `name` removed in favour of `id`; artboard
`width`/`height` editable. v1 is **refused, not migrated** (§141) — the five
in-repo fixtures get rewritten by hand. See [spec 0011](specs/0011-editor-property-model.md).

One consequence to handle in the same change: `deleteGlobal` switches from
refusing to reassigning with a `palette.none` fallback.

The other one is gone. "Group resize handles come off the canvas, which makes
`resize-children.ts` dead code" was reversed on 2026-09-15: a group has geometry
again, resize is a group operation, and Fabric's `LayoutManager` performs it —
so `resize-children.ts` is deleted as *superseded* rather than as dead, at spec
0013 stage 4.

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
