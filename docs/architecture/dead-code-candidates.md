# Dead-code candidates

The export-and-module half of the dead-code sweep's reference picture: every
candidate `scripts/dead-code-sweep.mjs` reported at
`aa9d7b96e7c2a6f51ea286e33d0d9d2690e0ff30`, with the search that found each kind,
so the removal phase works from a list rather than from an instinct. Taken
2026-10-12 on `develop`. The other half — which stylesheet selectors the product
still reaches — is [`dead-selectors.md`](dead-selectors.md), taken at `a7ef0c3a`.

**These are candidates, not verdicts, and this document modifies nothing** — no
file was deleted, and no row here has been re-established as dead. The scanner's
own header names the reason (`scripts/dead-code-sweep.mjs:14-22`): the
false-positive engine in this repository is *string-resolved vocabulary* —
`data-vigilia-*` attributes, `--vigilia-*`/`--shell-*` custom properties,
`KIND_*` registries, Fabric JSON keys, classes composed by template literal —
all of which are live with no importer anywhere, and none of which this graph can
see. `dead-export` and `redundant-export` are deliberately separate kinds because
their remedies are opposite: deleting a declaration versus deleting one
`export` keyword (`scripts/dead-code-sweep.mjs:34-40`).

## 1. The run

```
node scripts/dead-code-sweep.mjs                  # candidate report to stdout
node scripts/dead-code-sweep.mjs --json <path>    # the same report to a JSON file
node scripts/dead-code-sweep.mjs --self-test      # the scanner's own checks, non-zero on failure
```

The run that produced this document: `node scripts/dead-code-sweep.mjs --json
<scratch>/task3-candidates.json` at `aa9d7b96`, exit 0, and a separate
`--self-test` invocation reporting **22/22 passed** (exit 0; the result lands in
`src/web/test-results/dead-code-sweep-self-test.json`, which is gitignored and
therefore not evidence a clone carries). The self-test is run in its own
invocation because its result has its own fixed destination — `--self-test
--json <path>` once overwrote the candidate report, and the self-test's own
check that the report is still a finished candidate report is what caught it.

Nothing runs the scanner for you: no `package.json` script and no CI job names
it (`vg-379` — the self-test that no command runs), so these numbers are
reproducible by hand or not at all. The JSON is written outside the repo on
purpose; this document is the artefact a clone keeps.

**Scanned: 597 files** — 304 production, 293 test — from four roots:
`src/web/packages/*/src` (537), `src/web/tests` (49), `src/web/scripts` (1) and
root `scripts/` (10).

### 1.1 By kind

| Kind | Rows | What the row asks a phase to decide |
|---|---|---|
| `test-only-consumer` | **7** | A module every importer of which is a test file — mount it or delete it |
| `no-importer-file` | **1** | A module nothing imports, entry points and runner globs set aside |
| `dead-export` | **14** | A symbol nothing imports *and* whose own file never uses — a declaration to delete |
| `redundant-export` | **280** | A symbol nothing imports but whose own file *does* use — one keyword to delete, **never the symbol** |
| `barrel-only-export` | **0** | An export reached only through its own package barrel and taken from there by nobody |
| `unreachable-branch` | **10** | A closed union's member whose literal appears nowhere else — **8 distinct literals**, since `"image-cover"` and `"scale-montage"` are each declared in two files |
| **Total** | **312** | |

### 1.2 By package

| Package | Rows | `test-only-consumer` | `no-importer-file` | `dead-export` | `redundant-export` | `unreachable-branch` |
|---|---|---|---|---|---|---|
| `editor` | 224 | 6 | 1 | 9 | 203 | 5 |
| `host` | 53 | — | — | — | 49 | 4 |
| `renderer-core` | 13 | — | — | 5 | 7 | 1 |
| `scene-fabric` | 13 | 1 | — | — | 12 | — |
| `player` | 9 | — | — | — | 9 | — |
| `tests` / `scripts` / root | 0 | — | — | — | — | — |

Every row names a file under `src/web/packages/`; the `(tests)`, `(scripts)` and
`(root)` buckets are empty, which is §3's subject as much as it is a count.

### 1.3 Reconciling with the ledger's earlier run

