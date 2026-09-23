# Editor Shell Visual Layout Implementation Plan

> **For agentic workers:** Execute task-by-task, committing after each task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's vertical panel stack with the editorial
dashboard shell: top bar with File/Edit/Insert/Arrange/View menus, left rail +
pane, React inspector tabs, canvas-bottom action dock, and the `editorial`
default palette — every action dispatching through the existing develop owners.

**Architecture:** React renders shell chrome only (per
`docs/superpowers/specs/2026-09-21-editor-shell-modernization-design.md` and
`docs/superpowers/specs/2026-09-24-editor-shell-visual-layout.md` on
`codex/editor-shell-visual-layout`). A typed `EditorShellBridge` adapts
`EditorSession` document actions and `EditorInteraction` manager APIs into
React callbacks. Panel DOM keeps its imperative owners; React relocates and
styles it. The shell ships the `editorial` palette as the new default (cream
paper, near-black ink, serif display, thin rules) alongside the base-spec
palettes.

**Tech Stack:** TypeScript, Vite 8, React 19, `@base-ui/react`, Tailwind v4
(`@tailwindcss/vite`), Vitest (jsdom for shell tests), Playwright.

**Porting note:** the 13 shell commits on `codex/editor-shell-modernization`
(Tasks 0–5 of `2026-09-21-editor-shell-modernization.md`) already implement the
bridge, dock, palette and layout against the retired fork's owners
(`fork-main.ts`/`ForkExtensions`/`ImageEditor`). Their tip `bridge.ts` still
imports the removed `@anu3ev/fabric-image-editor`; the `EditorInteraction`
bridge retarget exists in `stash@{1}`. develop renamed those owners
(`editor-main.ts`/`EditorSession`/`EditorInteraction`). This plan therefore
**ports** the shell components onto develop directly instead of merging;
adapted deltas are called out per task. `stash@{1}` stays as evidence; do not
pop it.

## Global Constraints

- develop is the base. Do not merge either codex branch; port files and adapt.
- All actions dispatch through existing owners: `EditorSession` document
  methods (made reachable through a façade), `ShortcutManager`-registered
  handler logic, `EditorInteraction` managers, `applyArrange`/`canArrange`,
  and panel factories. No action logic in React.
- Panels keep their DOM contract (`root`, `data-vigilia-*` hooks, `render()`);
  React relocates roots, never reimplements controls.
- `ui-copy.ts` owns all visible shell copy; no remote font for the serif face.
- New dependencies only in `@vigilia/editor`; update
  `THIRD-PARTY-NOTICES.md` in the same change.
- Shell palette choice is browser-local (`vigilia.editor.shell-palette`);
  never touches the envelope.
- The dock supersedes the floating toolbar; `toolbar-manager/` retires in the
  change that lands the dock, and its action set moves verbatim.
- The bridge may grow read-only transient fields (`activeKind`); never write
  logic, never serialized.
- Full local `npm run test:e2e` is the browser gate; `VIGILIA_CAPTURE=1
  --workers=1` for evidence captures, inspected before staging.

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/web/packages/editor/src/ui-copy.ts` | Typed package-local visible copy (ported, extended for menus) |
| `src/web/packages/editor/src/editor-shell/palette.ts` (+ test) | Shell palette keys incl. `editorial`; localStorage owner |
| `src/web/packages/editor/src/editor-shell/bridge.ts` (+ test) | Selection snapshot (`selectedCount`, `locked`, `activeKind`), eligibility, dispatch |
| `src/web/packages/editor/src/editor-shell/session-facade.ts` | Typed façade exposing `EditorSession` private document actions |
| `src/web/packages/editor/src/editor-shell/shell-layout.tsx` (+ test) | React chrome: header menus, rail+pane, stage, inspector tabs, dock |
| `src/web/packages/editor/src/editor-shell/canvas-dock.tsx` | Dock over bridge, toolbar-manager action set |
| `src/web/packages/editor/src/editor-shell/editor-shell.css` | Editorial palette tokens + base palettes, `--vigilia-*` mapping |
| `src/web/packages/editor/src/editor-session.ts` | Action façade widened (no logic moved) |
| `src/web/packages/editor/src/editor-main.ts` | Creates shell layout + bridge around the mount cycle |
| `src/web/packages/editor/index.html` | React mount root; `--vigilia-*` tokens drop to shell variables |
| `src/web/packages/editor/vite.config.ts`, `tsconfig.json`, `package.json` | React/Tailwind build boundary |
| `THIRD-PARTY-NOTICES.md` | React, react-dom, @base-ui/react, tailwindcss, @tailwindcss/vite provenance |

## Tasks

Status: Tasks 1–5 implemented on `develop` (commits `85b7c8c`, `feat: add
editorial shell palette and copy`, `feat: bridge editor actions into shell`,
`feat: add editorial shell layout and dock`, `fix: bind shell selection state
to the editor session`). Task 6 evidence recorded below; remaining gaps listed
under "Deviations and follow-ups".

### Deviations and follow-ups

- The inspector keeps the **document panels mounted in the Design tab** for
  every selection kind, rather than swapping them out when something is
  selected. Swapping made the theme's own settings unreachable while an object
  was selected, and hid panel DOM from tests. The spec's "fall back to
  document-level panels on no selection" is satisfied; the selection hint line
  above the panels is the only selection-dependent part.
- `Tabs.Panel` uses `keepMounted` so panel DOM survives tab switches; without
  it, chart settings vanished from the DOM whenever Data was not the active
  tab.
- The rail's compact marks come from `uiCopy.railMark` (glyphs), not
  `label.slice(0, 1)` — "Add" and "Assets" both reduced to "A".
- The floating toolbar (`toolbar-manager/`) is deleted and its full action set
  (including front/back and group/ungroup) moved into the dock.
- Follow-up: resize-time snapping and the remaining spec-0014 items are
  untouched by this change.

### Task 1 — Build boundary: React + Tailwind in the editor package

- [ ] Read resolved metadata for `react`, `react-dom`, `@base-ui/react`,
  `tailwindcss`, `@tailwindcss/vite` and record licence + version in
  `THIRD-PARTY-NOTICES.md` before installing.
- [ ] `npm install -w @vigilia/editor react react-dom @base-ui/react
  tailwindcss @tailwindcss/vite` and `-D @types/react @types/react-dom`.
- [ ] `vite.config.ts`: add `plugins: [tailwindcss()]`; keep aliases, `base`,
  build target, loopback server.
- [ ] `tsconfig.json`: add `"jsx": "react-jsx"`; widen `include` to
  `"src/**/*.{ts,tsx}"` and add `@types/react` globals coverage via
  `../../tsconfig.base.json` types as needed.
- [ ] `index.html`: strip inline shell styles (they move to
  `editor-shell.css`); keep `#app` mount root and base tokens until Task 3
  remaps them.
