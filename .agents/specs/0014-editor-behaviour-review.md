# 0014 — Legacy editor behaviour review

- **Status:** review backlog; **not accepted requirements**
- **Purpose:** preserve only useful behaviours that are missing from the current fork route long enough to decide whether they still belong

The previous custom editor accumulated detailed behaviour specs. Most generic
selection, transforms, grouping, duplication and history infrastructure now come
from the adopted editor fork and do not need Vigilia parity specs.

This file keeps only behaviours that are currently absent from the new editor.
Before implementing an item, inspect the fork/current workflow and choose one:
**keep**, **replace with editor-native behaviour**, or **drop**. If kept, promote
it into the relevant product/spec acceptance criteria first.

## Review candidates

### Layers/tree navigation

Currently no Vigilia semantic layer tree exists on the fork route.

Review whether the product still needs:

- a hierarchy list independent of canvas hit-testing;
- recovery/selection of hidden objects;
- visibility/lock toggles and effective parent state;
- explicit sibling z-order controls;
- group/child navigation from a tree.

Prefer fork-native object/layer UI if it provides the needed outcome.

### Alignment and distribution

Old custom code supported selection-relative edge/centre alignment and equal-gap
distribution. The fork already owns grouping/transforms, so do not port the old
matrix math.

Review whether dedicated align/distribute actions are still valuable and, if so,
which targets matter: selection, artboard, or key object.

### Rulers, grid, guides and snapping

The fork route currently has none of the old configurable ruler/grid/guide/
object-snapping system. Review the authoring need and the fork/Fabric extension
cost before retaining any subset. Do not restore the old snapping managers by
default.

### Multi-selection property editing

Current Vigilia chart controls edit one selected chart. The old inspector had a
planned/common-field model for mixed multi-selection values and bulk edits.
Review whether this is worth adding after the single-selection property model is
complete.

### Global-management UX

The token/reference data model remains current in spec 0011, but old UI details
are not automatically inherited. Review optional authoring conveniences such as:

- where-used navigation/counts;
- separate display-name vs key rekey UI;
- bulk reassignment workflow before token deletion.

The integrity rule itself remains: deletion must not leave dangling references.

### Session/file UX beyond the current v2 picker/download

Current open/save already validates bounded JSON and protects the active editor
from invalid/incompatible files. Plan §141 still requires dirty-work protection
before destructive New/Open.

Review, rather than blindly port, old conveniences such as id-derived filenames,
save-in-place, recent files, unload warnings and draft recovery. Host-backed
storage may make the old download-oriented workflow obsolete.

## Explicitly not carried forward

Do not preserve separate specs for:

- custom hit-testing/selection geometry;
- custom transform/group math;
- legacy immutable-document history internals;
- legacy inspector/panel layout;
- old DOM renderer behaviour;
- old layer/arrange/snapping implementation details.

Those implementations are superseded. Git history remains available if a future
review needs the old detail.
