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
the C# tree, solution and paused backend CI job are gone.

Observed on this machine: four baseline sensors, real readings, `cpu.load`
reporting `missing` with a reason on the first cycle and `ok` after, and an
unsupplied `gpu.temp` absent from the batch rather than zeroed.

The current editor exposes scalar chart settings for all four chart families.
Rows come from `renderer-core/src/charts/settings-fields.ts`; same-family
multi-selections show shared or mixed values, edits are range-checked through
the same descriptors, and mixed families show no incompatible settings section.

| Check | Latest recorded result |
|---|---|
| Unit tests | **1,251 passed across 64 files** (2026-09-15) |
| Typechecks | **six projects clean**; CI calls workspace `npm run typecheck` rather than a hand-written project list |
| Browser tests | **164 passed, 62 skipped, 0 failed** on the latest recorded clean run. Display timing flakes were diagnosed; the editor suite still has an undiagnosed contention-only flake that passes in isolation |
| §47 player size gate | **262.4 KB gzip / 400 KB**; Fabric adds about 60.6 KB to the display bundle |
| Host bundle | **34.36 kB**, zero runtime dependencies |

`AGENTS.md` is now an operating manual rather than a second architecture file;
`architecture.md`, `decisions.md`, `plan.md`, `lessons.md` and the specs own the
durable design. CI's licence check was also fixed: it had previously derived no
dependency names and exited green without checking anything.

---

## Current Fabric migration state

### The renderer migration is real and should be kept

`packages/scene-fabric` is now the shared Fabric rendering package. Fabric stays
out of `renderer-core`, so the Node host cannot accidentally pull browser scene
graph code into its bundle.

The important pieces that exist and have meaningful test coverage:

- `createSceneAdapter` reconciles a `ScenePlan` onto a Fabric canvas and is the
  shared plan → Fabric owner.
- `VigiliaChart` renders ECharts into a detached canvas and blits it through a
  custom Fabric object.
- Charts support **rotation**, including live redraw while rotated.
- Chart engine animation is disabled; Fabric invalidation is explicit.
- Charts use `objectCaching: false` and `strokeWidth: 0`; both were measured as
  load-bearing rather than stylistic choices.
- Chart backing resolution is bounded and adapts to render scale / DPR.
- Chart teardown disposes ECharts; removal without disposal was measured to leak
  heavily.
- Images, SVG, shapes, groups and text render through the shared adapter.
- Text parity work landed for clipping, single-line ellipsis, wrapped line
  clamping, vertical alignment and font-load re-measurement.
- The player has a working Fabric path behind `?scene=fabric`.
- The old DOM renderer is **still the player default**.
- The editor is **still rendered through the old DOM path plus the old custom
  interaction overlay**. The hard editor migration has not happened yet.

This means the branch has convincingly validated **Fabric as Vigilia's shared
renderer**, but has not yet validated the chosen editor foundation.

### The ECharts/Fabric result is strong

Measured/proven in this branch or the migration prototypes:

| Capability | Result |
|---|---|
| ECharts rendered through a custom Fabric object | pass |
| Rotation at arbitrary angle | pass; 37° explicitly exercised |
| Live redraw while rotated | pass |
| Proportional resize by re-layout | pass |
| Four live charts at 1 Hz + static scene | fast in Chromium emulation; **not physical Pixel 3 evidence** |
| Serialization/revival | pass with custom class registration |
| Disposal | pass when explicitly disposed; removing the object alone is insufficient |
| Player bundle | comfortably inside the current 400 KB placeholder gate |

For chart authoring, keep the product compromises already approved:

- **rotation is required**;
- proportional resize is enough; arbitrary stretch/skew is not required;
- grouping may be restricted or unavailable if it creates disproportionate
  complexity;
- changing an existing chart to another family is not required;
- chart-property changes do not have to participate in undo/redo;
- direct-manipulation QoL is secondary to correct rendering and complete
  property controls;
- every supported chart setting must still be editable through the property UI
  of the **new editor foundation**, not necessarily the legacy Vigilia inspector.

### Player flip is still ahead

The DOM applier remains the default. Stage 3 should still complete the player
flip and port the E2E coverage that is meaningful on a canvas scene. DOM-only
tests should be removed rather than recreated as fake canvas hooks.

The display clock issue is fixed: `page.clock.install({ time })` did not stop
wall time; `pauseAt` does. With the clock actually stopped, chart frames are
byte-reproducible in the same environment. The separate editor-suite contention
flake remains undiagnosed.

