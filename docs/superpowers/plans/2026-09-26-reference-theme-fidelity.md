# Reference Theme Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the actual default starter toward the latest reference, with
editor-authorable frosted panels, dependable typography and live device labels,
reusing current charts.

**Architecture:** Fabric JSON remains the authored scene. Shared `scene-fabric`
backdrop composition serves editor Canvas and player StaticCanvas; palette/type
owners and existing inspector/persistence paths carry authoring. Providers and
existing semantic text bindings supply device captions; no new telemetry pipeline.

**Tech Stack:** TypeScript, Fabric 7.4.0 via `fabric/es`, ECharts 6.1.0, React 19
shell, Vitest, Playwright and Biome. No new dependency assumed.

**Spec:** [Reference theme fidelity and frosted glass](../specs/2026-09-26-reference-theme-fidelity-design.md)

**Target:** [Latest supplied reference](../specs/2026-09-26-reference-theme-target.png)
— 1672 × 941; RAM partial gauge, VRAM full ring. Documentation reference only,
not a licensed asset to bundle in the product.

**State:** Queued immediately after snapping fidelity. Spec approved for planning
by the user's 2026-09-26 request. Plan/execution method still require review.
Glass feasibility has not been demonstrated; Task 1 is a blocking probe, not
permission to assume a renderer implementation. No task has started.

## Global Constraints

- Finish and verify the active snapping-fidelity plan before activating this one;
  `STATUS.md` remains the sole active-plan owner. Other queued work follows this.
- Real blurred/frosted glass is mandatory; city/background artwork is exempt.
- Existing chart rendering is acceptable; optional glow never blocks completion.
- Weather, daily traffic accounting, hour-history/replay expansion, exact chart
  ticks and a new chart/effects/widget framework are out of scope.
- The actual default starter improves during capability work, not only at the end.
  Existing saved themes/user edits must not be overwritten by default changes.
- One authored Fabric scene; no parallel scene model or React mirror. Player may
  use shared StaticCanvas rendering, never editor managers or interactive Canvas.
  `renderer-core` remains Fabric/DOM-free.
- Paint uses palette references; typography uses named type presets. Persist
  authored state only; caches, pixels, media frames and readings stay transient.
- Reject invalid numeric input, preserve work on error, and validate imports
  before revival/allocation. Missing/non-ok data never becomes a fabricated zero.
- UI copy belongs in `editor/src/ui-copy.ts`; every control needs keyboard access
  and an accessible name. Reuse history, IDs, assets, selection and grouping owners.
- Supported Node: 22.12+, 24, or 26+. Use workspace scripts from `src/web/`.
  `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` remain enabled.
- No environment/plugin/hook changes. No shipped dependency without the reuse and
  licence gate. Keep new source focused; 500 lines is a signal, 800 a stop.
- Unit-test contracts, browser-test wiring/appearance, demonstrate regression
  failure with the fix disabled. Rebuild affected bundles before browser proof,
  including after restoring a deliberate break. Real-host claims start the host.
- Follow existing task review/commit workflow; replace `STATUS.md`'s latest-change
  summary before task commits. Stage explicit paths. Publishing/pushing is separate.

## Review Focus

1. **Backdrop correctness under nesting/overlap:** grouped, rotated or translucent
   panels must not sample themselves, later objects or controls — Tasks 1, 4, 5.
2. **Resource abuse and unavailable media:** malicious blur/size values, asset load
   failures and unreadable sources must fail safely without losing work — Tasks 2, 4.
3. **Stale caches after authoring/runtime changes:** undo, deletion, theme switch,
   video/chart refresh and viewport/DPR changes must update or dispose — Tasks 5, 6, 11.
4. **Device mismatch during fallback/assignment:** caption must identify the same
   physical device as adjacent readings, even when providers differ — Tasks 9, 11.
5. **False parity from seeded defaults:** newly inserted panels, imported packages
   and variable-width text must work without factory-only behavior — Tasks 3, 8, 11.

---

## File/ownership map

