# ADR-0007: Typed Vigilia charts over ECharts

**Status:** Accepted

## Context

Raw ECharts configuration is too engine-specific to be a stable authoring or
theme contract, while ECharts remains a strong rendering engine for the required
chart families.

## Decision

`VigiliaChart` persists typed Vigilia chart settings and translates them to
ECharts through one adapter. Raw ECharts options are never persisted or exposed
as the normal authoring surface.

## Consequences

Charts support the product's typed capabilities without binding theme format to
ECharts internals. Engine gaps must be surfaced rather than hidden behind
unverified approximations.
