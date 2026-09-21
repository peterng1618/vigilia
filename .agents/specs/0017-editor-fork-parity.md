# Editor Fork Parity — Interaction & Content Restoration

## Goal

Restore editor UX and functionality that the native-Fabric migration (spec
0016) silently dropped from the retired `fabricjs-image-editor` fork, plus
two promoted product decisions (image import bounds, per-image crop).
Default is faithful restoration; dropping a fork behaviour requires a
concrete product-fit reason, not absence of a named complaint.

Fork source for reference: `D:\git-repos\fabricjs-image-editor`, pinned at
commit `9efdd78a342a29f169a8dbf1da78c95bbf1ffe77` (the exact commit Vigilia
depended on before removal).

## Scope (build now)

New owners, one per concept, under `src/web/packages/editor/src/`:

### `controls-manager/`

Object/rotation handle styling: rounded-square/rect handles, a distinct
circular grab-cursor rotation handle, `snapAngle = 1`. Ported near-verbatim
from the fork's `ControlsCustomizer.apply()`; excludes its ActiveSelection
bounds-patching and Textbox width-control wrapping (Vigilia has no
shape-composite/`BackgroundTextbox` types those served). Applied once at
session/shell init via `InteractiveFabricObject.ownDefaults`/`Textbox.ownDefaults`.

### `toolbar-manager/`

Floating DOM toolbar positioned below the active selection's bounding box;
hidden during transform and when nothing is selected. Ported from the fork's
`ToolbarManager`. Actions: duplicate, lock/unlock, bring-to-front/forward,
send-to-back/backward, group/ungroup, delete — wired to existing
`layerManager`/`objectLockManager` plus the new managers below. English
labels (the fork's own demo config was Russian).

### `deletion-manager/`

Delete the active object or `ActiveSelection`, plus a Delete/Backspace
shortcut. Minimal relative to the fork: no group-ungroup-on-delete
recursion, no delete-guard hook — neither concept exists in Vigilia today.

### `clipboard-manager/`

Full OS clipboard: copy, cut, paste (including paste-from-external
image/HTML), and duplicate (copy+paste at a `+10/+10` offset). Adapted from
the fork's `ClipboardManager`: drop its `textManager.commitStandaloneTextScale`/
`shapeManager.commitRehydratedShapeLayout` post-clone hooks (no equivalent
concept in Vigilia's plain-object model) in favour of a plain
`object.setCoords()`.

### `grouping-manager/`

Group the current selection into a Fabric `Group`; ungroup back to
individual objects. Ported from the fork's `GroupingManager` (232 lines),
same hook substitution as clipboard above. Required by product-requirements
§57/§61.

### Movement snapping

Drag-time line and equal-spacing "smart guide" snapping. Ports the fork's
`movement/*.ts` + `guides/renderer.ts` + `guides/anchor-buckets.ts` (~2,900
lines) — the fork's own "migrated"/complete, fully generic path, with zero
`CropFrame`/`BackgroundTextbox`/`shapeComposite` coupling. Resize-time
(scale) snapping is a separate follow-up decision — tracked in spec 0014,
not built now.

### Indicators

Rotation-angle tooltip while rotating, size tooltip while scaling/resizing,
and their shared cursor-following DOM tooltip primitive. Ported from
`ui/angle-indicator/`, `ui/object-size-indicator/`, `ui/cursor-indicator/`
(~440 lines total). Localize label strings; gate each behind an editor
option, matching the fork's own pattern.

### `error-manager/` (minimal)

Structured `editor:error`/`editor:warning` canvas events plus console
logging, rebuilt — not ported — against Vigilia's actual manager set:
categories for `clipboard-manager`, `deletion-manager`, `grouping-manager`,
`controls-manager`, `toolbar-manager`, and snapping, not the fork's
dropped-subsystem categories (background/crop/etc.).

### Image import bounds (`image-manager/`)

On import, downscale an oversized image to a maximum bound before creating
the Fabric image object, preserving aspect ratio. Main-thread by default —
no Web Worker; Vigilia's dashboards are not a bulk photo-editing workload.
Revisit worker-offloading only if resize itself becomes a measured
performance problem. Promotes product-requirements §171.

### Image crop tool

New `crop-manager/` (or folded into `image-manager/` — decide during
implementation planning) providing an interactive crop session for a
selected `FabricImage`: a draggable/resizable frame bound to source-image
pixel space, optional aspect lock, apply/cancel kept outside undo history
until committed. Built on Vigilia's own existing `clipPath`-based crop
primitive (`fitImage`'s `cover` math in `scene-fabric/src/fabric-image.ts`),
**not** a port of the fork's 3,600-line `CropFrame`. Promotes
product-requirements §171.

### Live background-media swap (`scene-fabric/src/scene.ts`)

`FabricSceneHandle` currently mounts `backgroundMedia` once from
`options.artboard` and has no way to change it afterward —
`update(next: ScenePlan)` can't help, because `ScenePlan["artboard"]`
(`renderer-core/src/scene/plan.ts`) never carries `backgroundMedia`; that
field only exists on the document-level `Artboard` type, and today nothing
calls `mountFabricScene` with a changing one. Add
`updateArtboard(artboard: Artboard): void` to `FabricSceneHandle`: stores the
new `Artboard`, and if `media` exists (i.e. `resolveAsset` was supplied at
mount), calls `media.update({ artboard, assets: <original>, resolveAsset:
<original> })` — mirroring `editor-shell.ts`'s already-correct `setArtboard`
pattern, but as a real typed API rather than assumed inside `update()`. Scope
stays narrow: `assets`/`resolveAsset` remain whatever mount supplied (same
assumption `update()` already makes); no lazy creation of `media` when mount
didn't provide `resolveAsset`. A full theme swap is two calls —
`scene.update(newPlan)` for resolved paint/fit/nodes, `scene.updateArtboard(newArtboard)`
for `backgroundMedia` — since those two inputs are already architecturally
separate in this file. No current caller needs this yet; it closes a real
capability gap in the handle's contract.

## Explicitly out of scope (tracked in spec 0014)

Resize/scale snapping, zoom/pan/viewport-scrollbars, template apply,
Alt-drag measurement guides, worker-based image resize, generic
interaction-blocker, AI-generation overlay. Font and background subsystems
are already superseded by Vigilia-native owners (`font-catalog.ts`/
`font-preview.ts`/`font-assets.ts`; `artboard-panel.ts`/`artboard-paint.ts`/
`background-media.ts`); any technique-level adjustments land as spec-0014
follow-ups, not a port.

## Testing

Unit-test each new manager's pure decisions (delete targets, clone/paste
geometry, group/ungroup membership, snap-candidate resolution, crop-frame
math). Browser-test toolbar positioning/visibility, handle rendering, and
smart-guide rendering during a live drag — visible behaviour requires
rendered inspection, not just geometry/object counts.
