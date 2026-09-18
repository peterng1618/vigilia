# Status — 2026-09-18

Current handoff only. Durable rules: `AGENTS.md`; product plan:
`design/plan.md`; architecture: `architecture.md`; active work: specs 0010,
0011 and 0013. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Unit tests | 1,259 passed across 74 files |
| Typechecks | six projects clean |
| Builds | player, editor and host clean |
| Visual review | 16 active-fork editor tests passed; gradient capture inspected |
| Browser suite / size | Size gate passed (262.3 KB gzip / 400 KB); full browser suite unverified because it emitted no final summary |

The prior full browser gate was 2026-09-18. This slice has current typecheck,
unit, build, size and focused active-fork visual evidence; its full browser
suite emitted no final summary.

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

- `/editor` mounts the adopted `fabricjs-image-editor` fork; the old DOM/custom
  route is inactive and its generic editor code is fallback-only.
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
- Visual-review coverage renders only the active fork route; obsolete fallback
  editor/globals/inspector captures were removed.
- Product property extensions render in the dedicated sidebar, so selected-chart
  controls cannot displace the interactive Fabric stage.
- The fork starts at contain-fit zoom in a centered artboard-aspect viewport;
  its persisted artboard control changes width, height, preview fit and existing
  palette background/bar tokens without rescaling Fabric object geometry.
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
  still transitional. `palette.none` and structured solid/linear-gradient
  palette tokens are enforced in v2 and artboard gradients render on player and
  fork canvases; type presets and palette authoring controls remain pending.
- Fabric text saves its authored runs beside resolved Fabric text, so a revived
  v2 scene retains the semantics needed for later live updates.

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

- Finish Stage 4B editor migration: remaining domain property boundaries, then
  delete fallback code.
- Finish spec 0011: palette/type authoring controls, type presets, stable
  reference UI, remaining domain-property editing and removal of transitional
  globals/literals.
- Live editor telemetry/bindings are incomplete; current editor source is the
  fake demo source.
- Production video background integration is not implemented.
- The surrounding UI has no React/shadcn stack today. That modernization is
  deliberately later than the core Fabric migration.
- Legacy custom-editor behaviours in spec 0014 are **not requirements yet**.
  Review each against the fork before recreating it.

## Next

1. Finish remaining Stage 4B domain property boundaries before deleting fallback
   code.
2. Review spec 0014 and explicitly keep/drop/replace each missing legacy editor
   behaviour before implementing any of it.
3. Complete the property/token model in spec 0011 before stabilising v2.
4. Add live editor bindings/charts, then the video background path.
5. Remove superseded DOM/custom editor code.
6. Only after the authoring core is stable, start the React + shadcn/Base UI
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
