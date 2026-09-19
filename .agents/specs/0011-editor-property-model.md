# 0011 — Editor property and theme-token model

- **Status:** active; chart descriptors/control path partly implemented, remaining domains pending
- **Design sections:** §57, §73, §75, §83, §87, §89, §137, §170

## Goal

Define authored property ownership independently of any particular panel layout.
The new editor property surface must use this model rather than preserve the old
Vigilia inspector.

## Rules

### Authorable properties need a UI

If Vigilia supports authoring a property, expose a typed control. Do not make raw
Fabric/ECharts JSON the normal editing surface. Invalid input is refused rather
than coerced.

### Geometry belongs to Fabric

Fabric objects/groups persist geometry and compose transforms. Groups are
non-painting containers: no fill/stroke/shadow/typography/bindings of their own.
Author-facing geometry uses whole artboard units where practical.

### Colour is theme-level

Final palette entries are named tokens containing CSS-compatible solids or
gradients. Every authored element paint, including `fill`, stroke and text
colour, references a palette token; per-instance opacity remains local. A
gradient has editable colour stops/positions plus one angle and spans the
object's rectangular bounding box before clipping.

`palette.none` is reserved transparent fallback and cannot be deleted/renamed.
Deleting another referenced token requires reassignment.

### Typography uses type presets

A named type preset groups family, size, weight, letter spacing and line height.
Each styled run independently references its preset and palette colour; local
typography is invalid and there is no text-object-level preset.

Each preset selects one declared packaged font face by family, weight and style;
the renderer never synthesizes missing bold or italic variants. Font assets are
local WOFF2, WOFF, TTF or OTF bytes with their family, weight, style, format,
source URL and license metadata. Variable fonts and axis controls are out of
scope.

Theme settings owns font authoring after background media. Google Fonts uses an
entered family plus requested face, retrieves its CSS endpoint and downloads the
referenced WOFF2 into the package. Custom import requires the author to provide
family, weight and style. Type-preset controls offer only declared faces.
Open/Save/Release retain exact bytes; player/editor load them through `FontFace`
before measuring or rendering text. A missing or incompatible preset face
invalidates the package; runtime load failure is visible, never silently
replaced by a synthesized face. No runtime Google CDN dependency is persisted.

### Charts are family-specific

Each chart family owns typed setting descriptors in `renderer-core`. The editor
builds controls from those declarations. Existing charts need not change family.
Raw ECharts options are not persisted or directly edited.

### Theme settings and artboard properties

One Theme settings surface owns editable theme metadata (name, description,
author and optional SemVer release version), artboard width/height, viewport fit
mode, palette background/bar-colour tokens, and background media. Resizing the
artboard does not rescale scene objects.

Ordinary Save never changes the release version. A Release action validates the
theme package, prompts for a major/minor/patch bump, updates the optional SemVer
version (initially `0.1.0`), then writes the package.

The artboard always has palette-referenced paint. Its optional
`backgroundMedia: { assetId, fit: 'contain' | 'cover' }` references one
packaged PNG, JPEG, WebP, SVG, MP4 or WebM asset. Image/SVG and video are
mutually exclusive, are not Fabric scene objects, and use this media-fit
setting. `contain` exposes the artboard paint in letterbox space; `cover` crops
to fill. This is distinct from artboard viewport fit (`contain`/`cover`), which
only positions the entire artboard in the player or editor. Video autoplays
muted, loops and has no authored playback controls.

Missing, deleted or incompatible referenced media is an invalid package.
Clearing background media returns to paint-only. Media bytes remain in the
package asset map; object URLs and DOM media are disposed on replacement,
New/Open and unmount. GIF and remote URLs are not supported.

Scene objects use one stable Vigilia id rather than separate id/name fields that
can disagree.

### New-element defaults

Defaults select valid authored references when a Vigilia creation command runs.
They are editor-local derived input, never mutable theme globals or persisted
document state. Generic object construction and stack ordering remain fork-owned.

### Semantic layers and arrange actions

The editor projects the current Fabric object graph into a semantic layer tree;
it never persists or maintains a second scene tree. Entries use each object's
derived Fabric kind plus stable Vigilia id, in top-most-first paint order.
Nested groups project their current ordered children. Top-level and group
entries synchronize selection with the canvas. Child entries navigate to their
owning group; they are not independently editable until the fork supports safe
group entry.