Paths below are relative to `src/web/packages/` unless rooted in `docs/`,
`schema/` or `src/web/tests/`. Recheck at activation because snapping is still
active. Names for new files describe responsibilities, not speculative interfaces.

| Responsibility | Owning files / proposed addition | Evidence |
|---|---|---|
| Glass authored contract and bounds | New `renderer-core/src/theme/glass.ts`; existing `fabric-envelope-validate.ts`, public barrel; `schema/theme-document.schema.json` | Focused validator tests; theme-package round trips |
| Shared rendering integration | New `scene-fabric/src/glass.ts` and, only if needed, focused backdrop-surface module; existing `persist.ts`, `scene.ts`, `background-media.ts`, `render-scale.ts`, `index.ts` | New glass DOM tests; browser proof |
| Editor mount, media and history | `editor/src/editor-shell.ts`, `editor-session.ts`, `history-manager/`, `clipboard-manager/` | Existing owner tests plus targeted browser cases |
| Panel insertion and appearance | `editor/src/new-object-panel.ts`, `new-object-defaults.ts`, `editor-interaction.ts`, `selection-inspector/appearance.ts`; focused panel fields module if needed; `ui-copy.ts` | Add/inspector DOM tests; real insertion |
| Palette application | `scene-fabric/src/object-paint.ts`, editor `palette-manager/` | Reassignment and paint-refresh tests |
| Typography | `scene-fabric/src/object-type.ts`, `fabric-text.ts`, `text-runs.ts`; editor `type-preset-manager/`, `live-runtime.ts` | Existing text/preset suites and browser checks |
| Device captions | `renderer-core/src/data/semantic-keys.ts`; host `providers/library.ts`, `lhm.ts`, `lhm-mapping.ts`, `settings/devices.ts`; existing assignment integration | Provider/assignment tests and host browser proof |
| Default starter | `editor/src/new-fabric-theme.ts`, its tests and normal asset/font-loading owners | New-theme route and saved starter |
| Optional chart glow | Only existing `renderer-core/src/charts/` settings/builders/validation and `scene-fabric/src/chart-object.ts` if clipping requires it | Focused chart visual proof, or explicit skip |
| Player integration | `player/src/main.ts`, shared `scene-fabric` mount/revival/disposal | `src/web/tests/e2e/display-fabric.spec.ts` and focused new spec |
| Browser/evidence contract | New `src/web/tests/e2e/reference-theme.spec.ts`; reuse existing fixture/host setup, extract small helpers only if necessary | `docs/evidence/screenshots/README.md` and registered captures |

Do not assume legacy `paintFor` or ScenePlan support proves the v2 path works.
Player currently mounts a scene, then revives the envelope into its canvas;
editor mounts/revives through `mountEditorShell`. Glass must survive both and
subsequent history revival. Background media currently lives outside the canvas.

## Phase 1 — Feasibility and authoring foundation

### Task 1: Prove the glass integration and freeze its resource contract

**Outcome:** A reproducible throwaway probe establishes a viable shared approach,
render hooks, numerical bounds and supported environments, or stops product work
with a concrete blocker. This task cannot be marked complete from documentation
or a static screenshot alone.

**Owners:** Installed Fabric 7.4.0 render/cache APIs; `scene-fabric/src/scene.ts`,
`background-media.ts`, `persist.ts`; editor `mountEditorShell`; player
`startHostedTheme`. Probe files live outside the repo; durable findings attach to
this plan before approval of product phases.

**Constraints/failure modes:** Real backdrop includes DOM-backed media and earlier
objects. Transparent groups, nested glass, retina transforms, canvas taint,
clipping and texture limits cannot be waved away. No new dependency or product
patch merely to keep the probe. Native filtering first; installed/maintained
alternatives only if the first option fails the specified behavior.

- [ ] Read current owners and installed Fabric code; compare render-boundary
  sampling with available native/installed filtering. Record why rejected paths
  miss scene order, media, capture or resource constraints.
- [ ] Run the smallest browser probe in both Canvas and StaticCanvas with a
  detailed background, two overlapping panels, grouped/rotated glass, sharp text,
  a changing chart/video source, history-like revival and zoom/DPR changes.
  Check normal group opacity and flattened-versus-grouped backdrop behavior.
