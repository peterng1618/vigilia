# Status — 2026-09-17

Current handoff only. Durable rules: `AGENTS.md`; architecture:
`architecture.md`; decisions: `decisions.md`; migration: spec 0013.

## Current evidence

| Check | Latest recorded result |
|---|---|
| Unit tests | 1,271 passed across 70 files |
| Typechecks | six projects clean |
| Browser suite | 52 passed / 118 skipped / 0 failed across desktop and phone Chromium |
| Player size | 260.3 KB gzip / 400 KB gate |
| Host bundle | 25.36 KB raw / 8.34 KB gzip; no Fabric dependency edge |
| Visual inspection | desktop assets and phone demo captures inspected; fit modes, recolouring, charts and letterboxing rendered correctly; the fork editor route mounts its interactive canvas |
| Editor foundation | compiled fork package installed; fork typecheck/build and 1,809 tests passed |

These figures are from the current session's Stage 4B route-migration gate.

## What works

- Node/TypeScript host serves real baseline telemetry over SSE.
- Status-before-value semantics are enforced; missing is not zero.
- `scene-fabric` renders text, shapes, groups, images/SVG and all four chart
  families.
- `VigiliaChart` renders ECharts through a detached canvas, supports rotation,
  live redraw, proportional resize, serialization and explicit disposal.
- Fabric text path supports clipping, ellipsis, wrapping/line clamp, vertical
  alignment and font-load re-measure.
- Player is Fabric-only; its runtime no longer imports the DOM mount or registers ECharts.
- Player display E2E coverage probes the canvas scene and rendered pixels.
- Fabric images support contain/cover/stretch and alpha-preserving bitmap/SVG recolouring.
- Fabric scene serialization/revival exists in `scene-fabric/src/persist.ts`.
- `scene-fabric` can construct a schema-v2 Fabric theme envelope and refuses a
  mismatched exact Fabric runtime before revival; the published schema switch is pending.
- `renderer-core` validates schema-v2 Fabric envelopes before revival, including
  version-first refusal, object identity/bounds and semantic binding references.
- The editor has a bounded, v2-only file parser; routing the validated result to
  the active fork shell is the remaining Open-file step.
- `renderer-core` exposes direct chart-option planning from authored chart state
  and bindings, so the v2 editor need not rebuild a legacy node tree for charts.
- `renderer-core` extracts v1 semantic metadata and bindings into the envelope;
  Fabric remains the sole owner of persisted geometry.
- Scene revival disposes existing `VigiliaChart` engines, including grouped charts,
  before Fabric replaces the object graph.
- The source fork is adopted: its text/image/shape, selection, transforms,
  grouping and duplicate mechanics work with `VigiliaChart`; chart runtime
  updates stay out of its history in the Stage 4A browser spike.
- The adopted fork's `codex/fabric-es` branch pins Fabric 7.4.0 and imports
  `fabric/es` throughout. Vigilia consumes its compiled Git package, keeping
  the fork out of Vigilia's stricter TypeScript program.
- `editor/src/fork-shell.ts` mounts the fork with `beforeHistoryStateLoad` set
  to `disposeScene`, and disposes charts before destroying the fork canvas.
- The fork shell can snapshot its interactive canvas into the v2 envelope;
  Ctrl/Cmd+S downloads it; a validated v2 envelope can now revive directly into
  its interactive canvas, while route-level file selection remains pending.
- `ShortcutManager` is the sole window listener and dispatches only registered
  Vigilia actions; `PersistenceManager` owns envelope download.
- `ForkExtensions` composes and destroys the current chart, persistence and
  shortcut managers above the fork canvas.
- The editor route mounts that fork shell; the legacy DOM route is no longer active.
- The fork route reconciles the shared demo ScenePlan onto its interactive canvas,
  so authored scene objects use the same Fabric classes as the player.
- The fork property surface generates scalar chart controls from the shared
  descriptor registry and updates adopted charts from envelope bindings in place,
  so fork-managed transforms survive authored settings changes without a legacy
  node tree.
- `editor/src/chart-manager/` owns the chart-specific fork extension; generic
  selection, transforms and history remain owned by the adopted fork.
