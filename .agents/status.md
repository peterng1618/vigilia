# Status — 2026-09-17

Current handoff only. Durable rules: `AGENTS.md`; product plan:
`design/plan.md`; architecture: `architecture.md`; active work: specs 0010,
0011 and 0013. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Unit tests | 1,242 passed across 70 files |
| Typechecks | six projects clean |
| Browser suite | 53 passed / 119 skipped / 0 failed |
| Player size | 260.3 KB gzip / 400 KB gate |
| Host bundle | 25.36 KB raw / 8.34 KB gzip; no Fabric dependency edge |
| Fork | compiled package installed; fork typecheck/build and 1,809 tests passed |

These are the latest code-verification figures recorded before the documentation
cleanup. No code changed in this pass.

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
  then rebuilds the fork shell. Invalid/incompatible files leave the current
  editor intact.
- Current Vigilia extensions are **only** `ChartManager`, `PersistenceManager`
  and `ShortcutManager` composed by `ForkExtensions`.
- The chart panel supports scalar settings for one selected `VigiliaChart`,
  generated from the shared descriptor registry and updated in place.
- Startup still loads the legacy demo theme, builds a `ScenePlan`, then adopts
  those Fabric objects into the interactive canvas. Direct v2 startup is not
  finished.
- The v2 envelope/Fabric scene contract exists, but its globals/property model is
  still transitional. Palette/type-preset semantics from spec 0011 are not yet
  represented by the published development schema.

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

1. Finish the Stage 4B direct-v2 editor path and retire corresponding legacy
   startup/persistence assumptions.
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
