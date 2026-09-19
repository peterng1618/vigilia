# Status — 2026-09-20

Current handoff only. Durable rules: `AGENTS.md`; product: `design/plan.md`;
architecture: `architecture.md`; active work: specs 0010, 0011 and 0013.
Spec 0014 is review-only; 0015 is implemented.

## Latest recorded verification

| Check | Result |
|---|---|
| Hosted authoring source | package/library, preview/live source and player-host loading are committed in `8a657b4` |
| Unit tests | 895 passed across 65 files |
| Typechecks | seven projects clean |
| Builds | player and host clean; editor rebuilt clean on 2026-09-19 |
| Player size gate | 268.8 KB gzip JS; 0.0 KB gzip CSS |
| Visual review | 12 completed desktop/phone player and desktop editor captures inspected |
| Browser suite | 74 passed; 26 desktop-only editor checks skipped on phone |
| Image/SVG asset authoring | typechecks, 903 units, builds, player size and visual capture passed; focused asset browser test passed |
| Background-media mount | 910 units, seven typechecks, builds and size gate passed; browser evidence pending Task 5 |
| Background-media assets | 913 units, seven typechecks, builds and size gate passed; Theme settings/browser evidence pending Tasks 4-5 |
| Theme settings | focused editor typecheck and 14 panel/persistence tests passed; player/browser evidence pending Task 5 |
| Player background media | seven typechecks, 914 units, builds and size gate passed; focused browser capture remains unverified |

Preview/live source controls and hosted player loading have current typecheck,
unit, build, size and visual evidence. The full browser suite is not green.

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
- Fabric image/SVG authoring imports/replaces selected images, protects referenced assets from removal, retains package bytes through Open/Save, and refreshes replacement selection controls.
- Theme-package-only Open/Save and host-library Open/Save are active.
- Live editor telemetry and production video integration remain incomplete.

### Host

- Node/TypeScript host, CLI, SSE transport and baseline CPU/RAM telemetry work.
- Disk/network and LibreHardwareMonitor telemetry are not implemented.
- Package storage and loopback-only mutation work; pairing/revocable sessions
  and the full LAN flow are not implemented.

## Next

1. Implement Theme settings/background media, then the approved packaged-font slice.
2. Revisit remaining spec-0014 candidates only when needed.
3. Modernize the shell per plan §35 only after the authoring core is stable.

## Unverified / limitations

- Browser E2E previews bundles; it does not exercise the host.
- The full 102-test browser command exited after its tenth desktop check twice
  without a result summary; its overall result is unverified.
- No physical-phone gate exists; LAN pairing is not validated end to end.
- LHM extended telemetry is still a contract.
- Canvas text cannot guarantee tabular numerals.
- Chart engine gaps remain for gauge angular gradients and discrete line thresholds.
