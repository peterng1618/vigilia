# Decisions

Current architectural positions only. Git stores superseded reasoning; feature
behaviour belongs in specs and progress in `status.md`.

## Settled

### Host: Node/TypeScript; CLI `vigilia-dashboard`

The host shares the TypeScript workspace/browser contracts. No .NET/Python
runtime is required. Plain `vigilia` on npm is unrelated.

### Fabric is the single renderer

Fabric 7.4.0 is the player/editor scene graph. `renderer-core` stays
Fabric-free; `scene-fabric` owns Fabric application/persistence. Player uses
`StaticCanvas`, editor interactive `Canvas`; import `fabric/es`.

Prefer Fabric/editor-native outcomes over compatibility glue. Preserve product
outcomes and correctness, not obsolete internal machinery.

### Persist Fabric JSON inside the Vigilia envelope

The envelope owns product semantics; Fabric owns geometry, grouping, stacking,
visibility, locks and custom-object state. No parallel simplified scene tree.
Reject incompatible Fabric runtimes before revival. Charts persist authored
settings, never ECharts/runtime data.

### Theme packages own asset-bearing files

`@vigilia/theme-package` owns portable ZIP layout and bounded validation,
reusing `renderer-core` envelope validation. A validated ZIP is the immutable
share, library and future-store release artifact; the player does not import it.
Callers own file UI/storage.

Local folders may be authoring workspaces, never a competing published format.
They export explicitly to a ZIP snapshot; do not silently synchronize folder
and package state. **Decided by:** user, 2026-09-19.

### Type presets belong to styled runs

Each run has its own optional preset reference; text objects have no base preset.
**Decided by:** user, 2026-09-18.

### Trio application aligns face and weight

Applying a curated trio updates each role preset's face and weight to the
nearest available face weight. It preserves size, spacing, line height and
unassigned custom presets. **Decided by:** user, 2026-09-20.

### New-element defaults are derived editor input

A pure editor-side factory derives valid palette/type references from the open
envelope. Defaults are not mutable theme globals or persisted state; the fork
owns generic construction/order.

### The image-editor fork is the editor foundation

The fork owns selection, transforms, grouping, duplication, object tools,
canvas lifecycle and history. Vigilia adds charts, theme semantics, bindings,
persistence and product UI. Permanent fork divergence is acceptable; add missing
hooks there rather than rebuilding a generic editor.

Legacy custom-editor behaviour is not inherited automatically. Missing behaviour
is review-only in spec 0014 until explicitly kept/replaced/dropped.
**Decided by:** user, 2026-09-17.

### Development v2 may break before release

The v2 Fabric envelope is the migration branch format; there is no v1 reader.
Unreleased semantic/property shapes may change incompatibly. Released formats
require normal migration/version rules.

### Later shell: shadcn/Base UI

After the Fabric authoring core stabilizes, migrate the outer shell incrementally
to shadcn/Base UI patterns and Tailwind/CSS variables while retaining the
TypeScript/Vite shell. Fabric stays imperative behind an editor/controller
boundary. This must not block the migration. **Decided by:** user, 2026-09-20.

### Charts remain typed Vigilia objects over ECharts

`VigiliaChart` uses a detached ECharts canvas. Move, rotation and proportional
resize are required; skew, arbitrary stretch, family conversion and perfect
chart-setting undo are not. Raw ECharts JSON is not an authoring surface.

### Video is an aligned DOM background

One video may sit beneath the transparent Fabric canvas using the artboard
transform. It is not a scene object; no grouping/rotation/timeline. Animated
GIF elements are dropped.

### Sensors are capability-driven

Providers report actual capability and never fabricate readings. Baseline
sensors need no driver. LHM, if implemented, runs as an external prebuilt
program; Vigilia does not compile/link its .NET library.

### Performance budgets follow measurable costs

Keep the player bundle-size gate. Add budgets when a real expensive path exists;
reproducible browser profiles suffice without a physical-device release gate.

## Open

- **Chart engine:** authored treatment for gauge angular gradients and discrete
  line-threshold bands (product requirements §85).
- **Extended sensors:** PawnIO/LHM coexistence with Vanguard/EAC/BattlEye remains
  unverified and belongs to provider validation.