- [ ] Measure enabled/disabled frame cost, dirty/static behavior and backing
  allocation at target size and higher DPR. Record hardware/browser/build,
  finite blur-radius and surface/memory limits, fallback diagnostics and cleanup.
- [ ] Amend this plan with the proven hook/lifecycle, concrete bounds, benchmark
  budget and responsibility split. Request review of those results before Task 2.
  If no approach satisfies mandatory glass, stop rather than silently reduce scope.

**Interface handoff:** Product tasks consume the probe's recorded rendering and
resource decisions. Until then, their implementation mechanisms are intentionally
not approved. This is an explicit dependency gate, not an unspecified task body.

### Task 2: Validate and round-trip authored panel material

**Outcome:** A validated material contract can survive v2 serialization, package
import/export and history without storing derived state.

**Owners:** New pure `renderer-core/src/theme/glass.ts`, existing envelope
validation/schema/barrel; `scene-fabric/src/persist.ts`, `object-paint.ts` and
shared registration lifecycle. Test owners include envelope/persistence suites
and theme-package validation tests.

**Contract:** Use one optional object treatment named `vigiliaGlass` containing
`blurRadius` in artboard units; absence means off and zero has no blur. Ordinary
fill remains palette-backed tint; radius/opacity/stroke/shadow use native object
properties. Extend the existing paint-reference owner for shadow color rather
than add another palette resolver. If Task 1 requires a dedicated registered
Fabric subclass, record its serialized type before this task; do not replace
unrelated Rect classes globally. Upper bounds come only from Task 1's approved
record. Reject malformed treatment on unsupported object types before revival.

- [ ] Pin invalid type/range/non-finite input, unsupported object kind and missing
  palette reference behavior with focused tests at actual import boundaries.
- [ ] Add minimal pure contract, validation/schema and shared serialization/
  revival registration; test old scenes with no glass remain unchanged.
- [ ] Prove nested objects, duplicate/history payloads and package round trips
  retain only authored properties. Inspect serialized output for leaked surfaces,
  resolved runtime colors, sampled readings or media state; none may appear.

**Verification:** Validator/persistence/theme-package tests; typecheck affected
packages. This task does not claim rendered glass yet.

### Task 3: Make panels insertable and styleable through normal UI

**Outcome:** Authors insert a panel and set palette fill/stroke/shadow, border
width, radius and opacity with undo/redo, without copying a starter card.

**Owners:** `new-object-panel.ts`, `new-object-defaults.ts`, existing
`EditorInteraction` construction/history path; `selection-inspector/`,
`palette-manager/`, `object-paint.ts`, `ui-copy.ts`.

**Constraints:** Reuse native rectangle insertion if available; otherwise one
small construction action, not a generic shape factory. Preserve palette identity
when tokens change/delete/reassign. A stale inspector event cannot mutate the
previous selection. Locked objects follow current edit policy. Unsupported
selection types do not show working-looking panel controls.

- [ ] Add failing tests for insert/select/style/undo plus invalid numbers, stale
  selection events and palette reassignment on fill/stroke/shadow.
- [ ] Wire accessible fields and creation defaults through existing owners;
  keep one history entry per committed edit and no selection-induced history.
- [ ] Drive keyboard and pointer authoring in the real editor; save/reopen one
  styled panel. Move starter panel geometry/borders toward the latest target
  using these same supported properties, without pretending glass is finished.

**Verification:** Focused new-object/inspector/palette tests, rendered panel
inspection and a recorded starter checkpoint. Glass control is wired in Task 6.

## Phase 2 — Shared glass rendering and first usable card

### Task 4: Render correct backdrop composition in both mounts

**Outcome:** Proven shared integration renders actual frosted panels over artboard
media and earlier objects with correct mask, tint, border and sharp foreground.

**Owners:** `scene-fabric/src/glass.ts`, background/media/surface owner selected by
Task 1, `scene.ts`, `persist.ts`; editor `editor-shell.ts`; player `main.ts`.

