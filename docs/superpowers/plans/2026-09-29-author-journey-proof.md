# Author Journey Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an author a blank theme they can actually start from, then rebuild the whole reference composition from that blank state by hand, through the UI alone, and record every gap, friction point and visual-quality problem the rebuild exposes.

**Architecture:** Three product changes first, because without them the proof has to begin with a workaround and would measure the workaround rather than the surface: a blank theme `New`, an artboard chooser, and the starter as an explicit template. After that no new code path is built — the work is a Playwright driver exercising the real editor's real controls, and a Findings table that is the durable record of what the surface could not do.

**Tech Stack:** TypeScript, React 19 shell, Fabric 7.4.0, Playwright, Vitest, Biome. No new dependency.

**Spec:** [Author journey proof](../specs/2026-09-27-author-journey-proof-design.md) — the plan argues from the spec, so the spec travels with it; executors read both.

## Global Constraints

- **No generator, starter file, fixture, hand-edited JSON or developer intervention at any point** in Phase 2. Opening the starter and editing it is not the rebuild. The only legal moves are the controls in the delivered surface and the ones this plan names.
- **A control that does not exist is the finding.** Do not work around it with the canvas dock, a marquee, a drag, or code. A workaround is a defect in the surface, not a technique.
- **Fix what you find, using what the repo already decides.** A property not exposed in the panel, a layout that does not line up, something hard to read, an icon that is not Lucide — each is fixed in the pass, not merely recorded. The repo already answers most of these: `docs/architecture/ownership.md` names the owner, the surrounding code sets the idiom, `ui-copy.ts` holds the copy, and the existing controls set the pattern. A reasonable decision from those is a decision, and making it is the job. Fix it, regression-test it, and move on.
- **Note and continue only for a genuine unknown** — a product decision with no precedent in the repo and no owner who can be inferred. Record it in the Findings table, keep the rebuild moving past it, and do not stop the pass. Nothing waits on a human.
- **Gaps, friction and visual quality are findings in their own right.** A journey that completes but is unpleasant has still failed.
- Paint resolves through palette tokens (§73) and type through named type presets (§75). A per-object colour that bypasses a token is a defect, not a shortcut — the rebuild varies the frosted tint by editing a token.
- Missing or non-`ok` telemetry is never fabricated as zero/default data (§97). A gap in the display is a correct result.
- One history entry per committed edit (§67). No runtime or derived state in persisted data.
- UI copy belongs in `editor/src/ui-copy.ts` (§35); every control keeps its accessible name and keyboard access.
- Report what was not verified. A partially completed pass is reported as partial, not rounded up.
- Supported Node: 22.12+, 24, or 26+. Workspace scripts run from `src/web/`. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` remain enabled.
- Stage explicit paths. Pushing and opening a PR are separate actions.
- File an issue with `gh issue create --body-file .github/bug-report-template.md`; a finding whose cause is not established is written as "cause not established", not guessed.

## Product decisions, taken 2026-09-29

Recorded here so an executor does not re-open them.

| Decision | Ruling |
|---|---|
| A blocking finding that cannot be fixed quickly | **Fix it in the pass, using what the repo already decides** — ownership, idiom, copy, and the existing controls' pattern. Note and move on only for a genuine unknown with no precedent. The pass never stops for a human. |
| A blank theme's palette | **Minimal starting set** — `text`, `dim`, `panel`, `frost`, `panelStroke`, `rule`, `chartTrack`, `frostInk`, `frostArea`. Not the reference palette's device colours. |
| The starter's reach, now that `New` is blank | **Also a library template**, not only a File item. |
| Artboard sizes offered | **16:9, 19.5:9 and 4:3**, landscape and portrait, at **1080p, 2K and 4K**. No device names — the 19.5:9 entry is not labelled as any handset. |
| How a resolution maps onto a ratio | **The short edge.** 1080p / 2K / 4K are 1080 / 1440 / 2160 on the short side; the long edge is derived from the ratio. 16:9 therefore lands on the familiar 1920×1080, 2560×1440 and 3840×2160. |
| Where the chooser appears | **On New, and driving the inspector's artboard controls.** One preset list, two uses. |
| Scene objects and their names | **Objects get an author-facing display name**, as globals already do (§75). The authored id stays the stable key; the name is what the layer list, the selection and the semantics show. |
| The left panel | **Collapsible.** The rail button for the visible pane toggles it closed, and reopening restores it. |

The starter keeps its own 1672 × 941 artboard. It is not resized to a preset — 16:9 is its *ratio*, and the new-document presets are a separate list.

---

## Findings backlog

**This section is live and grows.** The pass is driven by using the product, and every gap found is either fixed here or recorded. Priorities are re-ordered as new findings arrive — a P1 becomes P0 if it blocks the rebuild, and finished items move to the archived tail rather than disappearing.

**Standing instruction (2026-09-29):** this plan's scope is whatever it takes to ship. Finding something broken, missing, misaligned, hard to read, or inconsistent with the repo's own conventions means it enters this backlog and gets done — not that it gets noted for later.

### P0 — must land before the rebuild

| # | Finding | Fix owner | State |
|---|---|---|---|
| F0.1 | `New` emits the finished composition; there is no blank state | Task 2 | not started |
| F0.2 | No artboard chooser — a new document's size is not the author's to pick | Task 1 | **dispatched once and lost** — see below |
| F0.3 | The starter is what `New` means, so it cannot be left behind | Task 3 | not started |
| **F0.4** | **An author cannot import or replace an asset at all** | see below — **new, 2026-09-29** | not started |

**The first F0.2 dispatch produced nothing.** The agent created no file, committed nothing and never reported — it was running alongside two others in one worktree and appears to have died silently. Its orphaned full-Playwright child was still burning CPU against a tree that changed twice underneath it, so it was stopped; its result would have meant nothing regardless. **Re-dispatched 2026-09-29.** Recorded because a silent loss is invisible to compaction, and the second one would have been too.

### F0.4 — an author cannot import or replace an asset, and the tests say it works

**This is the best finding in the pass: a fully tested feature that no human can reach.**

`createAssetPanel` (`packages/editor/src/asset-manager/index.ts:243`) appends two `input[type=file]` elements — `data-vigilia-asset-import` and `data-vigilia-asset-replace` — plus a remove button, and **nothing triggers them**. Measured: both inputs are `display: none` with `getClientRects().length === 0`, no `<label for>`, not wrapped in a label. The only interactive elements the pane renders are a `<select>` and **"Remove asset"**. Grepping the package, the only two `.click()` calls are `picker.click()` (the package opener, `editor-main.ts:156`) and `link.click()` in persistence — neither touches the asset inputs.

**Why the suite is green anyway:** the specs import with `setInputFiles` (`editor.spec.ts:2185`, `reference-theme.spec.ts:2273`), which drives a `display: none` input directly and does not care that a human could never click it. The feature is proven by a method the product does not offer.

**What an author can actually do with assets today:** look at the one the starter shipped (`starter-backdrop`) in a dropdown, and remove it. There is no way to add one, replace one, or preview one. That blocks background media on a new theme — which F0.1 and F0.2 are both being built to enable.

**Fix shape:** a visible control per hidden input (a labelled button that calls `.click()` on it, which is the pattern the package opener already uses), plus whatever the pane needs so the asset is identifiable rather than a bare id in a dropdown. **And the spec should stop being able to pass by a route a human does not have** — the fix is incomplete until a test reaches the import through the control a user would click.

### P1 — ship defects found by hand, measured at 1920 × 1080

| # | Finding | Why it is a defect | Fix owner |
|---|---|---|---|
| F1.1 | The left panel cannot be collapsed | `280px` fixed, `resize: none`, no splitter, and clicking the active rail item reclaims **0px**. The `aria-pressed` mechanism is already there; the toggle is not. | `editor-shell/shell-layout.tsx` + CSS |
| F1.2 | Rail icons are Unicode glyphs stored as copy | `ui-copy.ts:13` holds `▤ + ▣ ⚙` as **translatable strings**, so an icon cannot be a component. `layer-panel.tsx` already has the right pattern: `KIND_ICONS: Record<LayerKind, LucideIcon>`. `railMark` should go, not be restyled. | `ui-copy.ts`, `shell-layout.tsx` |
| F1.3 | Description is a single-line `<input>` holding prose | 781px of text in a 161px field, truncated mid-word, unreadable. A description is multi-line; it needs a `textarea`. | theme settings panel |
| F1.4 | "Release version" is a bare `<label>` | No `for`, no form control — it wraps an `<output>` and associates with nothing. | theme settings panel |
| F1.5 | Two `<label>`s stacked with no input between | A structural bug in Type presets, not a style choice. | type preset panel |
| F1.6 | No favicon | 404 on every load of the editor. | editor `index.html` / build |
| F1.7 | The Insert menu omits Panel | Two surfaces offer the same six objects and have already drifted: the rail's **Add** pane offers Text, Panel, Gauge, Line, Bar, Pie; the **Insert** menu offers the same list **minus Panel**. The omission matters — a panel is the most fundamental object here and the composition is mostly panels. Two lists that must stay in sync and don't is the actual defect; one owner reading from both is the fix. | `new-object-panel.ts` + the menu owner |
| F1.8 | **A scene object cannot be named at all** | Insert a Text and the layer list shows `text-7363db18-c109-42ec-b1ec-8728c2d04292`. There is no field to change it: the only "Name" inputs in the whole editor are `vigiliaThemeName`, `vigiliaPaletteName` and `vigiliaTypeName`. Every object an author ever creates is a UUID, permanently. This is the most author-facing gap found so far and it was escalated from P2 on the evidence. **Escalated 2026-09-29.** | `renderer-core` types + envelope schema + validator + editor |

**F1.8's shape, decided.** The authored `id` stays the stable key and is what bindings and round-trips reference — it is not renamed. A new optional `name` rides on the object beside it, exactly as globals already carry a display name (§75). Absent means "fall back to the id", so a hand-authored scene that predates the field still opens. The layer list, the selection and any semantics that would otherwise print an id show the name when there is one.

### F1.9's scope, decided

**Authoring.** The Add pane's "Panel" becomes a shape list offering every primitive Fabric 7 ships: **Rect, Circle, Ellipse, Triangle, Polygon, Polyline, Line, Path**. `Path` already exists as a type — the starter's nine icons are paths — but has no authoring entry, so it is a gap like the rest. No new dependency: all eight classes are in the installed package.

**Their properties, in the selection inspector** — each shape exposes what is actually its own, and the general geometry fields stay as they are:

| Shape | Shape-specific properties |
|---|---|
| Rect | corner radius (`rx`/`ry`) — the panel already exposes this |
| Circle, Ellipse | none of their own; both derive from width and height |
| Triangle | none of its own |
| Polygon | **side count only** — see the correction below |
| Polyline | its points |
| Line | its two endpoints |
| Path | the path data |

**Two premises in this table were wrong, and the implementer corrected them rather than faking them (2026-09-29).** Verified in the installed package, not assumed:

- **Fabric 7.4.0's `Polygon` has neither `numPoints` nor `cornerRadius`.** A polygon therefore takes a **side count** which is recomputed into the corners the scene stores — what Fabric 5's `numPoints` did — and gets **no** corner-radius field at all. A radius box that accepts an edit and applies none is the one thing `panel.ts`'s own doc comment forbids, so the absent field is the correct outcome, not a gap.
- **`new Path({ path: "..." })` throws in Fabric 7.** `path` must be the command array; the Path default is authored as SVG data and normalised by Fabric's own parser.

**Material widens with the shapes.** `supportsPanelFields` widens from `object instanceof Rect` to the primitive set, so fill, stroke, border width, corner radius and shadow appear on every one of them. One owner, one set of fields, no per-shape fork. Open shapes (polyline, line) take a **content** token as their stroke — a fill in the surface colour would be invisible.

**Glass does not, and that is stated rather than hidden.** `GLASS_OBJECT_TYPES` is `Rect | Group` and the published schema enforces exactly that — the `type` enum of `["Rect", "Group"]` applies only when `vigiliaGlass` is present, so the object definition is otherwise permissive and no schema widening is needed for the new shapes. The renderer is the real limit: `localPath` in `scene-fabric/src/glass.ts` draws `ctx.rect` and a rounded rect and knows nothing else, and Task 1 measured radii on rectangles only. **A non-rect shape therefore carries no frosted treatment** until `localPath` is taught the other paths and the budget is re-measured. That limitation is honest, and it is the reason this is one backlog item and not a silent half-feature.

| F1.9 | **There is no shape surface at all** | `Rect` is the only shape the model produces: `new-fabric-theme-objects.ts` emits `Rect`, `Textbox`, `Path` and `VigiliaChart` and nothing else, and the Add pane's "Panel" is a rectangle with no choice. A dashboard product that cannot draw an ellipse or a triangle is limited, and this was found by using the app, not by reading it. **Scope widened by the user (2026-09-29): all primitive Fabric shapes, and their properties.** Fabric 7 ships `Rect, Circle, Ellipse, Triangle, Polygon, Polyline, Line, Path` — all present in the installed package, so this is authoring and material work, not a dependency. See the scope note below. | `new-object-defaults.ts`, the panel primitive, `selection-inspector/panel.ts` |

### Host findings, found by running it (2026-09-29)

The host was started for the first time in this pass — `node packages/host/bin/vigilia.js --no-browser --port 4185`. Everything below is measured, not inferred.

| # | Finding | Evidence | Fix owner |
|---|---|---|---|
| F1.10 | **The root theme chooser shows no thumbnails, while `/settings` does** | The same nine themes on both pages. `/settings` renders a real thumbnail for *System dashboard* and a hatched placeholder for the eight fixtures that have none — that fallback works well. The root chooser renders **zero** `<img>` elements and issues **no** thumbnail request at all. One theme list has the shipped feature and the other does not. | the host's two theme lists |
| F1.11 | **Nothing links to the editor** | `server.ts` serves `/editor` (302) and `/settings` (200). The root page renders **zero** `<a>` tags and zero `href`s, and `/settings` links nowhere either. A user who lands on the product cannot reach the editor from anywhere in the UI. | host root + settings markup |
| F1.12 | **Device names fall back to machine strings** | Under *Devices on this PC* → *Graphics card*, the only value offered is **"First card found (default)"**. That is a discovery fallback presented as if it were a product name, and it is what a real user with one GPU sees. | the device-identity owner |
| F1.13 | **The player's unread-sensor banner repeats itself** | `player/src/main.ts:496` builds the notice as a count, then joins up to three `sample.message` strings with a space, then appends `(and N more)`. It never deduplicates. Measured on a real host with four unsupplied sensors, the rendered banner is **326 characters** and contains the sentence *"no provider on this PC reports that sensor; check the device assignment or that its source is running"* **twice, run together with no separator**. It also carries a raw internal URL (`http://127.0.0.1:8085`) and a `(and 1 more)` debug tail, all on a wall display. **Fix shape:** the host owns the reason vocabulary, so the player should group by reason — `4 of 30 sensors have no reading: 2 no provider…, 1 unreachable…` — rather than concatenate sentences. | `player/src/main.ts` |
| F1.14 | **The player's failure path strands the user** | A bad `?theme=` renders a bare `<pre>` of monospace red on a black page — *"Vigilia could not load this theme. Could not load theme (404)."* — with no link, no retry and no route onward. `host-player.spec.ts:504` asserts the `<pre>` is *absent* in the happy path, so the failure presentation has never been looked at by anyone. | `player/src/main.ts` |

| F1.15 | **Every "refused, tell the author" path in the inspector tells nobody** | `createErrorManager` (`error-manager/index.ts:36`) **fires a canvas event** and logs to the console — it renders nothing itself. Grepping the package, **nothing outside the error manager's own tests subscribes to `editor:warning` or `editor:error`.** Measured on the opacity field: typing 500 is correctly refused, the field snaps back to `100`, the object stays at `1`, and the structured warning `{category: "controls", message: "That value cannot be applied to the selection."}` is emitted — and **nothing appears in the DOM**. The author sees a number jump back with no explanation. This is systemic, not one field: geometry, glass, opacity, the run fields and the palette all refuse through this same path, and each promises the author feedback in its own comment. **Fix shape:** the shell already renders a status line — subscribe there, so the refusal is visible where the author is already looking. | `error-manager` + `editor-shell` status surface |

### Player findings, found by running it (2026-09-29)

The player had never been looked at as a user in this pass. It **works**: the dashboard renders live readings, the clock ticks, the rings and sparklines draw, and unsupplied values correctly paint a gap rather than a zero — which is the §97 behaviour the plan asks for and is **not** a finding.

| F1.21 | **A refusal outlives the cause that cleared it** | Follow-on from F1.15, and reproduced by hand against the landed work. Opacity `500` is refused and the footer says *"Warning: That value cannot be applied to the selection."* Then opacity `80` is committed and accepted — `object.opacity` reads **0.8** — and the footer **still says the value cannot be applied**. The author fixed the problem and the editor keeps telling them it is not fixed, which is a new way of lying rather than the old silence. The message is replaced by a newer diagnostic or cleared on a document change, but not by the **successful edit that supersedes it**. The fix belongs where an edit is recorded: one `canvas.fire` in `EditorHistory.save()` (`history-manager/index.ts:51`), the §67 owner. | `history-manager` + `diagnostic-message` |

