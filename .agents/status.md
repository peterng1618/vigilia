# Status — 2026-09-21

Current handoff only. Durable rules: `AGENTS.md`; product:
`product-requirements.md`; architecture: `architecture.md`; active work: spec
0010. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Native Fabric editor migration | Planned on `codex/native-fabric-editor` from `origin/develop` `07b575f` on 2026-09-21. No implementation or runtime proof yet. |
| Spec 0011 chart creation | 950-unit suite, editor typecheck/build, focused desktop Chromium package round-trip and inspected `editor-fork-chart-creation-desktop-chromium.png` passed on 2026-09-21; Add exposes Text plus Gauge/Line/Bar/Pie, each chart starts from palette references, and a created gauge saves/reopens without runtime options; unbound revived charts hydrate from the Fabric scene |
| Verification policy | Browser changes run full local `npm run test:e2e`; CI runs only on `main` pushes and pull requests targeting `main`. `develop` pushes do not wait for GitHub CI. |
| Spec 0011 property corrections | Full 935-unit suite, focused preset/artboard/Release DOM tests, editor typecheck and editor build passed on 2026-09-21; desktop Chromium package round-trip applied `Inter 700`, edited letter spacing to `0.25`, and retained face/trio metadata after reopen; inspected `editor-fork-type-preset-desktop-chromium.png` shows those controls and the packaged font asset |
| CI | `35527200912` passed licence, format, lint, typecheck, unit, build and size jobs; its only failure was the viewport E2E test expecting the retired 1280px stress artboard width. The corrected focused Chromium test and format check passed locally on 2026-09-21. |
| Editor configuration | `.gitattributes` enforces LF checkout; stale C#/.NET rules removed; `git check-attr` verified text files resolve to `eol: lf` |
| Web quality tooling | Biome 2.5.14 `format:check` and lint for strict equality, unused symbols and floating promises, seven-project typecheck, 946-unit suite, workspace build and player-size gate passed on 2026-09-20; Markdown/YAML are not yet linted |
| CI licence notices | The `Licence notices present` job failed before the frontend job because its exact package-name check could not find `@playwright/test`; the notice now uses the declared name and needs CI confirmation |
| Editor interaction regressions | Fork history-baseline unit, editor typecheck, 5 focused arrange/chart units, editor/player builds, and desktop Chromium drag-undo/chart-runtime-after-undo proof passed on 2026-09-20 |
| Selection-order arrange | Editor typecheck, 10 focused fork-shell/arrange units, and editor build passed on 2026-09-20; the arrange regression fails when rebuilt selections use Fabric canvas stacking |
| Hosted authoring source | package/library, preview/live source and player-host loading are committed in `8a657b4` |
| Font editor slice | 23 focused tests, seven typechecks, editor build and inspected `editor-fork-font-trio-desktop-chromium.png` passed |
| Hosted font delivery | Host asset route, player fetch/lifecycle tests, full typecheck, 936 units, builds, size and desktop/phone visual capture passed; Node-hosted browser runtime remains unverified because E2E previews Vite bundles |
| Typechecks | seven projects clean |
| Builds | player and host clean; editor rebuilt clean on 2026-09-19 |
| Player size gate | 270.6 KB gzip JS; 0.0 KB gzip CSS |
| Live line visual review | Three v2 editor frames at one-second intervals show a continuous line at both edges: complete segments render in a hidden right gutter and the source retains one extra second for the left-edge predecessor; player requires a hosted v2 theme or an explicit test fixture |
| Browser suite | Focused desktop Chromium viewport-refit proof passed on 2026-09-21 after correcting its fixture-width expectation; full local `display-fabric` run was unstable at an unrelated initial canvas-mount test, with no summary produced. |
| Image/SVG asset authoring | typechecks, 903 units, builds, player size and visual capture passed; focused asset browser test passed |
| Background media | seven typechecks, 914 units, builds, size gate, player suite and focused editor package/browser capture passed; `editor-fork-background-media-desktop-chromium.png` inspected |
| Live telemetry buffer | 942 units, seven typechecks, builds, 271.0 KB player gzip, and desktop/phone fixture captures passed and were inspected. Live sources hold all telemetry one cadence. |
| Editor live bindings | 946 units, seven typechecks, builds, and focused desktop Chromium proof passed; inspected `editor-fork-live-text-desktop-chromium.png` shows a preview-bound text value while Save persists only its authored run and fallback. |
| Shared line-chart motion | 931 units, editor/renderer typechecks and editor/player builds passed on 2026-09-20; player/editor share `renderer-core` line geometry, live batches receive browser-local timestamps immediately, line windows retain one left-edge predecessor, and only the viewport trails complete segments by one cadence. The editor exposes 2:1/3:1/4:1 line aspect presets and visible history; committed chart transforms rerasterize every chart family. |

Preview/live source controls and hosted player loading have current typecheck,
unit, build, size and visual evidence. The full browser suite is not green.

## Current product state

### Player

- `scene-fabric` renders text, shapes, groups, images/SVG and four chart families.
- Player uses `StaticCanvas` and does not depend on editor UI.
- `VigiliaChart` supports persistence, disposal, live redraw and transforms.
- Charts repaint at 30 FPS; live line viewports trail one cadence. Complete segments render in a cropped right gutter and one predecessor remains at the left edge. There is no custom startup animation.
- Text layout and bitmap/SVG fit/recolour paths are implemented.

### Editor

- `/editor` uses the adopted `fabricjs-image-editor` fork; the custom editor is removed.
- The fork is pinned to `918a454` and Fabric 7.4.0 via `fabric/es`.
- v2 New/Open/Save, dirty-work protection, compatibility validation and fork
  history integration are active.
- Vigilia extensions cover artboard, palette, type presets, charts, bindings,
  chart paint, semantic layers and align/distribute.
- Add offers semantic Text plus Gauge, Line, Bar and Pie commands; generic
  shapes stay fork-owned and images/SVGs stay asset-owned.
- `Chart refresh` selects 30 FPS or 1 FPS for the editor session; it is not persisted.
- Palette/type references are validated and reassigned safely on deletion.
- Curated font previews, trio/single-face adoption and editor/player `FontFace` loading are implemented.
- Fabric image/SVG authoring imports/replaces selected images, protects referenced assets from removal, retains package bytes through Open/Save, and refreshes replacement selection controls.
- Theme-package-only Open/Save and host-library Open/Save are active.
- Preview/live editor sources refresh bound text and charts without entering authored history or persistence.

### Host

- Node/TypeScript host, CLI, SSE transport and baseline CPU/RAM telemetry work.
- Disk/network and LibreHardwareMonitor telemetry are not implemented.
- Package storage and loopback-only mutation work; pairing/revocable sessions
  and the full LAN flow are not implemented.

## Next

1. Implement spec 0016 module-by-module, starting with native contracts for the current customized editor path.
2. Revisit remaining spec-0014 candidates only when needed.

## Unverified / limitations

- Browser E2E previews bundles; it does not exercise the host.
- Full E2E on 2026-09-21: 8 passed, 33 skipped and 71 failed after the
  Playwright preview server returned `ERR_CONNECTION_REFUSED`; the focused
  chart-creation browser proof passed, but the full suite is not green.
- No physical-phone gate exists; LAN pairing is not validated end to end.
- LHM extended telemetry is still a contract.
- Canvas text cannot guarantee tabular numerals.
- Hosted player font loading is implemented but unverified in a browser because
  E2E previews Vite bundles rather than the Node host.
- Chart engine gaps remain for gauge angular gradients and discrete line thresholds.
