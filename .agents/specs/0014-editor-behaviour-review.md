# 0014 — Legacy editor behaviour review

- **Status:** review backlog; **not accepted requirements**
- **Purpose:** retain only unresolved legacy behaviours worth reconsidering

Generic selection, transforms, grouping, duplication, history, layer ordering
and locks come from the adopted fork. Accepted semantic layers and
align/distribute moved to spec 0011. Bulk multi-selection property editing was
dropped.

Before implementing an item below, inspect the current workflow and choose
**keep**, **replace with editor-native behaviour**, or **drop**. Promote kept
behaviour into product/spec acceptance criteria first.

## Review candidates

### Rulers, grid, guides and snapping

Review the authoring need and fork/Fabric extension cost before retaining any
subset. Do not restore the old snapping managers by default.

### Global-management UX

Token/reference integrity is current in spec 0011. Optional UX:

- where-used navigation/counts;
- display-name vs key/rekey UI;
- bulk reassignment before token deletion.

### Session/file UX

New/Open protects dirty work; Open validates and stages v2 revival before
replacement. Host-backed storage may supersede download-oriented conveniences.

Review only if useful: id-derived filenames, save-in-place, recent files, unload
warnings and draft recovery.

### Resize/scale snapping (deferred, not dropped)

The fork's `snapping-manager/scaling/*` (~10k lines) covers resize-time line
and equal-spacing snapping. Its "migrated" paths are tangled with
`BackgroundTextbox`/`shapeComposite` ActiveSelection eligibility rules
Vigilia's object model doesn't have, and Vigilia's own `VigiliaChart` object
never existed in the fork, so scale-eligibility needs new integration work
regardless. Movement (drag) snapping ships in the
0017 fork-parity work (complete); resize-snapping is a
follow-up decision once that ships and gets used.

Additional 0017 residuals, tracked here on completion:

- **Crop of a rotated image** is refused with a warning; `clipPath`
  coordinates are image-local and unrotated, and mapping a canvas-space frame
  through a rotated image's inverse transform is a larger problem than §171
  asked for.
- **Splitting the vendored snapping geometry** (`movement-snapping-resolver.ts`
  and `spacing.ts`, each over 1,300 lines) below the 800-line stop; vendored
  verbatim on purpose, see decisions.md.
- **The fork's `pixel-grid.ts` pixel snapping** (487 lines) is excluded from
  the port; it string-matches the fork's `background-textbox` type.
- **The size indicator's `mouse:move` refresh pass** is dropped: it reached
  into Fabric's private `_currentTransform` for the fork's late-materialising
  text pipeline, which Vigilia does not have. Restore if the size label proves
  stale at the end of a text resize during use.

### Canvas zoom, pan, and viewport scrollbars — drop

