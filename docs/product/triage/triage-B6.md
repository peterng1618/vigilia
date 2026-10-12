# Triage B6 — `vg-344` … `vg-386`

Reproduction pass, batch B6. **Ids owned: 39. Verdicts written: 39.** Every row sorted into
`closes` / `decision` / `work` / `parked`. Nothing here is fixed and nothing is closed — this is a
read pass whose every verdict carries the command or `file:line` that produced it. Written at
`87cc2311`. **No browser run was made** (Ruling 3): rows whose verdict needs one are `work`, with the
spec path, `--grep` value and build command recorded, and marked *not run — deferred*.

Build command for every deferred row: `cd src/web && npm run build` (builds the player, editor and
host bundles the Playwright `webServer` previews at 4173/4174 and the host app; the plan adds
`npm run build:fixture -w @vigilia/editor` where a fixture is needed).

## Summary

| Verdict | Count | Ids |
|---|---|---|
| `closes` | 1 | vg-349 |
| `decision` | 15 | vg-348, vg-350, vg-352, vg-354, vg-355, vg-363, vg-366, vg-368, vg-372, vg-373, vg-379, vg-380, vg-381, vg-382, vg-386 |
| `work` | 23 | vg-344, vg-346, vg-347, vg-353, vg-356, vg-357, vg-359, vg-360, vg-361, vg-362, vg-364, vg-365, vg-367, vg-369, vg-370, vg-371, vg-374, vg-376, vg-377, vg-378, vg-383, vg-384, vg-385 |
| `parked` | 0 | — |

**Deferred to a serialised browser follow-up: 8** — vg-346, vg-347, vg-359, vg-360, vg-361, vg-362,
vg-370, vg-376.

`parked` is 0 for this batch and the reason is structural, not a judgement: the row the plan's Task 6
note calls parked (`vg-330`, with `vg-331` as the decision the user already named) is **not in this
batch's authoritative list** — the controller's B5 list owns `vg-325`…`vg-343`. B6 starts at `vg-344`.
Nothing in B6 is a user park, so no `parked` verdict exists to write here. See the report.

## The table

