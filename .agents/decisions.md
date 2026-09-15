# Decisions

Every architectural decision, **current position only**. A reversed decision is
rewritten here rather than kept alongside its replacement — the full text of
each original is in git history if the reasoning is ever needed.

Feature-level decisions live in the spec for that feature, not here.

---

## Settled

### The host is Node/TypeScript, shipped as a CLI

Same npm workspace as the renderer, published binary `vigilia-dashboard`.

The C# host never compiled; a Python draft produced no code. Node wins on one
argument that outranks the rest: **the wire contract and the theme types live in
one place and both ends import them.** A C# host meant hand-mirroring `Sample`
and `SensorDescriptor` into TypeScript, where a change compiles cleanly on both
sides and produces wrong values at runtime. That defect class no longer has
anywhere to live.

The C# tree, its solution file, `global.json`, `Directory.Build.props` and the
paused CI backend job were **deleted on 2026-09-13** — 26 files that had never
compiled. **There is no second toolchain: do not install a .NET SDK or Python to
unblock anything.**

Plain `vigilia` on npm is an unrelated package — `npx vigilia` fetches a
stranger's CLI and crashes.

*Supersedes: target .NET 10; sequence-the-.NET-host-after-the-frontend (whose
ordering stands — the host was built last and took a different runtime
entirely, which would have been a rewrite on top of three milestones of
dependent work).*

### The editor and the player both render through Fabric

**Decided by:** the user, 2026-09-15, directing the migration and choosing stock
Fabric over adopting `fabricjs-image-editor` as a foundation.

`fabric` 7.4.0 (MIT, no runtime dependencies) is the scene graph for **both**
displays. `renderer-core/src/scene/plan.ts` stays the only place that decides
what a frame contains; `scene/mount.ts`'s DOM applier is replaced by one Fabric
adapter that the editor and the player both import. The `ThemeDocument` remains
the persisted format, and Vigilia keeps its envelope: `schemaVersion`, id and
metadata, artboard, globals, assets and the semantic layer.

**The node tree, though, is stored in Fabric's own object format inside that
envelope** (user, 2026-09-15), because storing it twice is what would need a
translation engine — a parallel tree reconciled by a write-back layer on every
commit. Fabric's serialisation round-trips geometry, stacking, grouping,
visibility, lock and custom classes for free; measured on the prototype as a
pixel-identical round-trip. What is *not* adopted is bare Fabric JSON as the
whole document: `scene/plan.ts` reads a `ThemeDocument` and resolves tokens,
text and chart options in 733 tested lines, so replacing the envelope would
relocate translation rather than remove it. Fabric *does* stamp a `version` on
every object and on the canvas — an earlier draft here said it carries none, and
that was wrong — but it is a **library** stamp: nothing reads it, nothing
refuses on it, and it says nothing about Vigilia's own semantics, which change
on their own schedule. §141 requires a persisted format to refuse what it cannot
read, so the envelope keeps `schemaVersion` and keeps the refusal.

The safety conditions are in §134 and they are requirements: the envelope
records the Fabric major version, that version is pinned exactly, a Fabric major
upgrade is a schema migration that **refuses** an older scene, and Fabric's own
default-stripping is **on**, so every persisted key is an authored deviation and
every absent one means the recorded major's default.

**The last of those replaced an explicit-origin rule on 2026-09-15**, when the
review's reopening of "refuse or migrate?" was put back to the user with
measurements. Fabric's `installOriginWrapperUpdater` needs explicit origins;
explicit origins need `includeDefaultValues = true`, because stripping drops an
origin equal to the default and asking for it by name does not rescue it. So the
choice was one choice, not two: migrate and pay ~3× the document size, 7.4.0's
default values baked into every object and a hand-written filter to keep
`subTargetCheck`, `interactive` and `layoutManager` out of a portable document —
or refuse and get all three for free. The user chose refuse. It protects
thirty-three keys where the explicit origin protected two, and costs one
migration of saved themes at some future Fabric major.