- Fork history uses `scene-fabric`'s canonical serializer/revival callbacks;
  the pinned fork revision is `73657f0`.

## What has not migrated yet

- Legacy DOM/custom editor code remains fallback-only; the fork route is active.
- Theme schema still uses the pre-Fabric node-tree shape; envelope switch is
  coordinated with editor migration.
- Live editor telemetry/bindings remain incomplete.
- Video background production integration is not finished.

## Direction — do not drift

### 1. Keep the Fabric renderer work

`renderer-core` stays Fabric-free; `scene-fabric` is the shared renderer layer.
Do not reopen the one-renderer decision without a fundamental blocker.

### 2. Keep Fabric scene JSON as the persisted scene

User decision: optimize for **minimal glue**, not human-readable scene JSON.
Vigilia keeps its semantic/versioned envelope; Fabric JSON owns scene geometry,
grouping, stacking, visibility, lock and custom objects.

Do not introduce a parallel simplified node tree plus bidirectional write-back
mapping.

### 3. Use the adopted `fabricjs-image-editor` source fork

`../fabricjs-image-editor` is the Stage 4B editor foundation. Keep its generic
selection, controls, grouping, clipboard and object tools; change source where
Vigilia's typed charts, persistence or property surface need a hook.

The goal of this migration is to **stop owning generic editor mechanics**.
Selection, controls, grouping, clipboard, text/image/shape tools and similar
behaviour should come from the fork where practical.

### 4. Keep the custom editor framework fallback-only

Current `EditorCore` work includes document, selection, globals, arrange,
snapping, layers and inspector managers. Keep it as fallback/harvestable domain
logic, but do not add more generic-editor infrastructure.

Do not build new custom clipboard, tools, Fabric gesture layers, selection
controls or generic snapping systems.

### 5. Chart QoL compromises remain accepted

Required:

- correct rendering;
- move;
- rotation;
- proportional resize;
- complete property controls for supported chart settings.

Optional/acceptable limitations:

- no chart-family conversion;
- no skew/arbitrary stretch;
- restricted/no grouping if needed;
- chart-setting edits may bypass undo/redo;
- limited direct-manipulation QoL.

Property controls should be integrated into the **new editor foundation**, not
preserve the old Vigilia inspector by default.

### 6. Media scope

Video remains required: one DOM background beneath the transparent Fabric
canvas, aligned/cropped by the same artboard transform. It is not a normal
Fabric node.

Animated GIF elements are **dropped**. Remove the legacy `gif` asset/schema
semantics with schema v2; do not build a workaround.

## Next, in order

1. **Continue Stage 4B:** move the first Vigilia property controls into the fork UI surface.
2. Migrate editor + Fabric scene envelope together.
3. Add schema-v2 tokens/property model, live bindings/charts, then video.
4. Delete old DOM/custom generic-editor code after replacements are proven.

Use sub-agents for independent source audits: manager inventory, history,
property/demo UI, clipboard/grouping, custom chart lifecycle, persistence and
media. Primary agent owns integration and shared contracts.

## Source-fork rejection bar

Do **not** reject for:

- missing npm types;
- demo-only UI;
- unsuitable stock history;
- missing hooks that can be added in the fork;
- permanent divergence from upstream.

Reject only with evidence of a fundamental mismatch, e.g. custom chart objects
cannot survive normal editor lifecycle/persistence without pervasive rewrites,
or runtime telemetry cannot be separated from authored state.

## Not verified / known gaps

- Browser E2E previews bundles directly; it does not exercise the host.
- Fabric scene JSON is not yet the published theme schema.
- The route currently loads the legacy demo fixture through the shared ScenePlan;
  the published Fabric-scene envelope remains the next persistence migration.
- Legacy DOM editor browser cases are skipped while equivalent Fabric-route coverage is added.
- LHM extended telemetry is not implemented.
- Pairing/revocable sessions and LAN end-to-end flow are not implemented.
- Accepted limitation: Canvas text uses the font's natural digit metrics when
  tabular numerals cannot be guaranteed and reports the substitution.
- Two chart engine gaps remain: gauge angular gradients and line thresholds.

## Needs a human

Nothing before the source-fork checkpoint unless it reveals a genuine product
trade-off or fundamental blocker.
