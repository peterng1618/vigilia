import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import base from "./vite.config.js";

/**
 * The design-language fixture's own build, into the editor's `dist`.
 *
 * It is a **second invocation** rather than a second `rollupOptions.input` in
 * `vite.config.ts`, and that is the whole point of the file. Two entries in one
 * build share a chunk graph: adding `control-fixture.html` moved `index.html`
 * onto a new shared `editor-shell-*.js` chunk it had never loaded, and shipped
 * the fixture and its bundle in the editor's production output. Test scaffolding
 * in the shipped bundle is not something a gate should introduce silently.
 *
 * Here the production build is untouched — `npm run build` emits exactly the
 * bundle graph it emitted before the fixture existed — and this run adds only
 * the fixture's page and assets, with `emptyOutDir: false` so it cannot delete
 * them. `npm run build:fixture` is what the browser gate and the capture
 * instructions call, and the route is unchanged:
 * `http://127.0.0.1:4174/control-fixture.html`.
 *
 * Vite types the config as a union of a plain object and a function, so the
 * spread only works on the object form this repository uses.
 */
const production = base as Record<string, unknown>;

export default defineConfig({
  ...production,
  build: {
    ...(production.build as Record<string, unknown>),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        controlFixture: fileURLToPath(
          new URL("./control-fixture.html", import.meta.url),
        ),
      },
    },
  },
});
