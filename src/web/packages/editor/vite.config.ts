import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EDITOR_ROOT = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@vigilia/renderer-core': fileURLToPath(
        new URL('../renderer-core/src/index.ts', import.meta.url),
      ),
      '@vigilia/theme-package': fileURLToPath(
        new URL('../theme-package/src/index.ts', import.meta.url),
      ),
      // SCAFFOLD: the fixture themes and the synthetic sample source. The
      // editor will open real documents (Gate 4) and preview live data through
      // the transport (Gate 3) instead.
      '@vigilia/fake-source': fileURLToPath(
        new URL('../fake-source/src/index.ts', import.meta.url),
      ),
      // The adopted fork is compiled at its package boundary. Resolve that
      // entry explicitly: Rolldown 1.2 intermittently misses this Git package's
      // otherwise valid `exports` map on Windows.
      '@anu3ev/fabric-image-editor': resolve(
        EDITOR_ROOT,
        '../../node_modules/@anu3ev/fabric-image-editor/dist/main.js',
      ),
    },
  },
  // Served from two different places: `vite preview` and the browser suite put
  // this bundle at the root, while the host mounts it under `/editor`. The
  // default absolute base emits `/assets/…`, which under the host resolves
  // against the *player's* dist and 404s — the editor then boots to a blank
  // stage stuck on "starting…", because its HTML arrives and its script does
  // not. A relative base is the only one correct at both mount points; the host
  // redirects `/editor` to `/editor/` so it resolves against the right
  // directory (see `host/src/serve/static-path.ts`).
  base: './',
  build: {
    // §124's floor applies to the player; the editor is desktop-only, and this
    // matches it so both are built by one toolchain rather than two.
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    // Loopback only (§145). The editor is an admin surface and has no business
    // being reachable from the LAN.
    host: '127.0.0.1',
  },
});