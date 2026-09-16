# Status — 2026-09-17

Current handoff only. Durable rules: `AGENTS.md`; architecture:
`architecture.md`; decisions: `decisions.md`; migration: spec 0013.

## Current evidence

| Check | Latest recorded result |
|---|---|
| Unit tests | 1,252 passed across 64 files |
| Typechecks | six projects clean |
| Browser suite | 107 passed / 59 skipped / 0 failed across desktop and phone Chromium |
| Player size | 260.3 KB gzip / 400 KB gate |
| Host bundle | 25.36 KB raw / 8.34 KB gzip; no Fabric dependency edge |
| Visual inspection | desktop assets and phone demo captures inspected; fit modes, recolouring, charts and letterboxing rendered correctly |

These figures are from the Stage 3 completion run in this session.

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

## What has not migrated yet

- Editor still uses the old DOM renderer/custom interaction overlay.
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

### 3. Prefer a source fork of `fabricjs-image-editor`

The earlier conclusion that the repo adds little beyond Fabric is reopened and
should not guide Stage 4.

`../fabricjs-image-editor` is already cloned beside Vigilia. Evaluate its source
as a potential permanent fork, not merely its npm package API. Missing package
types, demo-only UI, unsuitable history or missing hooks are editable fork
concerns, not rejection reasons.

The goal of this migration is to **stop owning generic editor mechanics**.
Selection, controls, grouping, clipboard, text/image/shape tools and similar
behaviour should come from the fork where practical.

### 4. Freeze expansion of the custom editor framework

Current `EditorCore` work includes document, selection, globals, arrange,
snapping, layers and inspector managers. Keep it as fallback/harvestable domain
logic, but do not add more generic-editor infrastructure while the source-fork
spike is open.

Do not build new custom clipboard, tools, Fabric gesture layers, selection
controls or generic snapping systems before the comparison.

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

1. **Run Stage 4A source-fork spike** before further custom editor work.
2. Compare fork vs current custom path by concrete ownership:
   - reuse from fork;
   - modify in fork;
   - keep Vigilia-specific;
   - fallback only.
3. If no fundamental blocker, adopt the fork and update durable docs/package
   structure before Stage 4B.
4. Migrate editor + Fabric scene envelope together.
5. Add schema-v2 tokens/property model, live bindings/charts, then video.
6. Delete old DOM/custom generic-editor code after replacements are proven.

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
- Editor browser suite still has an undiagnosed contention-only flake.
- Fabric scene JSON is not yet the published theme schema.
- `fabricjs-image-editor` has not yet been tested as a source fork with
  `VigiliaChart`.
- LHM extended telemetry is not implemented.
- Pairing/revocable sessions and LAN end-to-end flow are not implemented.
- Accepted limitation: Canvas text uses the font's natural digit metrics when
  tabular numerals cannot be guaranteed and reports the substitution.
- Two chart engine gaps remain: gauge angular gradients and line thresholds.

## Needs a human

Nothing before the source-fork checkpoint unless it reveals a genuine product
trade-off or fundamental blocker.
