import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests for the shared renderer's pure logic. Visual and cross-device
    // behaviour is covered by Playwright (tests/e2e), not here.
    include: ["packages/*/src/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
