# Ownership map

Canonical map of which module owns each cross-cutting concept. Check this before
adding a new owner, parallel abstraction, registry, persistence path or manager.
If implementation moves an owner, update this map in the same change.

## Editor

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
| The Style tab (resolved references, document globals) | `editor/src/selection-inspector/style.ts` |
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

### Packaged fonts

`renderer-core/src/theme/` owns font-face declarations and preset validation;
`editor/src/font-catalog.ts` and `editor/src/font-preview.ts` own curated
metadata and transient previews; the existing type-preset/asset boundaries own
adoption; `scene-fabric/src/font-assets.ts` owns loaded-face lifecycle. The UI
adapter does not own catalog, preview or adoption semantics.

`editor-shell.ts` owns generic z-order, grouping and locks; the Vigilia layer
panel projects that state without a parallel scene tree.

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
| Measurement conversion for display, and which families convert | `renderer-core/src/scene/measurement.ts` |
| The preference a display reads at load | `player/src/theme-loader.ts` (`loadDisplayPreferences`) |
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

Legacy behaviour candidates such as advanced snapping remain review-only in the
[editor behaviour review](../superpowers/specs/2026-09-24-editor-behaviour-review.md).
