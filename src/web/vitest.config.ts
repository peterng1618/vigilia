import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // shadcn's convention, matched to the editor's own vite alias so a component
  // written for the app resolves in tests too.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./packages/editor/src", import.meta.url)),
    },
  },
  test: {
    // Unit tests for the shared renderer's pure logic. Visual and cross-device
    // behaviour is covered by Playwright (tests/e2e), not here.
    //
    // The one exception is a **pure reader of a file**, with no DOM and no
    // server: `tests/e2e/mockup-values.test.ts` parses the checked design
    // drawing, and it is the reader's own proof that it reads the drawing rather
    // than a transcription of it. Playwright's own suite is `.spec.ts` only
    // (`playwright.config.ts`), so the two runners do not collect each other's
    // files.
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx",
      "tests/e2e/**/*.test.ts",
    ],
    environment: "node",
    restoreMocks: true,
    // The default 5s per-test budget is below the floor this harness imposes: at
    // 144 files Vitest spawns a worker per file (~5.2s of startup each), and a
    // jsdom file needs 5-8s of wall clock under load. The budget was failing
    // tests whose bodies all pass in isolation, with a different set each run -
    // load, not logic. Raise the ceiling rather than the file's own timeout, so
    // a genuinely slow test still shows up.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
