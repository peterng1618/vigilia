# Dead-code candidates

The export-and-module half of the dead-code sweep's reference picture: every
candidate `scripts/dead-code-sweep.mjs` reported at `f7900f5c`, with the search
that found each kind, so the removal phase works from a list rather than from an
instinct. First taken 2026-10-12 on `develop` at `aa9d7b96`, and refreshed the
same day at `f7900f5c` once Phase 3's two removal tasks had landed — §1.3 states
that delta, which is the only thing that changed in this document's numbers. The
other half — which stylesheet selectors the product still reaches — is
[`dead-selectors.md`](dead-selectors.md), taken at `a7ef0c3a`.

**These are candidates, not verdicts, and this document modifies nothing** — no
file was deleted, and no row here has been re-established as dead. The scanner's
own header names the reason (`scripts/dead-code-sweep.mjs:14-22`): the
false-positive engine in this repository is *string-resolved vocabulary* —
`data-vigilia-*` attributes, `--vigilia-*`/`--shell-*` custom properties,
`KIND_*` registries, Fabric JSON keys, classes composed by template literal —
all of which are live with no importer anywhere, and none of which this graph can
see. `dead-export` and `redundant-export` are deliberately separate kinds because
their remedies are opposite: deleting a declaration versus deleting one
`export` keyword (`scripts/dead-code-sweep.mjs:33-39`).

## 1. The run

```
node scripts/dead-code-sweep.mjs                  # candidate report to stdout
node scripts/dead-code-sweep.mjs --json <path>    # the same report to a JSON file
node scripts/dead-code-sweep.mjs --self-test      # the scanner's own checks, non-zero on failure
```

The run that produced this document: `node scripts/dead-code-sweep.mjs --json
<scratch>/task6-candidates-final.json` at `f7900f5c`, exit 0, writing
`incomplete: false` — which is what the script's own endorsed predicate
(`isCompletePass`) requires, and is not the `0/0` marker that a bare
`passed === total` would read as a vacuous pass. Two runs made it: one at
`86398b1f` and one at `f7900f5c`, identical in `scanned`, `countsByKind`,
`countsByPackage` and `unreachableBranchDistinctLiterals`, which is the
reproducibility this document can claim. And a separate `--self-test` invocation
reporting **22/22 passed** (exit 0), read from
`src/web/test-results/dead-code-sweep-self-test.json`, which is gitignored and
therefore not evidence a clone carries. The self-test is run in its own
invocation because its result has its own fixed destination. That `--self-test
--json <path>` once overwrote the candidate report is **corroborated, not
reproduced**: it is fixed, so no run at HEAD demonstrates it, and the evidence is
the source comment recording the regression (`scripts/dead-code-sweep.mjs:1097-1105`),
commit `93c4f704`'s message, and the self-test check that reads the report back
after the self-test ran (`:1126-1129`) — which is what now fails if the two
destinations ever merge again.

Nothing runs the scanner for you: no `package.json` script and no CI job names
it (`vg-379` — the self-test that no command runs), so these numbers are
reproducible by hand or not at all. The JSON is written outside the repo on
purpose; this document is the artefact a clone keeps.

**Scanned: 596 files** — 303 production, 293 test — from four roots:
`src/web/packages/*/src` (537), `src/web/tests` (49), `src/web/scripts` (1) and
root `scripts/` (10).

### 1.1 By kind

| Kind | Rows | What the row asks a phase to decide |
|---|---|---|
| `test-only-consumer` | **7** | A module every importer of which is a test file — mount it or delete it |
| `no-importer-file` | **0** | A module nothing imports, entry points and runner globs set aside |
| `dead-export` | **8** | A symbol nothing imports *and* whose own file never uses — a declaration to delete |
| `redundant-export` | **83** | A symbol nothing imports but whose own file *does* use — one keyword to delete, **never the symbol** |
| `barrel-only-export` | **0** | An export reached only through its own package barrel and taken from there by nobody — **this zero is a detector limit, not a count**: the tier cannot fire at all, see §3.4 and `vg-386` |
| `unreachable-branch` | **9** | A closed union's member whose literal appears nowhere else — **7 distinct literals**, since `"image-cover"` and `"scale-montage"` are each declared in two files |
| **Total** | **107** | A floor rather than a measurement: the tier above cannot fire, and a corrected detector reports 133 more (§3.4) |

### 1.2 By package

