import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/** Bundles the host for Node so the published package needs no workspace source tree. */
export default defineConfig({
  resolve: {
    alias: {
      '@vigilia/renderer-core': fileURLToPath(
        new URL('../renderer-core/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    /** SSR keeps `node:` builtins external and avoids browser shims. */
    ssr: 'src/main.ts',
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    /** Keep server stack traces readable. */
    minify: false,
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: 'main.js',
      },
    },
  },
});