**One thing checked and *not* a finding.** The footer's `textContent` reads `"Fabric editor readyWarning: …"` with no separator, which looked like a layout bug. It is not: the two are separate elements with a measured **12px gap** (status 22–147, message 159–990). `textContent` concatenation is not a layout defect, and this was worth measuring rather than reporting.

| F1.22 | **The Open-library surface is dumped in the page corner over the menus** | `File ▸ Open library` renders its picker at **`position: fixed`, `left: 0`, `top: 0`**, 276 × 59, with `z-index: auto`. Measured against the menubar (141–386 at top 23): **File, Edit, Insert and Arrange are all obscured**; only View escapes. It is also **not a dialog** — no `role="dialog"`, so no modal semantics, no focus trap, and Escape will not close it. An author who opens the library loses four of the five menus and has no modal affordance telling them a surface is up. | the library panel |

**The round trip itself is sound.** Verified by hand against a host with an empty, isolated library: naming the theme, `Save to library` writes it and reports **"Saved to library"**; the dirty-document guard correctly interrupts with Save / Discard / Cancel; and reopening carries the name through. Two earlier attempts appeared to show "Save to library does nothing and says nothing" — **that was my own bad selector, not the product.** Menus stay in the DOM after closing, so `[role=menu] button` was matching a stale View menu; the items are `role="menuitem"`. That trap is now recorded above, because the rebuild driver would have hit it and drawn a false finding.

| F1.23 | **The player banner overlays the top of a phone screen** | Found by the F1.13 implementer, measured, and **not** treated as in scope by them: at 390 px the grouped banner wraps to four lines of a `position: fixed` strip that sits over the top of the display. It is better than the ~six lines the old string wrapped to, but **a phone is the main display type**, so this is a defect on the product's primary face, not a curiosity. **Escalated 2026-09-29.** | player layout |
| F1.24 | **The host still bakes a transport address into a browser-facing message** | The player now redacts defensively (`a34b838`), but `packages/host/src/providers/lhm.ts:210` puts a transport address into a sample message and `library.ts:774` passes through whatever a `systeminformation` error string contains — and the repo's own `ProviderHealth` contract says those messages **must already be safe for a browser**, as `providers/provider.ts:18` states in as many words. Two owners, one contract; the player-side redaction is a safety net, not the fix. | host providers |

| F1.25 | **Hand-authored label copy lives in the panels, not `ui-copy.ts`** | Found by the F1.19 implementer while working in exactly those panels, and predating it: the theme-settings, palette and type-preset panels carry their field labels as string literals — `"Name"`, `"Colour"`, `"Angle"`, `` `Stop ${n} position` ``, `"Solid"`, `"Linear gradient"`, `"Family"`. §35 says UI copy belongs in `editor/src/ui-copy.ts`, and the project-wide memory says to probe `Intl` and existing copy before writing a new string table. The only strings the implementer introduced went to `ui-copy.ts`; it did not sweep the pre-existing ones, which is a different task. | the three panels' copy |

| F1.26 | **The chooser now requires the admin bundle** | Consequence of `e245138`, named by the implementer in its commit body because it would not fit `STATUS.md`'s five bullets. `/` is now `public/library.html`, served by the same admin bundle as `/settings`. A host started **without** `bundles.admin` — which only tests do, since `main.ts` always sets it — gets a **404 naming the missing page at `/`**, where before that path worked. Real for any minimal or embedded host, and the failure reads as a broken product rather than a missing build. | host packaging |

| F1.27 | **The layer panel's twisties are still raw glyph text** | `layer-panel.tsx:246` renders `▸`/`▾` as literal text — the same class of defect as F1.2, in the file F1.2's implementer did not own and flagged rather than touched. F1.2's `ui-copy.test.ts` now fails on Unicode in the **copy table**, but these are in markup rather than copy, so the guard does not reach them. | `editor-shell/layer-panel.tsx` |

| F1.28 | **The panel collapse broke 11 e2e call sites** | A regression from **our own** F1.1 work, found by the F1.16–18 implementer and not by us. `openRailPane(page, "Add")` now **closes** the pane when Add is already the showing one, so `reference-theme.spec.ts:541` times out. It proved the fault was not its own by stashing all of its work and reproducing the identical failure at HEAD — which is the right way to establish that in a shared worktree. The helper must only click when the pane is **not** already open, or the collapse is untestable and every caller re-learns this. | the `openRailPane` helper and its call sites |

### Landed

| # | Finding | Landed in | Proof |
|---|---|---|---|
| F0.4 | An author cannot import or replace an asset at all | `ce80354`, `a36c5fb`, `c8590fe` | 1956 unit tests green; 6 e2e pass. Red-without-fix stubbed the trigger and the import test timed out waiting for a `filechooser`. **Verified by hand:** Import / Replace / Remove are visible, the dropdown reads `starter-backdrop.jpg` with the id as its value, a preview renders, and the hidden input is correctly still `display:none` behind a button. It **did not** fix one of F1.19's controls: `vigiliaPaletteToken` was still unlabelled, and the asset pane's new select is a different control. |
| F1.19, F1.4 | Seven (in fact fifteen) controls had a visible label and no accessible name; "Release version" was a bare label | `9fd56a0` | 1969 unit tests green; 4 new Playwright tests and 11 existing editor specs pass. Red-without-fix: removing the two `htmlFor` pairings left 6 controls unnamed in Chromium and took 4 unit tests red. **Measured in a browser, not asserted:** `ariaSnapshot` over all 35 controls of the Settings pane computes a name for every one. The audit opened the gradient and delete branches, so it found 15 — the finding's 7, plus the palette's Angle, both stop positions, both stop colours, the `Paint` and `Reassign to` selects, the type panel's `Reassign to`, and the language sample. `output` is labelable, so the release version takes the same `for`/`id` pairing and computes `status "Release version"`. **Not fixed, found there:** F1.5 and F1.3 remain. |
| F1.9 | No shape surface; all primitive Fabric shapes and their properties | `9b47534` | 1908 unit tests green; red-without-fix took `panel.dom.test.ts` to **20 failed / 34 passed**; 3 Playwright specs pass; capture regenerated and inspected. **Glass did not widen**, as instructed. |
| F1.8 | A scene object cannot be named at all | `1e0c5a0` | 1915 unit tests green; 4 Playwright specs pass; verified by hand — shapes get correct names, pre-field objects carry no `name` key. |
| F1.15 | Every "refused, tell the author" path tells nobody | `074be0b`, `845bd3e` | 1956 unit tests green; red-without-fix took 4 tests red. **Verified by hand**: footer reads the refusal with `role="status"`, `data-severity`, `data-category` and an icon, and the field snaps back. Follow-on **F1.21** found. |
| F1.13 | The player's unread-sensor banner repeats itself | `a34b838` | 1969 unit tests green; red-without-fix took 5 of 7 new tests red. The banner groups by cause: **220 characters on one line, against 326 with a sentence duplicated.** The internal URL is gone, and the implementer found the rule rather than inventing it — `providers/provider.ts:18` already says messages "may reach a browser and must be redacted". `(and N more)` counted *sensors the code had thrown away*; the cap now sits on distinct **causes** (3), with `+N more reasons` naming what was dropped. **Honest gap:** the `+N more` tail is unit-tested only — this host composes three reason shapes, so four causes are unreachable without editing the host, and it did not fake it. §97 intact. |
| F0.2 | No artboard chooser | `1f3fa9c`, `a29f8bc` | 1946 unit tests green; red-without-fix took 9 portrait assertions red and 1 custom-fallback red. The implementer **corrected the plan**, which pointed Step 7 at `editor-shell/` while `ownership.md:22` names `artboard-panel.ts`. |
| — | Four e2e selectors broken by F1.9, plus a fifth live ambiguity | `e5b52d6` | reference-theme 15 passed, host-player 22 passed. A blanket replace would have missed the fifth. |

**Still open from that work, and grown since:** `new-object-defaults.ts` is at
522 lines, `selection-inspector/panel.ts` at **659** and
`selection-inspector/runs.ts` at **694** — F2.1, F2.5 and F2.8 took `runs.ts`
past 500 for the first time. None is near the 800 stop, and each has a stated
reason for the shape it is in, but two of the three are now large enough that
the split is worth taking rather than noting. — both over the "500 is a signal" line, and the implementer left them because the split candidate would export the shared commit/refuse plumbing across a module boundary. That is a real call to revisit, not a thing to wave through.

### Found by looking at the landed work, not by reading it

| # | Finding | Evidence | Fix owner |
|---|---|---|---|
| F1.16 | **A newly inserted closed shape is invisible** | Inserted all six non-rect shapes and screenshotted the stage: **only the polyline is visible** (it takes a light stroke, as open shapes should). The circle, ellipse, triangle, polygon and path are filled `#0c0e13` and read as nothing. Cause: `newShapeSurface` fills from `surfacePalette(globals, "panel")`, and `SURFACE_TOKENS` is `["background", "bars", "scene", "surface", "track"]` — **`panel` is not in the list**, so a shape is filled with the scene's own backdrop. That list is right for a chart track and wrong for a shape an author draws, and the doc comment directly above says the opposite of what the code does: *"a shape an author draws a card on must be as legible as a panel."* **The comment and the code disagree, and the code is what ships.** | `new-object-defaults.ts` |
| F1.17 | **The chart chips lost their group when the shapes gained one** | Before F1.9 the Add pane was one flat list of six peers. Now it is `Text`, then a **SHAPE** legend over eight buttons, then **four unlabelled chart chips** below it. The charts were peers of Panel before and are now orphaned under a heading that is not about them. Measured with Playwright's own accessible-name engine: `getByRole("group", { name: "Shape" })` resolves, but **the group name is not concatenated onto a button's accessible name** — so `getByRole("button", { name: "Line", exact: true })` resolves to **2** (the shape and the chart). That is not only a test problem: a screen-reader user hears "Line" twice with nothing to tell them apart, and it already broke a spec that meant to click the chart. **Grouping the charts the same way fixes both** — the visual orphaning and the ambiguity. | `new-object-panel.ts` |
| F1.18 | **Every new shape's id is prefixed `panel-` whatever it is** | `new-object-panel.ts:82` hardcodes `` `panel-${crypto.randomUUID()}` `` for all eight kinds. Measured: an ellipse gets `panel-ab86824d`, a circle `panel-25b9dc21`, a line `panel-12c41175`. F1.8 gave the *display* the right name, so an author never sees this — but the id is the **stable key** that bindings, the schema path and the envelope carry, so a circle whose key is `panel-…` misleads everyone who reads the document rather than the screen. Same class of defect F1.8 caught in reverse: a shape wearing another kind's identity. `SHAPE_KINDS` and `newObjectName(kind)` already exist on both sides of this line. | `new-object-panel.ts` |
| F1.19 | **Seven controls have no accessible name, and they have visible labels** | Audited every focusable control in the editor: 155 visible, **7 unnamed** — `vigiliaThemeName`, `vigiliaThemeAuthor`, `vigiliaThemeDescription`, `vigiliaPaletteToken`, `vigiliaPaletteName`, `vigiliaTypePreset`, `vigiliaTypeReplacement`. The markup is `<div class="vigilia-field"><label>Name</label><input …></div>`: the label has **no `for`**, the input is a **sibling rather than wrapped**, and there is no `id`, `aria-label` or `aria-labelledby`. The label is visible to a sighted user and invisible to a screen reader, which announces "edit text" and nothing else. AGENTS.md requires an accessible name on every control. **The fix has an in-repo precedent:** `selection-inspector` already pairs `label.htmlFor` with `select.id`; the theme-settings, palette and type panels simply do not. **Shares a cause with F1.4** — a bare `<label>` with no `for` — so both should be fixed as one. | theme settings, palette manager, type preset panels |

### P2 — data model

| # | Finding | Why it is not a UI fix | Fix owner |
|---|---|---|---|
| — | *No P2 items. F2.1 was escalated to **F1.8** on the evidence: an object cannot be named at all.* | | |

| ~~F1.29~~ | **WITHDRAWN — the editor is desktop-only, so the hidden inspector is the design** | The finding was mine and it was **wrong**. `tests/e2e/surface.ts` says so in its own doc comment: *"The editor and the host's pages are **desktop-only**, and their tests say so by skipping on a phone."* Eight specs guard on `isDesktopSurface`. I read `display: none` below 980px as a defect **without reading the guard that documents why it is there** — and I then dispatched an agent to build a phone inspector for it. `ad45667` (485 lines) is **reverted in `6d2ec2a`**. The evidence was in the repo the whole time; the F1.28 agent had even hit it and correctly *skipped* the failing phone spec, which I praised as judgement rather than reading as the answer. | — |
| ~~F1.31~~ | **WITHDRAWN with F1.29** | A phone author cannot save — true, and not a defect: the editor is not a phone surface. | — |

**A phone is the main display type (the user, 2026-09-29).** This is the frame the rest of the pass should have been read in, and getting it wrong cost a false finding *and* a commit:

- **The editor is desktop-only.** It is the authoring surface, and authoring happens on a desktop.
- **The artboard presets are exactly right** — 19.5:9, 4:3 and portrait exist so a **desktop author builds a phone-shaped dashboard**, which is the core workflow, not an edge case.
- **The player is the primary face**, and it runs on a phone. So F1.23 is not a curiosity: the availability banner wrapping to four lines of a `position: fixed` strip over the top of a phone display is a defect on the product's **main** surface, and it is escalated accordingly.

| F1.30 | **The host's own pages still have no favicon** | Scope note from the F1.6 implementer, which fixed the editor and player but not the host: `packages/host/public/library.html`, `settings.html` and `firstRunPage()` declare no icon and 404 the same way. The host's *player* surface is covered because it serves the player bundle. The fix is one `<link>` in each. | `packages/host/public/` |

| F1.31 | **A phone author could not save** | Found and fixed inside `ad45667`. The header put **467px of content in a 396px box**, landing "Save package" at x=397 with **64 of its 79 pixels off-screen**. Not a nudge — the primary action, unreachable, on the surface the artboard presets (F0.2) exist to serve. It now wraps. A separate `panel-labels.spec.ts` skip carried the comment *"the settings panels are hidden below 980px"* — **F1.29 quoted as its own cause**; the skip is removed and those four tests now run on a phone. |

### F1.29 landed

`ad45667`. **A rail-toggled collapse that becomes a sheet below 980px** — "Inspect" is a fifth rail entry carrying `aria-expanded` and no `aria-pressed`, because it names a region rather than a member of a set. A sheet was the only option the existing layout supports (the shell already positions the dock, arrange toolbar and zoom readout as absolute glass over the stage), and a pure collapse was rejected as *"the F1.29 defect with an extra tap"* — so the collapse is the state and the sheet is where a narrow shell puts it.

**The 980px rule never achieved its own purpose.** It came in with the original React shell as a canvas budget, and it kept the budget by *deleting a region*: 52 + 240 + gaps + padding left the canvas **88px** at 412px. The grid below the breakpoint is now rail and stage, and the canvas is **336px**.

Measured at 412×915 and 390×844: sheet 280×753 / 280×651, stage 336 / 314, artboard field 59×30, and **0 of 35 controls at 0 × 0**. Red without the fix: exactly 7 failed, all on `phone-chromium`.

**Its own bug, caught by measuring rather than looking:** the narrow grid rule omitted `[data-inspector="false"]`, so the phone's default fell through to a 3-track rule and measured a **48px stage**. It had screenshotted past that twice.

Seventeen findings have landed across five packages and several shared files. A single rebuild-and-look at `1280943` confirms they compose rather than merely coexist in the log:

- **All eight shapes insert, are keyed correctly and are visible.** ids `rect-`, `circle-`, `ellipse-`, `triangle-`, `polygon-`, `polyline-`, `line-`, `path-`; the six closed ones filled `#081523d9`, the two open ones stroked `#ecf5ff` with no fill. Spread across the stage and looked at: each reads as a distinct dark card against the sunset, where five of them read as **nothing** before F1.16.
- The Add pane carries `SHAPE` (8) and `CHART` (4) as separate fieldsets.
- The rail's four entries each hold one `<svg>`, with empty text and their `aria-label` (`Layers`, `Add`, `Assets`, `Settings`) and `aria-expanded` intact.

That last group is the point: F1.2 deleted the glyphs and F1.1 added state to the same four buttons, and the names survived both.

| F1.32 | **The language sample reads as a bare date** | Seen only by looking at the phone screenshot: under *Language* the panel prints **"September Tuesday"** on its own line. It has an accessible name — `ad45667` gave it `aria-label` "Sample in the chosen language" — so a screen reader is told what it is, and **a sighted author is not**. It sits between the Language picker and the Size row, formatted as a date, with nothing on screen saying it is a preview of the chosen language. The same panel's *Release version* beside it now at least has a label; this one does not. | theme settings panel |

