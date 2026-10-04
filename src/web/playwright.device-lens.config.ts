import { defineConfig, devices } from "@playwright/test";

/**
 * The display lens proof, and the reason it is not the suite's.
 *
 * A framing claim measured against built bundles, on one editor preview of its
 * own, driven by one worker. `playwright.config.ts` boots the player, the
 * editor and a real host on 4173/4174/4185, which every other agent and the
 * root session also uses — and two agents driving one preview is how a proof
 * ends up measuring somebody else's build.
 *
 * Chromium is launched directly with `ignoreDefaultArgs: ["--hide-scrollbars"]`
 * so the stage's own box is the same width the CSS lays out for. The Playwright
 * MCP browser is shared with other agent sessions and is not used here.
 */
const EDITOR_PORT = 4217;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /editor-display\.spec\.ts/,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${EDITOR_PORT}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1600, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: { args: [], ignoreDefaultArgs: ["--hide-scrollbars"] },
  },

  webServer: {
    command: `npx vite preview packages/editor --port ${EDITOR_PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${EDITOR_PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },

  projects: [{ name: "device-lens" }],
});
