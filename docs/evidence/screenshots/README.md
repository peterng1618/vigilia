# Visual evidence screenshots

Visual evidence from built bundles; **not** cross-platform pixel baselines.

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test --project=desktop-chromium --grep "<selected capture title>" --workers=1
```

Build player and editor first: Playwright previews both built outputs. Use one
worker to avoid capture collisions. Select only captures affected by the current
change and inspect only their generated images. Captures use `?static=1` and a
controlled clock. After push, prefer the **Visual evidence** Actions artifact.

Pick the project the capture's spec lives in: `desktop-chromium` for the
preview-server captures (editor and player), `desktop-host` for the ones that
drive the real host (the settings page).

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
| Object tools | Add/edit shape, text, image or SVG | add when integration changes |
| Assets | Import, replace and reopen a packaged image | `editor-assets-desktop-chromium` / `imports and round-trips packaged images` |
| Palette | Edit or reassign a palette token | `editor-palette-solid` or `editor-palette-reassignment` / `edits an artboard palette token|reassigns palette references` |
| Type presets | Edit, reassign or apply a font trio | `editor-type-preset`, `editor-type-reassignment` or `editor-font-trio` / `edits a global type preset|reassigns text type presets|captures curated font trio` |
| Theme settings | Author a background image | `editor-background-media` / `authors a packaged background image` |
| Viewport | Resize or change zoom | `editor-zoom-readout` / `tracks the camera's zoom in the stage readout` |
| Feedback | Error, notice, disabled action or compatibility message | add when changed |

## Settings page (`/settings`, real host)

| Domain | Visible action | Capture / title regex |
|---|---|---|
| Settings scope | Choose a theme whose bindings need a device | `settings-theme-question` / `captures the question a theme raises` |

The capture is the whole page, so the Devices and Display sections (including
the units choice) are evidence from the same file.

Mechanics ported from the retired editor fork need captures only when Vigilia
changes their rendered outcome. Keep this table aligned with
`src/web/tests/e2e/editor.spec.ts`.
