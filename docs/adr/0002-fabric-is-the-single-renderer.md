# ADR-0002: Fabric is the single renderer

**Status:** Accepted

## Context

The original editor maintained a separate DOM/geometry authoring path. That
duplicated rendering semantics and drove expensive editor-specific geometry,
selection and transform code.

## Decision

Fabric 7.4.0 is the shared scene graph for player and editor. `renderer-core`
remains Fabric/DOM-free; `scene-fabric` owns Fabric application and persistence.
The player uses `StaticCanvas`; the editor uses interactive `Canvas`, both via
`fabric/es`.

Prefer Fabric-native outcomes over compatibility code for retired internal
behaviour.

## Consequences

There is one rendered scene model. Player code must not import editor
UI/managers, and no parallel DOM/geometry scene representation may be introduced.
