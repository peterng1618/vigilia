# 0013 — Fabric scene and editor migration

- **Status:** active; Stage 4B editor migration underway
- **Design sections:** §31, §35, §47, §51, §53, §55, §57, §61, §64, §67, §83, §85, §89, §91, §105, §116, §124, §126, §134, §137, §141
- **Supersedes:** DOM mount path and most custom generic-editor implementation in 0004/0005/0006/0012 while preserving required product behaviour

## Goal

Stop owning a general-purpose graphics editor.

Vigilia owns telemetry, semantic bindings, design tokens, typed chart settings,
theme semantics and player/host integration. Fabric owns scene geometry and
rendering. The adopted `fabricjs-image-editor` fork owns generic editor mechanics.

## Architecture

```text
Vigilia envelope
├── schema/version/artboard
├── globals/assets/bindings
└── Fabric scene JSON
          │
          ▼
renderer-core          Fabric-free domain/chart planning
          │
          ▼
scene-fabric            shared Fabric objects + persistence
      ┌───────────────┬────────────────┐
      ▼               ▼
player             editor
StaticCanvas       interactive Canvas
                  + fabricjs-image-editor fork
                  + Vigilia domain extensions
```

Rules:

- Fabric 7.4.0 is pinned and imported through `fabric/es`.
- `renderer-core` stays Fabric-free.
- Player uses `StaticCanvas`; editor uses interactive `Canvas`.
- Fabric JSON is the persisted scene. Do not introduce a parallel simplified
  geometry tree plus bidirectional mapping.
- `scene-fabric/src/persist.ts` owns scene serialization/revival and custom-object
  lifecycle.
- React owns the application shell; Fabric remains imperative behind the editor
  boundary. Do not mirror every Fabric object declaratively in React.

## Adopted editor foundation

The source fork of `fabricjs-image-editor` is adopted. It supplies generic:

- selection and transforms;
- grouping;
- duplication/clipboard-related mechanics;
- text/image/shape tools;
- editor canvas lifecycle and history infrastructure.

Vigilia adds domain extensions for charts, persistence, shortcuts, tokens/types,
artboard, assets, bindings, media, layers and product-specific property controls.

The old `EditorCore`/DOM/custom editor remains fallback/harvestable code only.
Do not expand it with new generic editor mechanics.

## Persistence

The v2 Vigilia envelope is the supported editor file format.

Persist:

- semantic/versioned envelope data owned by Vigilia;
- Fabric scene JSON for geometry, transforms, grouping, stacking, visibility,
  locking and custom objects;
- stable Vigilia object identity;
- authored chart family/settings only.

Never persist runtime telemetry, ECharts options, animation state or render scale.
A mismatched Fabric runtime must fail before replacing the active scene.

No v1 compatibility reader is required. Convert repository fixtures instead.
Legacy GIF asset semantics are removed in v2.

## Charts

`VigiliaChart` is a Fabric object backed by a detached ECharts canvas.

Required:

- correct rendering;
- move;
- rotation;
- proportional resize/re-layout;
- serialization/revival;
- explicit ECharts disposal;
- all supported authored settings editable through the new editor property UI;
- live/runtime updates must stay outside authored history.

Accepted limitations:

- no chart-family conversion after creation;
- no skew or arbitrary non-proportional stretch;
- restricted grouping if needed;
- chart-setting edits may bypass undo/redo;
- limited direct-manipulation QoL.

Keep `objectCaching: false`, ECharts animation disabled, bounded backing-canvas
scale/area and explicit invalidation/disposal.

## Media

Video remains required as one DOM background layer beneath the transparent
Fabric canvas, aligned/cropped by the same artboard transform. It is not a normal
scene object and has no grouping, rotation or timeline controls.

Animated GIF elements are out of scope.

## Current migration status

### Complete

- **Stage 1:** `scene-fabric`, `VigiliaChart`, package boundary, serialization and
  disposal.
- **Stage 2:** shared Fabric scene path for text, shapes, groups, images/SVG and
  all four chart families.
- **Stage 3:** player is Fabric-only; DOM player path and DOM-specific assertions
  are no longer active.
- **Stage 4A:** source-fork spike passed; no fundamental incompatibility found.
- Fork is unified on pinned Fabric 7.4.0 / `fabric/es` and consumed as a compiled
  Git package.
