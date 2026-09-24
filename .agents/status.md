# Status — 2026-09-24

Current handoff only. Durable rules: `AGENTS.md`; product:
`product-requirements.md`; architecture: `architecture.md`; active work: spec
0010. Spec 0014 is review-only.

## Latest recorded verification

| Check | Result |
|---|---|
| Unreadable sensors explain themselves (§97) | A key no provider considers was absent from the SSE frame entirely, so a display could not distinguish "nothing reports this" from "no data yet"; the host now emits an explicit gap carrying the reason. The player shows a notice naming how many sensors have no reading and why, in the provider's own words, and renders nothing when every key has a reading. Verified 2026-09-24 against the real host: "1 of 1 sensors have no reading. no provider on this PC reports that sensor; check the device assignment or that its source is running", with the inspected capture confirming it renders, and a fully-readable theme showing no notice. Two test mistakes were caught and fixed: the first hook covered only the fixture path, and the first test passed on a theme whose keys all resolved. Evidence: 1122-unit suite, `biome check` exit 0, seven-project typecheck, builds, 281.8 KB size gate, browser suite 91 passed / 0 failed. |
| Device selection for consumers | A theme shows one GPU and one disk, so a machine with several needs to say which. `/settings` (loopback-only, served from one dependency-free HTML file) lists the real devices and stores the choice beside the themes; the aggregate keys follow it, and a device can be renamed. Verified 2026-09-24 against the real host: the page listed this machine's GPU and four drives, a choice persisted across a reload, and assigning one drive made a theme's `disk.total` report 3000.6 GB (that drive) instead of 12502.4 GB (all combined). Three rendering defects — a blank select for a single-device group, a name field showing another group's value, and a sticky status bar overlapping the last field — were found by inspecting the page and are fixed. Assignments are read through both providers, so the page works without LHM. Evidence: 1120-unit suite, `biome check` exit 0, seven-project typecheck, builds, 281.6 KB size gate, browser suite 91 passed / 39 skipped / 0 failed. |
| LHM packaging and launch | `npm run vendor:lhm` stages the pinned v0.9.6 release unpacked into `packages/host/vendor/lhm`, adds the `LICENSE` and `THIRD-PARTY-NOTICES.txt` the archive omits, and records the sha256 in `PROVENANCE.txt`. Bundling approved 2026-09-24. LHM's manifest is `requireAdministrator` (it loads a driver), so `spawn` cannot start it: the launcher runs LHM's own startup task when registered (no prompt) and otherwise requests elevation via Windows' runas verb. `--register-lhm-task` performs the one-time setup, reporting "Access is denied" and exiting 1 when it lacks rights. Verified against the real binary: elevation detected, a missing/source file correctly not, the task check works, a plain binary still spawns directly, and the registration failure path is explicit. **Not verified:** the successful registration and the elevated launch both require an administrator terminal, which an automated session cannot provide. Evidence: 1123-unit suite, `biome check` exit 0, seven-project typecheck, builds, 281.8 KB size gate, browser suite 91 passed / 0 failed. |
| Hardware metrics via LHM + systeminformation | Providers now read existing sources instead of a hand-rolled collector. Verified 2026-09-24 against the running host without LHM: `library` answered `cpu.load` 16.7%, `ram.used` 10.5 GB, `disk.used` 5396 GB across four volumes and `network.download` 0.014 Mb/s, while `lhm` reported its own absence with a reason rather than a value. Verified against a stub serving LHM's exact `data.json` shape: `lhm` answered `cpu.fan` 1450 RPM, `cpu.temp` 58.5 °C, `gpu.load` 71%, `gpu.temp` 64 °C, and `cpu.load` fell through to `library`, proving the registry's fallback. Two LHM traps were found in its source and handled: `Used Space` is typed Load but carries a percentage, and `Data` is already GB while `Throughput` is bytes per second. Evidence: 1093-unit suite, `biome check` exit 0, seven-project typecheck, builds, 281.6 KB size gate (unchanged — the library stays host-side), browser suite 91 passed / 39 skipped / 0 failed. |
| Line threshold bands — §85 gap closed, no engine gaps open | A threshold stroke now colours line segments per value through `visualMap.piecewise`, with the agreed mapping: authored 0–1 offsets resolve against the line's authored `min`/`max`, and a line declaring neither keeps one colour rather than guessing at a moving visible axis. The first implementation silently drew one colour because `VisualMapComponent` was missing from the modular ECharts registration; registering it is what makes the feature real. Verified by rendering a new stress-fixture chart whose samples climb 7 → 50 on a 0–100 axis: the line draws cyan below 40 and amber above. Evidence: 1111-unit suite, `biome check` exit 0, seven-project typecheck, builds, 281.6 KB size gate, browser suite 91 passed / 39 skipped / 0 failed. |
| §35 copy centralization landed | Shell modernization triggered §35's requirement that each frontend package keep visible copy in one typed module. `@vigilia/editor`'s `ui-copy.ts` now owns every panel heading, field label and action name as well as the shell's, and `@vigilia/player` gained its own for the load-failure panel, the connection banner and the synthetic-data disclosure. The Insert menu and the Add panel had drifted into two copies of the chart-family labels; that is now one owner. Developer status text ("Fabric editor ready") stays inline, which §35 excludes. Rendered output unchanged: the editor capture was inspected before and after and is identical. Evidence: 1107-unit suite, `biome check` exit 0, seven-project typecheck, builds, 269.7 KB size gate, browser suite 91 passed / 39 skipped / 0 failed. |
| Gauge angular gradients — §85 gap closed | ECharts applies gauge `progress` colour across the swept arc, so the adapter now expresses a gradient progress as the same arc segments it already used for the track, replacing a cartesian `to-right` gradient that did not follow the ring. Threshold progress is deliberately unchanged (one flat colour for the current value). The stress fixture's reverse gauge carries a gradient progress so the arc renders in the browser suite; the inspected capture shows colour sweeping along the ring. Evidence: 1107-unit suite, `biome check` exit 0, seven-project typecheck, builds, 269.6 KB size gate, browser suite 91 passed / 39 skipped / 0 failed. |
| Hosted font loading — now verified in a browser | The host fixture declares Inter from the same Fontsource URL the curated catalog uses, so the packaged-font path is exercised end to end: the player fetches the declared bytes over the host's asset route, registers the face and Fabric measures text against it. Asserted on the registered face's `loaded` status — `document.fonts.check()` was measured returning `true` for a generic fallback with an empty face set, so it proves nothing. Disabling the player's font fetch fails the test. Bytes are downloaded once into a gitignored cache; the licence travels in the envelope. Evidence 2026-09-24: 1106-unit suite, seven-project typecheck, format/lint clean, builds, 269.9 KB size gate, full browser suite 91 passed / 39 skipped / 0 failed. |
| LAN pairing — spec 0010 sessions | Loopback stays trusted admin; a non-loopback display now needs a live session for every read, and a host without a session store refuses LAN reads rather than trusting them. Pairing is loopback-only (a phone cannot mint its own credentials), tokens are 32 CSPRNG bytes with a 12-hour expiry compared in constant time, and revocation takes effect immediately. The player sends `x-vigilia-session` on fetches and `session=` on the stream URL, which it must because `EventSource` cannot set headers. Verified 2026-09-24 against a host bound to `0.0.0.0` and queried on this machine's LAN address (`192.168.2.56`): unpaired read and stream 403, paired read 200, LAN pairing mint 403, loopback read 200, revoked token 403, `/api/health` `pairing: true`. Evidence: 1106-unit suite, seven-project typecheck, format/lint clean, builds, 269.9 KB size gate, full browser suite 89 passed / 37 skipped / 0 failed. |
| Host browser gate + disk baseline | The browser suite now starts the built Node host as a third webServer against a seeded theme package (`tests/e2e/host-theme.ts`), covering hosted theme revival in the player, the live SSE batch count behind the connection banner, declared package-asset serving with an undeclared-path 404, and the non-loopback mutation refusal. `disk.used`/`disk.used.percent`/`disk.total` now have a stdlib provider over `fs.statfs`; verified against the running host on 2026-09-24 (C: 465.17 GB total / 283.99 GB used / 61.05%) and `network.download` returned under `/api/health`'s `unmapped`. Evidence: 1091-unit suite, seven-project typecheck, format/lint clean, builds, 269.7 KB size gate, full local browser suite 89 passed / 37 skipped / 0 failed. |
| Editorial editor shell — visual-layout plan executed | The editor's vertical panel stack is replaced on `develop` by the editorial shell: cream/ink palette as the new default (graphite/ember/moss/plum/light stay selectable), top bar with File/Edit/Insert/Arrange/View menus, rail plus pane (Layers/Add/Assets/Settings), inspector Design/Data/Style tabs, and a canvas-bottom dock. Every control dispatches through existing owners — `EditorSession`'s document actions via a typed façade, `EditorInteraction` managers, `applyArrange`/`canArrange`, panel factories; the floating `toolbar-manager/` and the file-actions panel section were deleted with their action sets moved, not reimplemented. Evidence 2026-09-24: typecheck across seven projects, 1078-unit suite, format/lint clean, builds and the 269.4 KB player size gate, the full local browser suite (82 passed / 36 skipped / 0 failed; the 34 editor tests all pass) and inspected `editor-fork-desktop-chromium.png` / `editor-fork-toolbar-desktop-chromium.png` captures showing the editorial palette, menus, rail, inspector tabs, status line and a dock correctly withholding Group/Ungroup on a single selection. |
| Editor fork parity — spec 0017 executed | All 15 plan tasks implemented and committed: `updateArtboard` on `FabricSceneHandle` (Task 1), `error-manager/`, `controls-manager/`, `deletion-manager/`, `clipboard-manager/` with document-`paste` ownership and chart rehydration, `grouping-manager/`, `toolbar-manager/`, image import/rehydrate pixel bound (4096), `crop-manager/` over `clipPath`, unmodified-key product shortcuts, movement snapping (vendored geometry core + guide rendering + wired controller) and `indicator-manager/` rotation/size tooltips. Seven-project typecheck, 1071-unit suite (216 in the editor package after the review fix pass), builds, player size gate 269.4 KB gzip and the full local `npm run test:e2e` (82 passed, 0 failed, plus a re-run of the drag proof after the fix) passed on 2026-09-24; `editor-fork-snap-guides`, `editor-fork-rotation-indicator` and `editor-fork-toolbar` captures inspected showing dashed guides + spacing badges, a `31°` mid-rotation badge, and the floating toolbar over a selection. |
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
  imported and rehydrated images are downscaled to a 4096-px longest edge (a zero-delta snap step verifies its pending token so a whole-pixel drag never wedges the gesture);
  `FabricSceneHandle.updateArtboard` swaps live background media.

