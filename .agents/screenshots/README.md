# Dashboard screenshots

Visual evidence from the built player bundle. They are **not** cross-platform
pixel baselines.

Refresh deliberately:

```bash
cd src/web
npx vite build packages/player
VIGILIA_CAPTURE=1 npx playwright test -g "captures a screenshot" --workers=1
```

Build first because Playwright previews built output. Use one worker because the
desktop/phone projects otherwise write the same capture directory concurrently.

Captures use `?static=1` and a controlled clock. Chart frames are reproducible in
the same environment once time is actually paused; the previous contrary claim
was a test-clock bug.

Use these images to inspect rendering changes that structural assertions may
miss. CI and development render on different OSes, so glyph rasterization can
differ and committed PNGs remain evidence rather than golden files.