**Consumes:** Task 2 authored contract and Task 1 approved integration/bounds.
**Produces:** One shared attach/update/dispose lifecycle called by editor/player;
no DOM overlay scene, second editable tree or pixel-streaming transport.

- [ ] Turn probe failures into focused regression cases for self/later-object
  exclusion, rounded padded edges, nested/overlapping glass, opacity and
  background-media fit. Include missing/unreadable source and oversized inputs.
- [ ] Integrate composition at the approved boundary with bounded allocations,
  correct group/viewport transforms and palette tint/stroke order. Preserve the
  existing asset resolver/session access rules; never fetch arbitrary paths.
- [ ] Inspect identical authored scenes through real editor Canvas and player
  StaticCanvas. Verify texture behind glass visibly softens while foreground
  text stays sharp; tint-only fallback must report failure and cannot pass.

**Verification:** Shared glass tests and focused browser pixel/visual inspection,
including unsupported capability diagnostics and unaffected non-glass scenes.

### Task 5: Keep glass correct across runtime and lifecycle changes

**Outcome:** Glass updates when its inputs change and releases resources when no
longer used, without a new always-running loop on static scenes.

**Owners:** Shared glass/media owner, `chart-refresh.ts`, existing editor viewport,
live-runtime/history events, player mount/disposal. Extend existing refresh hooks
rather than invent another global scheduler.

- [ ] Pin stale-backdrop cases: moving/resizing/rotating a panel, changing a lower
  object, changing z-order/group opacity, video frame updates, palette changes,
  zoom/DPR/fit and undo/revival replacing object identity.
- [ ] Connect bounded invalidation and shared media lifetime. Dispose listeners,
  video callbacks, surfaces and chart references on delete, replace and unmount.
  Hidden/disconnected rendering follows current policy and resumes accurately.
- [ ] Profile Task 1's repeatable scenes against approved budgets. Verify idle
  scenes incur no extra glass animation loop, repeated mount/unmount does not
  accumulate resources, and group/viewport operations remain responsive.

**Verification:** Focused lifecycle tests plus browser evidence of changed
backdrop, cleanup and performance; no object-count-only proof of blur correctness.

### Task 6: Expose glass controls and ship the first starter slice

**Outcome:** Authors toggle/adjust glass through inspector; the actual starter
contains a working reference-like CPU card with live value and sparkline.

**Owners:** `selection-inspector/`, `ui-copy.ts`, existing history/clipboard owners,
`new-fabric-theme.ts`, focused browser tests and screenshot registry.

- [ ] Test enabled/disabled/zero blur, finite upper bound rejection, locked/stale
  selection, undo/redo, duplicate/group, and token changes through UI.
- [ ] Wire controls to Task 2 properties and Task 5 lifecycle; compose the CPU
  card using the normal palette, text runs and line chart family. Other starter
  cards may remain incomplete, with differences recorded honestly.
- [ ] Exercise save/reopen/export/import and player output of this slice; inspect
  real blur, sharp text and current data. Include ordinary and grouped panels so
  seeded defaults cannot hide an unusable authoring operation.

**Verification:** Inspector/history regressions and registered screenshots of
actual starter plus UI-built panel. Record remaining target differences.

## Phase 3 — Typography, metadata and complete starter

### Task 7: Lay out the new starter using current chart families

**Outcome:** New-theme creation uses the reference composition: clock/date,
CPU/GPU sparklines, RAM partial gauge, VRAM full ring, performance chart and
stacked Storage/Network panels, all with working available metric bindings.

**Owners:** `new-fabric-theme.ts` and focused starter tests; current chart defaults,
asset/font loading paths and theme globals. Split the oversized starter file by
actual composition responsibility only if needed; no reusable widget framework.

- [ ] Pin semantic binding correctness and required chart families; verify RAM
  keys use the actual vocabulary, not stale `memory.*` names. Gauges bind usage
  percentage; capacity labels are separate normal live-text objects.
- [ ] Replace weather/quotes/unrelated demos, set target-size artboard/layout and
  compose imported/licensed icons. Preserve blank-authoring behavior if separately
  supported; do not overwrite existing saved themes. Keep all styling editable.