**Only authored values are stored on a Fabric object; derived state is
recomputed.** A chart persists its `family` and typed `settings` — exactly
`ChartContent`'s keys — and not the built engine option, which `plan.ts`
rebuilds from those settings, the theme's tokens and the current samples every
frame. That is what makes §67 structural instead of inspected: a serialised
built option carries live readings inside `series[].data`, where a guard on key
*names* cannot see them. One was written, and it passed. The same reasoning
excludes `renderScale`, which is device state.

**A Fabric `Group` is persisted with its geometry, and §137's no-geometry rule
is dropped** (user, 2026-09-15). Keeping it meant flattening every group's
matrix onto its children on save and rebuilding groups from a tag on load —
a write-back layer in a different place, which is the thing this decision
exists to avoid. Nesting, group resize, rotation and clipping arrive as
Fabric's. The rule was never adopted by the format anyway: the schema and §57
have always described composing transforms. §137's "child order alone
determines stacking" clause is unaffected and is what nearly all of its
citations rely on. The editor still implements the old rule and moves at stage 4.

**§31 is satisfied, not waived.** The earlier rejection turned on adopting a
prebuilt Fabric *editor* whose canvas would have rendered the authoring surface
while `mount.ts` rendered the display — two renderers, which §31 forbids. Making
Fabric the renderer for both ends removes the second one. What is abandoned is
Vigilia owning hit testing, transform handles, rotation maths, marquee selection
and group transforms: ~1,600 lines of generic graphics editor that is not the
product and that carries most of the editor's open defects.

Measured before deciding, in headless Chromium: charts render through a custom
`FabricObject` over a detached ECharts canvas, **including rotation at arbitrary
angles with no hack**; §89's styled runs work in one text object on one shared
baseline; the player lands at ~257 KB gzip against its 400 KB gate. Four
settings are load-bearing rather than tunable — `objectCaching: false`,
`animation: false`, an explicit `center` origin because Fabric 7 changed the
default and deprecated every other value, and `strokeWidth: 0` on charts,
because Fabric folds stroke width into an object's bounding box and that was
the whole unexplained 1.4 px error measured at 37°.

**Fabric's own mechanisms are used rather than re-implemented**, which sounds
obvious and was not: the first chart object hand-wrote `toObject`, overrode
`fromObject` in a way that skipped Fabric's enlivening of clip paths and
gradients, declared its defaults twice, and set `dirty` by field assignment —
which bypasses the `_set` call that propagates dirtiness to an enclosing group,
so any grouped live chart would have frozen. It also could not be constructed
at all. See [lessons.md](lessons.md).

Two limits found by measurement, both confined to media:

- **Video cannot be a Fabric object.** Fabric clears and redraws the entire
  canvas per frame with no dirty-rectangle path, costing 22.9–28.2 ms against a
  33.3 ms budget at a 4× CPU throttle. Video is therefore a DOM layer beneath a
  transparent canvas, scoped to **one background** that the artboard crops.
- **GIF cannot animate through Fabric at all** — `drawImage` yields frame 0
  forever, measured against a visibly animating `<img>`. Deferred.

`@anu3ev/fabric-image-editor` is **not** a dependency. It is read as a reference
implementation at `../fabricjs-image-editor`, and its snapping, montage-area
clipping and background handling are the models to follow. Against it: no
shipped type declarations, a property-editing UI that is demo-only and excluded
from its own package, no layers panel, and a full-canvas snapshot-diff history
that would bake live telemetry into undo entries. Vigilia's declarative property
descriptors and immutable-document history are kept instead.

**What would reopen this:** live telemetry proving unaffordable on real Pixel 3
hardware, or Vigilia's semantic state proving impossible to keep separate from
renderer state. Neither has been tested on a device. Details, staging and the
full migration map are in [spec 0013](specs/0013-fabric-scene-migration.md).

*Supersedes: the-editor-is-a-layer-over-the-renderer-not-a-canvas-editor (whose
one-renderer requirement stands and is the reason this shape was chosen — what
fell was its conclusion that a canvas foundation must mean two renderers); and
the "what is not adopted is the canvas" clause of the manager-architecture
decision below, which otherwise stands in full.*

