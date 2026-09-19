# Dashboard screenshots

Visual evidence from built bundles; **not** cross-platform pixel baselines.

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test -g "visual review" --workers=1
```

Build first: Playwright previews built output. Use one worker to avoid capture
collisions. Inspect every generated image before the full browser suite.
Captures use `?static=1` and a controlled clock.

## Editor visual-action checklist

Update/add a capture when a change affects a listed domain. Show the action's
result, not merely a mounted editor.

| Domain | Visible action | Capture |
|---|---|---|
| Workspace | Load starter document | `editor-fork` |
| Selection/bindings | Select chart; change semantic key/transform | `editor-fork-chart-binding` |
| Chart settings | Change family-specific scalar setting | add when changed |
| Artboard | Change dimensions or preview fit | `editor-fork-artboard` |
| Artboard | Retain literal letterbox colour while resizing | `editor-fork-artboard-literal-bar` |
| Session | Show dirty New/Open confirmation | `editor-fork-dirty-replacement` |
| Open | Valid, invalid or incompatible file | add when changed |
| History | Save changed document or undo visible drag | add when changed |
| Fork mechanics | Transform/group/duplicate/delete/reorder | add when integration changes |
| Object tools | Add/edit shape, text, image or SVG | add when integration changes |
| Viewport | Resize or change zoom | add when changed |
| Feedback | Error, notice, disabled action or compatibility message | add when changed |

Fork-owned mechanics need captures only when Vigilia changes their rendered
outcome. Keep this table aligned with `src/web/tests/e2e/editor-fork.spec.ts`.
