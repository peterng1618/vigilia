# Dashboard screenshots

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

## Editor visual-action checklist

Update/add a capture when a change affects a listed domain. Show the action's
result, not merely a mounted editor.

| Domain | Visible action | Capture / title regex |
|---|---|---|
| Workspace | Load starter document | `editor-fork` / `captures the mounted editor` |
| Selection/bindings | Select chart; change semantic key/transform | `editor-fork-chart-binding` / `captures selected chart binding controls` |
| Layers/arrange | Select a semantic layer and expose its layer/arrange controls | `editor-layer-arrange` / `captures semantic layer controls` |
| Chart settings | Change family-specific scalar setting | `editor-fork-chart-binding` / `captures selected chart binding controls` |
| Artboard | Change dimensions or preview fit | `editor-fork-artboard` / `captures changed artboard controls` |
| Artboard | Change gradient/literal artboard paint | `editor-fork-artboard-gradient` / `renders palette gradients` |
| Session | Show dirty New/Open confirmation | `editor-fork-dirty-replacement` / `captures dirty document replacement confirmation` |
| Open | Valid, invalid or incompatible file | add when changed |
| History | Save changed document or undo visible drag | add when changed |
| Fork mechanics | Transform/group/duplicate/delete/reorder | add when integration changes |
| Object tools | Add/edit shape, text, image or SVG | add when integration changes |
| Assets | Import, replace and reopen a packaged image | `editor-fork-assets-desktop-chromium` / `imports and round-trips packaged images` |
| Palette | Edit or reassign a palette token | `editor-fork-palette-solid` or `editor-fork-palette-reassignment` / `edits an artboard palette token|reassigns palette references` |
| Type presets | Edit, reassign or apply a font trio | `editor-fork-type-preset`, `editor-fork-type-reassignment` or `editor-fork-font-trio` / `edits a global type preset|reassigns text type presets|captures curated font trio` |
| Theme settings | Author a background image | `editor-fork-background-media` / `authors a packaged background image` |
| Viewport | Resize or change zoom | add when changed |
| Feedback | Error, notice, disabled action or compatibility message | add when changed |

Fork-owned mechanics need captures only when Vigilia changes their rendered
outcome. Keep this table aligned with `src/web/tests/e2e/editor-fork.spec.ts`.