| ~~F1.22~~ | **RESOLVED as a side effect — the library picker is a real dialog now** | Recorded resolved, not fixed as a task. It was `position: fixed; left: 0; top: 0`, 276 × 59, covering File, Edit, Insert and Arrange with no `role="dialog"`. Re-measured after `a4824fe`: the picker sits at **(627, 467)**, `position: static`, **inside a `<dialog>`**, with **zero** menubar items obscured, and it lists the Templates group F0.3 added. F0.1's work fixed it without being asked. | — |
| F1.33 | **Converting a theme to portrait strands most of the composition, silently** | Found by doing the core workflow end-to-end on the main display. The starter is 1672 × 941. Setting Ratio to 19.5:9 and Orientation to portrait (F0.2's own controls, working correctly — 19.5:9 filled the others to 2340 × 1080, portrait gave 1080 × 2340) narrowed the artboard to 1080 while the content kept its positions. `reference-theme.spec.ts` pins this as intended — *"persists artboard properties without rescaling Fabric objects"* — and the editor does show the artboard bounds. **The player does not.** The Storage and Network panels live at x = 1138, outside a 1080-wide artboard, so on the phone they are simply **gone**: no crop cue, no warning, nothing. A one-click ratio change silently deletes two thirds of a dashboard. | player + artboard resize |
| F1.34 | **Out-of-artboard content is dropped by the player with no cue** | The mechanism behind F1.33, and it stands on its own. The player shows what the artboard contains and has no way to say *something was here and is not now*. A wall display and a phone both lose it identically, so the reader cannot tell a short dashboard from a broken one. | player |

| F1.35 | **A chart's inspector says "Paint: not set"** | Named by the F0.1 implementer, true of **every chart in every theme** and predating this pass. `VigiliaChart` keeps its colour in `settings`; `paintReferenceOf` (`selection-inspector/appearance.ts:28`) reads only `vigiliaPaint`. So the resolution line under a selected chart reports that the chart has no paint, while the chart is painted. The same line is the one F1.19 made *announce correctly* — it is announcing the wrong thing. | `paintReferenceOf` / chart paint |
| F1.36 | **The host serves no templates, so `/` lists none** | The starter-as-template landed in the **editor's** library, under Templates beside Your themes. The host's own chooser at `/` shows none, because a template is never stored and the host has no way to serve one. A template the display chooser cannot show is only half a template. | `packages/host/` |
| F1.37 | **A new card on a blank theme is 1.33:1** | The honest cost of the minimal nine-token palette, measured by the F0.1 implementer and not hidden: a card inserted on a blank theme is visible only from its own `panelStroke` outline. The blank theme's page token is `chartTrack` because `panel` puts a card on the page at **1.02:1** and `dim` puts text at 1.74:1 — so `chartTrack` is right and the *card* still has no surface to sit on. Not fixable without changing the palette decision, which is the user's. | minimal palette decision |

### Phase 0 complete

`a4824fe` closes the last of it. `createBlankFabricTheme` builds **from** `createNewFabricTheme()` — same schema version, same fabric version, same type presets — with objects, assets and bindings emptied, so the vocabulary stays one decision in one place.

**The implementer corrected the decision, and was right to.** The palette is **ten** ids, not the nine I listed: `paletteNone` in `fabric-envelope-validate.ts:660` refuses any palette without `none`. It proved the tokens by **identity** — `expect(palette[id]).toBe(starterPalette[id])` — rather than restating a colour, which is precisely the mistake that let the tint drift to three literals once already.

Three things it found and fixed on the way: `SURFACE_TOKENS` never looked for `chartTrack`, so a blank theme's new gauge drew **nothing**; the chooser landed top-left over the menu that opened it, because Tailwind's preflight zeroes the `margin: auto` a modal dialog is centred by; and the library's control label repeated the dialog title, printing over the select.

**The rebuild can now start.** `New` gives a blank theme at a chosen size; `New from starter` and the library's Templates group give the reference back; assets are importable through a control a person can click.
| # | Finding | Why it was withdrawn |
|---|---|---|
| W1 | "The canvas gets only 35% of the viewport" | Measured in a 1008px-wide window. At 1920 × 1080 it is **66%**, and View offers "Zoom to fit". The panel being non-collapsible is F1.1; the share was an artifact of the window. |

## Review Focus

The five failure modes this pass implies that no single task's tests exercise:

1. **A rebuild step that silently uses a different control than an author would.** The driver and the product share no code, but if the driver reaches into `window.vigilia` to set a value a click would set, the proof is void. **Any `page.evaluate` that writes scene state is a defect in the driver.**
2. **A round trip that passes on the DOM and fails in the envelope.** Reading the live DOM proves the control repainted; only reading the persisted package proves save. Every round-trip task must assert on the reloaded envelope.
3. **A finding recorded but not classified.** The Findings table is not a log; an unclassified row means the pass cannot be judged complete. Blocking/deferred is required at observation time.
4. **A blocking finding "fixed" by a second control that describes the same thing.** A fix that adds a second owner is a new defect; the fix must sit inside the one owner named in `docs/architecture/ownership.md`.
5. **Save that loses authored work on the way.** The proof touches every authored surface in one document. A fix that makes a control work by dropping or coercing what the author wrote is worse than the gap.

| F1.38 | **The New-theme chooser ignores the current artboard** | Found by driving the blank-theme flow. The chooser opens on its own defaults — 16:9, Landscape, 1080p, 1920 × 1080 — even when the document is already 19.5:9 Portrait at 1080 × 2340. An author who has settled on portrait and clicks **New theme** again is thrown back to landscape without being asked. A new-document chooser should open on the shape you were last working in. | the New chooser |
| ~~F1.22~~ | **RESOLVED as a side effect — the library picker is a real dialog now**

`2f0223f`. The player now carries a persistent strip when content falls outside the artboard:

> **27 of 52 objects are outside this artboard and are not shown — past the right edge**

**It names the side, not the objects, and that came from looking.** Its first version listed object names, and the browser screenshot showed `ram-card-icon, ram-card-title, +24 more` — internal ids, because the starter predates the name field. Its reasoning: *a wall reader is not the author, and the layer list is where ids are looked up.* And "past the right edge" is itself the diagnosis — the frame is too narrow, not the content wrong.

**Slate, not amber, and this closes F1.23 as a consequence.** The sensor-gap notice is amber at the same edge, and §97 requires a dashboard gap and a sensor gap not to look alike — a theme can be both at once. Both strips were `position: fixed; top: 0` drawing over each other; they now stack in one column.

The artboard controls carry, via `aria-describedby` on all five size controls: *"Objects are not moved or resized. Anything outside the artboard is not shown on a display."* **No count** — the panel cannot see the scene, so a number there would be a guess. The player owns the measurement, which is the split the ownership map asks for.

**It filed rather than guessed.** `reference-theme.spec.ts:365` fails — `Ctrl+N`'s discard prompt times out waiting for a `Discard` button. It stashed every file it touched, rebuilt, and reproduced it identically, so it is pre-existing with the cause not established: **issue #7**.

| F1.39 | **The canvas context menu holds a third copy of the chart list** | Named by the F1.7 implementer, which consolidated the Insert menu and the Add pane into one `insertGroups()` owner and then found the third. The context menu reads `CHART_FAMILIES`, so it **cannot** drift on charts, and it has no shapes or panel by design. It is therefore not F1.7's defect — but it is a third place that knows what can be inserted, and the one that most needs the other two's rule. | `editor-shell/canvas-context-menu` |

### F1.35 and F1.7 landed

`1b948c0` and `d15c265`.

**F1.35 went through the right owner.** `paintReferencesOf` reads a chart through `chartPaintFieldsFor` — the renderer's existing declaration of which settings hold paint — rather than adding a second rule beside it. The reference composition's `network-chart` now reads *"Stroke paint: palette.down → #22d3ee"*, *"Series paint 2: palette.gpu → #a98bff"*.

**The useful half is what "not set" now means.** A chart inserted through the Add pane has never been styled, and it reads *"Track paint: palette.background"* / *"Progress paint: palette.text"* — it is painted from the moment it exists, because `createNewChartDefaults` gives it token references. So the line's "not set" is now genuinely "no reference", which is what a bare Fabric object is. It also stated the case it did **not** solve: a chart carrying *literal* colours — reachable only from hand-written JSON, since the editor never writes them — still reads "not set", and it declined to invent a second vocabulary for literals.

**F1.7 deleted a duplicate rather than adding one.** `insertGroups()` in `new-object-panel.ts` is the only list, built from the two owners that already existed (`SHAPE_KINDS`, `CHART_FAMILIES`), and both surfaces render it. The session façade's text body was already a copy of the pane's; it is now the pane's.

| F1.40 | **The template catalogue is a hand-copied second list** | Named by the F1.36 implementer, with a `ponytail:` comment. The host's `SHIPPED_TEMPLATES` (`packages/host/src/themes/templates.ts`) duplicates the editor's `STARTER_TEMPLATE`, and **nothing enforces agreement across the package boundary**. One rename makes the chooser offer a template the editor cannot produce, or the editor one the host cannot serve. It is the right trade for now — a cross-package contract is a bigger decision — but it is a duplication that exists and is named. | `packages/host/src/themes/templates.ts` vs the editor |

### F1.36, F1.24 and F1.30 landed

`4b7f5f5`, `9c96043`, `7708e5b`.

**F1.36 — the row is a link, not a button, and that is the whole design.** A template has no package, so `PUT /api/themes/active` still 404s it; a button would *promise a choice the host cannot keep*. It is an underlined link to `/editor/`, with the hatched stand-in drawn directly rather than an `<img>` at a thumbnail route with no entry, which would 404 on every clean load. It extended the shared row owner from `e245138` rather than writing a second list. And it fixed the page a new PC actually sees: `firstRunPage()` said "build one" while the product ships a finished dashboard — it now names the template from the same catalogue.

**F1.24 — one redaction vocabulary, not two.** `redactForBrowser` lives in `provider.ts` — the file whose own comment said messages must be redacted — and produces *"its configured address"*, the exact phrase the player's net already substitutes, so the two layers cannot disagree. `connect ECONNREFUSED` and `ENOENT` are deliberately **kept**: a display saying only "no reading" tells a reader nothing actionable. It probed its patterns against real error strings rather than assuming — a `\b` cannot precede a `/`, so the anchor is a lookbehind, which leaves `2026/09/29` alone, and `2340:1080` and `19.5:9` are test cases rather than hopes. Decision note `0014` with all seven rungs.

**F1.30 — the host needs the opposite of the editor's care.** The editor's `./favicon.svg` is relative because it is mounted under `/editor/`, where absolute resolves against the *player's* dist. The host serves `/` **and** `/settings` — two directories — so relative would resolve against whichever served it. One absolute path is correct for all three. Asset copied byte-for-byte, md5 verified.

**It corrected itself twice rather than papering over it.** The three `<link>` elements were already in the tree and got swept into its F1.36 commit, so F1.30's message originally claimed them; it amended the message to say where they actually are. And a grep of its own reported the links missing when they were present — **the rtk trap again** — so it re-verified instead of "fixing" a non-bug.

| F1.41 | **One option group, two spellings** | Found by the F1.25 implementer while moving copy. *Preview fit* spelled its options **"Contain"/"Cover"**; *Media fit* spelled the same two values **"cover"/"contain"** — same panel, two capitalisations of one setting, which reads as two different settings. `uiCopy.fitModes` is now the single owner, fixed inside F1.25 with its own red-without-fix test. | `ui-copy.ts` + the artboard panel |

### F1.3, F1.5, F1.25 and F1.32 landed

`9280099`, `c1b5f18`, `dbc8bff`, `3f8f7ad`.

**Description is a 4-row textarea** and all 130 characters are readable — measured `clientHeight === scrollHeight === 81` at 254px wide, so it genuinely fits rather than merely scrolling. The type panel's nine fields now sit in a label column, every label at x=1005 and every control at x=1083, matching the artboard panel.

**The copy move needed no new words in the largest panel.** The type panel's eight labels were **already in `ui-copy.panels`** — ten strings moved and not one rewritten, which is what probing existing copy before writing a new table buys. The genuinely new copy was the palette's (`paintKinds`, `angle`, `stopPosition`/`stopColour`) and `fitModes`. The new test is the net: it mounts all three panels and fails on any label the table does not hold.

**F1.32 is now legible as well as announced** — "Sample | September Tuesday" in the same label column as every other field, with the visible label and the `aria-label` both kept.

**It also named F1.41**, above: *Preview fit* said "Contain"/"Cover" while *Media fit* said "cover"/"contain" for the same two values, in one panel.

| F1.42 | **The canvas context menu cannot scroll** | Measured by the F1.39 implementer: the context menu fits at 1280 × 720 and does not fit a shorter editor window, and it has no scroll. A 13-item menu on a short window would simply be clipped at the bottom, with the last item unreachable. The editor is desktop-only, so the window can still be short. | `editor-shell/canvas-context-menu` |
| F1.43 | **A happy-path assertion got weaker** | `host-player.spec.ts:504` asserts no `<pre>` in the player happy path. After `b01b301` replaced the failure `<pre>` with a real page, that assertion still passes but now **guards a marker the failure path no longer uses** — it would not notice the failure page coming back as a `<pre>`. Re-point it at `[data-vigilia-load-failure]`. | `tests/e2e/host-player.spec.ts` |

### F1.14, F1.38 and F1.39 landed; F1.41 verified, not fixed

`b01b301`, `b861302`, `4df697c`. **F1.41 needed no commit** — both fit fields already read `uiCopy.fitModes`; the implementer proved that rather than assuming it, by sabotaging the media-fit spelling back to the raw id and watching the test go red.

**A display that could not load now says so as a page, not a strip** — so it cannot be read as a gap:

> **This display has nothing to show** — Vigilia could not load the theme this display was pointed at. `Reason: Could not load theme (404).` **[Try again]** *Go to the host*

`document.title` becomes *Vigilia — nothing to display*, so a reader with several displays open can tell which one broke. The link is underlined rather than boxed because the host's own stylesheet says a link is the only control that leaves the page.

**And the new page made an old behaviour a lie, which it fixed.** A packaged font that would not load used to call `showFailure` — but `loadFontAssets` never rejects; it reports per face and carries on. So a display **drawing correctly in a fallback** was covered by a page claiming nothing was shown. It is now a warning.

**F1.39's argument is the one to keep.** The context menu *could not* drift on charts, and that was true — but it offered **5 of 13** insertables with no shape in it, so a right-click on empty canvas was a strictly poorer version of the Insert menu one gesture away. A third surface hand-rolling a list contradicts `insertGroups()` calling itself the one owner. It now renders that list flattened, in the pane's order under the pane's headings — which is also what separates the two "Line" rows.

**A real bug its own test caught before the browser did.** A portrait document's aspect is the *reciprocal* of the ratio it would be named for, so a typed 1280 × 2778 measured **0.46** against a 19.5:9 entry of 2.17, matched nothing, and landed on 4:3 — the same stranding in a different hat. Ratios are matched long-over-short now.

### F1.42, F1.43 and F1.40 done

`75c671e`, `310cc2b`, `4ea07e7`.

**F1.43 is the most consequential result in the pass, and it was worse than one assertion.** I recorded it as `host-player.spec.ts:504` alone. It found **five** `locator("pre")` assertions — four in `host-player.spec.ts`, one in `host-media.spec.ts` — and proved the claim on a real host at a `?theme=` that cannot be served: the display showed the failure page with `preCount 0, failureCount 1`. **The old assertion passed on a dead screen.** All five now name `[data-vigilia-load-failure]`.

The reason none of it was caught: **nothing browser-tested the failure page at all.** It shipped with a jsdom test, and a jsdom test cannot see that a `<pre>` stopped being how the product fails.

**F1.42 was two CSS declarations, and the library already had them.** Base UI measures the room on the popup's chosen side and publishes `--available-height`; a context menu is positioned with the collision avoidance its own source describes as *"dropdowns that… use `var(--available-height)` to limit their height"*. The menu was the half that was missing. Measured at 1280 × 420: before, the popup's bottom sat at 475 in a 420 viewport with `scrollHeight === clientHeight` and no scroll; after, capped at 410px, `End` scrolled 55px, "Pie" fully on screen, and `Enter` inserted it. **The Insert menu carried the identical defect** and the same rule fixes it. Its test asks Fabric and `elementFromPoint` where to click rather than hard-coding a coordinate that would rot.

**F1.40 — investigated, not closed, and the cost measured.** Neither bad outcome can happen today, because the id is **inert across the boundary**: the chooser row carries it as `data-template` and links to `/editor/`, the editor's template branch calls `onNewFromStarter()` without reading `choice.id`, and no URL, route, dispatch or API resolves it. A rename leaves two surfaces spelling a label differently — a copy defect, not a broken link. Closing it *can* be done (a host-side test importing the editor's module passed), but it drags the whole starter composition and its `?url` asset imports into the host's Node run to compare two strings, and makes host tests depend on editor internals — **worse than the duplication**. It named the owner for when it does close: **`renderer-core`**, which both sides already depend on and which already carries product content both read (`MEASUREMENT_SYSTEMS`). Its own words on the margin: *"a chooser that can only open one starter has no way to say which."*

