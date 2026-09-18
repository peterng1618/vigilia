# Decisions

Current architectural positions only. Git history stores superseded reasoning.
Feature behaviour belongs in active specs; progress belongs in `status.md`.

## Settled

### Host: Node/TypeScript, CLI name `vigilia-dashboard`

The host shares the TypeScript workspace and imports the same contracts as the
browser packages. No .NET/Python runtime is required. Plain `vigilia` on npm is
unrelated.

### Fabric is the single renderer

Fabric 7.4.0 is the scene graph for player and editor. `renderer-core` stays
Fabric-free; `scene-fabric` owns Fabric application/persistence. Player uses
`StaticCanvas`; editor uses interactive `Canvas`. Import `fabric/es`, never bare
`fabric`.

### Prefer Fabric-native outcomes over compatibility glue

When old/custom behaviour conflicts with Fabric or the adopted editor, preserve
the user outcome and correctness constraints but do not rebuild parallel editor
or renderer machinery merely for exact parity.

### Persist Fabric JSON inside the Vigilia envelope

The envelope owns product semantics; Fabric serialization owns geometry,
grouping, stacking, visibility, locking and custom-object state. Do not maintain
a second simplified scene tree plus bidirectional mapping.

Fabric is pinned; incompatible runtime versions are refused before revival.
Custom charts persist authored family/settings only, never ECharts/runtime data.

### Type presets belong to individual styled text runs

Each run carries its own optional type-preset reference; a text object has no
base preset. This preserves independent label/value/unit typography without
inventing inherited state. **Decided by:** user, 2026-09-18.

### Use the `fabricjs-image-editor` fork as editor foundation

The fork is adopted for generic selection, transforms, grouping, duplication,
object tools, canvas lifecycle and history infrastructure. Permanent divergence
from upstream is acceptable. Vigilia consumes its compiled Git package and keeps
its own TypeScript program separate.

Vigilia adds only domain behaviour: charts, theme semantics, bindings,
persistence and product-specific UI. Missing upstream hooks may be added to the
fork; that is not a reason to rebuild a custom editor.

### Legacy editor behaviour is not automatically inherited

**Decided by:** user, 2026-09-17.

Old custom-editor specs are not requirements merely because they existed. Any
behaviour absent from the new editor goes into spec 0014 as a review candidate.
Verify what the fork already provides, then explicitly keep, replace or drop the
candidate before implementation.

### Development v2 is allowed to break before release

The v2 Fabric envelope is the only editor file format on the migration branch;
there is no v1 reader. Scene ownership is settled, but globals/property semantics
are still transitional and may change incompatibly before the first released
theme format. Once a format is released, normal version/migration rules apply.

### Later application shell: React + shadcn/Base UI

**Decided by:** user, 2026-09-17.

Vigilia currently has no React dependency. After the Fabric editor core is
stable, migrate the surrounding application shell incrementally to React +
TypeScript/Vite, shadcn/ui with Base UI primitives, Tailwind/CSS variables and
Zustand where useful. Fabric remains imperative behind an editor/controller
boundary; do not declaratively mirror every Fabric object in React.

This modernization must not block the active editor migration.

### Charts remain typed Vigilia objects over ECharts

`VigiliaChart` uses a detached ECharts canvas. Move, rotation and proportional
resize are required. Skew, arbitrary stretch, family conversion and perfect
chart-setting undo are not requirements. Raw ECharts JSON is never an authoring
surface.

### Video is an aligned DOM background

One video may sit beneath the transparent Fabric canvas, sharing the artboard
transform. It is not a scene object and has no grouping/rotation/timeline
controls. Animated GIF elements are dropped.

### Sensors are capability-driven

Baseline sensors need no extra driver. Extended sensors may be unavailable.
Providers report actual capability and never fabricate zero/default readings.
LibreHardwareMonitor, when implemented, runs as an external prebuilt program;
Vigilia does not compile/link its .NET library.

### Performance budgets follow measurable costs

The player has an explicit bundle-size gate. Add other numerical budgets when a
real expensive path appears. Reproducible browser profiles are sufficient; no
physical-device release gate is required.

## Open

### Chart engine gaps

- Gauge angular gradients lack a native ring-gradient representation.
- Discrete line-threshold bands lack a direct engine equivalent.

Resolve the authored representation under plan §85 before treating either as a
stable feature.

### Extended-sensor anti-cheat coexistence

PawnIO/LHM coexistence with Vanguard/EAC/BattlEye remains unverified and belongs
to provider validation, not the renderer/editor migration.
