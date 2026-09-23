# Status — 2026-09-24

Current handoff only. Durable rules: `AGENTS.md`; product:
`product-requirements.md`; architecture: `architecture.md`; active work: spec
0010. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Editor fork parity — spec 0017 executed | All 15 plan tasks implemented and committed: `updateArtboard` on `FabricSceneHandle` (Task 1), `error-manager/`, `controls-manager/`, `deletion-manager/`, `clipboard-manager/` with document-`paste` ownership and chart rehydration, `grouping-manager/`, `toolbar-manager/`, image import/rehydrate pixel bound (4096), `crop-manager/` over `clipPath`, unmodified-key product shortcuts, movement snapping (vendored geometry core + guide rendering + wired controller) and `indicator-manager/` rotation/size tooltips. Seven-project typecheck, 1071-unit suite, builds, player size gate 269.4 KB gzip and the full local `npm run test:e2e` (82 passed, 0 failed) passed on 2026-09-24; `editor-fork-snap-guides`, `editor-fork-rotation-indicator` and `editor-fork-toolbar` captures inspected showing dashed guides + spacing badges, a `31°` mid-rotation badge, and the floating toolbar over a selection. |
| Native Fabric editor migration — spec 0016 closed | `@vigilia/editor` mounts `fabric/es` directly with no `@anu3ev/fabric-image-editor` runtime/type/alias/lockfile dependency; canvas/text/image/layer/lock/history mechanics split into per-concern manager folders mirroring the retired fork's own split; palette/type-preset reassignment consolidated into `palette-manager/`/`type-preset-manager/`. Root-caused and fixed 3 behaviours the native mount had dropped from the retired fork's own generic construction: new text/image objects got no `id` (failed envelope validation on save), nothing wired Fabric's `object:modified` to history (a completed drag/resize was never undoable), and the fork's own `window[containerId] = editorInstance` debug/e2e handle and its global Ctrl+Z/Ctrl+Y undo-redo binding were never replicated. |
| Spec 0011 chart creation | 950-unit suite, editor typecheck/build, focused desktop Chromium package round-trip and inspected `editor-fork-chart-creation-desktop-chromium.png` passed on 2026-09-21; Add exposes Text plus Gauge/Line/Bar/Pie, each chart starts from palette references, and a created gauge saves/reopens without runtime options; unbound revived charts hydrate from the Fabric scene |
| Verification policy | Browser changes run full local `npm run test:e2e`; CI runs only on `main` pushes and pull requests targeting `main`. `develop` pushes do not wait for GitHub CI. |
| CI | `35527200912` passed licence, format, lint, typecheck, unit, build and size jobs; its only failure was the viewport E2E test expecting the retired 1280px stress artboard width. The corrected focused Chromium test and format check passed locally on 2026-09-21. |
| Editor configuration | `.gitattributes` enforces LF checkout; stale C#/.NET rules removed; `git check-attr` verified text files resolve to `eol: lf` |
| Web quality tooling | Biome 2.5.14 `format:check` and lint for strict equality, unused symbols and floating promises, seven-project typecheck, workspace build and player-size gate passed on 2026-09-20; Markdown/YAML are not yet linted |
| CI licence notices | The `Licence notices present` job failed before the frontend job because its exact package-name check could not find `@playwright/test`; the notice now uses the declared name and needs CI confirmation |
| Editor configuration | Vendored fork source is attributed in `THIRD-PARTY-NOTICES.md` ("Vendored source", full MIT text) and `.agents/dependency-licences.md` (pin `0.10.32, commit 9efdd78a34`); verified 2026-09-24 that fork copies live only in `editor/src/snap-manager/` and `editor/src/indicator-manager/` and that no source file carries a licence header |

Preview/live source controls and hosted player loading have current typecheck,
unit, build, size and visual evidence. The full local browser suite passed on
2026-09-24 (82 passed, 0 failed; see the fork-parity row above).

## Current product state

### Player

- `scene-fabric` renders text, shapes, groups, images/SVG and four chart families.
- Player uses `StaticCanvas` and does not depend on editor UI.
- `VigiliaChart` supports persistence, disposal, live redraw and transforms.
- Charts repaint at 30 FPS; live line viewports trail one cadence. Complete segments render in a cropped right gutter and one predecessor remains at the left edge. There is no custom startup animation.
- Text layout and bitmap/SVG fit/recolour paths are implemented.

### Editor

- `/editor` mounts `fabric/es` natively; there is no adopted image-editor
  package (see `.agents/architecture.md`'s editor boundary section for the
  per-concern manager split).
- v2 New/Open/Save, dirty-work protection, compatibility validation and native
  history integration are active.
- Vigilia extensions cover artboard, palette, type presets, charts, bindings,
  chart paint, semantic layers and align/distribute.
- Add offers semantic Text plus Gauge, Line, Bar and Pie commands; generic
  shapes stay editor-owned (`layer-manager/`, `object-lock-manager/`) and
  images/SVGs stay asset-owned.
- `Chart refresh` selects 30 FPS or 1 FPS for the editor session; it is not persisted.
- Palette/type references are validated and reassigned safely on deletion.
- Curated font previews, trio/single-face adoption and editor/player `FontFace` loading are implemented.
- Fabric image/SVG authoring imports/replaces selected images, protects referenced assets from removal, retains package bytes through Open/Save, and refreshes replacement selection controls.
- Theme-package-only Open/Save and host-library Open/Save are active.
- Preview/live editor sources refresh bound text and charts without entering authored history or persistence.
- Fork-parity mechanics are restored: structured `editor:error`/`editor:warning`
  diagnostics; fork handle styling with `snapAngle = 1`; Delete/Backspace,
  Ctrl+C/X/D and Ctrl+G/Ctrl+Shift+G product shortcuts; floating selection
  toolbar (duplicate/lock/z-order/group/delete, unlock-only when locked); OS
  clipboard with external image paste and duplicate; per-image crop sessions
  over `clipPath` (rotated images refused with a warning); drag-time line and
  equal-spacing snapping with smart guides; rotation-angle and size tooltips;
  imported and rehydrated images are downscaled to a 4096-px longest edge;
  `FabricSceneHandle.updateArtboard` swaps live background media.

### Host

- Node/TypeScript host, CLI, SSE transport and baseline CPU/RAM telemetry work.
- Disk/network and LibreHardwareMonitor telemetry are not implemented.
- Package storage and loopback-only mutation work; pairing/revocable sessions
  and the full LAN flow are not implemented.

## Next

1. Revisit remaining spec-0014 candidates only when needed; the four new
   residuals (rotated-image crop, snapping-file split, `pixel-grid.ts`, size
   indicator's `mouse:move` pass) are recorded in spec 0014.
2. The fork's own Playwright snapping suite was **not** ported — only its two
   highest-value unit specs (resolver, spacing geometry) were. Vigilia's own
   Playwright drag capture covers rendered guide behaviour instead.

## Unverified / limitations

- Browser E2E previews bundles; it does not exercise the host.
- No physical-phone gate exists; LAN pairing is not validated end to end.
- LHM extended telemetry is still a contract.
- Canvas text cannot guarantee tabular numerals.
- Hosted player font loading is implemented but unverified in a browser because
  E2E previews Vite bundles rather than the Node host.
- Chart engine gaps remain for gauge angular gradients and discrete line thresholds.
