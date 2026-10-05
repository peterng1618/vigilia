import { defineConfig, devices } from "@playwright/test";

/** The parity probe's own runner, on a port nothing else on this pass uses. */
const EDITOR_PORT = 4226;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /glass-circle-parity\.spec\.ts/,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${EDITOR_PORT}`,
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
});