### The editor is a manager architecture over that layer

**Decided by:** the user, 2026-09-14, naming `fabricjs-image-editor` as the
architecture to follow and its separation of concerns as the reason.

`packages/editor/src/main.ts` had reached **1,349 lines** holding nine unrelated
concerns in one closure: every piece of mutable state as a `let`, all panel DOM
construction, a 130-line action switch with command bodies in the case arms, the
pointer and keyboard listeners, file I/O, and ~25 hand-placed `render()` calls
guarded by four `JSON.stringify` cache keys. None of it was reachable from
outside, so none of it was unit-testable, and the next four things the product
needs — creation tools, a clipboard, zoom/pan, a live tick — had nowhere to
attach. Two actions were already implemented twice, and enablement was painted
by querying the DOM for buttons.

So: **one manager per domain behind a composition root**, modelled on
`fabricjs-image-editor` — a class holding every manager as a typed field, an
ordered registration table driving `init()` and its reverse `destroy()`, a typed
event map replacing manual redraw calls, and config-object registries as the
extension point. The contract is written in
[`architecture.md`](architecture.md) §4.

**What was adopted from that repo is the separation of concerns, and only
that.** The refactor itself added no dependency; Fabric arrived separately and
later, by the decision above, and the manager shape is what the Fabric adapter
now plugs into rather than something it replaces. Also rejected, and still
rejected: that repo's `jsondiffpatch` snapshot-diff history — this document is
immutable with structural sharing, so whole-document snapshots are already cheap
and reference equality already powers the dirty check. A canvas-snapshot history
would additionally bake live telemetry values into undo entries, which §67
forbids.

The costs, stated plainly: a large diff across a package with no unit tests on
its DOM half, where the only safety net is `tests/e2e/editor.spec.ts`'s 57
structural assertions — so no `data-vigilia-*` hook may be renamed while the
restructure is in flight. And it delays schema v2, which was next.

**What would reopen this:** a manager graph that needs a real dependency-
injection container to stay acyclic, or a UI surface complex enough that hand-
written DOM stops paying — either means the "no component framework" position
should be re-argued, not worked around.

### Two sensor tiers, discovered and never hardcoded

Baseline works with no driver and no elevation. Extended needs PawnIO and may
legitimately be unavailable. A provider reports what it can actually read on the
machine it is running on; an unavailable sensor is `Unavailable` with a reason,
never a zero and never a guess (§97).

This is why per-sensor elevation probing was dropped as a gate item — a table
established up front for one machine is a table the provider then has to
contradict at runtime.

### LibreHardwareMonitor is external, and its stable line is preferred

LHM runs as a **prebuilt executable** read over its local HTTP endpoint. Vigilia
does not reference or compile `LibreHardwareMonitorLib`.

The stability argument stands even though the NuGet pin is gone: LHM publishes a
handful of stable releases against a continuous prerelease stream, and tooling
resolving "latest" picks up a prerelease. A monitoring tool whose sensor
coverage changes silently between builds makes every "unavailable" report
untrustworthy.

Because LHM is external, its version is a property of the user's machine. Vigilia
cannot pin it — only detect what it found and say so. Not implemented yet; spec
0010 has the contract.

### Performance budgets are not tracked yet

Dropped 2026-09-13: nothing built is resource intensive. The host polls
`node:os` once a second for a handful of keys; the display renders a bounded
scene from a bounded buffer.

This deviates from §126, which requires budgets on named reference hardware —
see [`status.md`](status.md).

**The caveat, because it is the whole point of a budget:** it exists to catch
the regression nobody predicted. Two on the roadmap plausibly cost something —
the LHM provider reading a full sensor tree every cycle, and a 600-point line
chart on a low-end phone. Reinstate this the moment anything starts costing.

### Pre-commit verification is scoped to what changed, because CI is the backstop

**Decided by:** the user, 2026-09-15, after a commit that changed two prose
documents and one test comment ran the whole three-minute gauntlet.

`vigilia:verify` grades the paths being committed into four tiers and runs only
what the change can affect: nothing for prose, typecheck plus unit tests when a
test file changed, and all five steps for source, schema, a manifest or a
config. The tiers and the classifier live in that skill — one owner; this
records why they are allowed to exist.