Task 1 recorded **596 scanned files and 311 candidates (14 dead / 279 redundant)**
at `93c4f704`, which is an ancestor of this run's `aa9d7b96`. The difference is
one production file — `src/web/packages/editor/src/theme-library-manager/index.ts`,
the only file added under `src/web/packages` since — and it carries one
`redundant-export` row. This run does not otherwise reconcile row-by-row against
that one; it supersedes it.

## 2. The rows

### 2.1 The five kinds that are not `redundant-export`

| Kind | File | Symbol |
|---|---|---|
| `test-only-consumer` | `src/web/packages/editor/src/accessible-name.ts` | — |
| `test-only-consumer` | `src/web/packages/editor/src/chart-manager/chart-stage.test-stage.tsx` | — |
| `test-only-consumer` | `src/web/packages/editor/src/font-picker/font-picker.tsx` | — |
| `test-only-consumer` | `src/web/packages/editor/src/selection-inspector/idle-crop.test-stage.ts` | — |
| `test-only-consumer` | `src/web/packages/editor/src/selection-inspector/runs.test-stage.tsx` | — |
| `test-only-consumer` | `src/web/packages/editor/src/snap-manager/movement-snapping-core.test-utils.ts` | — |
| `test-only-consumer` | `src/web/packages/scene-fabric/src/glass-test-stage.ts` | — |
| `no-importer-file` | `src/web/packages/editor/src/button.ts` | — |
| `dead-export` | `src/web/packages/editor/src/editor-shell/controls/settings-field.ts` | `settingsField` |
| `dead-export` | `src/web/packages/editor/src/editor-shell/icons.ts` | `KIND_GLYPHS` |
| `dead-export` | `src/web/packages/editor/src/font-specimen-cache.ts` | `createSpecimenCache` |
| `dead-export` | `src/web/packages/editor/src/font-trios.generated.ts` | `GENERATED_SOURCE_REVISION` |
| `dead-export` | `src/web/packages/editor/src/selection-inspector/view.ts` | `RunBindingPort` |
| `dead-export` | `src/web/packages/editor/src/snap-manager/constants.ts` | `CENTERING_STEP` |
| `dead-export` | `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts` | `projectRectangularScaleBounds` |
| `dead-export` | `src/web/packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts` | `ScaleSnapEnvironment` |
| `dead-export` | `src/web/packages/editor/src/snap-manager/types.ts` | `AnchorBuckets` |
| `dead-export` | `src/web/packages/renderer-core/src/scene/measurement.ts` | `ConvertibleFamily` |
| `dead-export` | `src/web/packages/renderer-core/src/theme/capabilities.ts` | `CAPABILITY_TYPES` |
| `dead-export` | `src/web/packages/renderer-core/src/theme/envelope-keys.ts` | `envelopeKeyBags` |
| `dead-export` | `src/web/packages/renderer-core/src/theme/envelope-keys.ts` | `knownKeyShapes` |
| `dead-export` | `src/web/packages/renderer-core/src/theme/glass.ts` | `GLASS_TYPES` |
| `unreachable-branch` | `src/web/packages/editor/src/editor-interaction.ts` | `"image-cover"` |
| `unreachable-branch` | `src/web/packages/editor/src/editor-interaction.ts` | `"scale-montage"` |
| `unreachable-branch` | `src/web/packages/editor/src/error-manager/index.ts` | `"deletion"` |
| `unreachable-branch` | `src/web/packages/editor/src/image-manager/index.ts` | `"image-cover"` |
| `unreachable-branch` | `src/web/packages/editor/src/image-manager/index.ts` | `"scale-montage"` |
| `unreachable-branch` | `src/web/packages/host/src/providers/lhm-mapping.ts` | `"Current"` |
| `unreachable-branch` | `src/web/packages/host/src/providers/lhm-mapping.ts` | `"highest"` |
| `unreachable-branch` | `src/web/packages/host/src/providers/lhm-mapping.ts` | `"Level"` |
| `unreachable-branch` | `src/web/packages/host/src/providers/lhm-mapping.ts` | `"Voltage"` |
| `unreachable-branch` | `src/web/packages/renderer-core/src/scene/plan.ts` | `"unresolved-asset"` |

`barrel-only-export` has no row, in this run or any earlier one: the branch that
emits one has never fired in this tree, and the scanner's self-test says so — it
proves a barrel's re-export is *followed*, not that the kind can fire.