- [ ] Proof: `npm run typecheck -w @vigilia/editor && npm run build -w
  @vigilia/editor` passes.
- [ ] Commit: `build: add editor shell UI foundation`

### Task 2 — Copy, palettes (incl. `editorial`), tokens

- [ ] Port `ui-copy.ts`; extend with menu labels (file/edit/insert/arrange/
  view groups + items), rail labels (`layers/add/assets/settings`), dock
  labels, inspector tabs, palette label.
- [ ] Port `palette.ts` + `palette.test.ts`; insert `editorial` as the first
  key and make it `readShellPalette`'s fallback default (tests assert
  `editorial` for empty/invalid storage).
- [ ] Write `editor-shell.css`: `@import "tailwindcss";` plus the branch's
  layout/grid/glass rules; add the `editorial` palette block (cream paper
  `#f5f1e8`-family `--shell-backdrop`, near-black `--shell-text`, system serif
  stack for brand/headings, uppercase letter-spaced section labels, 1px
  near-black `--shell-edge`, no translucency needed — flat surfaces) and map
  `#vigilia-*` index.html tokens for the editorial palette only
  (`--vigilia-canvas-bg` stays a neutral artboard surround, not paper).
- [ ] Proof: `npm test -- editor-shell/palette.test.ts` passes (tests first,
  red→green).
- [ ] Commit: `feat: add editorial shell palette and copy`

### Task 3 — Bridge over `EditorInteraction` + session façade

- [ ] Port `bridge.ts` from the stash retarget (`BridgeEditor =
  EditorInteraction`): snapshot gains `activeKind: "none" | "object" |
  "group" | "chart"` derived from the active object type and `VigiliaChart` id
  detection (`instanceof VigiliaChart` is unavailable to editor; detect via
  `object.get("family") !== undefined && object.get("settings") !==
  undefined` or the Vigilia id property used by `scene-fabric` — confirm the
  existing chart-object discriminator before implementing). `can`/`run`
  eligibility mirrors `toolbar-manager`'s: duplicate/lock/z-order unlocked
  only; group on multi-selection; ungroup on `Group`; arrange via
  `canArrange`; `activeKind === "none"` disables everything.
- [ ] Add `session-facade.ts`: an interface + narrow adapter object created by
  `EditorSession` (public method `createActionFacade()`), exposing exactly:
  `newDocument`, `openPackage`, `savePackage`, `releasePackage`,
  `openLibrary`, `saveLibrary`, `setSourceMode`, `sourceMode`,
  `setChartRefreshRate`, `chartRefreshRate`, `addText`, `addChart(family)`,
  `arrange(action)` (with `canArrange`), `history` (undo/redo), `delete`,
  `copy`, `cut`, `duplicate`, `group`, `ungroup`. Each method delegates to the
  existing private/registered logic — `#save`/`#open`/… become reachable via
  the façade without moving their bodies; `edit.*` items call the same
  manager APIs the `ShortcutManager` handlers call today.
- [ ] Port `bridge.dom.test.ts` + new façade delegation test (one assert per
  façade method → owner spy).
- [ ] Proof: `npm test -- editor-shell/bridge.dom.test.ts
  editor-session.dom.test.ts && npm run typecheck -w @vigilia/editor`.
- [ ] Commit: `feat: bridge editor actions into shell`

### Task 4 — React shell chrome, rail/pane, inspector, dock; retire floating toolbar