- [ ] Render new starter in editor/player and inspect layout at 1672 × 941 and a
  fitted viewport. Accept current chart rendering and history window; do not fake
  an hour axis, readings or device names while later tasks are incomplete.

**Verification:** Starter/validation tests, live gauge/line/bar browser proof,
new-theme versus saved-theme separation and next visual checkpoint.

### Task 8: Finish tracked typography and runtime text stability

**Outcome:** Wordmark, subtitle and captions use correct object-level tracking;
clock/readings/gauge labels retain authored layout through refresh and reopening.

**Owners:** `scene-fabric/src/object-type.ts`, `fabric-text.ts`, `text-runs.ts`;
editor type-preset/run/live-runtime owners; starter type presets.

- [ ] Add regression cases showing current dropped spacing; cover single-run,
  mixed-run object-level limitations, preset reassignment, font readiness, changed
  digit width, locale/date length and center-aligned gauge capacity labels.
- [ ] Apply tracking through the current v2 path on edit/revival/live update.
  Use shared preset resolution and measured font size; do not add a legacy-only
  fix or pretend unsupported per-character tracking works. Expose clear limits.
- [ ] Tune actual starter typography and compare rendered heading/clock/gauge
  text before and after refresh, undo and import. Keep fixed-box alignment,
  wrapping/overflow and packaged font behavior intact.

**Verification:** Existing text/preset suites plus rendered tests where disabling
spacing propagation fails; inspect missing-font behavior and variable-width data.

### Task 9: Bind device captions consistently with readings

**Outcome:** CPU model, assigned GPU model and selected volume/mount caption are
real semantic text readings; machine-specific defaults never masquerade as data.

**Owners:** `renderer-core/src/data/semantic-keys.ts`; host provider/discovery/
assignment owners (`library.ts`, `lhm.ts`, `lhm-mapping.ts`, settings/server handoff);
existing text binding UI; starter caption bindings.

**Contract:** Extend existing `Sample.textValue` path, not a second metadata
transport. Declare keys in the existing semantic vocabulary and use them in both
provider descriptors and starter bindings. Reuse stable assignment identities;
resolve caption and metrics from the same device selection. Do not select the
first GPU's name while showing another GPU's readings or aggregate metrics under
a single-volume label. No serial numbers or provider-instance IDs in the theme.

- [ ] Inspect actual installed discovery APIs and current provider fallback;
  add deterministic tests for no devices, multiple GPUs/volumes, missing labels,
  fallback providers and assignment changes while a sample request is in flight.
- [ ] Acquire/cache display metadata through existing discovery cadence, emit
  requested text samples with honest status and discard obsolete assignment
  results. Share grouped acquisition; do not poll per card or add daily counters.
- [ ] Bind starter captions through normal UI-supported semantics. Exercise
  assignment/fallback with real host test wiring, including unavailable metadata,
  and inspect that captions change with adjacent readings rather than ahead of them.

**Verification:** Provider/assignment/semantic tests plus host-backed caption
refresh. Physical-hardware claims require actual hardware evidence; deterministic
provider injection proves routing, not availability of a sensor on every PC.

## Phase 4 — Optional polish, integration and close-out

### Task 10: Decide optional chart glow without expanding scope

**Outcome:** Either a small existing-engine glow treatment works and is verified,
or a documented skip leaves a finished, acceptable starter.

**Owners:** Existing chart settings/descriptors/builders/validators and chart object
backing/capture limits, only where evidence justifies changes.

- [ ] Check current ECharts documentation and installed options for native
  line/bar shadow support; probe clipping and cost with existing chart backings.
  Record skip immediately if it needs duplicate series, extra render passes,
  new dependencies, custom shaders or a general effects stack.
- [ ] If the cheap path works, add minimal typed setting/control with bounded
  blur/opacity and reuse series color. Keep defaults unchanged for other themes;
  raw engine options never enter the envelope. Test invalid settings and toggle.