**A new shared-tree hazard, recorded below:** two concurrent Playwright runs sharing the default `test-results/` produced a spurious teardown `ENOENT` on a test that had actually passed.

### Queued — the screenshot spring clean (raised by the user, 2026-09-29)

`docs/evidence/screenshots/` holds **57 images** and a large share are stale: they show the old starter theme, an editor UI from before the current shell, or the **v1 schema**, which is queued for removal. A stale evidence screenshot is worse than none — it is a claim about the product that is no longer true, kept in the repo where a reader will believe it.

**The approach is mechanical rather than a judgement call per file.** Regenerate every registered capture from the current build with `VIGILIA_CAPTURE=1 --workers=1`, then diff: an image that regenerates differently was stale, and an image that regenerates identically was already current. That answers all 57 without anyone eyeballing each one, and it cannot be talked into leaving a stale picture because it "looked fine".

**Then** delete the README rows whose capture no longer exists or documents v1 behaviour that is going away, and say which images were dropped rather than quietly emptying a directory.

**Sequencing decided (the user, 2026-09-29): the v1 screenshots are deleted later, with v1.** Not now. Regenerating them today would make them stale again the instant v1 is removed, and deleting the rows early would leave a hole in the evidence table for a thing that still exists. So the spring clean has two passes: **now** for everything that is merely stale — the old starter theme, the pre-current editor shell — and **with v1's removal** for the captures whose subject is going away. Both are the same mechanical regenerate-and-diff; only the timing differs.

**Capture runs write straight into `docs/evidence/screenshots/`**, so this must not run concurrently with anything else holding a browser. That is why it is queued rather than dispatched while the display proof is in flight.

| F1.44 | **System disk and Data disk offer identical options** | Found by auditing the host's `/settings`, a page this pass had only glanced at. The two fieldsets render **byte-identical option lists** — the same four drives, in the same order, `st4000dm004-2cv104`, `wd-my-passport-259f-usb-device`, `lexar-500gb-ssd`, `wd-game-drive-usb-device` — and both read **"Automatic (every drive, combined)"**. So an author setting both has nothing on screen telling them what choosing differently would do, and both resolve to every drive. **The honest ambiguity:** the cause could be that the distinction is not modelled (in which case two fieldsets is the defect), or that it is modelled and the options simply fail to express it (in which case the copy and the lists are the defect). Investigate before fixing. | host `/settings` |

### The user's design review, 2026-09-29

Twenty-five items from using the editor. Recorded verbatim in intent, triaged by whether the answer is a fix, a decision, or a question. **These come from the person who has been living with the product, so they outrank anything this pass inferred.**

#### A — defects, unambiguous, dispatched

| # | Finding | Owner |
|---|---|---|
| U1 | **"Replace asset" does not replace** — it inserts a new asset | `asset-manager` |
| U2 | **"Remove asset" throws "in use" for assets nothing uses** as background media | `asset-manager` |
| U3 | **Some image assets appear in the layer panel, some do not** | layer tree |
| U4 | **History does not cover asset transform, movement or layer order** — undo just removes the asset | history manager |
| U5 | **Entering a group dims other layers in the panel but not on the artboard** | group entry |
| U6 | **Entering a group does not make other artboard objects unselectable** | group entry |
| U7 | **Exiting a text box leaves other layers dimmed as if still typing**; needs Esc to recover | text editing / group state |
| U8 | **Left rail icons are misaligned** | shell CSS |
| U9 | **The graph is visibly aliased** — needs an anti-aliasing property, default 2× | charts |
| U10 | **The artboard is not a clipping area** — an asset half outside should be clipped, with only its selection/handles fully shown | artboard / scene rendering |

#### B — decided, need implementing