| Package | Rows | `test-only-consumer` | `no-importer-file` | `dead-export` | `redundant-export` | `unreachable-branch` |
|---|---|---|---|---|---|---|
| `editor` | 75 | 6 | — | 5 | 59 | 5 |
| `host` | 22 | — | — | — | 18 | 4 |
| `renderer-core` | 5 | — | — | 3 | 2 | — |
| `scene-fabric` | 1 | 1 | — | — | — | — |
| `player` | 4 | — | — | — | 4 | — |
| `tests` / `scripts` / root | 0 | — | — | — | — | — |

Every row names a file under `src/web/packages/`; the `(tests)`, `(scripts)` and
`(root)` buckets are empty, which is §3's subject as much as it is a count.

### 1.3 The delta since the first run, and what caused it

**312 rows → 107, and 205 of them went in Phase 3's two removal tasks, both of
which named every row they removed and reported no removal falsified by its
review.** The file count fell by one, and it is the same one: `aa9d7b96` scanned
597 files, `f7900f5c` scans 596, and the difference is
`src/web/packages/editor/src/button.ts`, deleted with its whole module.

By kind:

| Kind | at `aa9d7b96` | at `f7900f5c` | Δ |
|---|---|---|---|
| `test-only-consumer` | 7 | 7 | 0 |
| `no-importer-file` | 1 | 0 | −1 |
| `dead-export` | 14 | 8 | −6 |
| `redundant-export` | 280 | 83 | −197 |
| `barrel-only-export` | 0 | 0 | 0 — both zeros are the unreachable tier of §3.4, not a measurement that nothing changed |
| `unreachable-branch` | 10 (8 distinct literals) | 9 (7 distinct) | −1 |

By package:

| Package | at `aa9d7b96` | at `f7900f5c` | Δ | Owner |
|---|---|---|---|---|
| `editor` | 224 | 75 | −149 | Task 4 |
| `host` | 53 | 22 | −31 | Task 5 |
| `renderer-core` | 13 | 5 | −8 | Task 5 |
| `player` | 9 | 4 | −5 | Task 5 |
| `scene-fabric` | 13 | 1 | −12 | Task 5 |

What the two tasks removed, by commit:

- **`11029413` (Task 4)** — five editor confirmations: the module `button.ts`
  (90 lines, 5 exports) and the symbols `RunBindingPort`, `ScaleSnapEnvironment`,
  `AnchorBuckets` and `CENTERING_STEP`.
- **`93bb2c5f` (Task 4)** — 143 `export` keywords over 74 files, plus one
  declaration that needed more than a keyword: `new-fabric-theme-globals.ts`'s
  `panel`, a `redundant-export` row whose only in-file "use" was the object key
  `panel:` in `starterPalette` (`vg-382`'s first instance; `noUnusedVariables`
  caught it once the keyword came off).
- **`47658230` (Task 5)** — 51 `export` keywords over 26 files in `host`,
  `player`, `renderer-core` and `scene-fabric`.
- **`c9ed9dcc` (Task 5)** — `ConvertibleFamily`
  (`renderer-core/src/scene/measurement.ts`), `CAPABILITY_TYPES` with its
  `NODE_TYPES` import (`renderer-core/src/theme/capabilities.ts`), and the
  `export { countable, EDGE_TOLERANCE }` re-export in `player/src/artboard-crop.ts`
  — both names reachable from `@vigilia/scene-fabric`'s own barrel, which is
  where every other consumer takes them from.
- **`fd32a420` (Task 5)** — the `"unresolved-asset"` member of
  `renderer-core/src/scene/plan.ts`'s `PlanIssue.code`, the sweep's one
  `unreachable-branch` removal.

Two things did **not** move, and their staying still is part of the picture.
`test-only-consumer` is unchanged at 7: the removal tasks kept every one of them
deliberately — five are shared test helpers under `src/` whose basenames miss
both runners' globs, and `font-picker/font-picker.tsx` is the decision case the
register already holds twice (`vg-268`, `vg-283`). `barrel-only-export` is **0 because the tier cannot fire at all**, and that is a
detector incapability rather than a measurement that this tree has none. §3.4
gives the mechanism, the 133 rows a corrected filter reports, and why the zero
may not be read either way; `vg-386` owns it.

**Verdicts are not in this table.** A surviving row is not a claim that the
symbol is dead; several of §2.1's rows are deliberate keeps or decisions whose
reasons were established during Phase 3 and recorded in that plan's workspace,
which a clone does not carry. What a clone can check is the row's existence at
`f7900f5c` and the search in §4 that reproduces it.

## 2. The rows

