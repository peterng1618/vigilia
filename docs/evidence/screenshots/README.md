# Visual evidence screenshots

Visual evidence from built bundles; **not** cross-platform pixel baselines.

```bash
cd src/web
npm run build
npm run build:fixture -w @vigilia/editor
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "<selected capture title>" --workers=1
```

Build player and editor first: Playwright previews both built outputs. Use one
worker to avoid capture collisions. Select only captures affected by the current
change and inspect only their generated images. Captures use `?static=1` and a
controlled clock. After push, prefer the **Visual evidence** Actions artifact.

`build:fixture` is the design-language parity fixture
(`packages/editor/control-fixture.html`). It is a separate invocation on purpose:
building it inside `npm run build` would ship test scaffolding in the editor's
production output and move `index.html` onto a shared chunk it does not otherwise
need. Run it before any capture or browser run that names
`design-language.spec.ts`; without it that one spec 404s and the rest are
unaffected.

Pick the project the capture's spec lives in: `desktop-chromium` for the
preview-server captures (editor and player), `desktop-host` for the ones that
drive the real host (the settings page), and `publish` for the ones that start
their own host on their own port to prove the publish loop.

## Editor visual-action checklist

Update/add a capture when a change affects a listed domain. Show the action's
result, not merely a mounted editor.