### Physical Pixel 3 remains the important performance unknown

The target low-end mobile device is **Google Pixel 3**.

Nothing in this branch has run on a physical Pixel 3. Pixel-3-sized Chromium
emulation is useful for viewport/DPR correctness but is not CPU, GPU, thermal or
memory evidence. Do not report physical-device performance until it has actually
been measured.

---

## Persisted format — settled and reaffirmed by the user

**Do not reopen this merely in pursuit of a shorter or more human-readable JSON
file.** The user explicitly reaffirmed this direction after reviewing the
migration on 2026-09-15.

The priority is **minimal glue and minimal mapping code**, not a simplified theme
file.

The target persisted shape is:

```text
Vigilia envelope
├── schemaVersion / identity / metadata
├── artboard
├── globals / design tokens
├── assets / semantic data
├── pinned Fabric major
└── scene = Fabric's own object serialization
```

Fabric owns scene geometry, grouping, stacking, visibility, lock and other
scene-object state. A long or complex JSON document is acceptable if it avoids a
parallel simplified node tree plus a bidirectional conversion/write-back engine.

The rules already chosen remain:

- Fabric is pinned exactly.
- The envelope keeps Vigilia's `schemaVersion` and semantic data.
- A Fabric major upgrade is treated as a persisted-format migration and older
  scenes may be refused rather than silently reinterpreted.
- Fabric defaults are stripped so the scene stores authored deviations rather
  than every engine default.
- `id` is explicitly included because Fabric does not persist Vigilia identity
  by default.
- Custom chart objects persist **authored** `family` + typed `settings`, not the
  built ECharts option, telemetry samples or device render scale.
- Fabric groups may persist their own geometry. The old "groups are structural
  only" rule is superseded.

`scene-fabric/src/persist.ts` is already the one owner of scene ⇄ JSON and has
round-trip tests for identity, groups and custom classes.

The schema/envelope switch has not landed yet. Coordinate it with the editor
migration rather than inventing a second temporary document model.

---

# STOP BEFORE STAGE 4 — editor foundation decision reopened

**This is the most important instruction for the next work session.**

The user reviewed the branch on 2026-09-15 and **reopened the decision to reject
`fabricjs-image-editor` as the actual editor foundation**.

Do **not** continue expanding Vigilia's home-grown editor-manager framework, and
do **not** begin Stage 4 by wiring stock Fabric directly into the current custom
editor, until the source-level `fabricjs-image-editor` path has been seriously
prototyped.

The previous discovery concluded that `fabricjs-image-editor` added too little
and should be used only as a reference. That conclusion is now considered
insufficiently supported for the project's actual priorities.

Why it is reopened:

- The entire reason for this migration is that **building and maintaining a
  graphics editor from scratch has been extremely costly**.
- `fabricjs-image-editor` contains a substantial suite of managers for generic
  editor behaviour: canvas, clipboard, grouping, history, image, text/font,
  deletion, backgrounds, cropping, controls and other editing concerns.
- Its demo already behaves well for the generic editing tasks Vigilia needs.
- The earlier evaluation leaned too heavily on weaknesses of the **published
  package**: missing shipped type declarations, demo-only UI pieces and an
  unsuitable history implementation.
- Those are weak objections when the user has explicitly approved a
  **permanent source fork**. We may modify or replace unsuitable subsystems.
- Upstream compatibility is useful while the author remains active, but it is
  not a product requirement. A Vigilia fork that never receives another
  upstream update is an acceptable successful outcome.

The user prefers owning a fork of an already capable editor over owning a second
editor implementation modelled after it.

## What to do first tomorrow

### 1. Treat `../fabricjs-image-editor/` as source, not as an npm package

It is already cloned beside Vigilia under `git-repo/fabricjs-image-editor`.
Do not re-clone it and do not judge viability from its npm export surface alone.

Read the actual source and tests. Build a concrete inventory of managers and
behaviour that Vigilia could inherit versus code Vigilia would still have to own.

At minimum audit:

- canvas creation and lifecycle;
- selection and Fabric controls;
- object move/scale/rotate;
- grouping/ungrouping;
- clipboard / duplicate;
- deletion;
- layer/z-order behaviour;
- snapping, guides and alignment support;
- image and SVG handling;
- text editing and font loading;
- shape creation;
- background/media handling;
- serialization/revival hooks;
- custom Fabric-class compatibility;
- keyboard/action routing;
- history;
- property-editing UI architecture, including code that may live only in the
  demo application.