- [ ] Port `shell-layout.tsx` (+ `shell-layout.dom.test.tsx`), `canvas-dock.tsx`,
  `icon-button.tsx`/`editor-panel.tsx` if the port needs them; adapt:
  - Header: brand + tagline, File/Edit/Insert/Arrange/View Base UI `Menu`s,
    right-side primary black Save/Release button (File-menu equivalents for
    keyboard flow remain in the menu).
  - Rail buttons: Layers, Add, Assets, Settings (`aria-pressed` semantics);
    pane shows the matching panel root (`data-vigilia-panel` values `layers`,
    `add`; asset panel and settings palette selector get roots in this task).
    No Theme rail entry — document panels live in the inspector.
  - Inspector: Design/Data/Style `Tabs`; no-selection → document-level panels
    (artboard/metadata, palette, type presets); chart selected → its
    settings/bindings panel in Data; selection properties in Design; palette/
    type reference of the selection in Style. Tab routing reads
    `bridge.snapshot().activeKind`.
  - Status line: `#status` contract unchanged.
- [ ] `createShellLayout(host)` returns `{ stage, canvasHost, properties,
  status, dock, setBridge, setPane, setInspector, destroy }` so `editor-main.ts`
  hands imperative hosts to `mountEditorShell` and `EditorSession` as today.
- [ ] `EditorSession` changes: accept `panelHost`/pane hosts per panel from
  the layout (asset panel + settings into the rail pane; chart panel into the
  inspector Data slot; document panels into the no-selection inspector);
  delete the `#fileSection` DOM (menus replace it); delete
  `createSelectionToolbar` usage + `toolbar-manager/` folder and its tests;
  dock actions (branch `canvas-dock.tsx`) adopt the full toolbar-manager set:
  duplicate, lock/unlock, front/forward/backward/back, group/ungroup, delete,
  align-left, distribute-x — same ids in `data-vigilia-*` where e2e targets
  them (`data-vigilia-toolbar` goes; dock keeps `aria-label` "Selected object
  actions").
- [ ] `editor-main.ts`: create layout → `mountEditorShell` into
  `layout.canvasHost` → `EditorSession` with layout-provided hosts →
  `layout.setBridge(bridge)`; destroy order on remount: bridge → session →
  shell → React root stays; the existing source/refresh `select`s move into
  the View menu (Base UI `Menu` with `Menu.RadioItem`), wired to the same
  state + handlers.
- [ ] Update `index.html` `--vigilia-*` tokens: for the editorial default,
  point them at the shell's ink/paper variables (single source); keep the
  dark-graphite values as `[data-shell-palette="graphite"]`-family overrides
  for the other palettes.
- [ ] Proof: `npm test -- editor-shell/ shell-layout canvas-dock bridge &&
  npm run build -w @vigilia/editor && npm run typecheck -w @vigilia/editor`;
  update `savePackage` e2e helper + file-actions-dependent tests to use the
  File menu (Task 6 runs the suite).
- [ ] Commit: `feat: add editorial shell layout and dock`

### Task 5 — Responsive fit + viewport regression

- [ ] `mountEditorShell` already refits via its own `ResizeObserver` on host —
  verify refits still fire with the React layout (stage resizes when
  inspector collapses); add a shell DOM test asserting `#stage` retains
  positive size after inspector collapse class toggles.
- [ ] Playwright: narrow-viewport test — inspector hidden ≤980px, canvas
  still visible and interactive; desktop capture of editorial palette.
- [ ] Reduced-transparency fallback proof: with the editorial palette flat
  surfaces need no fallback; keep the branch's `@media
  (prefers-reduced-transparency)` rules for glass palettes.
- [ ] Commit: `feat: make editorial shell responsive`

### Task 6 — Integration gate + evidence

- [ ] `npm run format:check && npm run lint && npm run typecheck && npm test
  && npm run build && npm run size`.
- [ ] `npm run test:e2e` full suite; fix any tests that targeted the removed
  file-actions section/floating toolbar via the new UI.
- [ ] `VIGILIA_CAPTURE=1 npx playwright test tests/e2e/editor-fork.spec.ts
  --grep 'shell|toolbar|save' --workers=1`; inspect captures (editorial
  default on fresh profile, palette switch, dock eligibility states, narrow
  collapse) before staging any.
- [ ] `.agents/status.md`: replace Next item 1 with current state; move
  `2026-09-21-editor-shell-modernization.md` plan notes; record evidence.
- [ ] Commit: `test: verify editorial shell layout`

## Self-Review

- Spec coverage: Task 2 = visual system; Task 3 = menu façade + boundary; Task
  4 = layout/menus/rail/inspector/dock + toolbar retirement; Task 5 =
  responsiveness; Task 6 = acceptance proof + evidence.
- Ownership: every new control delegates to an existing develop owner; the
  only new logic is eligibility mirrors already owned by `canArrange`/
  toolbar rules, and `activeKind` derivation.
- Placeholders: none — chart `activeKind` discriminator is flagged for
  confirmation against `scene-fabric/src/chart-object.ts` during Task 3.