- Editor route now mounts the fork shell; the legacy DOM editor route is inactive.
- Shared demo ScenePlan reconciles into the fork canvas using shared Fabric classes.
- Fork history uses `scene-fabric` serialization/revival hooks and disposes charts
  before scene replacement/destruction.
- Ctrl/Cmd+S writes the v2 Fabric envelope.
- Ctrl/Cmd+O validates and opens v2 Fabric envelopes; incompatible Fabric versions
  fail before replacing the active editor.
- Scalar chart property controls are generated from the shared descriptor registry
  and update charts in place without rebuilding a legacy node tree.
- `ShortcutManager`, `PersistenceManager`, `ChartManager` and `ForkExtensions`
  establish the current domain-extension boundary.

Latest test counts and bundle figures belong in `.agents/status.md`, not here.

### Stage 4B — active

Finish moving editor authoring onto the fork and v2 envelope:

- replace remaining legacy fixture/startup assumptions with direct v2 envelope
  loading;
- move remaining Vigilia-specific property controls into the fork UI surface;
- complete the editor-side object/property ownership boundary;
- verify save/open/history against normal editing flows;
- retire legacy DOM/custom editor code only after equivalent fork behaviour is
  verified.

## Remaining stages

### Stage 5 — schema-v2 design system

- palette solids/gradients;
- typography presets;
- stable global references;
- artboard properties;
- remove old-node-tree assumptions and legacy GIF semantics.

### Stage 6 — live authoring

- dynamic text sensor bindings;
- chart bindings/history;
- editor live preview/tick;
- runtime updates must never enter authored history.

### Stage 7 — media

- production video-background path aligned with artboard contain/cover behaviour.

### Stage 8 — cleanup

- delete old DOM renderer/editor path;
- delete superseded custom geometry, hit-testing, overlay, gesture and group-resize
  infrastructure;
- remove stale migration-only code/docs.

### Later UI modernization

After the Fabric editor foundation and core authoring paths are stable, modernize
the surrounding React shell incrementally using the plan in §35:

- shadcn/ui + Base UI;
- Tailwind/CSS variables;
- Zustand where useful;
- keep editor-shell theming separate from authored dashboard theme globals.

This must not block Stages 4B–8.

## Ownership map

| Area | Direction |
|---|---|
| `renderer-core` telemetry/chart semantics | **KEEP** |
| `scene-fabric` + persistence | **KEEP** |
| `VigiliaChart` | **KEEP** |
| `fabricjs-image-editor` fork | **EDITOR FOUNDATION** |
| Vigilia tokens/bindings/chart/property/media extensions | **KEEP / MIGRATE** |
| legacy `EditorCore` generic mechanics | **FALLBACK ONLY / DELETE** |
| DOM `mount.ts` and old overlay/gesture stack | **DELETE after replacement** |
| video background layer | **IMPLEMENT** |
| legacy GIF handling | **DELETE** |

## Acceptance

Migration is complete when:

- editor and player both render authored scenes through Fabric;
- v2 Fabric envelopes save/open reliably with identity, grouping and custom chart
  state intact;
- generic editing mechanics come from the adopted fork rather than parallel
  Vigilia implementations;
- all supported Vigilia chart settings are editable in the new property surface;
- live telemetry never contaminates persisted state/history;
- player remains free of editor UI dependencies and within its bundle gate;
- video background aligns with the artboard;
- superseded DOM/custom generic-editor code is removed.

## Stop conditions

Only reconsider the adopted approach for a fundamental blocker, such as:

- reliable ECharts/Fabric rendering cannot be achieved;
- persistent memory leaks remain in normal live use;
- the fork requires pervasive unstable Fabric-internal hacks;
- custom chart state cannot survive normal lifecycle/persistence;
- runtime telemetry cannot be separated from authored state.

Missing QoL, missing upstream hooks that can be added to the fork, imperfect
chart undo, or permanent fork divergence are not blockers.

## Out of scope

- animated GIF elements;
- chart-family conversion;
- unrestricted chart skew/stretch;
- perfect chart-specific undo/redo;
- preserving the legacy Vigilia inspector/editor architecture;
- release packaging/public distribution.
