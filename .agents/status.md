# Status — 2026-09-24

Current handoff only. Durable product truth lives in
`product-requirements.md`, `architecture.md`, `decisions.md` and
`lessons.md`. Active designs/specs and implementation plans live under
`docs/superpowers/`.

## Verified baseline

Latest product change on `develop` (`b66fe097`) recorded:

- 1,228 unit tests passing;
- seven-project typecheck passing;
- workspace builds passing;
- full browser suite: 100 passed, 50 skipped, 0 failed.

This workflow-cleanup branch changes documentation/agent configuration only.

## Current product state

### Player

- Fabric `StaticCanvas` renders text, shapes, groups, images/SVG and gauge,
  line, bar and pie charts through the shared `scene-fabric` layer.
- Live telemetry, line-history presentation, hosted themes, packaged assets/fonts
  and display-unit conversion are implemented.
- Background video remains a separate aligned layer beneath Fabric.

### Editor

- `@vigilia/editor` mounts `fabric/es` directly; no external editor package is
  a runtime dependency.
- React/Base UI/Tailwind provides the shell while Fabric owns scene objects.
- New/Open/Save, host-library storage, dirty-work protection, native history,
  text/image/chart creation, palette/type tokens, bindings, assets/fonts,
  selection inspection, in-place text editing, clipboard/duplicate,
  group/ungroup, arrange/locks, movement snapping, indicators and image crop are
  implemented.
- Runtime preview data stays outside authored history/persistence.

### Host and settings

- Node/TypeScript host serves player/editor, theme packages/assets and SSE
  telemetry.
- Hardware data uses existing sources: LibreHardwareMonitor when available and
  `systeminformation` as the library fallback, including network throughput.
- Device assignments/names, active theme, per-theme device answers, timezone and
  measurement preference are persisted through the settings flow.
- LAN displays use short-lived revocable pairing sessions; loopback remains
  trusted administration.
- LHM can be staged/launched and a one-time scheduled task can be registered for
  elevation.

## Next

1. Let an author choose/preview the relevant device while editing instead of
   always seeing the provider/group default.
2. Use the
   [editor behaviour review](../docs/superpowers/specs/2026-09-24-editor-behaviour-review.md)
   only when real authoring use exposes one of those QoL gaps; resize-time
   snapping is the main remaining candidate.
3. Do a reduced-transparency capture pass for the glass editor palettes when
   visual polish is next in scope.

## Known limitations / unverified

- A theme-specific device answer is asked once and then hidden; changing an
  existing answer currently requires editing stored state rather than using the
  settings page.
- Editor live preview uses provider units; the consumer measurement preference
  is applied by the display path.
- No physical-phone release gate exists. LAN pairing is covered by server/unit
  tests and a manual same-machine LAN-address pass.
- LHM launch against a real installed/elevated process is not automated.
  PawnIO/LHM coexistence with Vanguard/EAC/BattlEye remains unverified.
- Aggregate disk metrics can include removable/multiple mounted filesystems.
- Canvas text cannot guarantee tabular numerals.