- [ ] Inspect enabled/disabled editor/player and round-trip behavior, including
  edges and sharp foreground. Record included or skipped; neither gauge glow nor
  exact chart matching is a release gate.

**Verification:** Native probe evidence; if included, focused builder/validation
and browser tests. A skip completes this optional decision task without code.

### Task 11: Prove real authoring, persistence and player parity

**Outcome:** Entire actual starter and a UI-built representative card survive the
user journey and match within agreed exemptions; failures cannot be hidden by
preview mode or manually authored JSON.

**Owners:** New `src/web/tests/e2e/reference-theme.spec.ts`, existing editor/display
fixture and real-host setup, package/persistence boundaries; screenshot registry.

- [ ] Drive insert/style/glass/bind/text operations, keyboard controls, save,
  close/reopen, export/import and real-player execution. Validate new default
  versus saved user theme behavior and no runtime/cached fields in output.
  Inspect normal capture/thumbnail paths: glass and packaged assets must appear
  there too, with stable IDs and unchanged authored bounds.
- [ ] Exercise reference-size/fitted/DPR views, nested/rotated/overlapping panels,
  background replacement/video, font failure, invalid import, disconnect/reconnect,
  missing sensors and device reassignment. Verify errors preserve recoverable work.
- [ ] Rebuild/capture/inspect affected registered actions. Compare latest target
  side by side, record remaining discrepancies and fix required ones within their
  owners. Exempt background pixels, live data and fine chart treatment only;
  real blur and editable layout remain non-negotiable.

**Verification:** Focused real-host Playwright run; deliberate-break proof for
new regression tests; reviewed screenshots and truthful availability diagnostics.

### Task 12: Review, full gates and durable handoff

**Outcome:** Independent review and current evidence establish spec acceptance,
with no hidden performance/authoring failures or unclaimed test failures.

**Owners:** Changed product/docs/tests, ownership map, current spec/plan,
`STATUS.md`, evidence registry; no environment changes.

- [ ] Request independent review of contract coverage, cross-owner lifecycle,
  palette/preset persistence, security/resource bounds, provider identity and
  actual default-starter evidence. Resolve material findings; do not edit agent
  settings/process documents in response to review.
- [ ] Run broad gates from `src/web/`: `npm test`, `npm run typecheck`,
  `npm run build`, `npm run format:check`, `npm run lint`, `npm run size`,
  `npm run test:e2e`, `npm run status:check`. Use JSON reports where output is
  compressed. Report exact failures/skips; inspect final real-host visuals.
- [ ] Record performance evidence and supported/untested environments; update
  ownership/current docs/schema/evidence together. Mark spec implemented only
  after acceptance is evidenced. Replace latest-change summary and hand off the
  remaining queue. Archive plan only when no active/queued dependency needs it.

## Verification cadence and commands

Task acceptance names outcomes/cases rather than predicted test counts. Use
existing workspace commands with focused files, for example
`npm test -- packages/scene-fabric/src/object-type.test.ts` only if that test file
exists at execution time; otherwise name the actual test created under its owner.
For browser work, rebuild affected bundles and use
`npm run test:e2e -- tests/e2e/reference-theme.spec.ts --workers=1` after the new
spec exists. Capture with `VIGILIA_CAPTURE=1` and only registered affected actions;
inspect images before staging. Do not infer real-host coverage from Vite preview.

## Review and execution handoff

Coverage: spec panel/glass contract — Tasks 1–6; typography/charts — Tasks 7–8,
10; live captions — Task 9; progressive starter — Tasks 3, 6–9; end-to-end and
performance — Tasks 1, 5, 11–12; exclusions apply to every task.

Spec scope approval is not proof of glass feasibility or approval of this plan.
Review this queued plan and choose execution method. Recommended:
**subagent-driven**, sequential tasks with independent review, because render
lifecycle, asset/persistence and device identity cross package boundaries.
Only Task 1 may proceed after activation and probe approval; its findings must
be reviewed before product phases. Do not run this alongside snapping or dispatch
workers against this queued plan. If later parallelism is authorized, keep work
inside the active phase with disjoint ownership and recorded dispatches.
