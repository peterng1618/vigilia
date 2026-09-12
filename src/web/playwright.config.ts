import { defineConfig, devices } from '@playwright/test';

/**
 * Visual and behavioural tests for the display path.
 *
 * Unit tests cover everything decidable without a browser — the chart adapters,
 * the scene plan, the validator. This covers what only a browser can answer:
 * that the mount layer produces the elements the plan describes, that text
 * measures and clips as intended (§89–§91), and that the artboard transform puts
 * the design where it should be at several viewport sizes.
 *
 * The time base is pinned with Playwright's clock API rather than a query
 * parameter, so the player needs no test hook: every value the fake source
 * produces is a pure function of the clock, so freezing it freezes the frame.
 *
 * ## Why these assertions are structural and not pixel baselines
 *
 * CI runs the frontend on `ubuntu-latest` and development happens on Windows.
 * Font rasterisation, and therefore every glyph, differs between them, so a
 * committed PNG baseline would fail for a reason that has nothing to do with
 * the change under test. These tests assert what is stable across platforms —
 * that the elements exist, that the transform is right, that a canvas actually
 * painted, that a missing sample shows a placeholder — and screenshots are
 * written to `test-results/` for a human to look at.
 *
 * §126 requires budgets and visual acceptance on **named reference hardware**,
 * and no hardware is named yet. Pixel baselines belong with that decision.
 */
export default defineConfig({
  testDir: './tests/e2e',
  // A failure that only reproduces sometimes is worth seeing, not papering over.
  retries: 0,
  fullyParallel: true,
  // A JSON summary alongside the human reporter, so `tools/dev-status.mjs` can
  // state the browser-test result without re-running a minute of tests. It
  // records when it was produced, which is what keeps the status page honest.
  reporter: [
    [process.env['CI'] === undefined ? 'list' : 'github'],
    ['json', { outputFile: 'test-results/summary.json' }],
  ],

  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Loopback only, matching the host's default (§145). Nothing here should
    // ever need a routable address.
    trace: 'retain-on-failure',
  },

  // Two servers. The player is what `baseURL` points at; the editor is a
  // separate bundle on its own port, and the editor spec uses absolute URLs
  // rather than a second project with its own baseURL — both suites want the
  // same browser projects, and splitting by baseURL would double the matrix for
  // no benefit.
  //
  // Both preview the BUILT bundle rather than the dev server: that is the
  // artefact a phone would actually receive, including the chunking the size
  // gate measures.
  //
  // `--host 127.0.0.1` explicitly on both: without it Vite binds "localhost",
  // which on Windows resolves to ::1 first, and an IPv4 URL then never answers.
  // Loopback only either way (§145) — nothing here needs a routable address.
  webServer: [
    {
      command: 'npx vite preview packages/player --port 4173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx vite preview packages/editor --port 4174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      // A 16:9 artboard on a 19.5:9 phone, so `contain` has to letterbox and
      // the bars must be visible — the case §53 describes.
      name: 'phone-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
