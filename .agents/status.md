# Status — 2026-09-17

Current handoff only. Durable rules: `AGENTS.md`; product plan:
`design/plan.md`; architecture: `architecture.md`; active work: specs 0010,
0011 and 0013. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Unit tests | 1,247 passed across 72 files |
| Typechecks | six projects clean |
| Browser suite | 56 passed / 122 skipped / 0 failed |
| Player size | 260.3 KB gzip / 400 KB gate |
| Host bundle | 25.36 KB raw / 8.34 KB gzip; no Fabric dependency edge |
| Fork | compiled package installed; fork typecheck/build and 1,809 tests passed |

Full gate run on 2026-09-17. Isolated preview confirms direct v2 startup shows
the static dashboard demo at usable stage size.

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
- Ctrl/Cmd+O validates a bounded v2 file, checks exact Fabric compatibility,
  then stages revival before replacing the fork shell. Invalid, incompatible,
  or unrevivable files leave the current editor intact.
- Open compares the serialized Fabric scene to the saved scene and offers
  Save/Discard/Cancel before replacing dirty work. A New-document action is not
  implemented yet.
- Current Vigilia extensions are **only** `ChartManager`, `PersistenceManager`
  and `ShortcutManager` composed by `ForkExtensions`.
- The fork starts at full contain-fit zoom in a centered artboard-aspect viewport,
  so the editor stage neither squeezes nor stretches the dashboard canvas.
- The chart panel supports scalar settings for one selected `VigiliaChart`,
  generated from the shared descriptor registry and updated in place.
- Startup creates and revives a static v2 dashboard envelope directly. The
  legacy demo theme/`ScenePlan` path no longer mounts the interactive editor.
- The v2 envelope/Fabric scene contract exists, but its globals/property model is
  still transitional. Palette/type-preset semantics from spec 0011 are not yet
  represented by the published development schema.
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

- Finish Stage 4B editor migration: direct v2 startup, remaining domain property
  boundaries, normal edit/save/open/history verification, then delete fallback
  code.
- Finish spec 0011: palette solids/gradients, type presets, stable reference UI,
  artboard/domain property editing and removal of transitional globals/literals.
- Live editor telemetry/bindings are incomplete; current editor source is the
  fake demo source.
- Production video background integration is not implemented.
- The surrounding UI has no React/shadcn stack today. That modernization is
  deliberately later than the core Fabric migration.
- Legacy custom-editor behaviours in spec 0014 are **not requirements yet**.
  Review each against the fork before recreating it.

## Next

1. Finish remaining Stage 4B domain property boundaries, ordinary edit/history
   verification, and New-document safety before deleting fallback code.
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