Two observations the table supports without judging either: five of the seven
`test-only-consumer` rows are named `*.test-stage.*` or `*.test-utils.*`, which
is why they are production files to the scanner and to both runners at once
(`src/web/vitest.config.ts:23-28` collects `*.test.ts(x)`, `src/web/playwright.config.ts:75`
collects `*.spec.ts`); and four of the five `"Level"`-family rows point at one
file, `host/src/providers/lhm-mapping.ts`, whose whole subject is a vendor's own
vocabulary arriving from outside the source.

### 2.2 `redundant-export`, by file

280 rows over **128 files**. Each row is one `export` keyword with no production
importer whose symbol its own file still uses; the row's own symbol names come
from re-running the command in §1, which prints them.

| Rows | File |
|---|---|
| 15 | `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-resolver.ts` |
| 14 | `src/web/packages/editor/src/new-object-defaults.ts` |
| 12 | `src/web/packages/editor/src/snap-manager/movement-snapping-resolver.ts` |
| 8 | `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts` |
| 7 | `src/web/packages/host/src/providers/lhm-launcher.ts` |
| 7 | `src/web/packages/host/src/providers/lhm-mapping.ts` |
| 6 | `src/web/packages/host/src/providers/library.ts` |
| 5 | `src/web/packages/editor/src/object-actions.ts` |
| 5 | `src/web/packages/editor/src/snap-manager/movement-snapping-runtime.ts` |
| 5 | `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-runtime.ts` |
| 5 | `src/web/packages/host/src/themes/store.ts` |
| 4 | `src/web/packages/editor/src/card-library.ts` |
| 4 | `src/web/packages/editor/src/editor-shell/shell-layout.tsx` |
| 4 | `src/web/packages/editor/src/theme-library-dialog.tsx` |
| 4 | `src/web/packages/host/src/settings/hosting.ts` |
| 4 | `src/web/packages/player/src/chrome.ts` |
| 3 | `src/web/packages/editor/src/clipboard-manager/index.ts` |
| 3 | `src/web/packages/editor/src/components/ui/colour-maths.ts` |
| 3 | `src/web/packages/editor/src/crop-manager/index.ts` |
| 3 | `src/web/packages/editor/src/editor-shell/controls/number-field.ts` |
| 3 | `src/web/packages/editor/src/indicator-manager/index.ts` |
| 3 | `src/web/packages/editor/src/new-object-panel.ts` |
| 3 | `src/web/packages/editor/src/selection-inspector/run-edits.ts` |
| 3 | `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-interaction.ts` |
| 3 | `src/web/packages/editor/src/viewport-manager/index.ts` |
| 3 | `src/web/packages/host/src/themes/trash.ts` |
| 3 | `src/web/packages/renderer-core/src/charts/line.ts` |
| 3 | `src/web/packages/scene-fabric/src/text-runs.ts` |
| 2 | `src/web/packages/editor/src/canvas-nudge.ts` |
| 2 | `src/web/packages/editor/src/display-lens.ts` |
| 2 | `src/web/packages/editor/src/editor-session.ts` |
| 2 | `src/web/packages/editor/src/editor-shell/controls/tooltip.ts` |
| 2 | `src/web/packages/editor/src/font-preview.ts` |
| 2 | `src/web/packages/editor/src/font-trios.generated.ts` |
| 2 | `src/web/packages/editor/src/image-manager/index.ts` |
| 2 | `src/web/packages/editor/src/new-fabric-theme-objects.ts` |
| 2 | `src/web/packages/editor/src/panes/document/references.tsx` |
| 2 | `src/web/packages/editor/src/panes/tokens/preset-list.tsx` |
| 2 | `src/web/packages/editor/src/persist.ts` |
| 2 | `src/web/packages/editor/src/persistence-manager/index.ts` |
| 2 | `src/web/packages/editor/src/run-placeholder.ts` |
| 2 | `src/web/packages/editor/src/selection-inspector/panel.ts` |
| 2 | `src/web/packages/editor/src/selection-inspector/per-kind-column.ts` |
| 2 | `src/web/packages/editor/src/selection-inspector/runs.tsx` |
| 2 | `src/web/packages/editor/src/selection-inspector/view.ts` |
| 2 | `src/web/packages/editor/src/shortcut-manager/index.ts` |
| 2 | `src/web/packages/editor/src/shortcut-manager/reference.ts` |
| 2 | `src/web/packages/editor/src/snap-manager/guide-renderer.ts` |
| 2 | `src/web/packages/editor/src/snap-manager/scaling/scale-projection.ts` |
| 2 | `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-controller.ts` |
| 2 | `src/web/packages/editor/src/snap-manager/scaling/text-width-resize-projection.ts` |
| 2 | `src/web/packages/editor/src/starter-backdrop.ts` |
| 2 | `src/web/packages/host/src/cli/args.ts` |
| 2 | `src/web/packages/host/src/providers/clock.ts` |
| 2 | `src/web/packages/host/src/session/pairing.ts` |
| 2 | `src/web/packages/host/src/settings/devices.ts` |
| 2 | `src/web/packages/host/src/settings/display.ts` |
| 2 | `src/web/packages/host/src/settings/theme-settings.ts` |
| 2 | `src/web/packages/player/src/artboard-crop.ts` |
| 2 | `src/web/packages/player/src/publish-follower.ts` |
| 2 | `src/web/packages/scene-fabric/src/fabric-image.ts` |
| 2 | `src/web/packages/scene-fabric/src/paint.ts` |
| 2 | `src/web/packages/scene-fabric/src/placement.ts` |
| 1 | `src/web/packages/editor/src/artboard-panel.ts` |
| 1 | `src/web/packages/editor/src/artboard-presets.ts` |
| 1 | `src/web/packages/editor/src/card-token-mapping.ts` |
| 1 | `src/web/packages/editor/src/chart-manager/index.ts` |
| 1 | `src/web/packages/editor/src/components/ui/control-choice-row.tsx` |
| 1 | `src/web/packages/editor/src/components/ui/control-well.tsx` |
| 1 | `src/web/packages/editor/src/components/ui/gradient-editor.tsx` |
| 1 | `src/web/packages/editor/src/editor-shell/bridge.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/controls/settings-field.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/icons.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/palette.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/qr-code.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/rail.tsx` |
| 1 | `src/web/packages/editor/src/editor-shell/settings.tsx` |
| 1 | `src/web/packages/editor/src/error-manager/index.ts` |
| 1 | `src/web/packages/editor/src/font-catalog-query.ts` |
| 1 | `src/web/packages/editor/src/font-catalog.ts` |
| 1 | `src/web/packages/editor/src/font-specimen-cache.ts` |
| 1 | `src/web/packages/editor/src/grouping-manager/index.ts` |
| 1 | `src/web/packages/editor/src/indicator-manager/cursor-indicator.ts` |
| 1 | `src/web/packages/editor/src/layer-manager/index.ts` |
| 1 | `src/web/packages/editor/src/new-document-chooser.tsx` |
| 1 | `src/web/packages/editor/src/new-fabric-theme-globals.ts` |
| 1 | `src/web/packages/editor/src/new-fabric-theme-icons.ts` |
| 1 | `src/web/packages/editor/src/new-fabric-theme.ts` |
| 1 | `src/web/packages/editor/src/object-lock-manager/index.ts` |
| 1 | `src/web/packages/editor/src/palette-manager/index.ts` |
| 1 | `src/web/packages/editor/src/panes/add/file-section.tsx` |
| 1 | `src/web/packages/editor/src/panes/composition/composition-pane.tsx` |
| 1 | `src/web/packages/editor/src/panes/document/artboard-fields.tsx` |
| 1 | `src/web/packages/editor/src/panes/document/document-pane.tsx` |
| 1 | `src/web/packages/editor/src/panes/document/metadata-fields.tsx` |
| 1 | `src/web/packages/editor/src/publish-client.ts` |
| 1 | `src/web/packages/editor/src/selection-inspector/appearance.ts` |
| 1 | `src/web/packages/editor/src/selection-inspector/bleed.ts` |
| 1 | `src/web/packages/editor/src/selection-inspector/column.tsx` |
| 1 | `src/web/packages/editor/src/selection-inspector/glass.ts` |
| 1 | `src/web/packages/editor/src/selection-inspector/index.ts` |
| 1 | `src/web/packages/editor/src/selection-inspector/style.ts` |
| 1 | `src/web/packages/editor/src/shortcut-manager/display.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/excluded-objects.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/guide-painting.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/index.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/movement-spacing-correction.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/scaling/scale-snap-candidates.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/scaling/text-width-resize-controller.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/scaling/text-width-resize-measurer.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/spacing-chains.ts` |
| 1 | `src/web/packages/editor/src/text-manager/index.ts` |
| 1 | `src/web/packages/editor/src/theme-library-manager/index.ts` |
| 1 | `src/web/packages/editor/src/viewport-manager/navigation.ts` |
| 1 | `src/web/packages/editor/src/viewport-manager/pan-bounds.ts` |
| 1 | `src/web/packages/host/src/providers/lhm.ts` |
| 1 | `src/web/packages/host/src/providers/library-devices.ts` |
| 1 | `src/web/packages/host/src/serve/published.ts` |
| 1 | `src/web/packages/host/src/settings/font-favorites.ts` |
| 1 | `src/web/packages/host/src/themes/templates.ts` |
| 1 | `src/web/packages/player/src/load-failure.ts` |
| 1 | `src/web/packages/renderer-core/src/charts/fill.ts` |
| 1 | `src/web/packages/renderer-core/src/charts/grid.ts` |
| 1 | `src/web/packages/renderer-core/src/theme/document.ts` |
| 1 | `src/web/packages/renderer-core/src/theme/envelope-keys.ts` |
| 1 | `src/web/packages/scene-fabric/src/background-media.ts` |
| 1 | `src/web/packages/scene-fabric/src/chart-refresh.ts` |
| 1 | `src/web/packages/scene-fabric/src/fabric-text.ts` |

