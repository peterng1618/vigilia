import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Builds the host to a single Node bundle.
 *
 * ## Why the host is built at all, when it is already JavaScript's own runtime
 *
 * Node 23.6+ runs TypeScript directly by stripping types — but stripping is
 * not resolution. `renderer-core` is consumed **as source** and imports its own
 * modules with `.js` specifiers (correct for a bundler, and what every other
 * package here does), so Node asked to run the host from source looks for
 * `types.js` beside a `types.ts` and fails. Rewriting those specifiers would
 * mean either diverging this package's import style from the whole repository
 * or rewriting renderer-core's — for the sole benefit of skipping a build the
 * player and editor already perform.
 *
 * So the host builds like they do, and gains the thing that actually matters
 * for shipping: the published package needs no workspace on disk.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@vigilia/renderer-core': fileURLToPath(
        new URL('../renderer-core/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    // `ssr` builds for Node: no browser polyfills, `node:` builtins left
    // external rather than shimmed.
    ssr: 'src/main.ts',
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    // Never minify a server bundle. The only thing it costs a local host is a
    // readable stack trace, and that is the one thing worth having when
    // something fails on a user's machine.
    minify: false,
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: 'main.js',
      },
    },
  },
});
