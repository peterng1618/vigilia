# Status — 2026-09-19

Current handoff only. Durable rules: `AGENTS.md`; product: `design/plan.md`;
architecture: `architecture.md`; active work: specs 0010, 0011 and 0013.
Spec 0014 is review-only; 0015 is implemented.

## Latest recorded verification

| Check | Result |
|---|---|
| Unit tests | 857 passed across 55 files |
| Typechecks | six projects clean |
| Builds | player, editor and host clean |
| Player size gate | 263.0 KB gzip JS; 0.0 KB gzip CSS |
| Visual review | active-fork chart-paint capture inspected; selected gauge and token selectors visible |

Chart-paint has current typecheck, unit, editor-build and focused visual evidence.

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

1. Finish asset/property authoring in spec 0011.
2. Connect live telemetry to the editor without authored-history pollution.
3. Integrate production video.
4. Revisit remaining spec-0014 candidates only when needed.
5. Modernize the shell per plan §35 only after the authoring core is stable.

## Unverified / limitations

- Browser E2E previews bundles; it does not exercise the host.
- No physical-phone gate exists; LAN pairing is not validated end to end.
- LHM extended telemetry is still a contract.
- Canvas text cannot guarantee tabular numerals.
- Current-session Playwright could not launch: runtime returned `spawn EPERM`.
- Chart engine gaps remain for gauge angular gradients and discrete line thresholds.