## 3. What this run cannot see

Two trees are read by this scanner and by no gate, so the honest statement is
what it can and cannot see in them — not that they were checked.

### 3.1 `src/web/tests/e2e/**` — read as importers, never reported

48 files, all `.ts`, and all 48 are in the scanned set. **No row in this
document names a file under `src/web/tests/`**, in any kind, and neither does any
unresolved-specifier row. That is not an accident of this run: `isTestFile`
(`scripts/dead-code-sweep.mjs:327-328`) calls every path under that prefix a test
file, and the candidate loop skips a test file outright
(`scripts/dead-code-sweep.mjs:666`).

So the scanner reads the tree **only as importers**, and that half works: 13 of
the 48 are imported by their siblings — `canvas-probe.ts`, `clock.ts`,
`control-set.ts`, `editor-canvas.ts`, `editor-rail.ts`, `glass-fixture.ts`,
`glass-probe.ts`, `host-theme.ts`, `mockup-values.ts`, `rebuild-composition.ts`,
`rebuild-driver.ts`, `shell-palette.ts`, `surface.ts` — and each of those edges
keeps a production module live, which is exactly how a production module only a
spec imports lands in `test-only-consumer`. The remaining 35 have no importer at
all; 33 are `.spec.ts` and one `mockup-values.test.ts`, discovered by a glob, and
the last is `global-setup.ts`, reached only by
`src/web/playwright.config.ts`'s `globalSetup`.

