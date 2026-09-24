# Architecture

Where current Vigilia concepts live. Behaviour belongs in active specs; product
requirements in `product-requirements.md`; transient progress in `status.md`.

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
```

`renderer-core` is the semantic boundary. `scene-fabric` prevents browser/Fabric
code from leaking into the Node host.

## Current editor boundary

`@vigilia/editor` mounts `fabric/es` directly; there is no adopted
image-editor package. Generic canvas mechanics are split by concern, the same
separation the retired fork used (canvas/text/image/layer/lock/history
managers), sized to what Vigilia's panels actually exercise rather than the
fork's full feature surface. `editor-shell.ts` owns canvas mount/disposal,
viewport fitting and artboard paint, and composes the other managers behind
the `EditorInteraction` contract consumed by product panels. `editor-session.ts`
owns product composition over that shell: envelope state, panel wiring,
dirty-work confirmation and deterministic disposal. `scene-fabric`'s
`FabricSceneHandle` exposes `updateArtboard` for document-level artboard
changes that a `ScenePlan` cannot carry (it never carries `backgroundMedia`).

`editor-shell/` is React chrome over that boundary: it owns the header menus,
rail, inspector tabs and canvas dock, and React re-renders only on selection
changes. It never creates or mirrors Fabric objects — menus and dock dispatch
through `editor-session.ts`'s action façade and `EditorInteraction`, and panels
keep their own DOM, relocated into React-owned host nodes.

Editor concept ownership:

| Concept | Owner |
|---|---|
| Canvas mount/disposal, viewport fitting, artboard paint | `editor/src/editor-shell.ts` |
| `EditorInteraction` contract consumed by product panels | `editor/src/editor-interaction.ts` |
| Text creation | `editor/src/text-manager/` |
| Image import | `editor/src/image-manager/` |
| Generic canvas stack order | `editor/src/layer-manager/` |
| Object lock/unlock | `editor/src/object-lock-manager/` |
| Scene undo/redo history | `editor/src/history-manager/` |
| Editor session composition and disposal | `editor/src/editor-session.ts` |
| Product shortcuts | `editor/src/shortcut-manager/` |
| Theme download | `editor/src/persistence-manager/` |
| Chart selection/settings/bindings | `editor/src/chart-manager/` |
| Theme metadata, artboard size/preview fit/paint/media | `editor/src/artboard-panel.ts` |
| Semantic layer projection and arrange actions | `editor/src/layer-panel.ts`, `editor/src/arrange.ts` |
| Palette-token authoring and reference reassignment | `editor/src/palette-manager/` |
| Type-preset authoring and reference reassignment | `editor/src/type-preset-manager/` |
| Open-package asset bytes and controls | `editor/src/asset-manager/` |
| Editor runtime binding refresh | `editor/src/live-runtime.ts` |
| v2 parsing/file boundary | `editor/src/persist.ts` |
| Structured editor diagnostics | `editor/src/error-manager/` |
| Selection and rotation handle styling | `editor/src/controls-manager/` |
| Active-object and selection deletion | `editor/src/deletion-manager/` |
| OS clipboard copy/cut/paste/duplicate | `editor/src/clipboard-manager/` |
| Group and ungroup | `editor/src/grouping-manager/` |
| Canvas dock (former floating toolbar) | `editor/src/editor-shell/canvas-dock.tsx` |
| Selection snapshot and dock eligibility | `editor/src/editor-shell/bridge.ts` |
| Selection geometry, appearance, runs and text layout | `editor/src/selection-inspector/` |
| Authoring-time value-run tokens | `editor/src/run-placeholder.ts` |
| Which theme a host displays | `host/src/settings/active-theme.ts` |
| The consumer's clock zone | `host/src/settings/display.ts` |
| Theme thumbnails (store and route) | `host/src/themes/thumbnails.ts` |
| Thumbnail capture in the editor | `editor/src/thumbnail-capture.ts` |
| Shell chrome, rail, inspector tabs, menus | `editor/src/editor-shell/shell-layout.tsx` |
| Shell palette | `editor/src/editor-shell/palette.ts` |
| Drag-time snapping and smart guides | `editor/src/snap-manager/` |
| Rotation-angle and size indicators | `editor/src/indicator-manager/` |
| Per-image crop session | `editor/src/crop-manager/` |
| Imported and rehydrated image pixel bound | `editor/src/image-manager/` |

## Packaged-font ownership

`renderer-core/src/theme/` owns font-face declarations and preset validation;
`editor/src/font-catalog.ts` and `editor/src/font-preview.ts` own curated
metadata and transient previews; the existing type-preset/asset boundaries own
adoption; `scene-fabric/src/font-assets.ts` owns loaded-face lifecycle. The UI
adapter does not own catalog, preview or adoption semantics.

`editor-shell.ts` owns generic z-order, grouping and locks; the Vigilia layer
panel projects that state without a parallel scene tree.

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
Providers form a fallback chain: a non-`ok` sample does not claim its key, so a
later provider may still answer it; a key nobody measured keeps the earliest
provider's stated reason.

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

## State categories

| State | Examples | Rule |
|---|---|---|
| Authored | geometry, chart settings, token refs | persisted; history where supported |
| Derived | resolved tokens, built ECharts options | recomputed |
| Runtime | telemetry, animation/playback | never saved/undoable |
| UI transient | selection, viewport, gesture state | never document content |

## Consumer settings scope

| Setting | Scope | Owner |
|---|---|---|
| Device assignments, display names, clock zone | this PC, whatever theme is shown | `host/src/settings/devices.ts`, `host/src/settings/display.ts` |
| A theme's device answers | one theme on this machine; asked only for the slots its bindings need | `host/src/settings/theme-settings.ts`, `host/src/settings/required-devices.ts` |

A global setting never reads the active theme: filtering this PC's own controls
by what is displayed makes a machine-level choice unreachable. Device assignment
resolves in one place — theme answer → global answer → provider default — and
every input to it (devices, the chosen theme, a theme's answers) publishes
through `publishAssignment()` in `host/src/server.ts`, or a display keeps showing
the device the consumer just replaced.

## Ownership registry

### Shared/domain

| Concept | Owner |
|---|---|
| Samples/status | `renderer-core/src/types.ts` |
| Live presentation buffer | `renderer-core/src/data/live-source.ts` |
| Theme semantic types/validation | `renderer-core/src/theme/` |
| Theme ZIP layout and bounds | `theme-package/src/` |
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
| Chart repaint cadence | `scene-fabric/src/chart-refresh.ts` |
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
| Declared package-asset HTTP reads | `host/src/server.ts` |
| Static-path safety | `host/src/serve/static-path.ts` |
| SSE connection/keep-latest | `host/src/transport/` |
| Provider scheduling/failure isolation/fallback | `host/src/providers/registry.ts` |
| Device assignment and display names | `host/src/settings/devices.ts` |
| A theme's own device answers | `host/src/settings/theme-settings.ts` |
| Which device slots a theme needs | `host/src/settings/required-devices.ts` |
| Device-assignment resolution handed to providers | `host/src/server.ts` (`publishAssignment`) |
| Clock/date provider | `host/src/providers/clock.ts` |
| Instant reading, author format tokens and the zone list | `renderer-core/src/scene/datetime-format.ts` |
| Consumer device-selection page | `host/public/settings.html` |
| LibreHardwareMonitor provider, tree and key mapping | `host/src/providers/lhm*.ts` |
| LHM launch and elevation reporting | `host/src/providers/lhm-launcher.ts` |
| systeminformation-backed baseline provider | `host/src/providers/library.ts` |
| LAN display sessions and pairing | `host/src/session/pairing.ts` |

## Known ownership gaps

Establish one owner when these become active work:

- new-object defaults, when insertion is implemented: an editor-side pure
  factory, not persisted document state;
- shared colour parsing;
- asset-path safety rules beyond current schema checks;
- stale-reading visual treatment under Fabric.

Legacy behaviour candidates such as advanced snapping remain review-only in
spec 0014.

## Verification boundaries

Unit tests cover pure/domain behaviour and adapter contracts. Browser tests prove
canvas/editor wiring and pixels. Browser tests preview bundles rather than the
host. Visible renderer changes require inspection of selected affected evidence;
screenshots are evidence, not cross-platform golden files.