Measured 2026-09-15: typecheck ~25 s, unit tests 17 s, all three builds 22 s,
size gate instant, browser suite ~114 s. The browser suite is 60% of the cost
and is the step with undiagnosed flakes, so it is the only one worth
conditioning; the rest are cheap enough that scoping them trades real coverage
for seconds.

**What makes this safe is CI, not judgement.** Every push runs typecheck, unit
tests, three builds, the size gate and `desktop-chromium`. Local scoping buys
iteration speed on a change CI will re-check anyway.

**Two exceptions, and they are the reopening conditions.** CI runs only
`desktop-chromium`, so `phone-chromium` is checked locally or never; and CI
typechecks five projects, not six. **If CI's coverage narrows — a step dropped,
a project missed, the Playwright project list trimmed — the tier that relied on
it stops being safe and this decision must be re-cut.** Widening CI to run
`phone-chromium` would retire the first exception.

**Rejected: selecting unit tests by path**, which is what "run the tests the
change touched" literally asks for. This repo's boundary tests live in a
different package from the code they constrain —
`packages/player/src/boundaries.test.ts` is what fails when `renderer-core`
imports Fabric the expensive way, and `boundaries.test.ts` walks the source tree
so *adding* a file changes its input with no diff in anything it already read.
Path-based selection would miss exactly the checks that span packages, to save
17 seconds. The suite is run whole or not at all.

**Also rejected: classifying by diff content** rather than by path, so that a
comment-only edit to a source file could skip the build. "It is only a comment"
is a judgement, and AGENTS.md prefers a mechanism; the classifier keys on paths
and a dropped tier has to be stated in the report.

### Measured: what Fabric costs the display bundle, and what the chart hook does not

2026-09-15, spec 0013 stage 2, both from the shipped build rather than a
prototype.

**The bundle.** The player is **261.5 KB gzip against the 400 KB §47 budget**,
up from 201.1 KB — so the Fabric scene graph, the adapter and everything with it
cost **+60.4 KB** once the SVG chart renderer is dropped. The spec predicted
~257 KB from component measurements; the 4.4 KB difference is the predicted
4.6 KB saving from removing `SVGRenderer` not materialising, which is worth
knowing next time a bundle change is estimated by adding up parts.

**The chart invalidation hook is masked on the player's path.** `chart-object.ts`
called `zr.on('rendered', …)` "the single most load-bearing line in this file".
Removing it and re-running the browser suite changes **nothing**: the adapter
calls `requestRenderAll` at the end of every `apply`, engine animation is forced
off, so the only engine repaint happens synchronously inside the same
`setOption`. It is still load-bearing for a repaint the *engine* drives rather
than the plan — a grouped chart whose siblings did not change, and the editor,
which does not rebuild a frame every second — so it stays, and its guard is
`chart-object.dom.test.ts`'s grouped-cache test.

**The generalisable part:** "load-bearing" was asserted from a prototype where
nothing else re-rendered. A claim about what a line protects is a claim about
its surroundings, and the surroundings changed when the adapter arrived. Both
end-to-end tests written to cover it were verified by sabotage and neither
caught it; what they catch — the update loop not reaching the canvas — is
recorded in the test instead.

### Measured: `grid.containLabel` was deprecated, not inert

2026-09-15, correcting spec 0013's own stage-2 finding, which said axis labels
"reserve no space anywhere". They did. One 400x240 line chart, five-figure y
labels, plot-area edges via `convertToPixel`:

| grid option | plot left | plot bottom |
|---|---|---|
| `containLabel: true` (what shipped) | 61.94 | 212 |
| `outerBoundsMode: 'same'` + `outerBoundsContain: 'axisLabel'` | 61.94 | 212 |
| neither, i.e. ECharts' `'auto'` default | 53.94 | 220 |
| `outerBoundsMode: 'none'` | 8 | 232 |