Tree visibility, lock and sibling z-order actions operate on the corresponding
Fabric object through the fork. It shows effective inherited visibility/lock;
revealing a hidden child reveals its hidden parent path before selecting its
owning group. Grouping and ungrouping remain fork-owned, but the projection must
refresh so the tree immediately reflects reparenting and reordering.

Dedicated align/distribute commands act on the current multi-selection only.
Alignment needs at least two objects; equal-gap distribution needs at least
three. Both use the objects' rendered Fabric bounding boxes, preserve the active
selection, and do not add an artboard or key-object target.

### Image/SVG asset authoring

The editor owns the open package's declared asset bytes until New/Open replaces
it. Import accepts local PNG, JPEG, WebP and SVG files, copies each file into
the package's embedded `assets/` directory, then inserts a Fabric image whose
stable `assetId` references that declaration. The original local file is never
modified.

Replacing a selected image changes its `assetId`; an imported replacement is
copied first. Removing a referenced asset is refused. Open retains declared
bytes; Save and host-library Save write the envelope and exact asset map through
the §139 package boundary. Dirty tracking includes asset bytes.

SVG is sanitized before preview and its original bytes are retained. Raster
previews use revocable object URLs. GIF, font and URL imports are out of scope.
A future URL importer may fetch Font Awesome SVG or Unsplash imagery, then apply
this same local asset boundary with explicit remote validation and attribution
handling.

## Capability summary

| Capability | group | shape | text | image/SVG | chart |
|---|---:|---:|---:|---:|---:|
| scene geometry/order/visibility/lock | ✓ | ✓ | ✓ | ✓ | ✓ |
| opacity | — | ✓ | ✓ | ✓ | ✓ |
| palette paint | — | applicable | text colour | monochrome where supported | family settings |
| typography preset/runs | — | — | ✓ | — | chart text where supported |
| asset source/fit | — | — | — | ✓ | — |
| sensor binding | — | — | ✓ | — | ✓ |
| family settings | — | — | — | — | ✓ |

Multi-selection/mixed-value property UX is not a requirement.

## Current implementation state

Implemented: Fabric scene/group persistence; typed chart descriptors and scalar
controls; artboard size/fit/paint; chart bindings and palette-referenced paint;
palette and type-preset authoring/reassignment; semantic text creation; semantic
layers with inherited visibility/lock/order; and selection-relative
align/distribute.

Still incomplete: background image/video authoring, packaged font authoring,
release-version controls, chart paint/threshold controls, and broader Vigilia
creation commands.

The development v2 semantic shape may still break before release; the Fabric
scene envelope boundary is settled by spec 0013.

## Ownership

| Concept | Owner |
|---|---|
| Theme semantic types/validation | `renderer-core/src/theme/` |
| Published development schema | `schema/theme-document.schema.json` |
| Chart setting descriptors | `renderer-core/src/charts/` |
| Scene geometry/grouping | Fabric scene via `scene-fabric` persistence |
| Semantic layer projection and arrange UI | `editor/src/layer-panel.ts`, `editor/src/arrange.ts` |
| Current chart property UI | `editor/src/chart-manager/` |
| Current palette/type property UI | `editor/src/palette-panel.ts`, `editor/src/type-preset-panel.ts` |
| Open-package image/SVG bytes and controls | `editor/src/asset-manager/` |

Do not create speculative managers/owners for property domains that are not yet
implemented.

## Acceptance

Before stabilising the theme format:

- palette/type presets persist as stable references rather than copied values;
- `palette.none` and reference deletion/reassignment rules are enforced;
- supported chart settings have typed controls and repaint correctly;
- layer navigation reflects Fabric hierarchy, effective parent state, grouping
  and sibling order without a parallel scene tree;
- alignment requires two objects, distribution requires three, and both preserve
  the active selection;
- artboard/token/type/binding/asset properties have a product editing surface;
- Theme settings preserve metadata and release versions; background paint/media
  has the specified crop, playback and package lifecycle behaviour;
- unknown/invalid authored property values are explicitly rejected;
- runtime telemetry never becomes persisted authored state.

Current run evidence belongs in `status.md`.