### 2.1 The five kinds that are not `redundant-export`

24 rows, the same set §1.1 counts.

| Kind | File | Symbol |
|---|---|---|
| `test-only-consumer` | `src/web/packages/editor/src/accessible-name.ts` | — |
| `test-only-consumer` | `src/web/packages/editor/src/chart-manager/chart-stage.test-stage.tsx` | — |
| `test-only-consumer` | `src/web/packages/editor/src/font-picker/font-picker.tsx` | — |
| `test-only-consumer` | `src/web/packages/editor/src/selection-inspector/idle-crop.test-stage.ts` | — |
| `test-only-consumer` | `src/web/packages/editor/src/selection-inspector/runs.test-stage.tsx` | — |
| `test-only-consumer` | `src/web/packages/editor/src/snap-manager/movement-snapping-core.test-utils.ts` | — |
| `test-only-consumer` | `src/web/packages/scene-fabric/src/glass-test-stage.ts` | — |
| `dead-export` | `src/web/packages/editor/src/editor-shell/controls/settings-field.ts` | `settingsField` |
| `dead-export` | `src/web/packages/editor/src/editor-shell/icons.ts` | `KIND_GLYPHS` |
| `dead-export` | `src/web/packages/editor/src/font-specimen-cache.ts` | `createSpecimenCache` |
| `dead-export` | `src/web/packages/editor/src/font-trios.generated.ts` | `GENERATED_SOURCE_REVISION` |
| `dead-export` | `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts` | `projectRectangularScaleBounds` |
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

Five of the seven `test-only-consumer` rows carry `test-stage` or `test-utils` in
their basename — `chart-stage.test-stage.tsx`, `idle-crop.test-stage.ts`,
`runs.test-stage.tsx`, `movement-snapping-core.test-utils.ts` and
`glass-test-stage.ts` — and that is why they are production files to the scanner
and to both runners at once: `src/web/vitest.config.ts:23-28` collects
`*.test.ts(x)` and `src/web/playwright.config.ts:75` collects `*.spec.ts`, and a
basename that merely contains `test-stage` matches neither. Four of the nine
`unreachable-branch` rows still point at one file,
`host/src/providers/lhm-mapping.ts`, whose whole subject is a vendor's own
vocabulary arriving from outside the source, and the kind's own evidence prose
documents both of these as **decisions rather than deletions** — a variant
produced or read through a composed string, and a value arriving from outside the
source. That is why they read as rows and not as work.

Two of the nine `unreachable-branch` rows are **closed**: the literals
`"image-cover"` and `"scale-montage"`, declared in `editor-interaction.ts` and
`image-manager/index.ts`, were `importImage`'s inert `scale` option and went with
its removal (`vg-381`, `678efef9`). The whole union is gone, so no branch of it is
unreachable any more.

