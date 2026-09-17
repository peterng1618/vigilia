# Architecture

Where Vigilia concepts live. For behaviour read specs; for decisions read
`decisions.md`; for current work read `status.md`.

## System shape

One TypeScript/npm workspace at `src/web/`:

```text
                         renderer-core
                 types · theme semantics · plan
                       (no Fabric import)
                         /          \
                        /            \
                    host          scene-fabric
                 Node/SSE      Fabric objects + adapter
                                  /        \
                                 /          \
                            player          editor
                         StaticCanvas   interactive Canvas
                                      + image-editor fork
```

`renderer-core` is the shared semantic boundary. `scene-fabric` exists so Fabric
cannot leak into the Node host.

### Current migration state

- Player: Fabric-only `StaticCanvas` path.
- Editor: still uses the old DOM renderer/custom overlay.
- Target editor: adopted source fork at `../fabricjs-image-editor` plus
  Vigilia-specific extensions. The current home-grown `EditorCore` managers are
  fallback/harvest-only until their replacements are proven.

## Runtime data flow

```text
provider.sample()
    ↓
ProviderRegistry                 one host poll for the union of requested keys
    ↓
SampleBatch
    ↓ SSE /ws?keys=…
createLiveSource / SampleStore   bounded history, keep latest
    ↓
buildScenePlan                  pure domain decisions
    ↓
scene-fabric adapter            draw/update Fabric objects
    ↓
StaticCanvas / interactive Canvas
```

Rules:

- non-`ok` samples have no plottable value;
- missing is a gap, never zero;
- fake data is dev/test only and never an automatic fallback;
- providers acquire; the host schedules;
- themes bind semantic sensor keys, never provider instance IDs.

## Persisted theme

Vigilia owns the envelope and semantics. Fabric owns the scene representation.

```text
Theme envelope
├── schemaVersion / id / metadata
├── artboard
├── globals / assets / bindings
├── pinned Fabric major
└── scene: Fabric object JSON
```

Do not maintain a second simplified geometry/group tree. Scene persistence goes
through `scene-fabric/src/persist.ts`.

A Fabric major change is a schema migration. Unsupported old scenes are refused.
Defaults are stripped; Vigilia `id` is explicitly included. Runtime/derived
state such as telemetry samples, built ECharts options and render scale is never
persisted.

## Rendering boundaries

| Boundary | Rule |
|---|---|
| Host ↔ browser | `renderer-core` stays Fabric/DOM-free |
| Player ↔ editor | player may use `scene-fabric`, never editor UI/managers or interactive `Canvas` |
| Domain ↔ renderer | `renderer-core` decides; `scene-fabric` applies |
| Chart domain ↔ ECharts | typed Vigilia settings cross through one engine adapter; raw ECharts options do not enter the theme format |

`player/src/boundaries.test.ts` guards the player import boundary and `fabric/es`
usage. The size gate is a backstop, not the primary boundary.

## Editor foundation

Generic editor mechanics come from the adopted `fabricjs-image-editor` source
fork, consumed through its compiled Git package boundary. Do not add its raw
source to Vigilia's strict TypeScript program. It must resolve the same pinned
`fabric/es` module as `scene-fabric`.

Expected reusable concerns include:

- interactive Canvas lifecycle and controls;
- selection / transforms / rotation;
- grouping;
- clipboard / duplicate / deletion;
- text, font, image and shape tools;
- background handling;
- generic keyboard/action plumbing.

Vigilia should add only domain-specific behaviour:

- theme/design tokens;
- sensor bindings and formatting;
- typed chart objects/settings;
- runtime telemetry separation;
- theme/package integration.

The fork may replace upstream history or UI pieces. Its history must use
Vigilia's canonical serializer/revival path and dispose removed charts before
reload. Permanent divergence is acceptable.

## State categories

Keep these separate regardless of editor foundation:

| State | Examples | Persistence/history |
|---|---|---|
| Authored | geometry, chart settings, token refs | saved; history where supported |
| Derived | resolved token values, built ECharts option | recomputed |
| Runtime | telemetry, animation, playback | never saved or undoable |
| UI transient | selection, viewport, drag/snap state | never saved as document content |

Chart-setting undo/redo is optional. Telemetry entering authored history is not.

## Ownership registry

Search here before adding another implementation.

### Shared contracts

| Concept | Owner |
|---|---|
| Samples/status | `renderer-core/src/types.ts` |
| Theme semantic types | `renderer-core/src/theme/` |
| Published theme schema | `schema/theme-document.schema.json` |
| Wire protocol | `renderer-core/src/data/protocol.ts` |
| Semantic sensor keys | `renderer-core/src/data/semantic-keys.ts` |
| Provider contract | `host/src/providers/provider.ts` |
| Chart setting descriptors | `renderer-core/src/charts/` |

### Rendering

| Concept | Owner |
|---|---|
| Pure frame decisions | `renderer-core/src/scene/plan.ts` |
| ScenePlan → Fabric reconciliation | `scene-fabric/src/adapter.ts` |
| Fabric mount/artboard viewport | `scene-fabric/src/scene.ts` |
| Scene serialization/revival | `scene-fabric/src/persist.ts` |
| Custom chart object/lifecycle | `scene-fabric/src/chart-object.ts` |
| Chart backing resolution limits | `scene-fabric/src/render-scale.ts` |
| ECharts registration | `scene-fabric/src/chart-engine.ts` |
| Node → Fabric object updates | `scene-fabric/src/fabric-nodes.ts` |
| Text runs | `scene-fabric/src/text-runs.ts` |
| Image/SVG rendering | `scene-fabric/src/fabric-image.ts` |
| Style → Fabric paint | `scene-fabric/src/paint.ts` |
| Placement / top-left ↔ center | `scene-fabric/src/placement.ts` |
| Unsupported renderer gaps | `scene-fabric` `onUnsupported` reporting |

### Current editor, transitional

These remain until the new editor foundation replaces them. Do not expand their
generic responsibilities during the source-fork spike.

| Concept | Current owner |
|---|---|
| Document/history | `editor/src/document/` |
| Selection | `editor/src/selection/` |
| Globals | `editor/src/globals/` |
| Arrange | `editor/src/arrange/` |
| Snapping | `editor/src/snapping/` |
| Layers | `editor/src/layers/` |
| Inspector/property descriptors | `editor/src/inspector/` |
| Action vocabulary | `editor/src/actions.ts` |
| Keyboard routing | `editor/src/keyboard.ts` |

Target ownership for generic selection/controls/grouping/clipboard/tools is the
`fabricjs-image-editor` fork, not new Vigilia modules.

### Host

| Concept | Owner |
|---|---|
| CLI flags | `host/src/cli/args.ts` |
| Static path safety | `host/src/serve/static-path.ts` |
| Slow-client policy | `host/src/transport/keep-latest.ts` |
| Provider scheduling | `host/src/providers/registry.ts` |

## Known ownership gaps

Fix the owner before adding another copy:

- new-node defaults;
- handshake vocabulary for `?keys=` / `?data=live`;
- shared colour parsing;
- asset-path safety rules;
- theme enum schema/type/validator synchronization;
- stale-reading visual treatment under Fabric.

Do not add a new generic editor owner while the source-fork decision is active.

## Test boundaries

- Unit tests cover pure/domain behaviour and renderer adapters where jsdom/canvas
  is enough.
- Browser tests prove actual canvas wiring/ink and editor interaction.
- Browser tests preview bundles directly; they do not exercise the host.
- Screenshots are visual evidence, not cross-platform pixel baselines.
- Visible renderer changes require inspection, not only object/geometry asserts.
