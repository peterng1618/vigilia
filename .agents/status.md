# Status — 2026-09-19

Current handoff only. Durable rules: `AGENTS.md`; product: `design/plan.md`;
architecture: `architecture.md`; active work: specs 0010, 0011 and 0013.
Spec 0014 is review-only; 0015 is implemented.

## Latest recorded verification

| Check | Result |
|---|---|
| Unit tests | 868 passed across 59 files |
| Typechecks | seven projects clean |
| Builds | player, editor and host clean |
| Player size gate | 263.0 KB gzip JS; 0.0 KB gzip CSS |
| Visual review | refreshed active-fork captures inspected; layers/arrange and existing property states are visible |

Layer/capture has current typecheck, units, builds and size evidence. Browser
automation remains unavailable in this runtime.

## Current product state

### Player

- `scene-fabric` renders text, shapes, groups, images/SVG and four chart families.
- Player uses `StaticCanvas` and does not depend on editor UI.
- `VigiliaChart` supports persistence, disposal, live redraw and transforms.
- Text layout and bitmap/SVG fit/recolour paths are implemented.

### Editor

- `/editor` uses the adopted `fabricjs-image-editor` fork; the custom editor is removed.
- The fork is pinned to `918a454` and Fabric 7.4.0 via `fabric/es`.
- v2 New/Open/Save, dirty-work protection, compatibility validation and fork
  history integration are active.
- Vigilia extensions cover artboard, palette, type presets, charts, bindings,
  chart paint, semantic layers and align/distribute.
- Palette/type references are validated and reassigned safely on deletion.
- Theme-package support exists; asset authoring UI does not.
- Live editor telemetry and production video integration remain incomplete.

### Host

- Node/TypeScript host, CLI, SSE transport and baseline CPU/RAM telemetry work.
- Disk/network and LibreHardwareMonitor telemetry are not implemented.
- Pairing/revocable sessions, host theme storage and the full LAN flow are not implemented.

## Next

1. Execute `docs/superpowers/plans/2026-09-19-hosted-theme-authoring.md`:
   host package storage, package-only editor save/open, live editor preview and
   player proof for existing authored features.
2. Implement image/SVG, font and video authoring only after that workflow works.
3. Revisit remaining spec-0014 candidates only when needed.
4. Modernize the shell per plan §35 only after the authoring core is stable.

## Unverified / limitations

- Browser E2E previews bundles; it does not exercise the host.
- No physical-phone gate exists; LAN pairing is not validated end to end.
- LHM extended telemetry is still a contract.
- Canvas text cannot guarantee tabular numerals.
- Current-session Playwright could not launch: runtime returned `spawn EPERM`.
- Chart engine gaps remain for gauge angular gradients and discrete line thresholds.