Do not summarize this as "the package lacks X" if the source contains X or can
be modified to provide it.

### 2. Build a source-fork spike before more custom editor infrastructure

The spike should answer whether a Vigilia fork can become the real editor shell.
Do not try to make it production-complete.

Minimum useful proof:

```text
fabricjs-image-editor source fork
        │
        ├── existing generic editor mechanics
        ├── VigiliaChart custom Fabric class
        ├── load/revive a small Vigilia Fabric scene
        ├── select / move / rotate / proportional-resize chart
        ├── ordinary text/image/shape editing
        └── Vigilia-specific property control proof
```

Use the existing `scene-fabric` chart implementation rather than reimplementing
it in the fork. If package boundaries need to move later, prove the behaviour
first and decide packaging second.

### 3. Do not require the fork to keep every upstream subsystem

The fork is allowed to replace pieces that do not fit Vigilia.

Known examples:

- Upstream snapshot/diff history may be wrong for live telemetry. Replace it,
  disable it, or adapt transaction boundaries rather than rejecting the whole
  editor.
- Chart configuration undo is optional anyway.
- Upstream property UI may be demo-only. In a source fork, that is code we can
  move/extend rather than evidence that the editor foundation is unusable.
- Vigilia's theme globals, sensor bindings and typed chart settings remain
  Vigilia-specific extensions.
- Irrelevant photo-editing features can be hidden or removed.

The evaluation question is not "can we consume upstream unchanged?" It is:

> **Is forking this existing editor less code and less long-term ownership than
> continuing to build Vigilia's generic editor mechanics ourselves?**

Given the migration's purpose, default toward **yes** unless the spike produces a
fundamental incompatibility.

### 4. Compare against the current `EditorCore` path honestly

The current branch has already added a home-grown composition root and managers:

```text
EditorCore
├── NoticeManager
├── DocumentManager
├── SelectionManager
├── GlobalsManager
├── ArrangeManager
├── SnappingManager
├── LayersManager
└── InspectorManager
```

That work is not bad code. The concern is ownership: it is the beginning of a
new Vigilia editor framework whose responsibilities overlap heavily with the
upstream manager suite.

**Freeze expansion of this framework while the fork spike runs.** Do not delete
it yet; it remains useful fallback/reference code. But do not add clipboard,
tools, Fabric gesture managers, custom selection controls, new snapping
machinery or other generic editor systems until the fork decision is closed.

The source-fork assessment must compare concrete ownership, not architecture
names. For each generic subsystem classify:

```text
REUSE FROM FORK
MODIFY IN FORK
KEEP VIGILIA-SPECIFIC
CURRENT VIGILIA FALLBACK ONLY
```

### 5. Reject the fork only for a fundamental incompatibility

The following are **not** sufficient reasons to reject it:

- the npm package lacks types;
- its property UI is not exported as package API;
- its history implementation is unsuitable;
- an extension hook is missing but can be added in our fork;
- a manager needs Vigilia-specific changes;
- keeping upstream updates becomes inconvenient.

A rejection needs evidence of something more fundamental, for example:

- its ownership model fights Fabric scene revival/persistence so deeply that
  replacing it would gut the editor;
- custom `VigiliaChart` objects cannot participate reliably in its canvas
  lifecycle;
- its manager assumptions make live runtime state inseparable from authored
  state without pervasive rewrites;
- adopting it would actually require maintaining more generic editor code than
  the current path.

If none of those is demonstrated, prefer the source fork.

### 6. Use sub-agents for the comparison

This review is naturally parallel. Spawn narrowly scoped sub-agents for, for
example:

- upstream manager inventory and extension points;
- clipboard/grouping/selection/controls behaviour;
- history and telemetry-state incompatibilities;
- property/demo UI extraction;
- custom `VigiliaChart` integration;
- serialization/revival compatibility;
- media/background behaviour.

The primary agent owns the comparison, resolves conflicting findings and makes
the final integration recommendation. Do not let multiple agents edit the same
shared contracts concurrently.

### 7. Update the durable docs before Stage 4 resumes

If the source-fork spike succeeds, update `decisions.md`, `architecture.md` and
spec 0013 before proceeding so future agents do not continue following the
currently recorded "reference, not dependency" decision.

If it genuinely fails, record the concrete blockers and then resume the stock-
Fabric/custom-editor path with evidence rather than the previous package-level
assumptions.

---

## Existing editor manager refactor — PAUSED

