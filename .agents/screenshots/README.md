# Dashboard screenshots

Visual evidence from built player and editor bundles. They are **not**
cross-platform pixel baselines.

Refresh deliberately:

```bash
cd src/web
npm run build
VIGILIA_CAPTURE=1 npx playwright test -g "visual review" --workers=1
```

Build first because Playwright previews built output. Use one worker because the
desktop/phone projects otherwise write the same capture directory concurrently.
Inspect every generated image before running the full browser suite. Captures
cover mounted shells and visible editing actions, so a functional regression is
not mistaken for a passing structural assertion.

Captures use `?static=1` and a controlled clock. Chart frames are reproducible in
the same environment once time is actually paused; the previous contrary claim
was a test-clock bug.

Use these images to inspect rendering changes that structural assertions may
miss. CI and development render on different OSes, so glyph rasterization can
differ and committed PNGs remain evidence rather than golden files.

## Editor visual-action checklist

This is the canonical guide for screenshot tests on the active `/editor` fork
route. When a change affects a domain below, update or add the named
visual-review capture before its full browser suite. A capture must show the
result of the action, not merely the editor after loading.

| Domain | User action with visible UI impact | Current visual-review capture |
|---|---|---|
| Workspace | Load the starter document | `editor-fork` |
| Selection | Select a chart and expose its selection/tool affordances | `editor-fork-chart-binding` |
| Chart properties | Change a binding semantic key or scalar transform | `editor-fork-chart-binding` |
| Chart properties | Change a family-specific scalar setting | add when that control changes |
| Artboard | Change width/height or contain/cover preview | `editor-fork-artboard` |
| Session/file | See the dirty-document New/Open confirmation | `editor-fork-dirty-replacement` |
| Session/file | Open a valid, invalid or Fabric-incompatible file | add when file UI changes |
| Persistence/history | Save a changed document or undo a visible drag | add when save/history UI changes |
| Fork mechanics | Select, transform, group, duplicate, delete or reorder objects | add when the fork integration or its visible controls change |
| Object tools | Add or edit a shape, text, image or SVG through the adopted fork | add when Vigilia exposes or configures that tool |
| Viewport | Resize the editor viewport or change fork zoom | add when viewport/zoom behaviour changes |
| Product feedback | Show an error, notice, disabled action or compatibility message | add when the feedback surface changes |

The final four rows are fork-owned mechanics, so they are not parity work for
Vigilia. They become required captures only when Vigilia's integration changes
their rendered outcome. Keep this table and the `visual review` test names in
`src/web/tests/e2e/editor-fork.spec.ts` synchronized.