| id | verdict | evidence | theme |
|---|---|---|---|
| vg-344 | `work` | `widget.ts:60-63` `sanitizeId` = `value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 64)` then `STABLE_ID_PATTERN.test(cleaned) ? cleaned : ""`; `document.ts:11` `STABLE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/`; `grep -n sanitizeId widget.ts` → `:34` (only call site) and `:60` (definition); `git grep -ln WidgetIssue` → `card-library.ts`, `clipboard-manager/index.ts` | the empty-string branch is provably unreachable — delete it with the union member across two callers |
| vg-346 | `work` | `git grep -n -- "mtr" -- src/web/tests` → **no hits**; `grep -rni "rotat" src/web/tests/e2e/*.ts` → authored or bridge-written angles only (`glass-authoring.spec.ts:88` comment, `reference-theme.spec.ts:2345`, `host-player.spec.ts:2200`), never a gesture; `controls-manager/index.test.ts:13` `snapAngle === 1`, `:28`, `:64-68` mtr handle | the canvas rotation gesture is the one thing no test performs. Deferred browser: **new case** in `src/web/tests/e2e/editor.spec.ts` (no existing `--grep`; the deleted block was `shows the rotation-angle indicator beside the pointer mid-rotation`); build `cd src/web && npm run build`; **not run — deferred** |
| vg-347 | `work` | `git grep -n openPaused src/web` → 1 hit, its declaration `tests/e2e/clock.ts:124`; `installFixedClock` called at `editor.spec.ts:4425` and `:4508` (the row's 4413/4496 have moved); `grep -rn "Buffer.compare" src/web/tests/e2e/` → **none** | frame determinism is unmeasured while `clock.ts` is live. Deferred browser: **new case** over the `tests/e2e/host-theme.ts` fixture; build `cd src/web && npm run build`; **not run — deferred** |
| vg-348 | `decision` | `fabric-envelope-validate.ts:96` calls `chartPaintReferences`, whose doc at `:513` is "Chart settings are semantic authored paint"; `grep -n settings schema/theme-document.schema.json` → **no hits** | no path validates a chart scalar on the envelope or in the schema |
| vg-349 | `closes` | read `snap-manager/index.ts`: the bindings array has one `["object:moving", runStep]`, `runStep` (`:240-330`) is uniform, and `startGesture`'s only branch is ActiveSelection eligibility (`:206-210`) | one route for every drag — a lone object and a composed selection differ in input geometry, not in path, which is the row's own close condition |
| vg-350 | `decision` | `docs/design/mockups/current/settings.html:82` `background:linear-gradient(145deg,#d8ebe4,#afd4d1)`; `mockup-values.ts:1089,1102,1115,1127,1139` five `background-color` rows (editorial/graphite/ember/moss/plum); `:1082-1087` comment names the missing gradient comparator | the light ground is the one bar no row reads |
| vg-352 | `decision` | `scripts/design-md.mjs:76` `CITE_TREES`, `:85` `CITE_EXTENSIONS`, `:92` `CITE_EXCLUDE` filter by tree and extension with no notion of which document speaks; rule-3 text `:435-436`; `requirements.md:20` `## §7 — Product and scope` | §1–§10 is a shared namespace with no per-document claim filter |
| vg-353 | `work` | `npm ls source-map-js` (from `src/web`) → `1.2.1` only through `vite@8.3.0 → postcss@8.5.28` and `@tailwindcss/vite@4.3.3`; `npm audit --json` → `{"high":1}` against `source-map-js` | a build-tool advisory that predates the work and is not the new dep's; a bump with its own verification |
| vg-354 | `decision` | `grep -n fontFamily DESIGN.md` → `:23,27,31,35,39,43` (six entries); `grep -rn -- "--font" src/web/packages/editor/src/editor-shell/editor-shell.css` → **no hits** | the front-matter `fontFamily` is owned by nothing |
| vg-355 | `decision` | `grep -rn -E 'design:check\|gates:self-test\|design:md\|design-tokens' .github/workflows/ .claude/settings.json` → **no matches**; both scripts exist at `src/web/package.json:33-34` | two gates wired and green that nothing runs |
| vg-356 | `work` | `design-md.mjs:460` prefix test `if (expected.every((heading, i) => path[i] === heading)) continue;`; spec mapping `docs/superpowers/specs/2026-10-10-design-md-replaces-the-bible-design.md:181` maps `## Components` → `§5`, `§6`; `DESIGN.md:396` `## Components`, `:491` `### Icons`, `:493` `<!-- §6 -->` | a bare-`##` mapping admits any subsection of the mapped section |
| vg-357 | `work` | `editor-shell.css:60-88` comment and `:90` `@media (prefers-color-scheme: dark)` omitting `--shell-display`, `--shell-flat`, `--vigilia-control-bg`; bare root declares the first two at `:71-72`; palette blocks declare `--vigilia-control-bg` individually (`:214,263,307,335,363`) | a dark OS's first frame takes graphite ground with editorial's display face and control paper |
| vg-359 | `work` | `editor.spec.ts:1107` test `ships the starter's frosted CPU card, reads it live, and round-trips it`, clicking `[data-vigilia-layer="cpu-card"]` at `:1131` | the starter card never appears; the capture is stale on graphite. Deferred browser: `npx playwright test tests/e2e/editor.spec.ts --project=desktop-chromium --grep "frosted CPU card" --workers=1`; build `cd src/web && npm run build`; **not run — deferred** |
| vg-360 | `work` | `glass-authoring.spec.ts:293` test `offers no empty radius to read, so no draft can coerce to no blur`, whose locator is the xpath `ancestor::div[contains(@class, 'ml-auto')]//span[contains(@class, 'font-mono')]`; `grep -rn "ml-auto font-mono" src/web --include=*.tsx` → dist bundles only | surface or locator moved, and which one is the first question. Deferred browser: `npx playwright test glass-authoring --grep "offers no empty radius to read"`; build `cd src/web && npm run build`; **not run — deferred** |
| vg-361 | `work` | `reference-theme.spec.ts:2444` test `a new background image is imported, and the artboard is repointed at it` | the background-media row never becomes visible. Deferred browser: `npx playwright test reference-theme --grep "a new background image is imported"`; build `cd src/web && npm run build`; **not run — deferred** |
| vg-362 | `work` | `host-walkthrough.spec.ts:375` test `the shell's regions each have a reachable, named focus target` calls `keyboardReach(page)` from mount (`:379-380`) with no selection first | the user ruled §13.1 means a populated region, so the census owes the select-first rewrite. Deferred browser: `npx playwright test host-walkthrough --project=desktop-host --grep "reachable, named focus target"`; build `cd src/web && npm run build`; **not run — deferred** |
| vg-363 | `decision` | `src/web/packages/host/src/themes/store.ts:484` `updatedAt: stat.mtime.toISOString()`; `:533` `.sort((a, b) => a.id.localeCompare(b.id))`; `boot-theme.ts:70` `latestOwnTheme` reduces on `entry.updatedAt > best.updatedAt` (first strict max) | an mtime tie decides which document a run starts from |
| vg-364 | `work` | register read → `vg-232` and `vg-247` still `open`; `STATUS.md` active work names one plan (this pass) and the manager census closed at `32265c25` | the deferral condition passed; the 17 manager rows are still unowned |
| vg-365 | `work` | `object-actions.ts:70-73` comment and `hasUnlockedSelection` used as `eligible` at `:118,:126,:134,:175,:207` | eligibility is still a second owner of two managers' lock refusal |
| vg-366 | `decision` | `src/web/packages/scene-fabric/src/persist.ts` `SCENE_PERSISTED_PROPERTIES` (block `:70-83`) carries `"locked"` | whether lock state is authored is decided inside a persist list, with no owning row |
| vg-367 | `work` | `editor-shell.ts:126` `dropDanglingBindings`; `asset-manager/index.ts:427` `assetReferencedBy` | one concept — "is this still referenced" — decided in two modules |
| vg-368 | `decision` | `ls src/web/.agent-scratch` → `task-E-*.png`, `p1-*.mjs`, `glass-proof/` present; `.gitignore:75` `src/web/.agent-scratch/` | a gitignored directory that only git ignores skews every filesystem walk |
| vg-369 | `work` | `grep -n "object-name\|colour-maths\|firstRunPage\|per-kind-column" docs/architecture/ownership.md` → **no hits** (the map is a 114-row table; persist rows at `:92`, `:165` only) | the census's map rows are absent and a filing pass must re-derive them from `ownership.md` |
| vg-370 | `work` | `src/web/packages/scene-fabric/src/authored-box.ts:203` `if (!Number.isFinite(value) \|\| value < 1) return;`; `selection-inspector/index.ts:272` `Math.max(value, MIN_DIMENSION)`; `per-kind-column.ts:281` `MIN_DIMENSION = 1` | the box minimum lives in two places and a sub-unit resize is a silent no-op. Deferred browser: **new case** (scale a text object, drag a side handle) in `src/web/tests/e2e/editor.spec.ts`; build `cd src/web && npm run build`; **not run — deferred** |
| vg-371 | `work` | `editor.spec.ts:2021` cites `editor-session.ts:979`, which now holds `...this.#envelope` in `#setPalette` (`:977-981`); `editor.spec.ts:2060` cites `:937`, now the `#addBindings` doc comment (`:935-939`) | two spec comments citing line numbers that have moved; cite the symbol |
| vg-372 | `decision` | `npx biome check packages/editor/src/card-insert-surfaces.dom.test.tsx` → `Found 1 error` (organizeImports assist); `npm run format:check` → `Checked 615 files in 264ms. No fixes applied`; `ci.yml:38` runs `format:check` and `:41` `lint`, never `check` | the gate and the toolchain disagree, and only one of them runs |
| vg-373 | `decision` | `theme-library-manager/index.ts:214-217` `options.errors.warn("controls", "Saved, but the library picture failed: …")` | a diagnostics label naming a module the code has left, and a user-visible log string |
| vg-374 | `work` | `wc -l src/web/packages/editor/src/editor-session.ts` → `1077`; `ls src/web/packages/editor/src/theme-library-manager/` → `index.ts` only (21 `*-manager` dirs hold 41 test files, none of them this one) | still past the 800 stop, and the new manager is the only one untested |
| vg-376 | `work` | `selection-inspector/panel.ts:647-651` `object.set(key, Number(value))` for `shape-line-` with no finiteness check, while the branch above `:640-643` refuses (`const parsed = parsedPath(String(value)); if (parsed === undefined) return false;`) | an asymmetry whose reachability is unmeasured; a guard is owed either way. Deferred browser: a geometry field driven with a non-numeric string, `src/web/tests/e2e/inspector-sections.spec.ts` (`--grep "gives every kind a column"`); build `cd src/web && npm run build`; **not run — deferred** |
| vg-377 | `work` | `controls-manager/index.ts:136-138` comment: "setting `x2` alone parks the anchor at -1 while `x1` still reads 0" | a comment justifying a whole-quad write with a measurement nobody reproduced |
| vg-378 | `work` | `scripts/sdd-checkpoint.mjs:258` `/^\s*[-*]\s*\*\*Active plan:\*\*\s*`([^`]+)`/m`; `:331-335` parses `Task <n>: <state>`; `scripts/check-status.mjs:142` reads STATUS.md | two unwritten conventions the banner reads silently; one assertion in `check-status.mjs` removes the class |
| vg-379 | `decision` | `src/web/package.json:34` `gates:self-test` chains 7 scripts and omits `dead-code-sweep.mjs` (its `--self-test` documented at `scripts/dead-code-sweep.mjs:48`) and `ownership-enforcement.mjs`; `grep -rn dead-code-sweep --include=*.json --include=*.yml` → **no runner** | 22 scanner checks no command runs |
| vg-380 | `decision` | `editor-shell/controls/settings-field.ts:248` `note.className = "vigilia-field-hint"`; `grep -rn vigilia-field-hint` over source (excluding dist) → that one hit, no stylesheet rule | the sweep has no instrument for a class production writes that no stylesheet defines |
| vg-381 | `decision` | `image-manager/index.ts:13` declares `readonly scale?:` over the union `"image-contain"`/`"image-cover"`/`"scale-montage"` and no line in the file reads it (`grep -n "options.scale"` → none); `asset-manager/index.ts:91` passes `scale: "image-contain"` | an option the caller sets and the body ignores |
| vg-382 | `decision` | `scripts/dead-code-sweep.mjs:531` `usesIn`, `:542` `usesOutsideDeclaration`, `:724` `const ownUses = usesIn(selfUse.get(file), name)`, `:730` the LIVE verdict text | the `redundant-export` self-use test counts a declaration-shaped occurrence as a use; it can only over-retain |
| vg-383 | `work` | `selection-inspector/runs.dom.test.ts:220-221` asserts against `formatInstant(instantIn(Date.now()), "HH:mm", "Asia/Tokyo")` after the render | a minute-boundary flake in a test, about once in sixty runs |
| vg-384 | `work` | `ci.yml` steps `:38` format:check, `:41` lint, `:44` status:check, `:50` hooks:check, `:59` typecheck, `:62` vitest, `:65`/`:72`/`:88` builds, `:82` build:fixture, `:92` check-size, `:104` playwright; `npm run format:check` green at HEAD (615 files) | dispatch gate lists restate CI from memory and rot |
| vg-385 | `work` | reproduced the licences job over `src/web/**/package.json` → 27 declared non-`@vigilia/` names, 4 missing from `THIRD-PARTY-NOTICES.md`: `@playwright/mcp`, `class-variance-authority`, `clsx`, `tailwind-merge`; the job is `ci.yml:112-129`; `ci.yml:3-9` triggers on `main` only | the notices are incomplete and no CI runs on `develop` |
| vg-386 | `decision` | `scripts/dead-code-sweep.mjs:705` `if (prodConsumers.length > 0) continue;` precedes `:708` `if (prodConsumers.length === 0 && consumers.includes(barrel))`; `STATUS.md` records the reproduction (240 candidates, 133 `barrel-only-export`) | the tier cannot fire for any input; which definition it means is the decision |

## Decision sentences (one per `decision` row)

- **vg-348** — Should a chart scalar bound (gauge `min` above `max`, `windowSeconds` 0, `innerRadiusPercent` above `outerRadiusPercent`) be refused at the envelope, or clamped at render the way pie already clamps?
- **vg-350** — Does the drawing's light bar become a solid `background-color` like the other five, or does the reader grow a gradient comparator plus a ruling on which stop of the gradient is the ground?
- **vg-352** — Which documents' `§N` may claim a DESIGN.md marker — `requirements.md`'s own `§7`, or only documents about the design language?
- **vg-354** — Does the shell gain a `--font-*` token the front matter syncs against, or is `fontFamily` declared `omitted` with a reason?
- **vg-355** — Should CI (or a hook) run `design:check` and `gates:self-test`, or is their absence the recorded decision that they stay manual like the `design-tokens` ratchet?
- **vg-363** — How should two themes saved in the same millisecond be ranked: by id, by name, or by a stored save counter?
- **vg-366** — Is an object's `locked` state authored (and therefore persists), or derived from the transform flags (and therefore does not)?
- **vg-368** — Delete `src/web/.agent-scratch/`, relocate it outside the tree, or exclude it from each walker that measures?
- **vg-372** — Is `biome check` the repo's gate (then CI should run it), or are `lint` and `format:check` the whole gate on purpose?
- **vg-373** — Should the save protocol's warning subsystem be renamed now the code has left `editor-session.ts`, accepting that the label is a user-visible string?
- **vg-379** — Is `gates:self-test` the owner for every `scripts/*.mjs` self-test — add the `dead-code-sweep` and `ownership-enforcement` entries, or write the exclusion down as deliberate?
- **vg-380** — Is the reverse direction (a class production writes that no stylesheet defines) in scope for the sweep's instruments at all?
- **vg-381** — Was `importImage`'s `scale` meant to drive the placed object's scaling, the decoded `FabricImage`'s sizing, or to be removed?
- **vg-382** — Should the `redundant-export` self-use test exclude declaration-shaped occurrences (object keys, re-exports), or is the tier a pre-filter whose survivors typecheck re-tests?
- **vg-386** — Which definition does the `barrel-only-export` tier mean: the plan's literal sole-importer shape (tests included, 76 rows) or no production consumer other than the barrel with test consumers disclosed (133)?

## Notes for the synthesis

- **`vg-349` is the only close, and it closes on a reading rather than on a fix** — the row's own test
  ("if they do, close this row with that reading rather than with a new test") is met: one
  `object:moving` handler serves every drag.
- **Eight rows need a browser and none was run** — vg-346, vg-347, vg-359, vg-360, vg-361, vg-362,
  vg-370, vg-376. Three of those (vg-359, vg-360, vg-361) are the capture run's deterministic
  failures, so their verdict is `work` and the useful output is the run command plus what each needs;
  `closes` was never available for them.
- **Three rows are decisions about a tool, not the product** — vg-372 (gate vs toolchain), vg-379
  (which self-tests the chain owns), vg-382 (what "use" means to the sweep's tier), and a fourth,
  vg-386, is the same family from the other end. The drain's spec should group them: one ruling on
  what the repo's gate is would settle vg-372 and vg-379 together.
- **`vg-353` is the batch's only dependency row** and it is `work`, not `parked`: the advisory is live
  (`npm audit` still reports it) and the path is build tooling.
- **`vg-362`'s decision half is already ruled** by the user (2026-10-12, recorded in the row): §13.1
  means a populated region. What remains is the census rewrite, which is why it is `work` and not
  `decision`.
- **`vg-364` is the deadline row, and its subject is 17 other rows** (vg-232…vg-248, all still open).
  The manager census closed without owning the cleanup, so this is `work` and not a bookkeeping close.
- **Rows filed today are the least settled** — 23 of the 39 were filed 2026-10-12 and several carry
  their own correction already (`vg-347`, `vg-364`, `vg-365`, `vg-369`, `vg-374`, `vg-382`). Every
  verdict above was taken at HEAD `87cc2311`, not from the row's text.