The manager refactor reached Phase 3 before the Fabric migration overtook it.
Existing work includes `EditorCore`, document/selection/globals/arrange/snapping/
layers/inspector managers, typed events and registration/lifecycle rules.

**Do not continue Phases 3–6 until the source-fork comparison above is closed.**
In particular, do not build the empty generic slots (clipboard, tools, more
interaction managers) merely because they were on the old refactor plan.

Useful Vigilia-specific concepts from this work may survive regardless of editor
foundation:

- semantic document ownership;
- globals/design-token logic;
- chart setting descriptors;
- sensor binding/property models;
- refusal/status semantics;
- telemetry exclusion from undo;
- file/theme integration.

Generic editor mechanics are exactly what the migration is trying to stop
owning.

---

## Media decisions

### Video

Video background support remains required.

Video **as a Fabric object** was measured too expensive because Fabric redraws
the whole canvas per video frame. The selected architecture is one DOM `<video>`
background beneath the transparent Fabric scene, positioned by the same artboard
fit transform and cropped by the artboard.

Scope is intentionally narrow: one background video per theme, no video node,
no grouping, no rotation, no timeline/playback controls.

### GIF

GIF elements are desired but **negotiable**. Drawing an animated GIF through
Fabric produced frame 0 only. GIF support is therefore deferred and must not
block the editor migration. Revisit later with a simple media-layer or decoded-
frame approach only if worthwhile.

---

## Next sequence after the editor-foundation checkpoint

Do not treat these as permission to skip the checkpoint above.

1. Complete Stage 3 player flip: Fabric becomes the default player renderer and
   meaningful display E2E coverage moves with it.
2. Run the source-fork editor spike and choose the actual editor foundation.
3. Update durable architecture/spec docs with that choice.
4. Stage 4: move the editor onto Fabric **through the chosen editor foundation**
   and switch the persisted scene envelope with it.
5. Migrate/extend Vigilia-specific property editing: design tokens, bindings,
   chart settings and assets.
6. Add live telemetry editing/runtime behaviour without polluting authoring
   history.
7. Finish video-background integration; leave GIF deferred unless cheap.
8. Delete the old DOM renderer and superseded custom editor mechanics as each
   replacement becomes proven.
9. Validate the player on a **physical Google Pixel 3** before calling mobile
   performance settled.

---

## Other product work after the migration foundation

The starter theme and host theme storage are still the main usability gap: the
current demo binds several extended-tier keys requiring LHM and hardcodes a
32 GB memory total. Do not point it blindly at real memory; that could produce a
dashboard that lies about hardware (§97).

After the migration foundation: baseline starter theme, `%APPDATA%/vigilia/`
storage, open/save/activate flow; then LAN opt-in/pairing, LHM provider, disk and
network baseline sensors, and tray integration.

---

## Not verified — do not report these as working

- No physical Google Pixel 3 run.
- No LAN bind has been exercised end to end.
- No pairing or revocable sessions.
- Keep-latest has not met a real slow socket.
- LHM extended telemetry remains a contract without an implementation.
- Browser E2E still previews bundles directly and does not exercise the host.
- The editor is not yet a Fabric/image-editor editor; it still renders through
  the old DOM path and custom overlay.
- Fabric scene JSON is implemented experimentally in `scene-fabric/persist.ts`,
  but the document schema/envelope has not switched yet.
- `fabricjs-image-editor` has **not yet been tested as a source fork with
  `VigiliaChart`**. The previous rejection is reopened, not disproven.
- The editor browser suite still has a contention-only flake with varying tests;
  isolated runs pass.
- GIF animation is not supported in the Fabric scene.
- Physical-device video-background performance is unmeasured.
- Several schema-v2/theme-token decisions remain specified rather than fully
  implemented.

---

## Needs a human

**Nothing before the next technical checkpoint.** The user has already supplied
the direction:

- keep the Fabric renderer migration;
- keep Fabric-object serialization inside the Vigilia envelope, prioritising
  minimal glue over human-readable JSON;
- reopen `fabricjs-image-editor` as the preferred editor foundation and evaluate
  it as a **source fork**, not merely as an npm dependency;
- prefer accepting editor/chart QoL compromises over rebuilding generic editor
  infrastructure;
- keep chart rotation;
- keep video-background support; GIF is negotiable;
- target Google Pixel 3 for mobile validation.

Return to the user only if the source-fork spike finds a fundamental blocker or
a product-taste decision is genuinely required.

---

Durable lessons from past sessions are in [`lessons.md`](lessons.md), not here —
this file is a snapshot and that one is not.
