# 0013 — Fabric scene and editor migration

- **Status:** accepted; renderer migration underway; editor foundation checkpoint reopened
- **Design sections:** §31, §47, §51, §53, §55, §57, §61, §64, §67, §83, §85, §89, §91, §105, §116, §124, §126, §134, §137, §141
- **Supersedes implementation in:** 0003 mount layer; most generic-editor implementation in 0004/0005/0006/0012 while preserving required behaviour

## Intent

Stop owning a general-purpose graphics editor.

Vigilia keeps its domain work: telemetry, semantic bindings, design tokens,
typed chart settings, theme semantics and player/host integration. Fabric owns
the scene graph and rendering. A source fork of `fabricjs-image-editor` is the
preferred editor foundation unless a focused spike proves a fundamental
incompatibility.

## Target architecture

```text
Vigilia envelope
├── schemaVersion / metadata / artboard
├── globals / assets / semantic bindings
└── Fabric scene JSON
          │
          ▼
renderer-core: pure domain planning / chart config
          │
          ▼
scene-fabric: shared Fabric objects + ScenePlan application
          │
      ┌───┴─────────────┐
      ▼                 ▼
player             editor
StaticCanvas       interactive Canvas
                  + fabricjs-image-editor fork
                  + Vigilia property controls
```

`renderer-core` stays Fabric-free so the Node host cannot pull browser code into
its bundle.

## Settled decisions

### Fabric is the shared renderer

Both player and editor use Fabric 7.4.0. The old DOM renderer is transitional
and is deleted after parity and E2E coverage move to Fabric.

Use `fabric/es`, not bare `fabric`, to preserve tree-shaking. The player uses
`StaticCanvas`; interactive `Canvas` stays editor-only.

### Persist Fabric scene JSON directly

The user explicitly prefers minimal glue over simplified/human-readable scene
JSON.

The Vigilia envelope keeps product semantics, but scene geometry, grouping,
stacking, visibility, lock and Fabric object state persist in Fabric's own
serialization. Do **not** maintain a parallel simplified node tree plus a
bidirectional mapping/write-back engine.

Rules:

- pin the Fabric version exactly;
- record the Fabric major in the envelope;
- treat a Fabric major change as a schema migration and refuse unsupported old
  scenes rather than guessing;
- strip Fabric defaults so absent values mean defaults from the recorded major;
- explicitly persist Vigilia object identity (`id`);
- persist only authored chart state (`family`, typed `settings`), never built
  ECharts options, telemetry values, animation state or render scale;
- Fabric groups keep their own geometry.

`scene-fabric/src/persist.ts` owns scene serialization/revival.

### Charts are Fabric objects backed by ECharts

`VigiliaChart` owns a detached ECharts canvas and blits it in `_render`.

Required direct transforms:

- move;
- proportional resize/re-layout;
- rotation.

Not required:

- skew;
- arbitrary non-proportional stretching;
- changing chart family after creation;
- unrestricted grouping if grouping introduces disproportionate complexity;
- chart-setting undo/redo.

Every supported chart setting must remain editable from the **new editor's
property UI**. Do not preserve the old Vigilia inspector merely for continuity.

Keep the measured chart invariants already implemented:

- `objectCaching: false`;
- engine `animation: false`;
- center origin;
- `strokeWidth: 0`;
- explicit ECharts disposal;
- invalidation through Fabric when the detached canvas changes;
- bounded render scale / backing pixel area.

### Video is a DOM background layer

Canvas video forced a full Fabric redraw every video frame and was too costly in
the measured probe. Support one background video beneath the transparent Fabric
canvas, aligned and cropped by the same artboard transform. It is not a normal
scene object and has no grouping/rotation/timeline controls.

### Animated GIF elements are dropped

GIF playback is no longer a product requirement. Remove the legacy `gif` asset
kind and related v1 handling as part of the planned schema-v2 cleanup; do not
build a Fabric/media workaround for it.

## Editor foundation checkpoint

### Preferred path: source fork of `fabricjs-image-editor`

`../fabricjs-image-editor` is already cloned beside Vigilia. Evaluate the source,
not only its npm export surface.