`zoom-manager/`, `pan-constraint-manager/`, `viewport-scrollbar-manager/`.
Vigilia's artboard is authored at a fixed dashboard resolution and shown
fit-to-panel (`editor-shell.ts`'s `fitArtboardViewport`); there is no
interactive zoom/pan concept to restore today. Restoring this trio means
building a new camera model from nothing, not repairing dropped polish —
revisit only if a real need for zooming into a dashboard while authoring
appears.

### Image crop tool and import bounds — promoted, not dropped

Superseded by product-requirements §171 and the
0017 fork-parity work: build a small
interactive crop on Vigilia's own `clipPath`-based fit primitive, not a port
of the fork's `CropFrame` (~3,600 lines, source-pixel-bound machinery Vigilia
doesn't need).

### Template apply/serialize — drop for now

`template-manager/` (~1,900 lines) applied a saved object tree onto the
montage area with image-source rehydration. No active requirement; when a
templates feature is built, design it as serialization glue over
`persistence-manager`/`asset-manager`, not ported from the fork's
`BackgroundManager`-coupled rehydration rules.

### Alt-drag distance measurement guides

`measurement-manager/` (759 lines) drew Figma-style spacing guides on
Alt+hover. Pure QoL, absent from the fork's own migration priorities. Defer;
if ever built, Vigilia's simpler object model (no shape-composite) makes a
from-scratch version smaller than 759 lines.

### Worker-based image resize — drop for now

The fork offloads image resize/dataURL conversion to a Web Worker via
`createImageBitmap`/`OffscreenCanvas`. Vigilia's image import (per §171) does
main-thread resize; revisit worker-offloading only if resize itself becomes
a measured performance problem.

### Generic canvas interaction-blocker — drop unless a use case appears

`interaction-blocker/` disables the whole canvas during a long-running
operation. No async operation in Vigilia today needs to freeze the whole
canvas; porting it now would add an unused manager. Its `ai-generation-overlay.ts`
variant is fork-demo chrome for a feature (AI image generation) Vigilia does
not have and does not plan.

### Structured error/warning bus

Ships as a minimal `error-manager/` in the
0017 fork-parity work, rebuilt against
Vigilia's actual manager set rather than the fork's dropped-subsystem
categories.

### Font and background managers — already superseded

Vigilia's curated font catalog (`font-catalog.ts`/`font-preview.ts`/
`font-assets.ts`) and declarative background (`artboard-panel.ts`/
`artboard-paint.ts`/`background-media.ts`) are deliberately different from
and superior in fit to the fork's arbitrary-upload `font-manager/` and
imperative `background-manager/`. Technique study complete; adoptable items:

- `background-media.ts` has no error-reporting path (`update()` silently
  no-ops on unresolved asset/kind mismatch). Add an `onError`/`onAssetError`
  callback to `BackgroundMediaOptions`, matching the convention
  `fabric-image.ts`'s `onAssetError` and `font-assets.ts`'s `onError`
  already use.
- **Not a bug, verified:** an earlier pass flagged `scene.ts`'s
  `mountFabricScene(...).update(next)` for never calling `media.update(...)`.
  Checked against the actual types: `ScenePlan["artboard"]`
  (`renderer-core/src/scene/plan.ts`) carries no `backgroundMedia` field at
  all — it's a resolved-paint-only shape, distinct from the document-level
  `Artboard` type that has it. `mountFabricScene` only ever receives a full
  `Artboard` once, at mount, as its own `options.artboard`; `update()`
  legitimately has no new `backgroundMedia` to propagate. `editor-shell.ts`'s
  `setArtboard` isn't a comparable path — it takes a real `Artboard`
  directly, never a `ScenePlan`. If live background-media swapping after
  mount is ever wanted, that is a new feature (a `ScenePlan`/`Artboard`
  reshape or a separate `updateArtboard` method), not a fix.
- `adapter.ts`'s `applyArtboard` recomputes `fabricArtboardPaint` and
  reassigns `canvas.backgroundColor` (allocating a new `Gradient`) on every
  `apply(plan)` call, including every player render tick. Add a cheap
  "same `artboard.background` as last apply → skip" memo.
- `font-assets.ts`'s `loadFontAssets` has no dedup: concurrent
  `mountFabricScene` instances loading overlapping trio faces each
  unconditionally `FontFace(...).load()` + `fonts.add()`, double-loading
  identical bytes. A refcounted registration-key cache (assetId/family+
  weight+style) would let concurrent instances share a load.
- Not adopted: `font-catalog.ts`/`font-preview.ts` already avoid the
  redundant-load problem by construction (one active preview at a time);
  `artboard-paint.ts`'s gradient-angle math is already more correct than the
  fork's (`_angleToCoords` midpoint approximation vs. Vigilia's CSS-matching
  reach formula); the fork's `<style>`-tag `@font-face` fallback for missing
  `FontFace` support is compat glue for a gap none of Vigilia's evergreen
  targets have.

## Not carried forward

Do not restore custom hit-testing, transform/group math, immutable-document
history, legacy inspector layout, old DOM rendering, old layer/arrange/snapping
implementations from Vigilia's original pre-fork editor, or multi-selection
property editing. Git retains the old detail.
