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

| # | Finding | Fix owner |
|---|---|---|
| F0.1 | `New` emits the finished composition; there is no blank state | Task 2 |
| F0.2 | No artboard chooser — a new document's size is not the author's to pick | Task 1 |
| F0.3 | The starter is what `New` means, so it cannot be left behind | Task 3 |

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
| Polygon | side count and corner radius |
| Polyline | its points |
| Line | its two endpoints |
| Path | the path data |

**Material widens with the shapes.** `supportsPanelFields` is `object instanceof Rect` (`selection-inspector/panel.ts:57`), so today a shape can be placed and not coloured — which is not a shippable shape. Fill, stroke, border width, corner radius and shadow belong to every one of these classes, so the predicate widens to the primitive set and the same fields appear. One owner, one set of fields, no per-shape fork.

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

### Player findings, found by running it (2026-09-29)

The player had never been looked at as a user in this pass. It **works**: the dashboard renders live readings, the clock ticks, the rings and sparklines draw, and unsupplied values correctly paint a gap rather than a zero — which is the §97 behaviour the plan asks for and is **not** a finding.

### P2 — data model

| # | Finding | Why it is not a UI fix | Fix owner |
|---|---|---|---|
| — | *No P2 items. F2.1 was escalated to **F1.8** on the evidence: an object cannot be named at all.* | | |

### P3 — withdrawn, recorded so they are not re-raised

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

- The editor's global is **`window["vigilia-fabric-editor-1"]`**, holding `{ canvas, viewport, historyManager, textManager, imageManager, layerManager, objectLockManager, errorManager, cropManager, deletionManager, clipboardManager, groupingManager, destroy }`. **`window.vigilia` is the player's, not the editor's** — reaching for it finds nothing and looks like a broken app.
- `canvas.viewportTransform` is a **property**. There is no `getViewportTransform()` method; calling it throws.
- The artboard controls exist and are `vigiliaArtboardWidth` / `vigiliaArtboardHeight`, in the Data tab under Theme Settings.
- The View menu offers `Zoom to fit`, `Zoom to selection` and `100 %`, plus `Data source`, `Chart refresh` and `Value runs` toggles.
- A starter text object is Fabric `textbox`; a newly inserted one is `i-text`. **Both enter editing mode**, so in-place editing covers the whole document — but a scene holds two text classes, which is worth remembering when a round trip misbehaves.
- Reading the scene through the handle is fine and is how the driver counts and locates objects. **Writing** through it is not — every authored change goes through a real control.

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
