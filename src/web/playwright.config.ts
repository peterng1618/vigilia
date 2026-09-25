import { defineConfig, devices } from "@playwright/test";
import { HOST_PORT, HOST_THEMES_DIR } from "./tests/e2e/host-theme.js";

/**
 * Projects are split by *shared state*, not by device.
 *
 * `host-*.spec.ts` drive one real host process whose stores are a directory on
 * disk. With a single fully-parallel project those files run in separate workers
 * while writing the same `active-theme.json`, `theme-answers.json` and display
 * state, so they raced: the consumer's saved device choice came back empty from
 * `page.reload()` under four workers. The host project pins `workers: 1` to keep
 * those stores single-threaded.
 *
 * The other two files share no server and never touch the host, so they keep
 * full parallelism. The host specs and the preview specs also share no port or
 * store, so no dependency phase is needed between the projects.
 *
 * Only `phone-host` is limited to `host-player.spec.ts`: the host's three
 * viewport-independent HTTP checks were duplicated across both viewports for no
 * viewport reason, and the host's own phone rendering is covered by
 * `/api/sensors` rather than a layout that would differ.
 */
const HOST_SPECS = /host-(player|settings)\.spec\.ts/;

export default defineConfig({
  testDir: "./tests/e2e",
  // Seeds the host fixture once; the config itself runs in every worker.
  globalSetup: "./tests/e2e/global-setup.ts",
  retries: 0,
  fullyParallel: true,
  // `workers` is deliberately left to Playwright's default (half the cores).
  // Hardcoding a count would oversubscribe a small CI runner, and oversubscription
  // is what turned the long `clock.runFor` waits into 30 s timeouts under load.
  // The two host projects below pin their own `workers: 1` instead.
  // JSON summary feeds dev-status without rerunning the browser suite.
  reporter: [
    [process.env["CI"] === undefined ? "list" : "github"],
    ["json", { outputFile: "test-results/summary.json" }],
  ],

  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },

  // Test built player/editor bundles on explicit IPv4 loopback ports.
  webServer: [
    {
      command:
        "npx vite preview packages/player --port 4173 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command:
        "npx vite preview packages/editor --port 4174 --strictPort --host 127.0.0.1",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // The real Node host, not a preview server: hosted theme loading, package
      // asset serving and the SSE stream are otherwise never browser-tested.
      command: `node packages/host/bin/vigilia.js --no-browser --port ${HOST_PORT} --themes-dir ${HOST_THEMES_DIR}`,
      url: `http://127.0.0.1:${HOST_PORT}/api/health`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],

  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
      testIgnore: HOST_SPECS,
    },
    {
      // Tall phone viewport exercises contain-mode letterboxing.
      name: "phone-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: HOST_SPECS,
    },
    {
      // One real host, one set of stores: serial by construction.
      name: "desktop-host",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
      testMatch: HOST_SPECS,
      workers: 1,
    },
    {
      name: "phone-host",
      use: { ...devices["Pixel 7"] },
      testMatch: /host-player\.spec\.ts/,
      workers: 1,
    },
  ],
});