Two rows in this table are known to be a downstream question rather than a
candidate: `settingsField` is `vg-342` (which names both remedies and says the
doc half's cause is not established), and `createSpecimenCache`'s only production
consumer would be `font-picker/font-picker.tsx`, the `vg-268`/`vg-283` decision.
Neither was settled by the removal phase, and neither is this document's to
settle.

### 2.2 `redundant-export`, by file

83 rows over **52 files**. Each row is one `export` keyword with no production
importer whose symbol its own file still uses; the row's own symbol names come
from re-running the command in §1, which prints them. One caution the removal
phase learned twice: this tier counts a **declaration-shaped occurrence** as a
use, so an object-literal property key and a re-export statement both read as
"LIVE" for a symbol with no reader (`vg-382`).

| Rows | File |
|---|---|
| 6 | `src/web/packages/editor/src/new-object-defaults.ts` |
| 4 | `src/web/packages/editor/src/theme-library-dialog.tsx` |
| 4 | `src/web/packages/host/src/providers/library.ts` |
| 3 | `src/web/packages/editor/src/editor-shell/shell-layout.tsx` |
| 3 | `src/web/packages/editor/src/new-object-panel.ts` |
| 3 | `src/web/packages/editor/src/object-actions.ts` |
| 3 | `src/web/packages/editor/src/snap-manager/scaling/rectangular-scale-gesture-projection.ts` |
| 3 | `src/web/packages/host/src/providers/lhm-launcher.ts` |
| 3 | `src/web/packages/player/src/chrome.ts` |
| 2 | `src/web/packages/editor/src/card-library.ts` |
| 2 | `src/web/packages/editor/src/indicator-manager/index.ts` |
| 2 | `src/web/packages/editor/src/persistence-manager/index.ts` |
| 2 | `src/web/packages/editor/src/selection-inspector/per-kind-column.ts` |
| 2 | `src/web/packages/editor/src/shortcut-manager/index.ts` |
| 2 | `src/web/packages/editor/src/viewport-manager/index.ts` |
| 2 | `src/web/packages/host/src/settings/display.ts` |
| 2 | `src/web/packages/host/src/themes/trash.ts` |
| 1 | `src/web/packages/editor/src/artboard-panel.ts` |
| 1 | `src/web/packages/editor/src/canvas-nudge.ts` |
| 1 | `src/web/packages/editor/src/chart-manager/index.ts` |
| 1 | `src/web/packages/editor/src/clipboard-manager/index.ts` |
| 1 | `src/web/packages/editor/src/components/ui/colour-maths.ts` |
| 1 | `src/web/packages/editor/src/crop-manager/index.ts` |
| 1 | `src/web/packages/editor/src/display-lens.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/icons.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/palette.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/qr-code.ts` |
| 1 | `src/web/packages/editor/src/editor-shell/rail.tsx` |
| 1 | `src/web/packages/editor/src/editor-shell/settings.tsx` |
| 1 | `src/web/packages/editor/src/font-catalog.ts` |
| 1 | `src/web/packages/editor/src/image-manager/index.ts` |
| 1 | `src/web/packages/editor/src/new-document-chooser.tsx` |
| 1 | `src/web/packages/editor/src/new-fabric-theme-icons.ts` |
| 1 | `src/web/packages/editor/src/palette-manager/index.ts` |
| 1 | `src/web/packages/editor/src/panes/tokens/preset-list.tsx` |
| 1 | `src/web/packages/editor/src/selection-inspector/column.tsx` |
| 1 | `src/web/packages/editor/src/selection-inspector/glass.ts` |
| 1 | `src/web/packages/editor/src/shortcut-manager/display.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/excluded-objects.ts` |
| 1 | `src/web/packages/editor/src/snap-manager/scaling/scale-snapping-resolver.ts` |
| 1 | `src/web/packages/editor/src/starter-backdrop.ts` |
| 1 | `src/web/packages/editor/src/viewport-manager/pan-bounds.ts` |
| 1 | `src/web/packages/host/src/cli/args.ts` |
| 1 | `src/web/packages/host/src/providers/clock.ts` |
| 1 | `src/web/packages/host/src/providers/library-devices.ts` |
| 1 | `src/web/packages/host/src/session/pairing.ts` |
| 1 | `src/web/packages/host/src/settings/devices.ts` |
| 1 | `src/web/packages/host/src/settings/font-favorites.ts` |
| 1 | `src/web/packages/host/src/settings/theme-settings.ts` |
| 1 | `src/web/packages/player/src/load-failure.ts` |
| 1 | `src/web/packages/renderer-core/src/charts/fill.ts` |
| 1 | `src/web/packages/renderer-core/src/theme/envelope-keys.ts` |

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
the 14 non-spec files are imported by their siblings — `canvas-probe.ts`,
`clock.ts`, `control-set.ts`, `editor-canvas.ts`, `editor-rail.ts`,
`glass-fixture.ts`, `glass-probe.ts`, `host-theme.ts`, `mockup-values.ts`,
`rebuild-composition.ts`, `rebuild-driver.ts`, `shell-palette.ts`, `surface.ts` —
and each of those edges keeps a production module live, which is exactly how a
production module only a spec imports lands in `test-only-consumer`. The other 35
have no importer at all; 33 are `.spec.ts` and one `mockup-values.test.ts`,
discovered by a glob, and the last is `global-setup.ts`, reached only by
`src/web/playwright.config.ts`'s `globalSetup`. Re-checked at `f7900f5c` by
reading every `from "./…"` in the tree rather than by trusting this paragraph, so
no file in this tree is unreached.

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
- **A helper's own exports.** A symbol exported from a helper file and imported
  by nothing is not a row, because the file that declares it is skipped. A human
  pass over the tree at `f7900f5c` found 13 such names — `SceneRead`, `HandleKey`
  and `LocalFile` in `editor-canvas.ts`, `BANDS` and `GlassTarget` in
  `glass-probe.ts`, the six per-region builders plus `buildWordmarkAndClock` in
  `rebuild-composition.ts`, and `addButton` in `rebuild-driver.ts` — and left
  every one of them: each is named in an exported signature of its own module or
  is a step of a builder its module's header documents as the region specs'
  interface, so the keyword is the module's stated shape rather than litter. The
  same pass found one genuinely orphaned declaration, `clock.ts`'s `openPaused`,
  which no file calls since `display-fabric.spec.ts` and `player-chrome.spec.ts`
  were deleted by `ad94e5ed`; it is kept as the composition `vg-347`'s
  rebuilding case names, and it is the one row here that no scanner will ever
  report.

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
  a row. **A human pass, because nothing else would look, found one dead local
  declaration and two unused import specifiers across the ten and removed them in
  `7bff97a1`** — `sdd-checkpoint.mjs`'s `isActivePlan` (whose body is written
  inline in `recoveryState`, the caller that survived) and the unused
  `readdirSync`/`statSync` and `dirname` imports of `ownership-overlap.mjs` and
  `ownership-sweep.mjs`. It also left every script's exported surface alone: the
  exported names are used by their own file's self-test, and `design-tokens.mjs`'s
  self-test *probes* its `check` export through a spawned importer, so the export
  keyword is the interface rather than a leftover.
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

