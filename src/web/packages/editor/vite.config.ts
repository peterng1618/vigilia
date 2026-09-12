import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@vigilia/renderer-core': fileURLToPath(
        new URL('../renderer-core/src/index.ts', import.meta.url),
      ),
      // SCAFFOLD: the fixture themes and the synthetic sample source. The
      // editor will open real documents (Gate 4) and preview live data through
      // the transport (Gate 3) instead.
      '@vigilia/fake-source': fileURLToPath(
        new URL('../fake-source/src/index.ts', import.meta.url),
      ),
    },
  },
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