ECharts 6.1.0 routes `outerBoundsMode: 'auto'` to `'same'` when `containLabel`
is set, so the deprecated key still worked and the console warning was the only
symptom. The builders moved to the two replacement keys anyway — identical
layout, no deprecated key emitted, and no dependence on
`LegacyGridContainLabel`, which nothing registered.

**The generalisable part, and why this is recorded rather than just fixed:** the
finding was reached by reading the warning and the registration sites, and the
inference from "ECharts warns that a key needs a module" to "the key does
nothing" is not sound. The layout was never measured until the fix was written.
`grid.dom.test.ts` now measures it.

### Measured: what Fabric 7.4.0 actually serialises

2026-09-15, against `fabric/node` 7.4.0 in a throwaway script, to settle spec
0013's three *Settle before stage 3* questions. Each of these had been reasoned
about from Fabric's source; two of the conclusions were wrong.

One `StaticCanvas` holding a `Rect`, a `Group` containing a `FabricText`:

| class | `includeDefaultValues` on | off |
|---|---|---|
| `Rect` | 33 keys | `height id left top type version width` |
| `Group` | 37 keys, incl. `interactive`, `layoutManager`, `subTargetCheck` | `height id left objects top type version width` |
| `FabricText` | 47 keys | `height id left styles text top type version width` |

Four findings, in the order they changed a decision:

- **Stripping removes the three keys the review wanted an allow-list for.**
  `subTargetCheck`, `interactive` and `layoutManager` are all at their defaults
  in a display scene, so no filter is needed. Set `subTargetCheck: true` and
  they come back — measured — which is stage 4's problem and now has a test.
- **`propertiesToInclude` does not survive `_removeDefaultValues`.**
  `canvas.toObject(['id', 'originX', 'originY'])` with defaults off emits
  `height id left top type version width`: the origin is requested and still
  dropped. So an explicit origin and stripped defaults cannot coexist for a
  built-in class, which is what made "refuse or migrate?" a single decision
  rather than two. The earlier draft assumed asking by name would work.
- **Identity needs no subclassing.** `canvas.toObject(['id'])` propagates
  through `__serializeObjects` into nested group children, and `loadFromJSON`
  revives `id` as an own property. The review's "a custom property on every
  persisted class" would have meant six subclasses for nothing.
- **And the hazard that replaces it is silent.** A canvas re-serialised without
  the argument — `canvas.toObject()` after a `loadFromJSON` that carried ids —
  emits no `id` anywhere, with no error. Hence one owner for canvas→JSON, and a
  test asserting every object in a saved scene has one.

**The generalisable part:** three of these are one-line experiments that took
minutes, and each overturned a written conclusion reached by reading the same
library's source carefully. Where a library's behaviour decides a format, run
it.

---

## Open — need a human

### Two §85 engine gaps

§85 requires explicit human agreement on an alternative wherever the engine
cannot draw what the theme format expresses. Two remain:

- **Gauge gradients.** ECharts cannot draw a true angular gradient, so the arc
  is approximated in segments (`gradientSegments`, default 64). Accept the
  approximation, or change what the format permits.
- **Line thresholds.** Discrete threshold bands on a line series have no direct
  engine equivalent.

Both now gate the gradient work, since spec 0011 D9 defines the gradient token
and §85 governs what can honestly be drawn from it.

### Anti-cheat coexistence, unanswered rather than closed

Whether PawnIO being loaded causes problems with Vanguard, EAC or BattlEye was
dropped as a gate probe and moved to the provider's concern. **The risk did not
move with it.** If a conflict exists, it surfaces on a user's machine rather
than in a checklist.

---

## Resolved by a later spec

- **Chart colours could not reference a global** (was G2-D1). A chart `Fill`'s
  colour was a plain string, so no chart could follow the palette and §170's
  dark/light overrides were unreachable for any theme with a chart. Spec 0011
  D3 and D9 settle it: colour and gradients are theme-level tokens, and a chart
  references them. Pending implementation in schema v2.
- **Editor property model** — which entity carries which property, colour and
  typography ownership, the gradient shape, the identifier merge. All in
  [spec 0011](specs/0011-editor-property-model.md) D0–D10.
