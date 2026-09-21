# 0016 — Native Fabric editor

- **Status:** active
- **Design sections:** §31, §32, §33, §35, §57, §61, §67, §134, §141, §157

## Goal

Remove `fabricjs-image-editor` as an editor dependency. `@vigilia/editor` owns
its interactive Fabric mechanics at the same architectural level as its existing
theme, chart, asset and persistence features.

## Contract

- The editor uses the shared pinned `fabric/es` runtime directly.
- `scene-fabric` remains the sole owner of Fabric scene persistence/revival,
  custom chart objects and player-compatible renderer primitives.
- The native editor owns canvas mount/disposal, viewport fitting, history,
  selection, transforms, grouping, duplication, locking, layer ordering, text
  insertion and image/SVG insertion.
- Existing Vigilia feature owners remain independent: package persistence,
  theme semantics, artboard, palette/type presets, assets, charts, bindings,
  runtime refresh and product shortcuts.
- Authored state enters history; runtime samples, selection and viewport do not.
  New/Open retain dirty-work protection and invalid envelopes fail before canvas
  mutation.
- The external package, declaration shim, Vite alias and fork-named composition
  files are deleted only when no production or test import remains.

## Migration sequence

1. Establish native editor contracts for the current fork surface and migrate
   fork-specific consumers to them without changing document semantics.
2. Replace the mount/root lifecycle and history with native Fabric mechanics;
   retain v2 revive/snapshot, artboard fit/paint and background-media behaviour.
3. Move exercised generic interactions into focused native modules: object
   creation/import, selection/transform, layers/locks, grouping and clipboard.
   Do not port review-only legacy behaviour from spec 0014.
4. Move existing composition to the editor root, remove fork imports and package
   metadata, then remove obsolete fork files.

Each step must leave the editor buildable and its covered interaction path
observable. A behaviour with no current product consumer is omitted; add it only
after an explicit spec-0014 retention decision.

## Acceptance

- `@vigilia/editor` has no `@anu3ev/fabric-image-editor` runtime, type, alias
  or lockfile dependency.
- A v2 package can create, open, edit, undo/redo, save and reopen through the
  native editor without losing authored scene/envelope state.
- Text, image/SVG, chart, palette/type-preset, artboard and layer workflows
  retain their current product contracts.
- Player remains independent of editor modules and retains its size gate.
- Focused unit/DOM tests cover each migrated mechanic; changed visible flows
  receive full local E2E and inspected selected evidence.

## Out of scope

- React/shadcn shell modernization, new document schema, a Fabric version
  change, compatibility reading for v1 themes, or unreviewed spec-0014 legacy
  behaviour.