A permanent Vigilia fork is acceptable. Upstream updates are useful while the
author remains active but are not a product requirement.

The previous rejection is reopened because it over-weighted package-level
limitations such as missing shipped types, demo-only property UI and unsuitable
snapshot history. Those can be changed in a source fork and do not justify
rebuilding selection, controls, grouping, clipboard, text/image tools and other
generic editor behaviour ourselves.

### Spike before Stage 4

Before expanding the current `EditorCore` path, prove a small source-fork
integration:

1. load the forked editor around an interactive Fabric canvas;
2. use existing generic mechanics for ordinary text/image/shape objects;
3. add/revive `VigiliaChart`;
4. select, move, rotate and proportionally resize it;
5. exercise grouping/clipboard where naturally supported;
6. prove one Vigilia-specific property control;
7. save/revive the Fabric scene without losing custom object state.

Compare concrete ownership, not API elegance.

For each subsystem classify:

| Classification | Meaning |
|---|---|
| **REUSE FROM FORK** | use existing behaviour |
| **MODIFY IN FORK** | change upstream source for Vigilia |
| **KEEP VIGILIA-SPECIFIC** | domain behaviour genuinely belongs to Vigilia |
| **FALLBACK ONLY** | current custom implementation retained only if the fork fails |

### Do not reject the fork for ordinary integration work

These are acceptable:

- modifying or replacing upstream history;
- moving demo-only UI code into the editor package;
- adding extension hooks/managers;
- disabling irrelevant photo-editing features;
- maintaining a permanent fork;
- chart-specific restrictions listed above.

Reject only with evidence of a fundamental mismatch, for example custom Fabric
objects cannot survive its lifecycle/persistence without pervasive rewrites, or
its state model makes live telemetry inseparable from authored state.

### Freeze home-grown generic editor expansion during the spike

The current branch has `EditorCore` plus document, selection, globals, arrange,
snapping, layers and inspector managers. Do not delete them yet, but do not add
new generic-editor infrastructure such as clipboard, tools, Fabric gesture
layers, custom selection controls or additional snapping machinery until the
fork comparison is closed.

Harvest Vigilia-specific logic from those managers where useful; generic editor
mechanics should come from the editor foundation.

## Property editing

The property surface belongs to the new editor foundation, not the legacy
inspector. Extend the fork's UI architecture or move its demo property UI into
the product as needed.

Vigilia-specific property groups include:

- design-token references;
- typography presets;
- sensor bindings and formatting;
- chart-family-specific settings;
- asset/background settings.

Prefer typed family-specific chart controls over a universal mapping engine.
Chart family conversion is unnecessary.

## Undo/runtime state

Telemetry, chart samples, animation/playback, selection and viewport state must
never enter authored history.

It is acceptable for chart configuration edits to commit without undo/redo.
Generic object transforms may use the editor foundation's history where safe.
Do not reject the editor because its stock history must be replaced or narrowed.

## Shared renderer requirements

`scene-fabric` remains shared by editor and player regardless of the editor
foundation.

The adapter must preserve:

- object identity;
- artboard contain/cover transform;
- group-local placement;
- text runs and layout;
- images/SVG;
- shapes;
- chart rendering and disposal;
- status-before-value semantics from `renderer-core`.

The player must not import editor controls/managers/UI.

## Current evidence

Latest verified branch state before this spec compaction:

- Fabric path renders all four chart families in browser tests;
- chart rotation and live redraw while rotated work;
- text clipping, ellipsis, wrapping/line clamp, vertical alignment and font-load
  re-measure are implemented;
- player with Fabric is ~262 KB gzip against the current 400 KB gate;
- host bundle remains ~34 KB with no Fabric dependency edge;
- Fabric player path exists behind `?scene=fabric`;
- old DOM renderer is still the default;
- editor still uses the old DOM renderer and custom overlay.

Current run counts belong in `status.md`, not here.

## Stages

### Stage 1 — chart object and package boundary — done

- add `scene-fabric`;
- add `VigiliaChart`;
- keep Fabric out of host/renderer-core;
- prove custom class serialization/revival and disposal.

