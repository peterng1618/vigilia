# ADR-0003: Persist Fabric scene inside the Vigilia envelope

**Status:** Accepted

## Context

Vigilia needs product semantics that Fabric JSON does not own, while duplicating
Fabric geometry/grouping into a second document model caused drift.

## Decision

The versioned Vigilia envelope owns product semantics, globals, assets, bindings
and metadata. Fabric JSON is the persisted scene and owns geometry, transforms,
grouping, stacking, visibility, locks and custom-object state.

Reject incompatible Fabric runtimes before revival. Persist authored chart
settings only, never built ECharts options, telemetry or other runtime state.

## Consequences

`scene-fabric/src/persist.ts` is the canonical scene serialization/revival
boundary. There is no parallel simplified scene tree.