### 3.4 `barrel-only-export` — the tier cannot fire, so its zero is not a count

The most important limit in this document, because it is the one that made a
number look like a measurement. `scripts/dead-code-sweep.mjs:705` is
`if (prodConsumers.length > 0) continue;`, and it runs **before** the
`barrel-only-export` branch at `:708`. A file's own package barrel reaches it by
a re-export edge the scanner does follow, and the barrel is not a test file — so
`prodConsumers` is non-empty for exactly the shape `:708` exists to report, and
its condition can only ever be evaluated when it is already false. **The tier
cannot fire for any input.** That is structural, not a property of this tree: an
unexercised kind might fire tomorrow, this one cannot fire at all.

**A corrected detector changes the picture, and the correction is one filter.**
Excluding the file's own barrel from `prodConsumers`, then running over the same
tree at `93fa9a5a`, reports **240 candidates** — `barrel-only-export` **133**,
with the other four kinds at exactly their counts above (8, 83, 7 and 9). The 133
are therefore pure additions and none of the 107 reclassifies. By package:
editor 1, fake-source 2, host 21, renderer-core 91, scene-fabric 18.

**Two defensible definitions, which is why this is filed rather than corrected
here.** The plan's literal wording — the only importer is the barrel, tests
included — yields **76**, the rows whose evidence names no test importer. The
code's own intent at `:708` — no *production* consumer other than the barrel,
test consumers disclosed in the row — yields all **133**. Both were measured: 76
rows have an empty test-importer list and 57 name test importers. Deciding which
the tier means is a decision, and a corrected detector emits 133 unverified
candidates whose adjudication is a sweep of its own.

**Reproducing this section, because its numbers come from a filter and not from
the command in §4.** Copy `scripts/dead-code-sweep.mjs` to a directory *outside*
the repo, set its `ROOT` constant to the absolute repo path, and change the one
filter that decides `prodConsumers` so the file's own barrel is excluded from it
(`!isTestFile(file_) && file_ !== barrel`), then run it with `--json`. The
unmodified scanner reports the 107 of §1.1; the corrected one reports 240, and
the difference is this tier. **The `ROOT` pin is not optional**: the script
resolves its own root from its file URL, so an unpinned copy scans its own
parent directory and reports zero candidates without failing.

**Nothing here is a verdict and nothing may be deleted on this section alone.**
renderer-core's 91 (49 strict, 42 test-consumed) is consistent with a private
library barrel wider than its consumers, but no row was adjudicated, and the
string-resolved vocabulary this repo resolves at runtime is invisible to the
graph (§3). The removals the sweep made are unaffected: none of them was reported
by this tier, so they stand. What does not stand is the picture — **§1's total is
a floor, not a measurement of what remains**, and `vg-386` records the defect.

## 4. Reproducing

From the repository root, on a clean tree:

```
git rev-parse HEAD          # f7900f5c for the numbers above
node scripts/dead-code-sweep.mjs --json <scratch>/candidates.json
node scripts/dead-code-sweep.mjs --self-test   # separate invocation; expect 22/22
```

Then, for a run at a new HEAD: `scanned`, `countsByKind`, `countsByPackage`,
`unreachableBranchDistinctLiterals` and `unresolvedRelativeSpecifiers` are the
fields this document's §1 and §3 quote, and `candidates` holds every row with the
search that found it. The first run's numbers are §1.3's left-hand columns, and
they were taken at `aa9d7b96`.
