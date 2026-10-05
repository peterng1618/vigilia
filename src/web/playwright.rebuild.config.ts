import { defineConfig, devices } from "@playwright/test";

/**
 * The rebuild's own runner, and the reason it is not the suite's.
 *
 * `playwright.config.ts` boots the player, the editor and a real host on
 * 4173/4174/4185, which every other agent and the root session also uses. The
 * rebuild is a proof run against one document in one editor, and two agents
 * driving the same preview is exactly how a pass ends up screenshotting
 * somebody else's theme — which the plan records as having already happened
 * twice. So it takes one server, on its own port, and drives nothing else.
 *
 * The editor is the only thing the rebuild needs: a theme is driven, saved and
 * then read back through a host started separately, so a preview is enough here.
 */
const EDITOR_PORT = 4215;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /author-journey-rebuild\.spec\.ts/,
  retries: 0,
  // One document, one editor instance, and the editor global's `N` is per
  // instance — two workers creating documents at once is a race nobody needs.
  workers: 1,
  fullyParallel: false,
  reporter: [["list"], ["json", { outputFile: "test-results/rebuild.json" }]],

  use: {
    baseURL: `http://127.0.0.1:${EDITOR_PORT}`,
    // A desktop surface: `tests/e2e/surface.ts` records that the editor and the
    // host's pages are desktop-only, and a phone is a display, not an editor.
    ...devices["Desktop Chrome"],
    viewport: { width: 1680, height: 1000 },
    trace: "retain-on-failure",
  },

  webServer: {
    command: `npx vite preview packages/editor --port ${EDITOR_PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${EDITOR_PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },

  projects: [{ name: "rebuild" }],
});
