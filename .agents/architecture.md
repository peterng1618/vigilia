# Architecture

Where current Vigilia concepts live. Behaviour belongs in active specs; product
requirements in `design/plan.md`; transient progress in `status.md`.

## System

```text
                         renderer-core
                 types · semantics · planning
                       (no Fabric import)
                         /          \
                        /            \
                    host          scene-fabric
                 Node/SSE      Fabric objects/persistence
                                  /        \
                                 /          \
                            player          editor
                         StaticCanvas   interactive Canvas
                                      + image-editor fork
```

`renderer-core` is the semantic boundary. `scene-fabric` prevents browser/Fabric
code from leaking into the Node host.

## Current editor boundary

The active editor route mounts the compiled `fabricjs-image-editor` fork. Generic
selection, transforms, grouping, duplication, object tools, canvas lifecycle,
history and stack ordering belong to the fork.

Current Vigilia-owned extensions are:

| Concept | Owner |
|---|---|
| Product shortcuts | `editor/src/shortcut-manager/` |
| Theme download | `editor/src/persistence-manager/` |
| Chart selection/settings/bindings | `editor/src/chart-manager/` |
| Artboard size/preview fit/paint | `editor/src/artboard-panel.ts` |
| Palette-token authoring/reassignment | `editor/src/palette-panel.ts`, `editor/src/fork-extensions/` |
| Type-preset authoring/reassignment | `editor/src/type-preset-panel.ts`, `editor/src/fork-extensions/` |
| Extension composition | `editor/src/fork-extensions/` |
| Fork mount/lifecycle | `editor/src/fork-shell.ts` |
| v2 parsing/file boundary | `editor/src/persist.ts` |
| Generic layer ordering | adopted fork `layerManager` |

Assets, media and semantic layers do
**not** yet have active fork-extension owners. Create those only when the
corresponding feature is implemented; do not document planned classes as current
architecture.

The retired custom-editor implementation is deleted. The fork's `layerManager`
owns z-order actions; no Vigilia semantic layer tree exists.

## Runtime data flow

```text
provider.sample()
    ↓
ProviderRegistry          one poll for the union of connected clients' keys
    ↓
SampleBatch
    ↓ SSE /ws?keys=…
createLiveSource / SampleStore
    ↓
buildScenePlan            pure domain decisions
    ↓
scene-fabric
    ↓
StaticCanvas / interactive Canvas
```

Rules: non-`ok` data is a gap, never zero; fake data is test/dev only; providers
acquire while the host schedules; themes bind semantic keys, not provider IDs.

## Persisted theme

The development v2 envelope is:

```text
Theme envelope
├── schemaVersion / fabricVersion / id / metadata
├── artboard
├── globals / assets / bindings / editor metadata
└── scene: Fabric JSON
```

Fabric owns geometry, transforms, grouping, stacking, visibility, lock and
custom-object state. Vigilia owns semantic/versioned envelope data. Do not add a
parallel simplified scene tree.

`scene-fabric/src/persist.ts` is the canonical serializer/revival path. A Fabric
runtime mismatch is refused before revival. Runtime samples, ECharts options and
render scale are never persisted.

The v2 **scene ownership** and palette/type-preset semantics are implemented.
Envelope validation rejects legacy global groups and local paint/type values. No
external compatibility promise exists before the first release.

## Rendering boundaries

| Boundary | Rule |
|---|---|
| Host ↔ browser | `renderer-core` stays Fabric/DOM-free |
| Player ↔ editor | player may use `scene-fabric`, never editor UI/managers or interactive `Canvas` |
| Domain ↔ renderer | `renderer-core` decides; `scene-fabric` applies |
| Charts ↔ ECharts | typed Vigilia settings cross one adapter; raw ECharts options never enter theme files |

`player/src/boundaries.test.ts` guards the player import boundary and `fabric/es`
usage.

## External-editor boundary

External editors are interaction references, not foundations. Retained generic
mechanics belong in the adopted fork after review; v2 envelope/token/package
boundaries remain Vigilia-owned. Do not import raw-canvas persistence or
framework UI state across that boundary.

## State categories

| State | Examples | Rule |
|---|---|---|
| Authored | geometry, chart settings, token refs | persisted; history where supported |
| Derived | resolved tokens, built ECharts options | recomputed |
| Runtime | telemetry, animation/playback | never saved/undoable |
| UI transient | selection, viewport, gesture state | never document content |

## Ownership registry

### Shared/domain

| Concept | Owner |
|---|---|
| Samples/status | `renderer-core/src/types.ts` |
| Theme semantic types/validation | `renderer-core/src/theme/` |
| Published development schema | `schema/theme-document.schema.json` |
| Wire protocol | `renderer-core/src/data/protocol.ts` |
| Semantic sensor keys | `renderer-core/src/data/semantic-keys.ts` |
| Chart setting descriptors | `renderer-core/src/charts/` |
| Provider contract | `host/src/providers/provider.ts` |

### Fabric renderer

| Concept | Owner |
|---|---|
| Pure frame planning | `renderer-core/src/scene/plan.ts` |
| ScenePlan reconciliation | `scene-fabric/src/adapter.ts` |
| Canvas/artboard mount | `scene-fabric/src/scene.ts` |
| Scene serialization/revival | `scene-fabric/src/persist.ts` |
| `VigiliaChart` lifecycle | `scene-fabric/src/chart-object.ts` |
| Chart backing limits | `scene-fabric/src/render-scale.ts` |
| ECharts registration | `scene-fabric/src/chart-engine.ts` |
| Fabric node updates | `scene-fabric/src/fabric-nodes.ts` |
| Text runs | `scene-fabric/src/text-runs.ts` |
| Image/SVG | `scene-fabric/src/fabric-image.ts` |
| Paint conversion | `scene-fabric/src/paint.ts` |

### Host

| Concept | Owner |
|---|---|
| CLI flags | `host/src/cli/args.ts` |
| HTTP routing | `host/src/server.ts` |
| Static-path safety | `host/src/serve/static-path.ts` |
| SSE connection/keep-latest | `host/src/transport/` |
| Provider scheduling/failure isolation | `host/src/providers/registry.ts` |

## Known ownership gaps

Establish one owner when these become active work:

- editor live binding/runtime updates;
- semantic layer UI;
- artboard/asset/media property editing;
- new-object defaults, when insertion is implemented: an editor-side pure
  factory, not persisted document state;
- shared colour parsing;
- asset-path safety rules beyond current schema checks;
- stale-reading visual treatment under Fabric.

Legacy behaviour candidates such as advanced snapping/alignment are review-only
in spec 0014 and should not acquire owners until retained.

## Verification boundaries

Unit tests cover pure/domain behaviour and adapter contracts. Browser tests prove
canvas/editor wiring and pixels. Browser tests preview bundles rather than the
host. Visible renderer changes require inspection; screenshots are evidence, not
cross-platform golden files.
