# 0013 — Fabric scene and editor migration

- **Status:** core migration complete; follow-on integration active
- **Design sections:** §31, §32, §35, §47, §51, §53, §55, §57, §61, §67, §105, §134, §137, §141, §157

## Goal

Fabric owns scene state/rendering; the adopted `fabricjs-image-editor` fork owns
generic editor mechanics. Vigilia owns domain semantics, telemetry, charts,
persistence and product integration.

## Boundaries

- Fabric 7.4.0 is pinned; import `fabric/es`.
- `renderer-core` stays Fabric/DOM-free.
- Fabric JSON is the persisted scene; no parallel geometry tree.
- `scene-fabric/src/persist.ts` owns serialization/revival and custom objects.
- Runtime telemetry, ECharts options and render scale never persist.
- Generic editor mechanics belong to the fork.

Player uses `StaticCanvas`; editor uses interactive `Canvas` plus Vigilia extensions.

## Implemented

- shared `scene-fabric` renderer and `VigiliaChart`;
- Fabric-only player and adopted fork on Fabric 7.4.0;
- fork route as the only active editor;
- fork history integrated with Vigilia serialization/revival;
- v2 Fabric envelope with guarded New/Open/Save;
- artboard, palette, type-preset, chart, binding and chart-paint controls;
- semantic layers plus selection, visibility, lock, order and align/distribute;
- retired custom editor removed.

The editor starts directly from a v2 Fabric envelope; the legacy `ScenePlan`
demo path is not its source.

## Remaining integration

1. Finish spec 0011 property/asset authoring.
2. Modernize the outer shell later per plan §35.

Do not restore legacy QoL for parity. Spec 0014 is review-only.

## Charts and media

`VigiliaChart` must render, move, rotate, resize proportionally, persist,
dispose explicitly, expose typed properties and accept runtime updates outside
authored history. Family conversion, skew/arbitrary stretch and perfect
chart-setting undo are not requirements.

Background media is one DOM image or video beneath the Fabric canvas, aligned to
the artboard. It is not a scene object. Video autoplays muted and loops; GIF
elements are out of scope. Spec 0011 owns the authored media/package contract.

## Completion

Close this spec when property surfaces, live telemetry and production video are
integrated; v2 reliably round-trips scene/chart state; runtime data stays out of
persistence/history; player boundaries/size gate hold; and no parallel generic
editor remains.
