# Ownership map

Canonical map of which module owns each cross-cutting concept. Check this before
adding a new owner, parallel abstraction, registry, persistence path or manager.
If implementation moves an owner, update this map in the same change.

**A concept has exactly one owner, and the owner's membership is not a second
module's decision.** Naming a member to *read* it — `IDS[0]`, `for (const id of
IDS)`, a type derived from it — is a consumer, and the rule working. Re-spelling
the set, or a subset of it, somewhere else is a **second owner**, and it fails
quietly: the two agree until someone adds a member, and then the new one is
simply never seen by whoever re-spelled it. That is not drift and is not fixed
by making one list read the other; it is fixed by deleting the second decision.

**This map is the first half of that rule, and a gap in it is a hole in the
rule.** A module that owns a vocabulary but appears nowhere below is invisible
here, so nothing warns a reader not to decide the membership elsewhere —
`object-actions.ts` was exactly that, and the Arrange menu picking two of its
eight actions is what it cost. **If you add a module that owns an enumeration,
add the row in the same change.**

`npm run ownership:sweep` checks the rule mechanically and reports candidates,
not verdicts: it finds every module exporting an id vocabulary and reports any
other module re-spelling two or more of those ids. **Adjudicate every hit** — a
consumer and a second owner look the same to it, and roughly half of what it
finds is a consumer. Its self-test runs in `npm run gates:self-test`.

## Uniqueness is necessary, not sufficient

**One owner does not mean the right owner.** A row can be perfectly unique and
still be shortsighted: `panel.ts` can faithfully enforce a rule that ought to live
somewhere else, and nothing above will notice, because the sweep proves
*uniqueness* and says nothing about *correctness*. **A green sweep is a warrant
for one decider, not for this decider.** As features grow, the assignments made
early are the ones most likely to have been made without the whole architecture
in view.

So the two questions are separate and both are real:

| question | who answers it |
|---|---|
| Does this concept have exactly one decider? | `npm run ownership:sweep` — mechanical, in the gate |
| Is that decider the right one? | **a person, reading.** No script can answer it |

`scripts/ownership-enforcement.mjs` is a starting point for the second question
and **is deliberately not wired into any gate**: it takes each concept's
distinctive words and reports the modules the map does not name, which flags 77
of 92 rows. In this codebase a concept's vocabulary and its enforcement are the
same words — `glass.ts` says `fill` and `shadow` because it paints things — so
presence cannot separate an owner from a consumer. **A gate that flags 84% of
rows trains people to ignore it.**

**What would actually answer it, and is enumerable by hand:** for each row, find
the code that would *reject* a wrong value for that concept — the guard, the
validator, the `refuse` — and ask whether it lives in the module the map names.
A guard in an unnamed module is a missing row or a wrong owner, and telling those
two apart is the judgement the map cannot make for itself.

## Editor

| Concept | Owner |
|---|---|
| Canvas mount/disposal, viewport fitting, artboard paint | `editor/src/editor-shell.ts` |
| **Which displays a theme can be seen through** — their ids and aspect ratios, and the screen rect one becomes | `editor/src/display-lens.ts` |
| The stage camera — zoom, pan, framing, and the lens it frames through | `editor/src/viewport-manager/` |
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
| **The artboard-to-viewport transform** — contain/cover scale, letterbox bars, cover crop | `renderer-core/src/artboard.ts` |
| Theme metadata, artboard size/preview fit/paint/media — **the authoring controls** | `editor/src/artboard-panel.ts` |
| Semantic layer projection | `editor/src/editor-shell/layer-tree.ts` |
| **Which object and arrange actions exist** — their ids, labels, icons and eligibility | `editor/src/object-actions.ts` |
| Applying an arrange action to a multi-selection | `editor/src/arrange.ts` |
| Palette-token authoring and reference reassignment | `editor/src/palette-manager/` |
| New-object defaults (text, charts, shapes) and the shape list | `editor/src/new-object-defaults.ts` |
| The Add panel's construction actions | `editor/src/new-object-panel.ts` |
| Shape material fields (fill, stroke, border, shadow, radius) and each shape's own geometry | `editor/src/selection-inspector/panel.ts` |
| Frosted-glass control (enable, blur radius) | `editor/src/selection-inspector/glass.ts` |
| Glass lifecycle re-resolve, asked for by that control | `editor/src/editor-shell.ts` (`EditorShell.refreshGlass`) |
| Type-preset authoring and reference reassignment | `editor/src/type-preset-manager/` |
| Open-package asset bytes and controls | `editor/src/asset-manager/` (`index.ts` bytes, `panel.ts` the pane) |
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
| The languages an author may pick | `editor/src/theme-languages.ts` |
| Which theme a host displays | `host/src/settings/active-theme.ts` |
| The consumer's clock zone | `host/src/settings/display.ts` |
| Theme thumbnails — store, location in the theme folder, and route | `host/src/themes/thumbnails.ts` |
| Thumbnail capture in the editor | `editor/src/thumbnail-capture.ts` |
| Shell chrome, rail, inspector tabs, menus | `editor/src/editor-shell/shell-layout.tsx` |
| Shell palette | `editor/src/editor-shell/palette.ts` |
| Drag-time snapping and smart guides | `editor/src/snap-manager/` |
| Rotation-angle and size indicators | `editor/src/indicator-manager/` |
| Per-image crop session | `editor/src/crop-manager/` |
| Imported and rehydrated image pixel bound | `editor/src/image-manager/` |
| **What a fresh object id looks like** — sanitising, truncation, and the `-N` bump past ids already in the document | `renderer-core/src/theme/widget.ts` (`createWidgetIdAllocator`) |
| **Minting a new identity for one object** — choosing the prefix that says what kind of thing it is | the manager that creates the kind (`text-manager`, `chart-manager`, `image-manager`, `grouping-manager`, `new-object-panel`) |
| **Minting ids for a *copy*** — object ids and binding ids together, minted past the destination | `renderer-core/src/theme/widget.ts` (`createWidgetIdAllocator`), used by `editor/src/card-library.ts` and `editor/src/clipboard-manager/` |

**The copy path and the fresh-object path are one job, not two, and only the copy
path has been folded in.** "A copy is a copy, not a twin" needs an id the
destination does not hold; "a new object needs an id" needs the same thing. The
seven creation sites still each inline a prefix plus a `randomUUID`, which is the
*shape* of the policy without its substance — no truncation, no sanitising, no
knowledge of what the document already holds, so a collision is possible and
silent. `ownership:sweep` cannot see this: none of the seven exports an id
vocabulary, each inlines a string literal, and the sweep reports re-spelled
vocabularies. Fold them in when a creation site is next edited.

### Packaged fonts

`renderer-core/src/theme/` owns font-face declarations and preset validation;
`editor/src/font-catalog.ts` and `editor/src/font-preview.ts` own curated
metadata and transient previews; the existing type-preset/asset boundaries own
adoption; `scene-fabric/src/font-assets.ts` owns loaded-face lifecycle. The UI
adapter does not own catalog, preview or adoption semantics.

`editor-shell.ts` owns generic z-order, grouping and locks; the Vigilia layer
tree (`editor-shell/layer-tree.ts`) projects that state without a parallel scene
tree, and `editor-shell/layer-panel.tsx` renders those rows.

## Ownership registry

### Shared/domain

| Concept | Owner |
|---|---|
| Samples/status | `renderer-core/src/types.ts` |
| Live presentation buffer | `renderer-core/src/data/live-source.ts` |
| Theme semantic types/validation | `renderer-core/src/theme/` |
| The authored `vigiliaGlass` treatment and its bounds | `renderer-core/src/theme/glass.ts` (DOM/Fabric-free; rendering lives in `scene-fabric/src/glass.ts`) |
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
| Backdrop-glass composition, and its attach/dispose lifecycle | `scene-fabric/src/glass.ts` (editor Canvas and player StaticCanvas share it) |
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
| Instant reading, offsets and the zone list | `renderer-core/src/scene/datetime/instant.ts` |
| The author's date/time format tokens | `renderer-core/src/scene/datetime/format.ts` |
| Locale-spelled month, weekday and day-period names | `renderer-core/src/scene/datetime/names.ts` |
| Measurement conversion for display, and which families convert | `renderer-core/src/scene/measurement.ts` |
| The preference a display reads at load | `player/src/theme-loader.ts` (`loadDisplayPreferences`) |
| Consumer device-selection page | `host/public/settings.html` |
| The theme chooser the dashboard falls back to | `host/public/library.html` |
| A saved theme as one row in a list, and the host pages' chrome | `host/public/theme-list.js`, `host/public/vigilia-page.css` |
| LibreHardwareMonitor provider, tree and key mapping | `host/src/providers/lhm*.ts` |
| LHM launch and elevation reporting | `host/src/providers/lhm-launcher.ts` |
| systeminformation-backed baseline provider | `host/src/providers/library.ts` |
| LAN display sessions and pairing | `host/src/session/pairing.ts` |

## Known ownership gaps

Establish one owner when these become active work:

- shared colour parsing;
- asset-path safety rules beyond current schema checks;
- stale-reading visual treatment under Fabric.

Legacy behaviour candidates such as advanced snapping remain review-only in the
[editor behaviour review](../superpowers/specs/2026-09-24-editor-behaviour-review.md).
