import { defineConfig, devices } from "@playwright/test";
import {
  HOST_PORT,
  HOST_THEMES_DIR,
  seedHostTheme,
} from "./tests/e2e/host-theme.js";

// Seed before the host webServer starts; the host reads this directory at boot.
await seedHostTheme();

/** Browser-only structural/visual checks; cross-platform font rasterisation makes pixel baselines unsuitable here. */
export default defineConfig({
  testDir: "./tests/e2e",
  retries: 0,
  fullyParallel: true,
  // Failure traces share test-results on Windows; parallel cleanup races them.
  workers: 1,
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
    },
    {
      // Tall phone viewport exercises contain-mode letterboxing.
      name: "phone-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