### Stage 2 — shared Fabric scene path — done

- implement `ScenePlan` → Fabric adapter;
- support text, shapes, groups, images/SVG and charts;
- add opt-in Fabric player path;
- fix visible parity defects.

### Stage 3 — make the player Fabric-only — next

- finish remaining renderer parity needed by current themes;
- flip Fabric to the player default;
- port meaningful player E2E assertions to canvas-aware probes;
- delete DOM-only assertions rather than fabricating equivalent hooks;
- keep the old DOM renderer only until the new path is proven.

### Stage 4A — editor-foundation spike — mandatory checkpoint

Run the source-fork experiment above. Use sub-agents for independent audits of:

- manager coverage and extension points;
- selection/grouping/clipboard/controls;
- history vs live telemetry;
- property/demo UI extraction;
- custom chart integration;
- persistence/revival;
- background/media handling.

Primary agent integrates findings and decides only after concrete comparison.

### Stage 4B — editor migration

If no fundamental blocker is found, use the source fork as the editor shell:

- interactive Fabric canvas;
- generic editor mechanics from the fork;
- shared `scene-fabric` objects;
- Vigilia property controls and semantic features;
- Fabric scene JSON inside the Vigilia envelope.

Delete superseded custom generic-editor code as each replacement is verified.

If the fork genuinely fails, record the blocker, update this spec/decisions, and
resume the stock-Fabric/custom-editor fallback with evidence.

### Stage 5 — design system and schema v2

- palette solids/gradients;
- type presets;
- stable references;
- artboard properties;
- Fabric-scene envelope switch;
- remove obsolete old-node-tree assumptions;
- remove legacy GIF asset semantics.

### Stage 6 — live authoring

- dynamic text sensor bindings;
- chart history/bindings;
- runtime updates outside authoring history;
- editor tick/live preview.

### Stage 7 — media

- production video-background layer aligned with the artboard.

### Stage 8 — cleanup

- delete old DOM renderer;
- delete superseded custom geometry/hit-testing/overlay/gesture/group-resize code;
- remove temporary migration branches and stale documentation.

## Migration map

| Area | Direction |
|---|---|
| `renderer-core` telemetry/plan/chart semantics | **KEEP / ADAPT** |
| `scene-fabric` | **KEEP** |
| `VigiliaChart` | **KEEP** |
| Fabric scene serialization | **KEEP** |
| DOM `mount.ts` | **DELETE after Stage 3** |
| custom geometry/hit-test/overlay/transform gestures | **DELETE after editor migration** |
| current `EditorCore` generic managers | **PAUSE; harvest domain logic, fallback only** |
| `fabricjs-image-editor` source | **PREFERRED EDITOR FOUNDATION** |
| design tokens / bindings / chart settings | **KEEP VIGILIA-SPECIFIC** |
| video background layer | **KEEP / IMPLEMENT** |
| legacy GIF asset handling | **DELETE with schema v2** |

## Acceptance

Migration is successful when:

- player and editor render through Fabric;
- custom charts render, rotate and update correctly;
- all supported chart settings are editable in the new editor property UI;
- Fabric scene JSON round-trips identity, grouping and custom chart state;
- live telemetry never contaminates persisted authored state/history;
- player remains free of editor UI code and within an explicit bundle budget;
- video background aligns with the artboard;
- old DOM renderer and superseded generic editor mechanics are removed.

## Stop conditions

Do not stop for missing QoL or missing upstream hooks. Stop only for a fundamental
problem such as:

- reliable ECharts/Fabric rendering cannot be achieved;
- persistent memory leaks remain in normal live use;
- the editor foundation requires pervasive unstable Fabric-internal hacks;
- custom chart state cannot survive normal editor lifecycle/persistence;
- authored semantic state cannot be kept separate from runtime telemetry.

## Out of scope

- animated GIF elements;
- chart-family conversion;
- unrestricted chart skew/stretch;
- perfect chart-specific undo/redo;
- preserving the legacy Vigilia inspector/editor architecture;
- keeping upstream image-editor compatibility at the cost of simpler Vigilia
  code;
- release packaging or public distribution.