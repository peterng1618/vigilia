# 0013 — Fabric scene and editor migration

- **Status:** active; Stage 4B
- **Design sections:** §31, §32, §35, §47, §51, §53, §55, §57, §61, §67, §105, §134, §137, §141, §157

## Goal

Stop owning a general-purpose graphics editor. Fabric owns scene state/rendering;
the adopted `fabricjs-image-editor` fork owns generic editor mechanics. Vigilia
keeps domain semantics, telemetry, charts and product integration.

## Architecture

```text
Vigilia envelope
├── semantics / artboard / assets / bindings
└── Fabric scene JSON
          │
          ▼
renderer-core         Fabric-free domain planning
          │
          ▼
scene-fabric           Fabric objects + persistence
      ┌───────────────┴──────────────┐
      ▼                              ▼
player                           editor
StaticCanvas                    interactive Canvas
                                + image-editor fork
                                + Vigilia extensions
```

Rules:

- Fabric 7.4.0 is pinned; import `fabric/es`.
- `renderer-core` stays Fabric-free.
- Fabric JSON is the persisted scene; no parallel simplified geometry tree.
- `scene-fabric/src/persist.ts` owns canonical serialization/revival and custom
  object lifecycle.
- Runtime telemetry/ECharts options/render scale never persist.
- Generic editor mechanics belong to the fork, not new Vigilia infrastructure.

## Current state

Completed:

- shared `scene-fabric` path and `VigiliaChart`;
- Fabric-only player;
- source-fork feasibility/adoption;
- fork unified on Fabric 7.4.0 and consumed as a compiled Git package;
- active `/editor` route mounts the fork; old DOM route is inactive;
- fork history uses Vigilia serialization/revival and chart disposal hooks;
- development v2 envelope with Fabric scene JSON;
- bounded Ctrl/Cmd+O validation/compatibility preflight and Ctrl/Cmd+S export;
- scalar chart property controls generated from shared descriptors;
- direct v2 startup through a static `demo` Fabric envelope.

Current fork extensions are only charts, persistence and shortcuts. The legacy
demo-theme/`ScenePlan` path does not mount the interactive editor.

## Stage 4B — finish editor migration

Required work:

1. make direct v2 envelope startup/document state the normal editor path;
2. finish the domain property boundary needed for current product features;
3. verify ordinary edit → history → save/open/revive flows on the fork route;
4. preserve dirty-document safety from plan §141 before destructive New/Open;
5. delete each corresponding legacy DOM/custom path once replacement is proven.

Do **not** recreate missing legacy editor QoL during this stage merely for parity.
Spec 0014 contains those review candidates. An item becomes migration scope only
if review promotes it to a current requirement.

## Charts

`VigiliaChart` is a Fabric object backed by detached ECharts rendering.

Required: correct rendering, move, rotation, proportional resize, persistence,
explicit disposal, typed property editing and runtime updates outside authored
history.

Accepted limitations: no family conversion, skew/arbitrary stretch, or perfect
chart-setting undo. Grouping may be restricted if it creates disproportionate
complexity.

## Media

Video remains one DOM background beneath the transparent Fabric canvas, aligned
by the artboard transform. It is not a scene object. Animated GIF elements are
out of scope.

## After Stage 4B

1. Complete the final v2 token/type/reference model in spec 0011.
2. Add live editor bindings/charts without polluting authored history.
3. Add production video-background integration.
4. Delete remaining DOM/custom editor infrastructure.
5. Later, modernize the surrounding shell to React + shadcn/Base UI per plan
   §35. This is separate from the Fabric migration.

## Acceptance

The migration is complete when:

- editor/player both render authored scenes through shared Fabric classes;
- v2 save/open reliably round-trips identity, grouping and custom-chart state;
- generic editing mechanics come from the fork rather than parallel Vigilia
  implementations;
- current required Vigilia properties have a new-editor editing surface;
- runtime telemetry never contaminates persisted state/history;
- player remains free of editor UI dependencies and inside its bundle gate;
- production video background aligns with the artboard;
- superseded DOM/custom generic-editor code is removed.

Review-only 0014 items are explicitly **not** acceptance criteria unless promoted.

## Reconsideration bar

Reconsider the adopted approach only for a fundamental blocker: persistent
rendering/lifecycle leaks, unavoidable unstable Fabric-internal hacks, custom
chart state that cannot survive normal persistence, or inability to separate
runtime telemetry from authored state. Missing QoL/upstream hooks are not
blockers.