What it cannot see there:

- **Anything inside the tree.** A helper under `tests/e2e/` that no spec imports
  is itself a test file, so it is skipped as a candidate and produces no row —
  the 35 unimported files above are the shape of that blind spot, and only the
  globs and the config say whether a given one is reached.
- **Whether a file is collected at all.** The scanner does not read the runners'
  rules; it substitutes the blanket prefix rule, which is broader than either
  glob (`playwright.config.ts:68-75`, `vitest.config.ts:23-28`). A file in this
  tree that no runner collects is a test file to this scanner and invisible
  either way.
- **The tree's own correctness.** No tsconfig includes `src/web/tests`, so
  nothing type-checks it (`vg-192`: `npm run typecheck` is
  `--workspaces --if-present`, `tests/` is not a workspace, there is no
  `src/web/tsconfig.json` and no `tests/tsconfig.json`, and the seven package
  configs include `src/**/*.ts` relative to their own directories). The only
  reader is this regex-based graph, and it parses text: a type error, and a
  specifier composed at runtime, are both silent here.

### 3.2 `.mjs` — read by the scanner, analysed by nothing else

11 `.mjs` files are in the scanned set: the ten root `scripts/*.mjs` and
`src/web/scripts/generate-font-trios.mjs`. Eight tracked ones are outside it —
`docs/product/probes/*.mjs` (6) and `src/web/packages/{host,player}/scripts/*.mjs`
(2) — because the walk's roots are `src/web/packages/*/src`, `src/web/tests`,
`src/web/scripts` and root `scripts/`
(`scripts/dead-code-sweep.mjs:294-315`), and dot-prefixed directories are skipped
outright (`:286`).

