#!/usr/bin/env node

/**
 * The `vigilia` entry point.
 *
 * A shim rather than the launcher itself: the launcher is TypeScript, so every
 * decision it makes is typechecked against the same contracts the renderer
 * uses, and it is built to `dist/main.js` for the reason `vite.config.ts`
 * explains — Node can strip types but cannot resolve `renderer-core`'s
 * bundler-style `.js` specifiers from source.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entry = new URL('../dist/main.js', import.meta.url);

if (!existsSync(fileURLToPath(entry))) {
  // A missing build is the most likely way this fails for someone working in
  // the repository, and an unresolved-import stack trace explains none of it.
  console.error(
    'The host is not built.\n' + '  From src/web/, run:  npx vite build packages/host',
  );
  process.exit(1);
}

const { run } = await import(entry);

process.exit(await run(process.argv.slice(2)));