| Domain | Visible action | Capture / title regex |
|---|---|---|
| Workspace | Load starter document | `editor` / `captures the mounted editor` |
| Selection/bindings | Select chart; change semantic key/transform | `editor-chart-binding` / `captures selected chart binding controls` |
| Live bindings | Open a bound text document and observe its preview value | `editor-live-text` / `refreshes bound text without saving its sampled value` |
| Live bindings | Select a bound text run, format its value and pin its zone | `editor-text-reads` / `captures the controls that give a text run its reading` |
| Layers/arrange | Select a semantic layer and expose its layer/arrange controls | `editor-layer-arrange` / `captures semantic layer controls` |
| Chart settings | Change family-specific scalar setting | `editor-chart-binding` / `captures selected chart binding controls` |
| Artboard | Change dimensions or preview fit | `editor-artboard` / `captures changed artboard controls` |
| Artboard | Change gradient/literal artboard paint | `editor-artboard-gradient` / `renders palette gradients` |
| Session | Show dirty New/Open confirmation | `editor-dirty-replacement` / `captures dirty document replacement confirmation` |
| Open | Valid, invalid or incompatible file | add when changed |
| History | Save changed document or undo visible drag | add when changed |
| Editor mechanics | Transform/group/duplicate/delete/reorder | `editor-snap-guides` / `snaps a dragged object`; `editor-snap-resize` / `snaps a resized object`; `editor-snap-resize-ctrl` / `Ctrl-resizes near a neighbour without snapping or showing a guide`; `editor-rotation-indicator` / `rotation-angle indicator`; `editor-toolbar` / `captures the canvas dock over a selected object`; `editor-canvas-context-menu` / `captures the canvas context menu over a selected object` |
| Object tools | Add/edit shape, text, image or SVG | `editor-arc-and-wedge` / `captures an arc and a wedge on the canvas` |
| Right column | Select a card and open its Position section | `editor-inspector-card` / `captures the sectioned column a card gets` |
| Right column | Select a free shape and read its own column | `editor-inspector-shape` / `captures the sectioned column a shape gets` |
| Right column | Select the starter's gauge and read the chart's column | `editor-inspector-chart` / `captures the chart's column` |
| Panel authoring | Insert a panel and set its fill, border, radius and shadow | `editor-panel-authoring` / `authors a panel from the Add panel` |
| Glass authoring | Turn frosted glass on for a panel over a real backdrop and set its blur radius | `editor-glass-authoring` / `gives an ordinary panel a real, measured backdrop blur` |
| Starter composition | Select the starter's frosted CPU card and read its live value | `editor-starter-cpu-card` / `ships the starter's frosted CPU card` |
| Starter backdrop | The new document's frosted card over its packaged photograph | `editor-starter-backdrop` / `the starter's frosted card reads a real backdrop` |
| Composition panel | The row's role, mark and bound key, with a card entered | `composition-panel-starter` / `carries the document's binding, and selecting a card and entering it are separate acts` |
| Composition panel | The panel at two hundred loose shapes | `composition-panel-two-hundred` / `two hundred loose shapes, re-measured` |
| Composition panel | The Document pane's own controls over a selected card | `composition-panel-document` / `keeps the document's own controls reachable while a card is selected` |
| Assets | Import, replace and reopen a packaged image | `editor-assets-desktop-chromium` / `imports and round-trips packaged images` |
| Palette | Edit or reassign a palette token | `editor-palette-solid` or `editor-palette-reassignment` / `edits an artboard palette token|reassigns palette references` |
| Type presets | Edit, reassign or apply a font trio | `editor-type-preset`, `editor-type-reassignment` or `editor-font-trio` / `edits a global type preset|reassigns text type presets|captures curated font trio` |
| Theme settings | Author a background image | `editor-background-media` / `authors a packaged background image` |
| Viewport | Resize or change zoom | `editor-zoom-readout` / `tracks the camera's zoom in the stage readout` |
| Viewport | Read the same composition at a two-device-pixel ratio | `editor-reference-dpr2` / `the fitted, reference-size and DPR views` |
| Glass authoring | Turn a second panel's treatment on over an already-treated one | `editor-reference-overlap` / `rotated and overlapping panels both keep compositing` |
| Document | Save, reopen and take a New document | `editor-reference-new` / `a new document is the reference composition` |
| Document | Insert, style, glass and bind, then save, close and reopen | `editor-reference-journey` / `insert, style, glass, bind and text survive save` |
| Capture | The picture the thumbnail path produces, at 2x on the library's ground | `editor-reference-capture` / `the capture path shows the glass and the packaged assets` |
| Keyboard | Hover a dock action and read the chord its tooltip names | `keyboard-tooltip` / `every canvas action's tooltip names the chord that runs it` |
| Keyboard | Read the reference sheet, opened with `?` over an entered group | `keyboard-reference` / `? opens the sheet, and the document behind it does not change` |
| Shell appearance | Choose each of the six palettes and read the surface | `shell-palette-` / `captures each palette's own surface` |
| Shell | Mount the shell with the Add slot open and nothing selected | `editor-shell-add` / `captures the shell with the Add pane open` |
| Design language | Mount the control set over the built stylesheet and read it in a panel | `control-set` / `the control set renders in the design language` — two files, `-desktop-chromium` (graphite, the ground the mockup is drawn on) and `-editorial-desktop-chromium` |
| Feedback | Error, notice, disabled action or compatibility message | add when changed |

## Settings page (`/settings`, real host)

| Domain | Visible action | Capture / title regex |
|---|---|---|
| Settings scope | Choose a theme whose bindings need a device | `settings-theme-question` / `captures the question a theme raises` |
| Theme library | Save the starter to the library and read the picture the host stored | `host-theme-thumbnail` / `stores the picture the editor captured` |
| Player | Play the saved reference composition at the reference's own size | `player-reference` / `plays the reference composition on the real host` |
| Player | The phone showing the theme the editor has open, after an edit reaches it | `publish-loop-live` / `an edit reaches the display` |
| Player | The phone's chrome taking its room from the artboard rather than covering it | `player-chrome-phone-chromium` / `no strip covers the artboard at landscape` |

The capture is the whole page, so the Devices and Display sections (including
the units choice) are evidence from the same file.

Mechanics ported from the retired editor fork need captures only when Vigilia
changes their rendered outcome. Keep this table aligned with the specs that
carry the captures: `src/web/tests/e2e/editor.spec.ts`,
`reference-theme.spec.ts`, `glass-authoring.spec.ts`,
`inspector-sections.spec.ts`, `composition-panel.spec.ts`,
`design-language.spec.ts` and `publish-loop.spec.ts`.
