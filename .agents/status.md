# Status — 2026-09-20

Current handoff only. Durable rules: `AGENTS.md`; product: `design/plan.md`;
architecture: `architecture.md`; active work: specs 0010, 0011 and 0013.
Spec 0014 is review-only; 0015 is implemented.

## Latest recorded verification

| Check | Result |
|---|---|
| Editor configuration | `.gitattributes` enforces LF checkout; stale C#/.NET rules removed; `git check-attr` verified text files resolve to `eol: lf` |
| Hosted authoring source | package/library, preview/live source and player-host loading are committed in `8a657b4` |
| Font editor slice | 23 focused tests, seven typechecks, editor build and inspected `editor-fork-font-trio-desktop-chromium.png` passed |
| Hosted font delivery | Host asset route, player fetch/lifecycle tests, full typecheck, 936 units, builds, size and desktop/phone visual capture passed; Node-hosted browser runtime remains unverified because E2E previews Vite bundles |
| Typechecks | seven projects clean |
| Builds | player and host clean; editor rebuilt clean on 2026-09-19 |
| Player size gate | 270.6 KB gzip JS; 0.0 KB gzip CSS |
| Visual review | Fresh demo player desktop and phone captures inspected; text and canvas rendering are intact |
| Browser suite | Full 106-test command exited after ten desktop checks without a summary; separate two-capture visual gate passed |
| Image/SVG asset authoring | typechecks, 903 units, builds, player size and visual capture passed; focused asset browser test passed |
| Background media | seven typechecks, 914 units, builds, size gate, player suite and focused editor package/browser capture passed; `editor-fork-background-media-desktop-chromium.png` inspected |
| Chart repaint | 940 units, seven typechecks, builds, 271.0 KB player gzip, and focused editor refresh-toggle browser test passed; preview line reveal and its scroll handoff are unit-covered; full browser suite and visual capture inspection remain unverified |

Preview/live source controls and hosted player loading have current typecheck,
unit, build, size and visual evidence. The full browser suite is not green.

## Current product state

### Player

- `scene-fabric` renders text, shapes, groups, images/SVG and four chart families.
- Player uses `StaticCanvas` and does not depend on editor UI.
- `VigiliaChart` supports persistence, disposal, live redraw and transforms.
- Charts repaint at 30 FPS on the display; synthetic previews reveal retained line history left-to-right over two seconds, then scroll; host telemetry remains at its configured cadence.
- Text layout and bitmap/SVG fit/recolour paths are implemented.

### Editor

- `/editor` uses the adopted `fabricjs-image-editor` fork; the custom editor is removed.
- The fork is pinned to `918a454` and Fabric 7.4.0 via `fabric/es`.
- v2 New/Open/Save, dirty-work protection, compatibility validation and fork
  history integration are active.
- Vigilia extensions cover artboard, palette, type presets, charts, bindings,
  chart paint, semantic layers and align/distribute.
- `Chart refresh` selects 30 FPS or 1 FPS for the editor session; it is not persisted.
- Palette/type references are validated and reassigned safely on deletion.
- Curated font previews, trio/single-face adoption and editor/player `FontFace` loading are implemented.
- Fabric image/SVG authoring imports/replaces selected images, protects referenced assets from removal, retains package bytes through Open/Save, and refreshes replacement selection controls.
- Theme-package-only Open/Save and host-library Open/Save are active.
- Live editor telemetry and production video integration remain incomplete.

### Host

- Node/TypeScript host, CLI, SSE transport and baseline CPU/RAM telemetry work.
- Disk/network and LibreHardwareMonitor telemetry are not implemented.
- Package storage and loopback-only mutation work; pairing/revocable sessions
  and the full LAN flow are not implemented.

## Next

1. Revisit remaining spec-0014 candidates only when needed.
2. Modernize the shell per plan §35 only after the authoring core is stable.

## Unverified / limitations

- Browser E2E previews bundles; it does not exercise the host.
- The full 102-test browser command exited after its tenth desktop check twice
  without a result summary; its overall result is unverified.
- No physical-phone gate exists; LAN pairing is not validated end to end.
- LHM extended telemetry is still a contract.
- Canvas text cannot guarantee tabular numerals.
- Hosted player font loading is implemented but unverified in a browser because
  E2E previews Vite bundles rather than the Node host.
- Chart engine gaps remain for gauge angular gradients and discrete line thresholds.
