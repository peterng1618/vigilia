# Decisions

Current architectural positions only. Git history holds superseded reasoning.
Feature behaviour belongs in specs; current progress belongs in `status.md`.

## Settled

### The host is Node/TypeScript, shipped as `vigilia-dashboard`

The host shares one TypeScript workspace and imports the same wire/theme
contracts as the browser packages. The unused C# backend and second toolchain are
gone. Plain `vigilia` on npm is unrelated and must not be used.

### Fabric is the renderer for both editor and player

**Decided by:** user, 2026-09-15.

Fabric 7.4.0 is the shared scene graph. `renderer-core` remains Fabric-free;
`scene-fabric` owns Fabric objects and plan application. The player uses
`StaticCanvas`; the editor uses interactive `Canvas` through its editor
foundation. This satisfies §31's one-renderer rule instead of running a canvas
editor beside the old DOM renderer.

Key constraints:

- import `fabric/es`, not the pre-bundled bare `fabric`;
- charts use a custom `VigiliaChart` backed by a detached ECharts canvas;
- chart rotation is required; proportional resize is sufficient;
- chart skew, arbitrary stretch, family conversion and chart-setting undo are
  not requirements;
- video is a separate DOM background layer beneath the Fabric canvas.

### Persist Fabric scene JSON inside the Vigilia envelope

**Decided by:** user, 2026-09-15 and reaffirmed after review.

The priority is minimal glue, not short/human-readable scene JSON. The envelope
keeps Vigilia semantics (`schemaVersion`, metadata, artboard, globals, assets,
bindings), while Fabric serialization owns scene geometry, grouping, stacking,
visibility, lock and custom object state.

Rules:

- Fabric is pinned exactly and its major is recorded in the envelope;
- a Fabric major change is a schema migration; unsupported old scenes are
  refused rather than guessed at;
- defaults are stripped so absent values mean defaults of the recorded major;
- Vigilia `id` is explicitly persisted;
- chart objects persist authored `family` + typed `settings`, never ECharts
  options, telemetry or render scale;
- Fabric groups persist their own geometry.

Do not add a parallel simplified node tree plus a bidirectional write-back
engine merely to make JSON prettier.

### Prefer a source fork of `fabricjs-image-editor` for the editor

**Decided by:** user, 2026-09-16, reopening the earlier package-level rejection.

`../fabricjs-image-editor` should be evaluated as source and, unless a focused
spike finds a fundamental incompatibility, become the editor foundation. A
permanent Vigilia fork with no future upstream updates is acceptable.

Missing package types, demo-only property UI, unsuitable stock history or
missing extension hooks are **not** rejection reasons; a source fork may change
those. The migration exists specifically to stop owning generic editor mechanics
such as selection, controls, grouping, clipboard and object tools.

Until that spike is closed, expansion of Vigilia's home-grown generic
`EditorCore` manager framework is paused. Existing domain logic may be reused;
the current custom editor remains fallback only.

### Editor property UI belongs to the new foundation

Do not preserve the legacy Vigilia inspector as an architectural requirement.
Extend the source fork's property/UI architecture for Vigilia-specific design
tokens, sensor bindings, chart settings and assets.

Every supported chart setting must be editable there. Chart family conversion
and chart-setting undo/redo are optional.

### Video is one background layer, not a Fabric scene object

A video drawn through Fabric forces full-canvas repaint each frame. Use one DOM
video layer beneath the transparent Fabric canvas, aligned/cropped by the same
artboard transform. No grouping, rotation, timeline or playback controls.

### Two sensor tiers are discovered, never hardcoded

Baseline sensors require no extra driver. Extended sensors may legitimately be
unavailable. Providers report what they can actually read and never substitute
zero/default values for missing hardware.

### LibreHardwareMonitor is external

Use a prebuilt LHM executable through its local interface; do not compile or
reference its .NET library. Detect the installed version/capabilities at runtime.

### Local verification is scoped; CI is the backstop

`vigilia:verify` selects a prose/unit/E2E/full tier from changed paths. CI still
runs the full shared checks on push. Unit tests are never path-selected because
cross-package boundary tests intentionally observe files outside their own
package.

### Performance budgets are introduced when a measurable cost needs one

The current player bundle has an explicit size gate. Add further numerical
budgets when a real cost appears. Reproducible browser profiles are sufficient;
there is no physical-device validation gate.

## Measured constraints worth retaining

Only measurements that affect architecture live here:

- Fabric player path is roughly **262 KB gzip** under the current 400 KB gate;
- bare `fabric` was substantially larger than equivalent `fabric/es` imports;
- video-through-Fabric consumed most of a 30 Hz frame under the throttle probe;
- chart object caching was much slower and blurrier than uncached rendering;
- removing explicit chart disposal leaked backing/ECharts memory heavily.

Exact current run counts belong in `status.md`.

## Open — need a human

### Chart engine gaps

- Gauge angular gradients require approximation by segments.
- Discrete line-threshold bands have no direct engine equivalent.

Follow §85 before finalising those representations.

### Anti-cheat coexistence

PawnIO/LHM coexistence with Vanguard/EAC/BattlEye remains unknown and belongs to
provider validation, not the renderer/editor migration.

## Resolved by specs

- Chart colour/token ownership and the editor property model: spec 0011.
- Fabric renderer/editor migration: spec 0013.