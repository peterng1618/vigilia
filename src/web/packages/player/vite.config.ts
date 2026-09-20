import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@vigilia/renderer-core": fileURLToPath(
        new URL("../renderer-core/src/index.ts", import.meta.url),
      ),
      // SCAFFOLD: the synthetic sample source, which exists only because no
      // transport does yet. Remove with the import in src/main.ts.
      "@vigilia/fake-source": fileURLToPath(
        new URL("../fake-source/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    // §124: define a tested minimum browser/WebView floor rather than assuming
    // evergreen. Confirm this target against the real low-end phone at Gate 0 and
    // record the result — this value is a starting point, not a measurement.
    target: "es2022",
    sourcemap: true,
    // Keep chunking visible so an editor dependency leaking into the player shows
    // up as a new chunk rather than hiding inside a monolith (§47).
    //
    // Vite 8 bundles with rolldown, which requires manualChunks to be a FUNCTION —
    // the object form that rollup accepted fails at build time with
    // "manualChunks is not a function".
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          return id.includes("node_modules/echarts") ? "echarts" : undefined;
        },
      },
    },
  },
});
