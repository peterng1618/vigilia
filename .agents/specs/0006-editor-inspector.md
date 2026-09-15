# 0006 — Editor property editing

- **Status:** behaviour retained; legacy inspector implementation is replaceable under [0013](0013-fabric-scene-migration.md)
- **Design sections:** §61, §67, §75, §77, §89, §93

This spec defines what authors must be able to edit, not which Vigilia panel code
must survive. Property controls should integrate with the new image-editor-based
editor foundation.

## Requirements

### Token-aware properties

A style property is either a global reference or a local literal where literals
are allowed. The UI must show that distinction clearly; editing a resolved swatch
must not silently detach a token reference.

Missing references remain visibly missing rather than silently selecting another
token.

### Multi-selection

- Show a field only when it applies to the whole selection.
- Shared values display normally; differing values display as mixed.
- Editing a mixed value applies it to all selected compatible objects.
- Locked objects remain inspectable; lock itself remains editable.

### Validation

Property editing must not create a document that the schema rejects. Refuse bad
numeric/text input rather than coercing it. Clearing a property means absence
when the format defines absence/default.

Bindings are addressed by stable binding id and may not persist an empty semantic
key.

### Chart properties

Every supported chart setting must be editable in the new property UI. Controls
may be family-specific. Raw ECharts JSON is never exposed.

Changing chart family after creation is not required. Chart-property edits may
be non-undoable per §67/0013.

### Vigilia-specific groups

The new property UI must eventually cover:

- transform and common object properties;
- design-token references;
- typography presets;
- sensor binding/formatting;
- chart settings;
- image/SVG/background asset settings.

Reuse/extend the source fork's property architecture rather than preserving the
legacy `inspector-panel.ts` structure.

## Acceptance

Browser tests should prove:

- token reference vs literal/missing states are distinguishable;
- switching token/local modes never creates a dangling intermediate value;
- mixed multi-selection behaviour;
- invalid input is refused;
- locked objects remain editable where appropriate;
- chart settings change rendered output through property controls.