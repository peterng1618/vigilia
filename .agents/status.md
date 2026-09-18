# Status — 2026-09-19

Current handoff only. Durable rules: `AGENTS.md`; product plan:
`design/plan.md`; architecture: `architecture.md`; active work: specs 0010,
0011 and 0013. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Unit tests | 847 passed across 52 files |
| Typechecks | six projects clean |
| Builds | player, editor and host clean |
| Visual review | 6 passed, 4 expected phone skips; four active-fork captures inspected |
| Browser suite / size | 69 passed, 23 expected skips; size gate passed (262.8 KB gzip / 400 KB) |

The current cleanup slice has current typecheck, unit, build, size, focused
active-fork visual evidence and a completed full browser suite.

## Current product state

### Rendering/player

- `scene-fabric` is the shared renderer for text, shapes, groups, images/SVG and
  all four chart families.
- Player is Fabric-only and uses `StaticCanvas`; editor UI code is outside its
  dependency boundary.
- `VigiliaChart` supports ECharts rendering, rotation, proportional resize, live
  redraw, serialization/revival and explicit disposal.
- Fabric text supports clipping, ellipsis, wrapping/line clamp, vertical
  alignment and font-load re-measure.
- Bitmap/SVG contain/cover/stretch and alpha-preserving monochrome recolouring
  work on the Fabric path.

### Editor migration

- `/editor` mounts the adopted `fabricjs-image-editor` fork; its retired
  DOM/custom generic-editor implementation is deleted.
- The fork is pinned by the editor manifest to commit `918a454` and resolves
  Fabric 7.4.0 through `fabric/es`.
- Fork history uses `scene-fabric` serialization/revival callbacks and disposes
  charts before scene replacement/destruction.
- Ctrl/Cmd+S downloads the development v2 Fabric envelope.
- Dirty-document checks compare the complete v2 envelope, so authored semantic
  changes cannot be discarded as though only fork scene state mattered.
- Ctrl/Cmd+O validates a bounded v2 file, checks exact Fabric compatibility,
  then stages revival before replacing the fork shell. Invalid, incompatible,
  or unrevivable files leave the current editor intact.
- Open compares the serialized Fabric scene to the saved scene and offers
  Save/Discard/Cancel before replacing dirty work. Ctrl/Cmd+N creates a fresh
  v2 dashboard document through the same guard.
- Current Vigilia extensions are the chart, persistence, shortcut and artboard
  size/preview controls composed by `ForkExtensions`.
- The fork's New/Open/Save dispatcher no longer imports the fallback action or
  keyboard model; it owns only product file shortcuts.
- The inactive legacy `main.ts` route and its size exception are deleted; the
  active editor entry remains `fork-main.ts`.
- The editor package barrel exposes only the adopted fork shell; legacy
  DOM-editor utilities are no longer public API.
- The skipped legacy DOM-editor browser suite is deleted; `editor-fork.spec.ts`
  is the active editor browser contract.
- Visual-review coverage renders only the active fork route; obsolete fallback
  editor/globals/inspector captures were removed.
- Retired actions, document/history, selection, transforms, arranging,
  snapping, legacy layer UI and their tests are deleted; generic editing comes
  only from the fork.
- Stage 4B is complete: direct v2 startup, current product properties,
  fork-native editing/history/save/open safety and legacy cleanup are proven.
- Product property extensions render in the dedicated sidebar, so selected-chart
  controls cannot displace the interactive Fabric stage.
- The fork starts at contain-fit zoom in a centered artboard-aspect viewport;
  its persisted artboard control changes width, height, preview fit and existing
  palette background/bar tokens without rescaling Fabric object geometry.
- The palette panel authors stable solid/linear-gradient tokens (including CSS
  colour strings), immediately repaints referenced artboard paints, and requires
  reassignment before deleting a token.
- The chart panel supports scalar settings for one selected `VigiliaChart`,
  generated from the shared descriptor registry and updated in place.
- Existing selected-chart bindings expose semantic key, precision, unit display,
  scale and offset controls; they repaint live and persist as envelope data.
- Startup creates and revives a static v2 dashboard envelope directly, including
  supported gradients, SVG-derived paths and all four chart families. The legacy
  demo theme/`ScenePlan` path no longer mounts the interactive editor.
- Starter-theme foreground objects remain selectable; only the background is
  locked. Selecting a chart opens its Vigilia property controls.
- A visible Fabric drag persists through v2 Save and Ctrl/Cmd+Z restores the
  saved geometry through fork history.
- The v2 envelope/Fabric scene contract exists, but its globals/property model is
  still transitional. `palette.none`, structured solid/linear-gradient palette
  tokens and fork palette authoring are implemented; type presets have a shared
  schema/reference contract. Raw Fabric objects can now persist palette-reference
  metadata and reapply it after revival; the starter scene uses palette and
  type-preset references for its Fabric objects. Envelope validation and export
  reject resolved Fabric fill/stroke without a persisted palette reference and
  resolved text type without an authored type-preset reference. Global changes
  reapply both resolved object paint and first-run text type cache.
- Fork type-preset controls edit global family, size, weight and line-height
  values; they require reassignment before deletion, and referenced starter text
  updates without local type settings.
- Canonical scene serialization removes Fabric's in-memory undefined gradient
  fields before envelope validation/export; active-fork captures include type
  preset authoring.
- `scene-fabric` owns palette-reference reassignment across Fabric object paint
  metadata and authored text runs; the fork reassigns artboard references before
  deleting the token.
- `scene-fabric` owns type-preset reassignment across every authored text run;
  the fork reassigns those runs before deleting the preset.
- Fabric text saves its authored runs beside resolved Fabric text, so a revived
  v2 scene retains the semantics needed for later live updates.
- v2 validation rejects legacy global groups and literal artboard/text paint or
  type values; v1-to-v2 conversion retains only palette and type presets.

### Host/telemetry

- Node/TypeScript host and CLI work with loopback-by-default serving.
- SSE sample transport, protocol versioning, keep-latest and union-of-requested
  key polling are implemented.
- Baseline provider supplies CPU load and RAM from Node built-ins.
- Disk/network baseline metrics and LibreHardwareMonitor extended telemetry are
  not implemented.
- Pairing/revocable sessions, theme storage and a complete LAN product flow are
  not implemented.

## Current gaps

- Finish spec 0011: remaining domain-property editing and removal of
  transitional globals/literals.
- Live editor telemetry/bindings are incomplete; current editor source is the
  fake demo source.
- Production video background integration is not implemented.
- The surrounding UI has no React/shadcn stack today. That modernization is
  deliberately later than the core Fabric migration.
- Legacy custom-editor behaviours in spec 0014 are **not requirements yet**.
  Review each against the fork before recreating it.

## Next

1. Review spec 0014 and explicitly keep/drop/replace each missing legacy editor
   behaviour before implementing any of it.
2. Complete the property/token model in spec 0011 before stabilising v2.
3. Add live editor bindings/charts, then the video background path.
4. Only after the authoring core is stable, start the React + shadcn/Base UI
   shell modernization from plan §35.

## Unverified / known limitations

- Browser E2E previews bundles directly; it does not exercise the host.
- No physical-phone validation gate exists.
- LAN bind/pairing has not been validated end to end.
- LHM extended telemetry is still a contract, not an implementation.
- Canvas text uses natural digit metrics where tabular numerals cannot be
  guaranteed.
- Two chart engine gaps remain open: gauge angular gradients and discrete line
  threshold bands.