### Host

- Node/TypeScript host, CLI and SSE transport work. Hardware metrics come from
  existing sources, never a collector Vigilia maintains: the `lhm` provider
  reads LibreHardwareMonitor's own web server JSON (CPU temperature/power/
  clock/fan, GPU detail, VRAM, network throughput) and the `library` provider
  uses the `systeminformation` package for CPU load/clock, RAM, GPU, disks,
  network and any key LHM could not answer.
- LHM can be staged and launched by the host (`npm run vendor:lhm`); nothing
  links or compiles its .NET
  library, and it is not packaged with the host yet.
- `/api/health` reports requested-but-unanswered keys under `unmapped`.
  `network.download`/`network.upload` now have providers, so they no longer
  appear there.
- Package storage and loopback-only mutation work; LAN displays pair through
  short-lived revocable sessions (§145). The launcher prints a pairing link;
  there is no in-editor device list, QR flow or physical-phone test.
- The browser suite starts the real host and covers hosted theme loading,
  package-asset serving, the live SSE batch count and the loopback admin guard
  (`tests/e2e/host-player.spec.ts`). LAN pairing is verified by unit and
  server tests plus a manual pass against a `0.0.0.0`-bound host, not by the
  browser suite.

## Next

1. Device assignment has an API and a page (`/settings`, loopback-only), but the
   editor does not yet offer a device picker while authoring, and a theme cannot
   declare which group a chart wants.