No gate reads a `.mjs` as source: `biome.json`'s
`files.includes` is `src/web/**/*.{ts,tsx,json,css}`, which is the filter both
`biome format ..` and `biome lint ..` run under, and no tsconfig includes
`scripts/`. Nothing analyses one — CI *executes* two paths
(`.github/workflows/ci.yml` runs `node packages/player/scripts/check-size.mjs`,
and `src/web/tests/scripts/design-md.test.ts:8` imports
`../../../../scripts/design-md.mjs`), and nothing runs this scanner's own
self-test (`vg-379`).

Inside the candidate space that means:

- Every root `scripts/*.mjs` is an entry point (`isScriptOrConfig`, `:382`), so a
  script is never a candidate container and an unused export inside one is never
  a row.
- `isScriptOrConfig`'s `(vite|playwright|vitest).config.ts` alternatives, and its
  `packages/*/scripts/*.mjs` alternative, can match nothing: no such file is in
  the scanned set. Verified — none of the ten `.config.ts` files under `src/web`
  (`playwright{,.display,.glass-shapes,.parity,.rebuild}.config.ts`,
  `vitest.config.ts`, and the four `packages/*/vite.config*.ts`) and neither
  package script is walked, so the unreachability costs no false candidate today
  and would hide a real one only if a config ever moved under a walked root.
- `.js` is in no scanned set at all, since `SCANNED_EXT` is `\.(ts|tsx|mjs)$`
  (`:276`). The two `.js` files under `src/web` are therefore unmodelled:
  `packages/host/bin/vigilia.js`, whose hardcoded entry-point line (`:343`) is
  inert — it imports only `node:` builtins and a `URL`, so no edge is lost — and
  `packages/host/public/theme-list.js`, which appears below as an unresolved
  specifier.

### 3.3 The five unresolved specifiers

Each one hides a file's importer, and the run lists them. Four point at files the
scanner does not model and which do exist — `editor-shell.css` (103 KB) and
`starter-backdrop.jpg` (428 KB), both imported with an extension or a `?url`
suffix, and `packages/host/public/theme-list.js`:

```
src/web/packages/editor/src/control-fixture.tsx -> ./editor-shell/editor-shell.css
src/web/packages/editor/src/editor-main.ts -> ./editor-shell/editor-shell.css
src/web/packages/editor/src/starter-backdrop.ts -> ./starter-backdrop.jpg?url
src/web/packages/host/src/theme-list.dom.test.ts -> ../public/theme-list.js
```

The fifth is a false edge rather than a hidden importer:

```
src/web/scripts/generate-font-trios.mjs -> ./font-catalog.js
```

That line (`:285`) sits inside the template literal that emits
`packages/editor/src/font-trios.generated.ts`; the emitted file carries the same
specifier at its `:19`, where it resolves to
`packages/editor/src/font-catalog.ts`, which declares `FontTrioRole` at its `:4`.
The scanner does not blank template literals (`stripComments`, `:508-509`), so a
string of emitted source text is read as this file's own import. It resolved to
nothing here; a specifier that did resolve would put a phantom importer on its
target.

## 4. Reproducing

From the repository root, on a clean tree:

```
git rev-parse HEAD          # aa9d7b96 for the numbers above
node scripts/dead-code-sweep.mjs --json <scratch>/candidates.json
node scripts/dead-code-sweep.mjs --self-test   # separate invocation; expect 22/22
```

Then, for a run at a new HEAD: `scanned`, `countsByKind`, `countsByPackage`,
`unreachableBranchDistinctLiterals` and `unresolvedRelativeSpecifiers` are the
fields this document's §1 and §3 quote, and `candidates` holds every row with the
search that found it.
