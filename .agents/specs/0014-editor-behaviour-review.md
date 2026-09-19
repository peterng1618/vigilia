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

## Not carried forward

Do not restore custom hit-testing, transform/group math, immutable-document
history, legacy inspector layout, old DOM rendering, old layer/arrange/snapping
implementations, or multi-selection property editing. Git retains the old detail.