| # | Decision | Note |
|---|---|---|
| U11 | **"Stroke" and "Border width" are inconsistent language — pick one** | one owner, one word |
| U12 | **The layer panel's bottom toolbar should always be visible**, not scroll with the list | |
| U13 | **A blank theme's background should be white by default** | F1.37's 1.33:1 cost is part of why |
| U14 | **A line should have two end handles *and a rotate handle***, not a diagonal bounding box — the diagonal makes alignment and snapping useless and crops both ends when the border is thick | **Corrected by the user, 2026-09-29.** Two end handles *alone* would leave a line unrotatable, because the diagonal box is what currently provides rotation — so this is a **complete transform set for Line**, not a reduction of one. **Reuse gate, rung 3 discharged, 2026-09-29:** a fresh `Line` in the installed Fabric 7.4.0 was instantiated and its controls read — `ml, mr, mb, mt, tl, tr, bl, br, mtr`, the bounding box plus rotation and nothing else. **Fabric ships no per-vertex line controls**, so this is not a matter of enabling something already there. `Line` stores its geometry as `points`, so a moved handle rewrites `points` — which is the representation the existing `scale-snapping-*` machinery already understands. **Rungs 4 and 5 are not discharged and must be before any build**: how other editors (Konva's line-with-anchors, the usual pattern) solved it, and whether the comparison changes the answer. `controls-manager/renderers.ts` already owns `ROTATE_DIAMETER` and `ROTATE_BACKGROUND` and is the place to extend. **The interaction, added by the user and gated the same way, 2026-09-29:** moving an end handle **moves that point in space**, and **holding Shift constrains the line's angle** so it extends without accidentally going off-level. Searched first: **`shiftKey` is an established modifier idiom in this codebase**, already read by `canvas-nudge.ts`, `shortcut-manager`, `snap-manager/index.ts`, `rectangular-scale-interaction.ts` and `scale-snapping-resolver.ts` — so the modifier is a reuse, not a new convention. But **there is no angle constraint anywhere**: no `atan2`, no angle step, no degree snapping, in any module. So Shift-to-constrain is reused for a new axis rather than invented. **What Shift already means in this codebase — searched, 2026-09-29, and it is one thing only.** `canvas-nudge.ts` gives Shift exactly one job: **a larger step** on the arrow-key nudge. `shortcut-manager` qualifies the arrow bindings for the same reason and its own comment says so. Beyond that, `shiftKey` is merely *plumbed* — `snap-manager/index.ts:94` extracts it, `rectangular-scale-interaction.ts:274` and `scale-snapping-runtime.ts:313` pass it along, and `scale-snapping-resolver.ts` **validates that it is a boolean without ever branching on it**. So Shift does not currently change movement or resize behaviour at all.

**Two consequences, both settled now:**

- **Shift-for-angle is a *second* meaning, and that is fine.** The near-universal convention is Shift = "constrain this gesture", and "larger step" is the same idea applied to a nudge — *"constrain the movement"* versus *"constrain the angle"*. They do not conflict semantically; they share a meaning. The 15° step is **settled by the user** (2026-09-29) and applies to **every object's rotation**, not only a line's.
- **A sharp edge the design must not walk into.** `scale-snapping-runtime.ts:375` treats a **modifier change mid-gesture as invalidating the gesture**: `if (first.ctrlKey !== second.ctrlKey || first.shiftKey !== second.shiftKey)`. A line-endpoint handle that read Shift from the pointer-move stream would therefore **restart the drag** the moment the user pressed Shift — the exact gesture they are trying to constrain. A line handle must read the modifier from the **pointerdown** that began the gesture, and must not reuse the invalidation path. |
| U15 | **A line's caps should have a corner radius** | |

#### C — needs a design pass before code

| # | Question | Why it is not a task |
|---|---|---|
| U16 | **The right sidebar needs a wholesale rethink.** Theme settings should not live inside the selection panel; *Selection* should be *Properties*; Palette and Type Presets are in the same boat; the Data tab is rarely used for charts; the Style tab displays paint and type as plain text and its purpose is unclear. How should the right side be split, structured and arranged? | This changes what three panels are for. It is a design decision with a dozen consequences, not a fix — it wants its own spec and its own review. |
| U17 | **Redesign the zoom control** as a toolbar — `−  65%  +`, zoom to fit, zoom to full, zoom to selection, and possibly a full-screen button that hides the editor layout and shows only the theme as the player would | Same: a new surface and a set of decisions about it |
| U18 | **Assets should not be their own panel.** Import → the Add pane and the Insert menu; Remove → normal layer delete; Replace → the dock toolbar and the right-click context menu | Follows from U16's reasoning; the same restructure |
| U19 | **"Preview fit" is no longer needed**, since there is full zoom control | A removal, so it needs the replacement named first |

#### D — questions, to be answered rather than built

| # | Question | Likely answer |
|---|---|---|
| U20 | **Why does glass blur stop at 48?** | `MAX_GLASS_BLUR_RADIUS = 48`, and it is a **measured** bound, not a preference: Task 1's sweep held 2.5–3.7 ms per frame across 0–64 px and first clearly rose at 128 px (6.44 ms), so 48 sits inside the flat band while bounding the worst case. Worth telling the user this is already answered and measured — and asking whether the frame budget should be revisited now that fewer panels are frosted. |
| U21 | **Can glass apply to any geometric shape, except line?** | It cannot today, and the reason is concrete: `GLASS_OBJECT_TYPES` is `Rect \| Group`, and the renderer only knows `ctx.rect` and a rounded rect. Widening it is real renderer work plus a re-measured budget. Feasible; a decision plus a task. |
| U22 | **Stroke types — solid, dashed, dotted — used to exist. Where did they go?** | **Investigate before answering.** The chart families still carry `dash` as a setting (`CHART_SETTINGS_FIELDS.line` has `dash` with solid/dashed/dotted), so the vocabulary exists for *chart strokes*. Whether a panel or text object's own stroke lost it is a separate question and may be a genuine regression. Do not guess. |

### The composition, on a display — the half the rebuild did not do (2026-09-29)

`tests/e2e/author-journey-display.spec.ts`, on `playwright.display.config.ts` (its
own preview on 4223, its own real host on 4224, its own themes directory, its own
`--output`). All eight regions in **one** document, the backdrop imported through
`Import asset`, saved by the header's own control, then shown on a real host at
1920 × 1080 and 390 × 844. 1 passed, 3.6 min.

**The gap is closed: the composition is authorable, it persists, and it is
viewable.** The player renders every region, the sensor gaps are gaps rather than
zeros (§97 intact), and nothing is clipped at either size.

#### F2.12 — **BLOCKING, filed: [#11](https://github.com/peterng1618/vigilia/issues/11) — the frosted-glass control does not carry the frosted material**

**This is the pass's headline finding, and it is the one the whole pass was
waiting to see in pixels.**

`selection-inspector/glass.ts` writes exactly one thing: the `vigiliaGlass`
treatment. It never touches the fill. So ticking **Frosted glass** puts a 40-unit
blur *under whatever fill the card already had* — and a card's fill is chosen by
`new-object-defaults.ts:474`:

```ts
const CARD_SURFACE_TOKENS = ["panel", "frost", ...SURFACE_TOKENS];
```

`panel` is ahead of `frost`, so every card an author inserts is filled with
**`palette.panel` = `#081523d9`, 85 % opaque**, and stays that way when it is
frosted. Measured on the saved package, not inferred: **all eight glass cards
carry `"fill": "#081523d9"`, `paint: { fill: "palette.panel" }` and
`blurRadius: 40`.** Not one carries `palette.frost`.

**85 % is worse than the 72 % that `0013` already rejected.** That note measured
the tint from both ends and settled on **30 %** (`#0815234d`) because the CPU
card's caption measured 4.02:1 at 18 % and 5.1:1 at 30 %. Its own words for the
failure mode: *"a blur applied under an almost-opaque panel is a blur of
nothing."* An author who does everything the surface asks — inserts a card, ticks
Frosted glass, sets the radius — lands at 85 %, further past the glass than the
value the decision note threw out.

**What it measures like.** Card interiors on the display read **35–50 luma**
while the photograph behind them spans **50–196**. The clock card sits on the
bright sky (140.8) and measures 34.5; `0.851 × 21 + 0.149 × 140.8` predicts 38.9.
The cards are not flat — they carry a smooth gradient of the backdrop — but the
transmission is the fill's own 15 %, not the 70 % the 30 % tint would give, and
the fine structure is gone either way.

**The material is reachable — through a second control, which is the other half
of the defect.** The Fill picker lists tokens by name, so `palette.frost` is
right there as **"Frosted panel"**, and one select moves a card from
`{"fill": "palette.panel"}` to `{"fill": "palette.frost"}` — asserted in
`author-journey-display.spec.ts` rather than eyeballed, because that is the whole
of issue #11: the material exists, is reachable, and is **not** what the control
labelled "Frosted glass" gives you, and nothing tells the author to go and find
it.

**Why it is asserted and not screenshotted.** The first attempt captured a second
frame with the token applied to all eight cards. It was replaced, because a test
that walks eight layers and rewrites eight fills to make a picture is a slow test
that asserts a photograph, and the thing worth asserting is the defect itself:
*the card the author frosted carries the opaque fill, and one select in another
control moves it.* Two assertions say that in a second. The pixels were gathered
once, by eye, and the numbers above are the record.

**Not fixed here, and the reason is a genuine unknown.** `ownership.md` splits
this field in two: *Shape material fields (fill, stroke, border, shadow, radius)*
is `selection-inspector/panel.ts`, and *Frosted-glass control (enable, blur
radius)* is `selection-inspector/glass.ts`. Making the second write the first is
Review Focus #4's exact trap — a second owner for one property. And the question
of **whether enabling a material should overwrite a fill the author chose** has no
precedent in the repo: a chart painted blue, then frosted, would lose its blue.
That is a product decision, it is the user's, and the plan's rule for those is
record and move on. Filed as **[#11](https://github.com/peterng1618/vigilia/issues/11)**
with the three candidate behaviours written out.

#### F2.13 — **blocking, fixed: `Background media` is on the Design tab, and the wrong tab is a ten-minute timeout**

`rebuild-composition.ts`'s `importBackdrop` opened the **Data** tab to set
Background media. The artboard panel is a *document* panel, mounted in **Design**
— `shell-layout.tsx` carries the comment *"Document panels stay mounted in Design:
a selection must not make the theme's own settings unreachable"* — so on Data the
`<select data-vigilia-background-asset>` exists in the DOM and is **not visible**,
and `selectOption` retried for the full test timeout with no message saying why.

Not a product defect; the product is right and says so in its own comment. The
helper is fixed and the reason is written down, because the same wrong guess costs
another agent ten minutes next time.

#### F2.14 — **blocking, fixed: the import helper guessed the asset's filename**

`importBackdrop` polled for an option reading `"backdrop.jpg"`. The committed
photograph is `res/author-journey-backdrop.jpg`, and `fileNameOf` renders the
file's own name, so the option read `author-journey-backdrop.jpg`. The label is
now `path.basename(file)`: a helper that guessed a name would pass on one
photograph and fail on the next.

#### F2.15 — **blocking, fixed: `rebuild-composition.ts` had never been executed by anything**

It imported `openRailPane` from `./rebuild-driver.js`, which imports it from
`./editor-rail.js` and does not re-export it. The module would not load. Nothing
caught it because **no spec imported it** — `buildComposition` and
`importBackdrop` had zero callers, and each region spec builds its own region
inline. A file of finished work that had never run is the exact thing the
screenshot spring clean and this pass both exist to surface.

#### F2.16 — **BLOCKING, filed: [#12](https://github.com/peterng1618/vigilia/issues/12) — a value run cannot be told not to print its unit, so a value and its unit print the unit twice**

The CPU card reads **`95.4%%`** and the GPU card **`1%%`** on a real display.

`unitDisplay` is a field on a `Binding` — `"none"`, `"short"`, `"long"` — and the
reference composition uses it: `new-fabric-theme-cards.ts:70` sets
`unitDisplay: "none"` on exactly the cards that follow their reading with a
literal `%`. **Only the chart manager exposes it.** `chart-manager/panel.ts:365`
renders a picker per binding; `selection-inspector/runs.ts` — the run editor, the
surface a *text* run is authored through — has no control for it at all, and
`grep -rn unitDisplay packages/` finds the field in the chart panel and the card
builders and nowhere else.

So the sequence the composition needs is unauthorable: bind the reading, turn its
unit off, add a second run for the `%` in the card's own type and colour. F2.1
made the second run possible; this is what it is for, and the unit fights it. The
saved package shows it exactly — the CPU card's binding is
`{"id": "binding-b127ad23…", "semanticKey": "cpu.load"}` with no `unitDisplay`,
and its second run is a literal `%`.

**Every editor assertion passes.** The envelope is valid, the binding is
declared, both runs persist, and `cpu.load` is the right key. The defect is
visible only in the rendered number, which is why nothing in the region specs
could have found it.

**Deferred, not fixed.** `ownership.md` puts a text run's fields in
`selection-inspector/` and a binding's in `chart-manager/`, and a text run's
binding is reached through the former while its `unitDisplay` belongs to the
latter — the same two-owner split as F2.12, and the same reason.

#### F2.17 — deferred: a 16:9 artboard uses **26 %** of a phone screen

Not a defect, and recorded because it is the first number anyone has for it. At
390 × 844 the 1920 × 1080 artboard letterboxes to **220 px of 844 — 26.1 % of the
screen height**, 312 px of black above and 312 below, and the whole composition
sits in a band across the middle.

This is the document's own choice and the presets exist for it: a **19.5:9
portrait** artboard is one click away in the chooser, and it is what a phone
display wants. What the measurement adds is that a desktop-shaped theme on a
phone is not a degraded view — it is a quarter of the screen, and the reader sees
black where they expect a dashboard.

#### F2.18 — **CORRECTED, and the correction is the finding: a §97 gap at large type reads as a solid rule, not as a gap**

**I recorded this one wrong first, and the wrongness is worth keeping.** The
clock card's reading was captured as a **solid white horizontal bar**, and I
wrote it up as a clip: a 108 px type in the 90-unit box the composition gave it,
`plan.ts:369` defaulting overflow to `"clip"`, the middle of every digit kept, a
row of digits with their middles kept being a bar. The mechanism was real and the
measurement was not.

**It is not a clip. It is a missing reading.** The crop shows two em-dashes at
108 px and weight 300 — the §97 gap glyph every other card on the same display
also shows, at 32 px where it reads as `——`. At 108 px the two dashes are long
enough and heavy enough to meet, and **a gap becomes indistinguishable from a
divider**. The card carries a rule where a reading should be, and nothing on a
wall display says which it is.

So the finding survives, and it is a better one than the wrong version: **§97 is
correct and it is not legible at the largest type in the composition.** The
honest measure is the crop — `crop-clock2.png` beside `crop-storage.png`, the
same gap at 32 px reading unmistakably as a gap.

**The clock's box was still wrong, and is still fixed.** `h: 90` under
`typePresets.108-300` is a box smaller than its own line height, which clips
when there *is* a reading — visible on the 20:54 frame, where the digits' lower
halves were cut by the rule beneath. That observation is real and it is separate.
The box is now 140.

**What this cost, stated because it is the pass's own lesson.** An hour of the
budget went into a write-up whose cause was guessed from a picture. The rule the
plan already states — *"a guess recorded as a cause sends the next person to the
wrong subsystem"* — is in `AGENTS.md`, and the thing that would have caught it
was reading **one more card** before concluding: the CPU card beside it showed
the same shape at a size where it was obviously a gap. The evidence for "this is
a clip" was a single frame, and a single frame of a *gap* is not evidence of a
clip.

#### The verdict, stated plainly

**The cards read as tinted panels, not as glass.** Not "neither", and not a
failure of the renderer: the blur is running, the diffusion is real, and the
photograph does show through as a smooth gradient. What is missing is the thing
the material is named for — at 85 % the card is mostly a fill, and a mostly-fill
card reads as a fill. The single sentence: **an author cannot author the frosted
material the reference composition is made of**, and the one control that says
"Frosted glass" is the one that should have carried it.

**The tint tension, resolved in the direction the measurement already chose.** The
fear was that 30 % would be past the ecosystem's *"past 0.25 the glass effect
dies"*. On the pixels, 85 % is the value past which the glass effect dies, and it
is the value the surface hands an author by default. 0013's 30 % was not a
compromise against the glass — it was the measurement, taken from the contrast
requirement, and the frosted capture is what that looks like against a real
photograph.

#### What the two displays look like, and what differs between them and the target

**At 1920 × 1080** the backdrop is the whole artboard, edge to edge, `cover` on a
16:9 image in a 16:9 artboard — the city fills the frame with the sunset band
behind the top row of cards and the water under the bottom row. The wordmark and
strapline sit on open sky at top left. Five cards run across the upper half
(clock, CPU, GPU, RAM, VRAM) and three across the lower (trends, storage,
network). Live readings throughout: **20:54 PM**, **Tue, Sep 29, 2026**, CPU
95.4 %, GPU 1 %, RAM 83.2 %, VRAM 14.9 %. The RAM and VRAM rings draw their arcs
in teal and magenta; the CPU and GPU sparklines are drawing; the trends panel has
three series but only a few samples of each.

**At 390 × 844** the same document letterboxes into a 220 px band — see F2.17.
The composition is legible and nothing is lost off the edge, but the cards are
small enough that the doubled `%` of F2.16 is visible even here.

**Editor against player: not compared side by side, and this is a real gap in
this record.** The composition was built in the editor and the *saved package* is
what the player drew — so the round trip is proved by the package carrying all
eight cards, their names, their bindings and their backdrop, and by the player
painting every one of them. But the editor was never captured showing the same
document beside the player's frame, and this section does not claim otherwise.
The step is in `author-journey-display.spec.ts` and is the first thing to run
when the display host is next free.

**Against the target** (`2026-09-26-reference-theme-target.png`): the layout, the
five-plus-three card arrangement, the ring positions, the legend and the type
hierarchy all follow the picture. Three differences are real.

1. **The backdrop is a different photograph at the top left.** The target's
   top-left corner is dark — a window frame and interior — where the committed
   photograph is bright sky. That is why the strapline needed `text` rather than
   `dim` (F. below): the same layout lands small type on a bright field.
2. **The target's cards carry visible blurred city structure** through the top
   row; the rebuild's do not, for the reason F2.12 gives.
3. **The target's charts are full of history**; a display that has been up for
   four minutes has three or four samples, so the trends panel reads as an empty
   card with a spike at its right edge. That is correct behaviour and a fair
   difference — a wall display runs for days, a test display for seconds.

**One more thing only a display could find.** The clock reads **`20:54`** with
the bottom of the digits sliced off by the rule beneath, and Storage reads
**`5  6  %`** with the digits spaced as three glyphs. Both are authored boxes
that fit in the editor's inspector and do not fit the type they were given — the
clock's 108 px preset in a 90-unit box, the storage value in a box too narrow for
its own reading. Neither an envelope assertion nor a canvas-object count could
see it.

### Hotkeys: the default audit, and the customisation panel (2026-09-29)

The user asked for two things: expose the shortcut manager to the settings panel with customisable keys, and make the **defaults follow graphic-editor convention** so nobody is thrown off. The audit came first, because knowing what exists is the reuse half of the gate.

**Sixteen of twenty defaults already match** Photoshop / Figma / Affinity / Canva: `Ctrl+N` new, `Ctrl+O` open, `Ctrl+S` save, `Ctrl+Z` undo, `Ctrl+C/X/D` copy/cut/duplicate, `Ctrl+G` and `Ctrl+Shift+G` group/ungroup, `Ctrl+A` select-all, `Delete`/`Backspace`, arrows to nudge, `Escape` to leave a group.

**Two deviate, and the second is the one that will bite.**

| # | Finding | Standard | Note |
|---|---|---|---|
| U23 | **Redo is on `Ctrl+Y`** | **`Ctrl+Shift+Z`** in Photoshop, Affinity and Figma today | `Ctrl+Y` is the *legacy* Windows redo. Someone arriving from any of the three named tools will press `Ctrl+Shift+Z` and get nothing. Figma accepts both, which is the cheap fix: **add `Ctrl+Shift+Z`, keep `Ctrl+Y`** as a secondary binding rather than replacing it and breaking anyone who learned it here. |
| U24 | **Front/back are on bare `Ctrl+[` and `Ctrl+]`** | Bare `[` / `]` are *order* (backward/forward one step); **`Ctrl+Shift+[` / `Ctrl+Shift+]`** are *to front* / *to back* in all three named tools | The current pair is not a binding most users have in their fingers at all — it is a Ctrl-modified *character*, which is a browser/OS chord before it is a design-tool one. |

**The customisation panel is a design pass, not a task** — like U16–U19 it needs its own spec, because a keybinding editor is a surface with its own conflicts-with-the-browser question, its own discoverability, and its own answer to "what happens when a user binds the same chord twice". It joins **group C**, and the two default corrections (U23, U24) are small enough to do first and independently.

### The right sidebar — decided by the user, 2026-09-29

**Four panels, each with one job, and the tokens move left.**

| Panel | Job |
|---|---|
| **Properties** | Whatever is selected — geometry, material, glass, runs, **and a chart's settings when a chart is selected** |
| **Bindings** | Mapping a sensor source to a data token, and formatting it |
| **Theme settings** | The document's own metadata |
| **Design tokens** | **Moved to the left**, beside Layers — paint and type presets |

**The reasoning the user gave for moving tokens left, which is the load-bearing part:** a token is *like a layer* — it is not a visual object you can move, transform or arrange on the dashboard — **but selecting one shows its configuration in the same standard Properties panel.** So the left column holds *what exists* (layers and tokens, both non-spatial) and the right holds *what the selection is*. That is a cleaner rule than "left is spatial, right is not", because Layers and tokens turn out to share a property the eye missed.

#### What Figma does (checked against Figma's own help docs, 2026-09-29)

**The principle agrees with the user; the placement does not.**

- **Left navigation panel.** The **File tab** gives you **layers and pages** — what exists in the file. The **Assets tab** gives you local components and libraries. So Figma's left column is already *"what exists"*, and it already carries a second, non-spatial tab beside Layers.
- **Right properties panel.** Tabs are **Design** and **Prototype**. With a layer selected you get its properties — layout, position, corner radius, constraints, fill, stroke, effects, text, export. **With nothing selected, the same panel shows local styles and variables.** Figma's words: *"When you don't have anything selected, you can view local resources, like color or text styles."*
- A styled layer shows *"only the style name and icon"* in the right panel — the style is referenced, not inlined, exactly as §73 requires here.

**So Figma puts tokens on the *right*, in the no-selection fallback — not on the left.** Two things follow.

1. **The user's instinct is corroborated by the principle, and by Figma's own left-column shape.** Figma already has Layers and a non-spatial Assets tab side by side on the left; adding a Tokens tab there is the same pattern, not a new idea. And Figma independently arrived at *"the properties panel is for the selection; document-level things appear when nothing is selected"* — the same rule the user's four-panel split rests on.
2. **There is a discoverability cost Figma has already paid and named.** Its own UI3 notes say the **variables modal is "not discover"**. A token surface nobody finds is a token surface nobody uses — which is an argument *for* the left column, where a tab is visible rather than a fallback you have to know exists.

**Open for the design pass:** whether tokens get a visible **left tab beside Layers** (visible, follows Figma's Assets precedent, costs a second non-spatial tab) or Figma's **no-selection fallback in Properties** (one surface, already corroborated — and already known to be hard to find). The design pass should decide with the user's "left, because it's like a layer" reasoning on the table, and the honest counter that Figma chose the other one.

### The player on a phone — decided by the user, clarified twice, 2026-09-29

**Content is never cropped. A landscape theme on a portrait phone stays landscape.** What the reader gets is either a **large letterbox** or a **heavily scaled background media** — and which is the author's intent, overridable by the user's own setting.

**So the current behaviour is already correct and nothing structural needs building.** The content's fit stays `contain`; the background-media fit is the lever, and it already exists. The two remaining consequences are small and real:

- **U19 is withdrawn as a design ask.** "Preview fit is no longer needed" is not right — it is the *content's* fit, it must stay `contain`, and removing it would remove the guarantee that content is never cropped. What survives is a **naming** question: the product has two fit controls — *Preview fit* for the artboard in the editor, *Media fit* for the backdrop — and F1.41 already found them spelled inconsistently. Two controls called "fit" meaning different things, in one panel, is the actual defect.
- **A phone in the wrong orientation is an authoring answer, not a rendering one**, and the New chooser now makes the right shape one control away.

### The rebuild finished — and what it did not do

### Glass on non-rect shapes — investigate before deciding (2026-09-29)

Rungs 4 and 5 first: how the ecosystem frosts non-rectangular shapes and what it costs them. No renderer change until that answer is in.

### The rebuild finished — and what it did not do

Nine tests, 1.9 minutes, all eight regions built from their own blank theme through the delivered UI. **Full Playwright: 206 passed, 143 skipped, 5 failed, exit 1** — and the agent read each of the five rather than counting them: two are stale assertions against landed work, one is filed issue #7, one sits in a file another agent was editing, and one is a player chroma threshold in a file it had not touched. It fixed the one that was cleanly its own: `display-fabric.spec.ts:663` still asserted a string `player/src` has not contained since F1.14, so it guarded nothing and could not pass.

**Two things it did not do, both of which are the next task:**

1. **Nothing has been seen on a display.** Every region is proved *in the editor*. Task 11's first half — save the rebuilt theme, open it on a real host, compare the player against the editor — is not done. Given that a phone is the main display type, this is the largest remaining gap in the proof: the pass proved the composition is *authorable* and never proved it is *viewable*.
2. **The backdrop is absent, and the reason was a genuine constraint collision — now resolved by the user.** The only photograph in the repo is the starter's own, and using it would be exactly the starter file the rules forbid. So every card is frosted over a flat colour rather than a photograph — which means the frosted material has been rebuilt and persisted but **never seen against an image**, which is the one thing the tint, the grain and the diffusion exist for. **The user supplied their own photograph** — Unsplash `CQhgno3yhv8`, "buildings near ocean", stated to be theirs, so no `THIRD-PARTY-NOTICES.md` entry is owed for a test asset. It is to be imported through the real control, not written as a fixture.

### The rebuild — what the proof was for

**The reference composition was, until this pass, essentially unauthorable by hand.** The generator emitted it; no author could have built it. Eleven findings, eight classified blocking, all eight fixed and landed:

| # | Finding | Why it was blocking |
|---|---|---|
| **F2.1** | A text object could never carry a second run, and a run's text had no field at all | A mixed reading — "62%" plus a unit, the single most common element on a dashboard — could not be authored |
| **F2.2** | **A chart could not be bound to a sensor** | Every chart in the composition was unauthorable. The composition is mostly charts. |
| F2.4 | The Add pane's Text was a centred, un-wrappable `IText` | Not the `Textbox` every shipped theme authors |
| F2.5 | W/H **scaled a text object's type** | `scaleX 3.448`, `scaleY 0.439` for a 220 × 40 box — type sized by the box |
| F2.8 | A path sized before it was drawn rendered at **1/14** of its size | |
| F2.9 | X/Y were the chart's centre | A gauge placed at (1069, 258) drew at (969, 158) — the position field lied about where it put things |
| F2.10 | The Format field never named its vocabulary | A date painted as raw `EEE, Sep d, yyyy` |
| F2.11 | A three-series chart had **one** series colour | The Trends panel is three series |

Three deferred as product decisions with no precedent, each with its candidates written out: **issues [#8](https://github.com/peterng1618/vigilia/issues/8), [#9](https://github.com/peterng1618/vigilia/issues/9), [#10](https://github.com/peterng1618/vigilia/issues/10)**.

**And the shape of the work, which is the finding worth keeping.** Once the surface was honest, all nine tests build and pass in **1.9 minutes**. The first three regions took longer than the last five combined — the pass was more than half *fixing the surface* than building on it. That is the argument for doing a proof pass before shipping: the cost of an unauthorable product is not the hours to build the thing, it is that nobody can build it at all.

*(Full Playwright counts pending — the suite was at 54/354 when this was written.)*

### The blank theme works, end to end — the plan's premise, verified

Driven by hand, not read off a report. **New theme** → chooser → Create → the dirty guard when the document is unsaved → **0 objects at 1920 × 1080**, Name "New theme", Author "Vigilia", Description empty, and **Background "Chart track" / Bar colour "Panel"** — the minimal ten-token palette resolving, with nothing reading "not set" anywhere.

Then, as an author: a **Rectangle** and two **charts** all insert with palette-backed defaults, and the selection inspector shows a **Name** field (F1.8), geometry, opacity, and the chart's own paint — *"Stroke paint: palette.text → #ecf5ff"*, *"Series paint 1: palette.text → #ecf5ff"* — which is **F1.35 already fixed** in a live build.

**The premise holds**: an author can start from nothing, put something on it, and every control they touch resolves.

### Filed, because a decision nobody can read is a decision lost

The three deferred findings above are product questions with no precedent in the
repo, which the Global Constraints say to record and pass over. They are also
exactly the shape that a plan cannot carry alone, so each is an issue with its
candidates written out:

| Issue | Finding | The open question |
|---|---|---|
| [#8](https://github.com/peterng1618/vigilia/issues/8) | F2.6 | keep minting token ids, or derive one from the name at creation |
| [#9](https://github.com/peterng1618/vigilia/issues/9) | F2.7 | what the Height field means before the author has authored a height |
| [#10](https://github.com/peterng1618/vigilia/issues/10) | F2.11's limit | whether a series' colour belongs to a slot or to a binding — a format change, or nothing at all |

### The broad gate, and what its five failures were

`typecheck`, `test` (2110) and `build` and `size` exit 0. `format:check` and
`lint` are clean over **every path this pass touched** (183 files, "No fixes
applied") but **red tree-wide**, on `tests/e2e/rebuild-composition.ts` — an
untracked file another agent is writing against this pass's `rebuild-driver.ts`
right now. It is not staged, not formatted and not touched: another agent is
mid-flight in it, and a format pass over their half-written file is the same
collision as the glass one below.

The full local Playwright suite was run twice, alone, reading the exit code
directly. **First run: 206 passed, 143 skipped, 5 failed, exit 1.** All five
were read rather than skimmed, and **none was this pass's**; the one that was
cleanly mine to fix is fixed and the suite was re-run. **Second run: 209
passed, 143 skipped, 2 failed, exit 1.**

| Failing test | Cause | Whose |
|---|---|---|
| `display-fabric.spec.ts:663` "unknown hosted themes show a clear load failure" — **×2** (desktop + phone) | **Stale assertion.** It expects `"Vigilia could not load this theme"`, a string `player/src` has not contained since **F1.14** (`b01b301`, which landed *before* this pass's first commit). F1.14 replaced the bare `<pre>` with a real page, so the test asserts copy that does not exist. **Fixed here** — the same class as F1.43 — re-pointed at the page the failure path actually renders, and it now asserts the reason and both ways out as well as the absence of a drawn scene. Red without the fix: 1 test red on the old text | F1.14's implementer left it; I fixed it |
| `glass-authoring.spec.ts:171` "refuses a radius past the published bound" — **still red** | Asserts `#status` is **exactly** `"Theme package saved"`, but the footer also carries `"Warning: That value cannot be applied to the selection."` — the **F1.15** refusal surface, whose copy is in `ui-copy.ts` from `9290bdd`, long before this pass. An exact-`textContent` assertion on a footer that now legitimately carries a diagnostic | **Deliberately not touched.** `glass-authoring.spec.ts`, `glass.ts` and `glass.dom.test.ts` were uncommitted in the shared worktree on both runs — another agent is editing that file right now, and its fix will move underneath mine. The cause is established and the fix is one assertion; it belongs to whoever is in that file |
| `reference-theme.spec.ts:365` "a new document is the reference composition" | The `Ctrl+N` **Discard** prompt timeout — **issue [#7](https://github.com/peterng1618/vigilia/issues/7)**, recorded as pre-existing with cause not established and reproduced at HEAD by its own implementer | Not mine, not fixed, already filed |
| `host-player.spec.ts:542` "paints its charts in the theme's own palette" | A **chroma threshold**: measured 412 against a `> 500` bound, on the *reference* theme rendered by the *player* | **Passed on the re-run**, so it is a rendering-threshold flake rather than a regression — which is the answer a single run could not have given. `packages/player` is **zero files** in this pass's diff either way |

**Stated plainly because the gate is this pass's to run:** the suite is **red**,
and the rebuild is not the reason. What remains is one stale assertion in a file
another agent is editing, and one filed pre-existing bug whose cause is not
established. Neither is a region of this pass, and neither was made worse by it.

### The full suite again, after the display pass (2026-09-29)

**209 passed, 143 skipped, 2 failed, exit 1**, 18.8 min, `--workers=1`, exit code
read directly. `typecheck`, `lint`, `format:check` and `npm test` (**2110**) all
exit 0 — and `lint` and `format:check` are now clean **tree-wide**, because
`rebuild-composition.ts` is no longer another agent's untracked half-written file.

| Failing test | Verdict |
|---|---|
| `glass-authoring.spec.ts:171` "refuses a radius past the published bound" | **Fixed and verified — 4 passed, exit 0.** The deferral above is lifted: the file's owner finished and committed, so the file was clean and the collision was over. The helper asserted `#status` **equals** its text, but that footer is F1.15's diagnostic surface and the radius test's *own* refusal is on it — the test's next three lines assert exactly that refusal. Contains, not equals. A stale assertion, not a defect |
| `reference-theme.spec.ts:365` "a new document is the reference composition" | **Still red, still filed, still not established.** The `Ctrl+N` **Discard** prompt timeout — issue [#7](https://github.com/peterng1618/vigilia/issues/7), reproduced at HEAD by its own implementer. Not mine, not fixed, cause not established |
| ~~`display-fabric.spec.ts:663` ×2~~ | Closed earlier in this pass — the stale `"Vigilia could not load this theme"` string F1.14 removed. Green in this run |
| ~~`host-player.spec.ts:542`~~ | Green in this run, as on the re-run before it. The chroma threshold does not reproduce |

**So: of the five the pass inherited, four are closed and one remains**, and the
one that remains is a filed, pre-existing, cause-not-established bug in a test
this pass does not own. The suite is still red, and the display work did not make
it redder — the two failures were both red before it.

**What the display pass did to the suite: nothing, and that is the finding worth
stating.** `author-journey-display.spec.ts` is excluded from the shared config
for the reason the rebuild is — it needs its own preview and its own host — so
adding it changed no shared test. The gate it *does* answer is the one no suite
answered: a composition on a display, which is where F2.12 and F2.16 came from.

### Where the rebuild stands

**Eight regions, each built from its own blank theme, every step a pointer or a
keystroke.** `tests/e2e/author-journey-rebuild.spec.ts`, run on its own config
and its own preview so it cannot race the suite's shared servers. The scene is
read through the editor handle and never written: no `page.evaluate` in the file
sets a value a click would set.

| Region | What it needed that the surface did not have |
|---|---|
| Wordmark, strapline, clock card | F2.4 (a text object that is placed by its middle and does not wrap), F2.5 (a size field that scales the type), F2.8 (a hairline is a path, and a path could not be sized before it was drawn) |
| Live clock and date | F2.1 (the day period is a second run), F2.10 (the Format field's vocabulary) |
| CPU card | F2.1 (reading + unit on one object), F2.2 (the sparkline bound to the same key as the reading) |
| GPU card | as the CPU card, with a second palette token |
| Both memory rings | F2.2 (a gauge bound to a sensor at all), F2.9 (a chart placed by its centre) |
| Trends panel | F2.2 — three series on one chart, which was unauthorable in every family |
| Storage bar | F2.1 (the value and its unit), F2.2 (a bar bound to a sensor) |
| Network panel | F2.2 — two series, two keys, two tokens |

**Not built, and the reason.** The full-bleed sunset backdrop is an artboard
*Background media* choice, and the only photograph in the repository is the
starter's own `starter-backdrop.jpg`. Importing the shipped asset to prove the
control works would be using a starter file, which the Global Constraints
forbid — so the backdrop is **absent from the rebuild and unverified**, and
every card is therefore frosted over a flat colour rather than over a
photograph. That is the same condition F1.37 records from the other side: glass
over nothing is a blur of nothing, and the frosted-card verdict stays the user's
to give.

**What it cost, against the estimate.** The plan budgets Tasks 7–11 as a
sequence of small browser tasks; in practice the surface blocked twice over
before any region could be laid out, and the pass was **more than half fixing
the surface** rather than building. F2.1, F2.2, F2.4, F2.5, F2.8, F2.9, F2.10
and F2.11 were **all eight classified blocking**, and the sequence each time was
measure, fix, red-without-fix, rebuild, re-measure — roughly half an hour,
eight times over, before a single card looked like the target. The regions themselves were fast once the surface
was honest: a card is an insert, six fields and a bind, and the whole eight
build and pass in under two minutes. **The lesson the pass pays for:** the
value of a proof like this is entirely in the first hour, and everything after
it is bookkeeping.

**The envelope, proved.** Task 11's second half — the *persisted package* rather
than the live DOM — is covered by one test that builds the CPU card, presses the
header's **Save package**, unzips the file the browser downloaded and reads
`theme.json` out of it. Asserted on the saved document, not the screen: the
artboard is the 1920 × 1080 the chooser was asked for; the value object's
`vigiliaText.box` is the 220 × 60 the author typed; its two runs are a value run
and a `%` literal; `cpu.load` is **declared in the envelope's bindings**; the
card's `vigiliaGlass.blurRadius` is 40; the card's fill, the icon's stroke and
the chart's settings are all `palette.*` references and the chart's settings
contain **no hex literal at all**; and the four objects carry the names the
author gave, with the stable key still separate — F1.8's shape, asserted.

**Not run, and why.** Two things remain, and both are stated rather than
implied:

- **Nothing has been seen on a display.** Every region is proved in the editor.
  Task 11's first half — open the saved theme on a real host and compare the
  player against the editor — is **not done**, and a dashboard that renders
  differently on a player than in an editor is exactly the finding that pass
  exists to catch.
- **The full-bleed backdrop is absent**, so every card is frosted over a flat
  colour rather than a photograph. See above.

The spec takes the repo's own desktop guard (`surface.ts`, in a `beforeEach` with
`testInfo`, the form `panel-labels.spec.ts` uses), because the shared
`playwright.config.ts` runs every spec on every project and the editor is not a
phone surface.


---

## The rebuild — the composition, built from blank by hand

Started 2026-09-29 against the tree at `594021f`. Every step below is a pointer
or keyboard gesture against a delivered control; the driver reads the scene
through the editor handle and **writes nothing to it**. The two regions below
were blocked outright, and the fixes are in the *Found by the rebuild* table.

### F2.1 — **BLOCKING: a text object could never have more than one run, and a run's text could not be typed at all**

**The composition is mostly multi-run objects.** "32" is a reading and "%" is
prose; "13.4 / 32 GB" is two readings and a unit; "4.8 GHz │ 62 °C" is three runs.
None of it exists without a second run on one object.

Measured on a blank theme at `594021f`:

- `new-object-defaults.ts:378` gives a new text object a **tuple of exactly one
  literal run**, and `createNewObjectPanel` inserts nothing else.
- `selection-inspector/runs.ts` renders one row per existing run and has **no
  control that adds or removes one** — the run editor's button count is `0`.
- It has **no field for a run's own text** either. `sourceField` can turn a run
  into a reading or back into prose, but the prose it produces is always `""`.
  So the only route to any text at all was in-place editing on the canvas.

**And in-place editing could not be the answer.** `keepTypedText`
(`text-manager/index.ts:38`) writes `object.text` back as run 0 and **drops
every other run**. For a one-run object that is the documented, intended
behaviour. Once a second run exists it is silent data loss: a value run becomes
prose and its sibling vanishes, with no record that either happened.

**Fixed in the pass** — the run editor is the owner (`ownership.md`: "Selection
geometry, appearance, runs and text layout"). An `Add run` control that inherits
the previous run's preset and colour, a per-row `Remove run N` (withheld on the
last run, because a run-less text object paints nothing), and a `Run text` field
for a prose run — none for a value run, which has no words of its own. Removing a
value run releases the binding only it could read, for the reason the source
field already gives. The refusal belongs to `text-manager`, which is the §67
owner of the write-back: `keepTypedText` now answers `"refused"` for a
multi-run object, the editor's own diagnostics say why, and the runtime repaints
so the canvas is not left standing on text the document does not hold.

### F2.2 — **BLOCKING: a chart could not be bound to a sensor, so no chart in the composition was authorable**

`chart-manager/panel.ts` renders one row per binding **the chart already has**.
Nothing declares the first one. Measured on a blank theme: a `Line` chart
inserted from the Add pane shows **0** `[data-vigilia-binding]` controls, and
`ChartManager.addChart` creates no binding.

`buildChartPlan` (`renderer-core/src/scene/plan.ts:615`) makes a line series, a
bar and a slice one binding each. So the CPU and GPU sparklines, the three-series
trends chart and the two-series network chart were **all unauthorable** — the
sparkline could not be bound to the same key as the reading beside it, which is
Review Focus #3's exact failure: a card able to show a percentage and a waveform
for two different moments.

**Fixed in the pass**, inside the owner `ownership.md` names for it
("Chart selection/settings/bindings"). A `Add a series` chooser of semantic keys —
one control, because a binding cannot exist without the key it names, so asking
for both at once removes the state where a chart holds one the panel must repair
— plus a per-series remove, withheld on the last. The gauge is capped at one
because `buildChartPlan` reads `bindings[0]` and ignores the rest: a second there
would be a control that accepts an edit and applies none, so the chooser is
disabled and the panel says why. All three binding writes now go through one
`#writeBindings`, so the envelope, the redraw and the panel cannot disagree.

### F2.4 — **BLOCKING: the text object the Add pane inserts is not the text object the product authors**

Found the moment the first object had to be *placed*, because the composition is
alignment-critical: a wordmark's left edge at 120, a card's left edge at 40, a
reading centred in its card. Two measurements, both on the live surface.

**X and Y meant two different things on the same field.** `TextManager.addText`
built a Fabric `IText` with Fabric's **centre** origin; a `Rect` is created with
`originX: "left", originY: "top"` (`NewPanelDefaults` says so in its own comment:
*"so the inspector's X and Y are the panel's edges"*). Measured:

| | originX / originY | X = 120 puts the… |
|---|---|---|
| Text from the Add pane | `center` / `center` | **middle** at 120 |
| Rectangle from the Add pane | `left` / `top` | **left edge** at 120 |

`selection-inspector/index.ts:59` claims *"the numbers an author types match what
they placed"*. For a text object they did not. A label could not be lined up with
a card at all.

**Wrap accepted an edit and did the opposite.** The run editor offers Align, Wrap
and Overflow to every object carrying `vigiliaText`. Two of the three are
`Textbox` behaviour and an `IText` has none of it. Measured, with a 57-character
caption, Wrap **on**, and W typed as 200:

> `width 749`, rendered **1193** — one line, straight past the box, and
> `vigiliaText.wrap` reads `true`, so the document records the ask.

The 200 is then gone: the object is 1193 wide and the W field will say 1193. A
starter `textbox` with the same content reports 262 and honours it.

**Both fixed, and they are one fix.** `text-manager` owns text creation, and
`new-object-defaults` owns placement:

- `addText` builds a **`Textbox`** — the class every text object in a shipped
  theme is authored as (`new-fabric-theme-objects.ts:130` emits `type: "Textbox"`,
  `originX: "left"`), and the only one that wraps.
- `createNewTextDefaults` sets `originX: "left", originY: "top"`, beside the
  `NewPanelDefaults` that already does, so one rule covers both.

The stale comment that called a centre origin "Fabric's own default" was wrong —
Fabric's default is left/top; the centre was the editor's own — and is corrected
where it was.

### F2.5 — **BLOCKING: the Size fields on a text object stretched the type instead of sizing the box**

The third of the family, and the one that made the composition impossible to
lay out. Found by looking at the first device card rather than at its numbers.

A `Rect`'s `width` is a natural size and scaling it is how the object changes
size, which is why the inspector writes `scaleX`. **A `Textbox`'s `width` is the
box its text wraps inside** — it is not a size to scale. Measured on a caption
at the `24-400` preset (`fontSize` 32), asking for a 220 × 40 box:

| | scaleX | scaleY | fontSize | result |
|---|---|---|---|---|
| before | 1 | 1 | 32 | a 64 × 91 one-line caption |
| W = 220 | **3.448** | 1 | 32 | the type at 3.4× its width |
| H = 40 | 3.448 | **0.439** | 32 | and squashed to 44 % of its height |

The field says **Size**. On a text object it was a distortion control wearing a
size field's label — and the composition is nothing *but* precisely-sized text
boxes: a 300-wide clock, a 306-wide rule, a 220-wide caption.

**Fixed in the owner `ownership.md` names** — "Selection geometry, appearance,
runs and text layout", which is `selection-inspector/`. ADR 0003 already decided
that `vigiliaText.box` owns a text object's box because a `Textbox` cannot hold
one; the inspector was writing past that owner. It now writes the authored box
and re-asserts it through `applyAuthoredText`, and reads it back so the field
shows the box rather than whatever the text happens to measure. A shape still
scales: the same field, the other kind of object.

Re-measured after the fix: W = 220 gives `scaleX` **1**, `fontSize` **32**, the
caption wrapped to two lines inside a 220-wide clip, and H = 40 gives a 40-tall
clip.

### F2.8 — **BLOCKING: a Path's data field could not draw anything an author had already sized**

Found by looking at the device cards and asking where the chip icons were.

**A polygon's points, a polyline's points and a path's commands are all absolute
coordinates in the object's own space**, so any `scaleX`/`scaleY` on the object
is a scale from a *different drawing*. Measured:

| | scaleX | scaleY | own size | drawn |
|---|---|---|---|---|
| a path as inserted | 1 | 1 | 360 × 150 | 360 × 150 |
| after W = 28, H = 28 | 0.0778 | 0.1867 | 360 × 150 | 28 × 28 |
| after 14 × 14 of **new** data | 0.0778 | 0.1867 | 14 × 14 | **1 × 3** |

The author drew a 28-unit icon and got a one-unit speck — and **insert, size,
then draw is the order every icon in a dashboard is built in**, because the size
is what the author knows before they know the path data. The polygon's branch
already kept half the rule (*"the points remain the only persisted truth"*); it
re-measured but left the scale belonging to the old points.

**Fixed in the owner** — `selection-inspector/panel.ts`, which `ownership.md`
gives "each shape's own geometry". One `adoptGeometry` for all three kinds:
re-measure, and take the scale back to 1, so the data wins and the W and H
fields mean what they mean everywhere else.

### F2.9 — **BLOCKING: X and Y were still the centre on a chart**

F2.4's defect, one object kind later, and the reason the gauge could not be put
in its card. `newChart` never set an origin, so a `VigiliaChart` arrived with
Fabric's **centre** origin — while a `Rect`, a `Path`, a shape and (after
F2.4) a text object were all corner-anchored. Measured, a 200 × 200 gauge:

| | placed at | drawn at |
|---|---|---|
| `getBoundingRect` before | (1069, 258) | **(969, 158)** |
| after the fix | (1069, 258) | **(1069, 258)** |

Exactly half its own size away on each axis. A chart is the object a dashboard's
layout is most sensitive to — six of them, each sitting in a card — and this was
the last kind where the inspector's X and Y did not mean what the field says.

Fixed in `chart-manager`, which `ownership.md` makes the owner of chart
creation. `boxFrom` (`authored-box.ts:42`) already converts between the two
origins on the way out — *"so a v2 document's left/top-corner text and the plan
path's centred text share one owner"* — so a saved chart is unaffected either
way, and this is an authoring-surface fix, not a format change.

### F2.10 — the Format field never said which tokens it accepts

Found by reading the clock card rather than the code: the date line painted
**`EEE, Sep d, yyyy`** — its own format string, on the canvas.

**The formatter is right and the field was silent.** `format.ts` documents a
deliberately small vocabulary (`YYYY YY MMMM MMM MM M dddd ddd DD D HH H hh h
mm ss A a`) and states the rule: *"An unrecognised token renders literally
rather than blanking the value, so a typo is visible."* My pattern was the ICU
one — `EEE`, `d`, `yyyy` — and the product said so by echoing it.

That rule is right for a formatter and **wrong for a wall display**, which is
where the echo lands. The author is not looking at the display. Nothing in the
panel listed the vocabulary: the field's `placeholder` is the key's own default
pattern, and the live preview beside it is the only place a mistake shows — which
is discoverable, but only if the author happens to read a preview they did not
ask for.

**Fixed in the owner** — `selection-inspector/runs.ts`, beside the format field
itself, using the class the run editor's other notes already carry. Copy in
`ui-copy.ts`. The vocabulary is now named where the pattern is typed. Authoring
`ddd, MMM D, YYYY` instead paints **`Tue, Sep 29, 2026`**, verified on the canvas.

### F2.11 — **BLOCKING: a three-series chart had one series colour**

Found by looking at the trends panel rather than at the binding list, which is
the only reason it was found at all — the assertions passed.

F2.2 made three series on one line chart reachable. The **colours** were still
one: the Data panel showed a single **Series paint 1**, and all three lines drew
in it. A new chart declares `palette: [one entry]`, the panel renders one picker
per entry in that array, and **nothing extended the array when a binding
arrived**. The target's trends panel is blue, violet and teal.

**Fixed in the owner** — `chart-manager`, which `ownership.md` names for
"Chart selection/settings/bindings". `seriesPaintFor` reconciles the family's
`multiple` paint with the number of bindings, reading *which* field repeats from
`chartPaintFieldsFor` rather than restating it, so a line's series paint and a
pie's slice paint are the same rule and a gauge — whose track and progress are
not per-series — is left alone. A new entry repeats the last one, which is what
an author extending a chart means.

**Its own limit, stated.** The two arrays are coupled **by index**, and the
remove control removes a binding by id. Adding and removing the *last* keeps
them aligned; removing a middle binding shifts the colours that follow it. Not
fixed here, because the alternative is a re-ordering rule the model does not
express and a colour would have to be a property of a binding rather than of a
slot — a format change, and a product decision.

### Found by the rebuild — fixed here

| # | Finding | Class | Fix | Proof |
|---|---|---|---|---|
| F2.1 | A text object could never carry more than one run, a run's text had no field, and an in-place edit silently dropped the siblings | **blocking** — the journey cannot complete | `selection-inspector/runs.ts`, `text-manager/index.ts`, `editor-interaction.ts`, `editor-session.ts` | 5 new run tests + 1 new text-manager test. Red-without-fix: disabling the add control took 1 red; restoring the flattening took 1 red |
| F2.2 | A chart could not be bound to a sensor from the UI, so every chart in the composition was unauthorable | **blocking** — the journey cannot complete | `chart-manager/panel.ts`, `chart-manager/index.ts` | 3 new panel tests. Red-without-fix: disabling the chooser's dispatch took 1 red |
| F2.4 | The Add pane's Text produced a centred, un-wrappable `IText` — a different class from every text object the product authors — so X/Y meant something else than on a card and Wrap recorded an ask it did not honour | **blocking** — the composition cannot be laid out | `text-manager/index.ts`, `new-object-defaults.ts` | 3 new tests. Red-without-fix: `Textbox` → `IText` took 2 red; dropping the origin took 1 red |
| F2.5 | The Size fields scaled a text object's type instead of sizing its box, so every precisely-sized label in the composition came back stretched or squashed | **blocking** — the composition cannot be laid out | `selection-inspector/index.ts` | 3 new tests. Red-without-fix: the write half took 1 red, the read half took 1 red |
| F2.8 | A path sized before it was drawn came out at a hundredth of its size, because the scale belonged to the previous data | **blocking** — no icon in the composition can be drawn | `selection-inspector/panel.ts` | 2 new tests. Red-without-fix: dropping the scale reset took 2 red |
| F2.9 | X and Y were the centre on a chart and the corner on everything else, so every chart landed half its own size from where it was put | **blocking** — no chart can be placed | `chart-manager/index.ts` | The existing four `addChart` cases now pin the origin. Red-without-fix: reverting to centre took 3 red |
| F2.10 | The Format field never named the vocabulary, and the formatter's "a typo is visible" rule makes the mistake visible on a display rather than in the editor | **blocking** — the date line painted its own format string | `selection-inspector/runs.ts`, `ui-copy.ts` | 1 new test. The vocabulary is named beside the field; `ddd, MMM D, YYYY` now paints `Tue, Sep 29, 2026` on the canvas |
| F2.11 | A chart's per-series paint was never extended when a series was added, so a three-series trends chart had three lines and one colour | **blocking** — the target's three trend colours are unreachable | `chart-manager/index.ts` | 2 new tests. Red-without-fix: dropping the reconciliation took 1 red |
| F2.3 | The New chooser's replacement guard reads as an error | deferred | — | `Create` is followed by a `Save changes before opening another theme?` prompt on a document nobody edited. It is correct and it is what stops work being lost, so it stays; the chooser simply does not say the second step is coming |
| F2.6 | A palette token's id says nothing about the token | deferred | — | A colour added through the panel is minted `colour`, `colour-2`, `colour-3`; the author types "CPU blue" and every picker *lists* it that way, while the reference the document carries is `palette.colour-3`. F1.18's class in reverse — here a token the author **named** wears an id that describes nothing. **Not fixed, and the reason is a decision, not an oversight:** re-keying an id breaks every reference to it, and deriving one from a name the author types *after* the click needs state that records "nobody references this yet", which the model has no place for. `palette-manager`'s doc comment states the current design deliberately. This is a genuine product question with no precedent in the repo for the alternative, which is what the plan says to record and pass over. |
| F2.7 | A text object's Height field shows a measurement that is already stale | deferred | — | With no authored `box.height`, the field shows Fabric's measurement — and Fabric remeasures when the text rewraps without firing anything the panel listens for. Measured: after W = 220 wrapped a caption to two lines, the object measured **59** and the field read **91**. The width half of the same finding is fixed (F2.5); this one needs a "measured, not authored" state the field can show honestly, which is a product decision about what the field means before the author has touched it. |

**The blank theme itself is sound.** Zero objects, ten palette tokens, thirteen
type presets, all three inspector tabs populated, and the Add pane offering
`Text`, `Shape` (8) and `Chart` (4). Nothing on that screen reads "not set"
except the two artboard paint fields, which are correct.

---

## The delivered surface, as found

Written 2026-09-29 against the tree, not inherited. Every key below was read from source; the rebuild drives **these** and nothing else.

| Control | Selector | Owner |
|---|---|---|
| Geometry X/Y/W/H/rotation | `[data-vigilia-geometry]` | `selection-inspector/index.ts` |
| Artboard width/height | `[data-vigilia-artboard]` | `editor-shell` artboard panel |
| Opacity 0–100 | `[data-vigilia-opacity]` | `selection-inspector/appearance.ts` |
| Panel fill / stroke | `[data-vigilia-panel-fill]`, `[data-vigilia-panel-stroke]` | `selection-inspector/panel.ts` |
| Border width / radius / shadow | `[data-vigilia-panel-border]`, `-radius`, `-shadow` | `selection-inspector/panel.ts` |
| Glass on/off | `[data-vigilia-glass-enabled]` | `selection-inspector/glass.ts` |
| Glass blur 0–48 | `[data-vigilia-glass-blur]` | `selection-inspector/glass.ts` |
| Resolved reference line | `[data-vigilia-resolution]` | `selection-inspector/appearance.ts` |
| Run list | `[data-vigilia-runs]`, rows `[data-vigilia-run="N"]` | `selection-inspector/runs.ts` |
| Run preset / colour | `[data-vigilia-run-preset="N"]`, `[data-vigilia-run-colour="N"]` | `selection-inspector/runs.ts` |
| Text align / wrap / overflow | `[data-vigilia-text-align]`, `-wrap`, `-overflow` | `selection-inspector/runs.ts` |
| Run source / format / zone | `[data-vigilia-run-source="N"]`, `-format`, `-zone` | `selection-inspector/runs.ts` |
| Style tab | `[data-vigilia-panel="style"]` | `selection-inspector/style.ts` |
| Globals (no selection) | `[data-vigilia-globals]` | `selection-inspector/style.ts` |
| Palette token / kind / colour | `[data-vigilia-palette-token]`, `-kind`, `-color` | `palette-manager/panel.ts` |
| Palette reassign / delete | `[data-vigilia-palette-replacement]`, `-delete` | `palette-manager/panel.ts` |
| Delete selection | canvas toolbar trash → `session.deleteActive()` | `editor-shell/bridge.ts` |

**Two facts that shape the pass:**

- **There is no blank theme today.** `New` calls `createNewFabricTheme()` (`editor-main.ts:148`), which emits the entire finished composition. The only route to a blank scene is selecting everything and deleting it — a workaround no author is expected to understand, and exactly the thing this pass exists to catch. **Phase 0 makes the blank state real; the rebuild starts from it.**
- **Alignment, wrap and overflow are run-level, not object-level.** The 2026-09-24 author-journey plan says otherwise and is wrong; see its Task 2. The rebuild drives the run editor.

### Driving the editor from a test

Measured 2026-09-29, so the driver does not rediscover these:

- The editor's global is **`window["vigilia-fabric-editor-N"]`**, holding `{ canvas, viewport, historyManager, textManager, imageManager, layerManager, objectLockManager, errorManager, cropManager, deletionManager, clipboardManager, groupingManager, destroy }`. **`window.vigilia` is the player's, not the editor's** — reaching for it finds nothing and looks like a broken app. **The `N` is per instance and is not stable:** creating a document tears the editor down and the global becomes `-2`, with the old name removed rather than left stale. **Resolve it at use — `Object.values(window).find(v => v?.canvas && v.historyManager)` — and never cache it across a `New`.** A cached handle reads as a live document after it is gone, which is the worst kind of wrong.
- `canvas.viewportTransform` is a **property**. There is no `getViewportTransform()` method; calling it throws.
- The artboard controls exist and are `vigiliaArtboardWidth` / `vigiliaArtboardHeight`, in the Data tab under Theme Settings.
- The View menu offers `Zoom to fit`, `Zoom to selection` and `100 %`, plus `Data source`, `Chart refresh` and `Value runs` toggles.
- A starter text object is Fabric `textbox`; a newly inserted one is `i-text`. **Both enter editing mode**, so in-place editing covers the whole document — but a scene holds two text classes, which is worth remembering when a round trip misbehaves.
- Reading the scene through the handle is fine and is how the driver counts and locates objects. **Writing** through it is not — every authored change goes through a real control.
- **Menus are `role="menuitem"`, and a closed menu stays in the DOM.** Querying `[role=menu] button` matches a stale menu's items and silently clicks the wrong control — this produced a false "Save to library does nothing" before it was caught. Match on `role="menuitem"` and confirm the item is on screen. A driver that clicks the wrong control produces a confident, wrong finding, which is worse than no finding.
- **The Playwright MCP browser and the host ports are SHARED between the root session and every running agent.** Two agents and the root all drove one browser: an agent's player fixture at `:4191` navigated the root's page out from under it mid-test, and background hosts on `:4185`/`:4186` were killed twice by processes they did not own. **Each agent must pick its own ports and expect the browser to move** — the e2e suite's own ports (4173 player, 4174 editor, 4175 host) plus the root's (4180 editor) are already taken. If a page you were reading is not the page you opened, another agent moved it; re-navigate rather than reporting what you see.
- **The rtk hook can report a false zero for `grep -c` across several files**, and the non-zero exit that follows reads exactly like "the file is missing". One implementer briefly concluded its own committed work had been reverted and was about to "fix" it; re-reading proved the files were untouched since its commit. **Re-verify a surprising "gone" with a direct read of the file before acting on it** — a phantom absence is worse than a real one, because it invites a change to something already correct.
- **Two concurrent Playwright runs share the default `test-results/` directory**, and the collision produced a spurious teardown `ENOENT` **on a test that had passed**. Pass an isolated `--output` per run. A flaky teardown in a concurrent session is a harness collision until proven otherwise, and the reflex to "fix" it would have been a change to working code.

---

## Phase 0 — The blank state

Nothing in Phase 1 or 2 can be trusted until this lands. Three tasks, each independently reviewable.

### Task 1: The artboard presets, as one derived owner

**Files:**
- Create: `src/web/packages/editor/src/artboard-presets.ts`
- Create: `src/web/packages/editor/src/artboard-presets.test.ts`
- Modify: the inspector's artboard controls, to drive from this list

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export type ArtboardRatioId = "16:9" | "19.5:9" | "4:3";
  export type ArtboardResolutionId = "1080p" | "2k" | "4k";
  export type ArtboardOrientation = "landscape" | "portrait";
  export interface ArtboardSize { readonly width: number; readonly height: number }
  export function artboardSize(
    ratio: ArtboardRatioId,
    resolution: ArtboardResolutionId,
    orientation: ArtboardOrientation,
  ): ArtboardSize;
  export const ARTBOARD_RATIOS: ReadonlyArray<{ id: ArtboardRatioId; ratio: number }>;
  export const ARTBOARD_RESOLUTIONS: ReadonlyArray<{ id: ArtboardResolutionId; shortEdge: number }>;
  ```
  Task 2 and Task 3 both consume `artboardSize`.

- [ ] **Step 1: Write the failing unit test**

In `artboard-presets.test.ts`, assert the whole derived table. It is small enough to state in full, and stating it in full is the point — the rule is arithmetic, so the test is the rule:

| ratio | 1080p | 2K | 4K |
|---|---|---|---|
| 16:9 landscape | 1920 × 1080 | 2560 × 1440 | 3840 × 2160 |
| 19.5:9 landscape | 2340 × 1080 | 3120 × 1440 | 4680 × 2160 |
| 4:3 landscape | 1440 × 1080 | 1920 × 1440 | 2880 × 2160 |

Every portrait size is that row's two numbers swapped. Also assert every derived size has integer width and height, both even, and both greater than zero — a fractional or odd artboard is a half-pixel on a panel border.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/editor/src/artboard-presets.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the implementation**

```ts
const RATIOS = [
  { id: "16:9", ratio: 16 / 9 },
  { id: "19.5:9", ratio: 19.5 / 9 },
  { id: "4:3", ratio: 4 / 3 },
] as const;

const RESOLUTIONS = [
  { id: "1080p", shortEdge: 1080 },
  { id: "2k", shortEdge: 1440 },
  { id: "4k", shortEdge: 2160 },
] as const;

export function artboardSize(ratio, resolution, orientation): ArtboardSize {
  const shortEdge = RESOLUTIONS.find((r) => r.id === resolution)?.shortEdge;
  const factor = RATIOS.find((r) => r.id === ratio)?.ratio;
  if (shortEdge === undefined || factor === undefined) {
    throw new RangeError(`no artboard preset for ${ratio} at ${resolution}`);
  }
  const longEdge = Math.round(shortEdge * factor);
  return orientation === "portrait"
    ? { width: shortEdge, height: longEdge }
    : { width: longEdge, height: shortEdge };
}
```

**Throw rather than return a default.** These ids come from a control, but the function is a trust boundary for anything that persists a size, and a silently-defaulted artboard is a document the author did not draw.

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run packages/editor/src/artboard-presets.test.ts`
Expected: PASS.

- [ ] **Step 5: Drive the inspector's artboard controls from the list**

The existing width/height fields stay — an author who wants an exact size still types one. Add the ratio, orientation and resolution controls beside them, and have a change to any of the three write through `artboardSize`. Choosing a control must not silently discard a width the author typed, and the free fields must still accept a value that is not a preset.

- [ ] **Step 6: Gates and the red-without-fix check**

Run: `npm run typecheck && npm run lint && npm run format:check && npm test`
Then comment out the portrait swap, run the unit test, confirm the portrait assertions fail, restore, confirm green.

- [ ] **Step 7: Commit**

```
git add src/web/packages/editor/src/artboard-presets.ts \
        src/web/packages/editor/src/artboard-presets.test.ts \
        src/web/packages/editor/src/editor-shell/
git commit -m "feat(editor): artboard sizes are a derived preset, not authored data"
```

### Task 2: `New` is a blank theme, chosen at the size you want

**Files:**
- Modify: `src/web/packages/editor/src/new-fabric-theme.ts` — add `createBlankFabricTheme(artboard)`
- Modify: `src/web/packages/editor/src/new-fabric-theme-globals.ts` — add the minimal palette entry set
- Modify: `src/web/packages/editor/src/editor-main.ts:147-155` — `onNew` takes the blank path
- Modify: `src/web/packages/editor/src/editor-session.ts:389,589` — `onNew` gains the chosen size
- Test: `src/web/packages/editor/src/new-fabric-theme.test.ts`, `src/web/tests/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `artboardSize` and the preset lists from Task 1.
- Produces: `createBlankFabricTheme(artboard: ArtboardSize): FabricThemeEnvelope`.

- [ ] **Step 1: Write the failing unit test**

Assert `createBlankFabricTheme({ width: 1920, height: 1080 })` validates against `validateFabricThemeEnvelope`, that `scene.objects` is `[]`, that `assets` is `[]`, that the artboard is the one passed rather than the starter's, and that the palette contains **exactly** the nine minimal tokens and none of `cpu`, `gpu`, `ram`, `vram`, `down`, `bars`, `background`.

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run packages/editor/src/new-fabric-theme.test.ts`
Expected: FAIL — `createBlankFabricTheme` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Build from `createNewFabricTheme()` with `scene.objects` emptied, `assets` emptied, the artboard replaced, and the palette narrowed to the minimal set. **Derive the narrow palette from `starterPalette` by token id, never by restating the colour** — a second copy of `#ecf5ff` is how the tint drifted to three literals once already.

- [ ] **Step 4: Run it and confirm it passes**

- [ ] **Step 5: Build the New chooser**

Opening `New` presents ratio × orientation × resolution, defaults to 16:9 landscape at 1080p, and creates the blank theme at the chosen size on Create. It is a real dialog with an accessible name, reachable and dismissible by keyboard, and it is shown **before** the document mounts so the first paint is already the size the author chose.

`New` on a dirty document still goes through `#confirmReplacement` — the chooser opens, and confirming the replacement is a second step, not a bypass.

- [ ] **Step 6: Gates and the red-without-fix check**

Run the static gates and the unit suite. Then comment out the palette narrowing, run the test, confirm the exact-token assertion fails, restore, confirm green.

- [ ] **Step 7: Browser proof and commit**

Add to `editor.spec.ts`: `New` offers the chooser, Create opens a document with no objects at the chosen size, and the palette resolves rather than reading "not set". The dirty-replacement test at `editor.spec.ts:2835` must still pass.

```
git commit -m "feat(editor): New is a blank theme at the size you choose"
```

### Task 3: The starter becomes an explicit template

**Files:**
- Modify: `src/web/packages/editor/src/editor-main.ts` — add `onNewFromStarter` holding today's behaviour
- Modify: `src/web/packages/editor/src/editor-session.ts:389,589` — `actionFacade` gains `newFromStarter`
- Modify: `src/web/packages/editor/src/editor-shell/session-facade.ts:8` — add `newFromStarter(): Promise<void>`
- Modify: `src/web/packages/editor/src/editor-shell/shell-layout.tsx:217` — add the item beside `New`
- Modify: `src/web/packages/editor/src/ui-copy.ts:99` — `newDocument: "New theme"`, add `newFromStarter: "New from starter"`
- Modify: `src/web/packages/editor/src/editor-shell/bridge.dom.test.ts:22`, `canvas-context-menu.dom.test.tsx:41`, `shell-layout.dom.test.tsx:11` — the three session doubles
- Modify: the library, to carry the starter as a template entry

**Interfaces:**
- Consumes: `createNewFabricTheme()` and `starterAssets()` unchanged.
- Produces: `newFromStarter(): Promise<void>` on the session facade.

- [ ] **Step 1: Wire `onNewFromStarter` and the menu item**

Today's `onNew` body moves verbatim. The File menu reads `New theme` / `New from starter`, both keyboard-reachable through the existing `MenuGroup`, neither a dock button. Both go through `#confirmReplacement`.

- [ ] **Step 2: Add the starter to the library as a template**

It is listed, it opens, and it is not one of the author's own themes — deleting it must not be possible and it must not appear in a count of "your themes". A template is a thing the product offers, not a thing the author made.

- [ ] **Step 3: Update the three session doubles**

Each adds `newFromStarter: vi.fn(async () => undefined)`. A missing method is a typecheck error, which is the intended way this surfaces.

- [ ] **Step 4: Gates, then commit**

Run `npm run typecheck && npm run lint && npm run format:check && npm test`, then the editor browser spec. Any e2e that reached the starter through `New` must now use the template; enumerate them rather than fixing the first failure the suite reports.

```
git commit -m "feat(editor): the starter is a template an author can open, not what New means"
```

---

## Phase 1 — The three round trips STATUS.md still lists as unverified

Each proves the **persisted envelope**, not the DOM.

### Task 4: Text layout round-trips through save/reopen

**Files:**
- Create: `src/web/tests/e2e/author-journey.spec.ts`

**Interfaces:**
- Produces: `reloadEnvelope(page)` and `openBlank(page)` helpers, reused by Task 5 and every Phase 2 rebuild task. `openBlank` drives the real `New` chooser from Task 2.

- [ ] **Step 1: Write the test**

Open a blank document, add a text object, set align/wrap/overflow through `[data-vigilia-text-align]`, `-wrap`, `-overflow`, save, reopen, and assert the **reloaded envelope's** `vigiliaText.layout` carries all three. Asserting the DOM instead is a defect, not a shortcut.

- [ ] **Step 2: Run it and read the failure**

Run: `npx playwright test tests/e2e/author-journey.spec.ts --project=desktop-chromium --workers=1 --reporter=line`
**Record what actually happens** — a pass is as informative as a fail, and either way the result goes in the Findings table.

- [ ] **Step 3: Fix a blocking failure inside its owner**

The fix belongs to the persistence owner that loses it — not the test, and not a new field. A cause that is not established is written as such and filed as an issue the same day.

- [ ] **Step 4: Prove the fix fails without it**

Disable the fix, rebuild the affected bundle, confirm the test goes red at the failing assertion. Restore, rebuild, confirm green.

- [ ] **Step 5: Commit**

```
git commit -m "test(author): text layout round-trips through the envelope"
```

### Task 5: In-place editing commits, undoes, and survives save

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`
- Consumes: `openBlank(page)`, `reloadEnvelope(page)` from Task 4.

- [ ] **Step 1: Write the test**

Double-click a text object, type, commit with Escape, assert exactly **one** history entry. Undo, assert the previous text returns. Save, reopen, assert the committed text is in the reloaded envelope. A second history entry on one edit is a §67 failure and a finding.

- [ ] **Step 2: Run, record, classify, fix or file**

- [ ] **Step 3: Commit**

```
git commit -m "test(author): in-place edit commits once, undoes, and survives save"
```

### Task 6: A run's preset and style override round-trip

**Files:**
- Modify: `src/web/tests/e2e/author-journey.spec.ts`
- Consumes: `openBlank(page)`, `reloadEnvelope(page)` from Task 4.
- Produces: the Findings table path (Task 7).

- [ ] **Step 1: Write the test**

Select a bound text object, change one run's preset through `[data-vigilia-run-preset="0"]` and override its colour through `[data-vigilia-run-colour="0"]`, save, reopen, assert both are in the reloaded envelope's `vigiliaText.runs[0]`, then clear the override and assert the run returns to its preset.

- [ ] **Step 2: Run, record, classify, fix or file**

- [ ] **Step 3: Commit**

```
git commit -m "test(author): a run's preset and override round-trip through save"
```

---

## Phase 2 — The rebuild, from a real blank theme

### Task 7: Open a blank theme and open the Findings table

**Files:**
- Create: `src/web/tests/e2e/author-journey-rebuild.spec.ts`
- Modify: the proof spec (Findings table)

**Interfaces:**
- Consumes: the surface table above, `openBlank(page)` from Task 4.
- Produces: `insertPanel`, `setToken`, `addText`, `setRun` helpers for every rebuild task.

- [ ] **Step 1: Write the blank-start test**

Drive the real `New` menu item, choose 16:9 landscape at 1080p, and assert the canvas holds no objects and the Style tab's globals are populated. **Every step is a pointer or keyboard gesture against a real control** — no `page.evaluate` writes scene state anywhere in this file, and a driver step that needs one is a finding in its own right.

- [ ] **Step 2: Run it, and note how it feels**

Note whether an author landing on a blank theme can tell what to do next, or whether they face an empty stage. That is a finding, and a visual-quality one, which the spec counts.

- [ ] **Step 3: Open the Findings table in the spec**

Each row classified **blocking** or **deferred** at observation time, with the surface, what happened, and whether it stops the journey.

- [ ] **Step 4: Commit**

```
git commit -m "test(author): the rebuild starts from a real blank theme"
```

### Task 8: The wordmark and the clock card

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: the helpers from Task 7.

- [ ] **Step 1: Build the region through the UI only**

Insert a panel through the Add panel action. Set fill and stroke through `[data-vigilia-panel-fill]` / `-stroke`, border width and radius through `-border` / `-radius`. Add the two text objects, set each run's preset through `[data-vigilia-run-preset]`, and set the tracked wordmark's spacing through its type preset in the globals.

- [ ] **Step 2: Compare against the target by eye**

`docs/superpowers/specs/2026-09-26-reference-theme-target.png`. Friction and visual-quality problems are findings even when every control exists.

- [ ] **Step 3: Record findings, commit**

```
git commit -m "test(author): the wordmark and clock card, built from blank by hand"
```

### Task 9: The four device cards

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: the helpers from Task 7 and Task 8.

- [ ] **Step 1: Build the CPU card**

Panel, then the frosted material: enable `[data-vigilia-glass-enabled]` and set `[data-vigilia-glass-blur]` to 40. The tint is **not** a panel control — it is the `palette.frost` token, edited through `[data-vigilia-palette-color]`. If the rebuild needs a tint control and cannot find one, that is a finding, **not** a workaround.

- [ ] **Step 2: Add the reading and the caption**

Two runs on one text object: a value run bound to a semantic key, and a literal unit run. If a binding cannot be authored from the UI, that is a blocking finding — and by the ruling above the pass stops until it is fixed.

- [ ] **Step 3: Add the sparkline**

Insert a chart, choose the `line` family, set its paint through the family's paint fields, bind it to the same key as the reading. The card must not be able to show a percentage and a waveform for two different moments.

- [ ] **Step 4: Repeat for GPU, RAM and VRAM**

RAM is a partial gauge and VRAM a full ring; the gauge family and its settings fields are the surface under test.

- [ ] **Step 5: Compare by eye, record findings, commit**

```
git commit -m "test(author): the four device cards, built from blank by hand"
```

### Task 10: The trends panel, the storage bar and the network panel

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: the helpers from Tasks 7–9.

- [ ] **Step 1: Build the trends panel** — a line chart with three series, each with its own palette token, on a frosted panel.
- [ ] **Step 2: Build the storage bar** — a bar chart with a value and a track paint, plus its caption.
- [ ] **Step 3: Build the network panel** — two readings and their labels, on the last frosted panel.
- [ ] **Step 4: Compare by eye, record findings, commit**

```
git commit -m "test(author): trends, storage and network, built from blank by hand"
```

### Task 11: Save the rebuilt theme, run it, and compare the output

**Files:** `src/web/tests/e2e/author-journey-rebuild.spec.ts` · Consumes: everything from Phases 0, 1 and 2.

- [ ] **Step 1: Save, package and run the rebuilt theme on the real host**

Build the host, then start it with `node packages/host/bin/vigilia.js --no-browser`. Open the saved theme on a real display and compare to the target. A dashboard that renders differently on the player than in the editor is a finding even when both look plausible alone.

- [ ] **Step 2: Assert the persisted envelope, not the live DOM**

Bindings, captions, glass treatments and palette references must all survive the round trip.

- [ ] **Step 3: Record findings, commit**

```
git commit -m "test(author): the rebuilt theme saves, runs, and matches the target"
```

---

## Phase 3 — Close out

### Task 12: Phone-width surfaces, inspected by eye

**Files:** `src/web/tests/e2e/author-journey.spec.ts` · Evidence registered in `docs/evidence/screenshots/README.md`

- [ ] **Step 1: Register the captures, then drive the phone project**

Add the rows to the README **before** running, then:
`VIGILIA_CAPTURE=1 npx playwright test tests/e2e/author-journey.spec.ts --project=phone-chromium --workers=1 --reporter=line`

The suite already exercises phone width; the obligation is that a person looked at the generated images.

- [ ] **Step 2: Record findings, commit**

### Task 13: Close the six status debts and archive their plans

**Files:** the six specs — `2026-09-24-authoring-and-consumer-polish.md`, `2026-09-24-author-journey.md`, `2026-09-24-authoring-time-run-placeholders.md`, `2026-09-24-consumer-journey.md`, `2026-09-24-theme-thumbnails.md`, `2026-09-24-settings-scope.md`; plus the plans those six name, where not already archived.

- [ ] **Step 1: Flip each spec to `implemented` with what was observed**

Each spec's Acceptance section records what this pass actually saw, as `specs/README.md` requires. A spec whose feature this pass did not exercise is **not** flipped — it is recorded as still unverified, and saying otherwise would be the exact misstatement this pass exists to catch.

- [ ] **Step 2: Archive the plans** — tick the boxes, move to `archive/`, record what the pass observed.
- [ ] **Step 3: Commit**

```
git commit -m "docs(specs): the authoring specs read implemented on observed evidence"
```

### Task 14: Broad gate and the full local browser run

**Files:** `STATUS.md` · Consumes: everything above.

- [ ] **Step 1: Run the broad gate from `src/web`**

`npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run size`

**Read the exit code directly. Do not pipe it into `tail` or `head`** — a pipeline reports the last command's status, which is how a red run gets reported as green.

- [ ] **Step 2: Run the full local browser suite**

`npx playwright test --workers=1 --reporter=line`, and record the actual pass/skip/fail counts.

- [ ] **Step 3: Replace STATUS.md's latest-change summary and report what was not verified**

A partially completed pass is reported as partial. Do not round it up.

- [ ] **Step 4: Commit**

```
git commit -m "chore(gate): the author journey pass at the broad gate"
```

---

## Self-Review

**1. Spec coverage.** DoD 1 (rebuild from blank, compared to target) → Phase 0 makes blank real, Tasks 7–11 rebuild from it. DoD 2 and Acceptance 2 (every finding in the table) → Task 7 onward, each task carrying a "record findings" step. DoD 3 (blocking findings fixed, not deferred) → the ruling in Global Constraints, applied at every classification point. DoD 4 (three round trips driven in a browser, phone widths by eye) → Tasks 4–6 and Task 12. DoD 5 (six status debts closed, plans archived) → Task 13. Verification at the pass boundary → Task 14.

**2. Placeholder scan.** No `TBD`, no "write tests for the above" without the assertion named, no "similar to Task N". Every command is given verbatim. The one thing deliberately *not* pre-baked is the region geometry: writing invented coordinates into this plan would be exactly the inherited-draft failure the spec forbids, and the target image is the reference.

**3. Type consistency.** `artboardSize`, `createBlankFabricTheme`, `openBlank`, `reloadEnvelope`, `insertPanel`, `setToken`, `addText`, `setRun` are produced once and consumed by name in later tasks; no task calls a helper a later task renames. Selector keys were read from source on 2026-09-29 and appear in exactly one table.

**4. Review Focus.** Each of the five lines is discharged: (1) by the Task 7 rule that any state-writing `page.evaluate` is a defect; (2) by the persisted-envelope assertion in Tasks 4, 6 and 11; (3) by classification at observation time; (4) by the "fix inside its owner" rule in Task 4 Step 3; (5) by the saved-envelope assertion in Task 11 Step 2.