2. The editorial shell has landed; its remaining follow-ups are resize-time
   snapping (spec 0014) and a reduced-transparency capture pass for the glass
   palettes.
3. Revisit remaining spec-0014 candidates only when needed; the four new
   residuals (rotated-image crop, snapping-file split, `pixel-grid.ts`, size
   indicator's `mouse:move` pass) are recorded in spec 0014.
4. The fork's own Playwright snapping suite was **not** ported — only its two
   highest-value unit specs (resolver, spacing geometry) were. Vigilia's own
   Playwright drag capture covers rendered guide behaviour instead.

## Unverified / limitations

- The browser suite now starts the real host for the hosted-player tests
  (`tests/e2e/host-player.spec.ts`); the editor tests still preview bundles.
- No physical-phone gate exists. LAN pairing is proven with server/unit tests
  and a manual pass from this machine's LAN address, but never on real phone
  hardware or a device that is not the host itself.
- LHM is read and can be staged, but not verified against a real install: the
  provider was proved against a stub serving LHM's documented `data.json` shape,
  and a real launch needs an elevated session, which no test performs. LHM/PawnIO
  coexistence with Vanguard/EAC/BattlEye is unverified. Bundling was approved
  2026-09-24 (the licence analysis in `.agents/dependency-licences.md` found
  redistribution permissible with notices, not blocked).
- `disk.used`/`disk.used.percent` sum every mounted filesystem, so a machine with
  a removable volume reports it as part of "disk". A per-volume key fan-out is a
  separate product decision.
- Canvas text cannot guarantee tabular numerals.
- Hosted player font loading is now verified through the real host; the fixture
  needs network access once to fetch the font bytes into a local cache.
- No chart engine gaps are open (§85): gauge angular gradients and line
  threshold bands are both resolved and rendered by the stress fixture.
- Network throughput has no provider; an external source was chosen in
  principle but none is picked yet (`.agents/decisions.md`).
