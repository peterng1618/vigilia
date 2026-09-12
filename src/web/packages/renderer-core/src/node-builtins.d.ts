/**
 * Minimal typings for the Node built-ins used by *tests only*.
 *
 * `@types/node` is deliberately NOT a dependency of this package. `renderer-core`
 * targets a browser and a phone WebView; pulling in the whole Node surface would
 * let `fs`, `process` and `child_process` type-check inside the renderer, where
 * they cannot run. The §47 boundary is about what can be imported, and the
 * cheapest way to keep that honest is to not have the types available at all.
 *
 * Two test-support functions are needed: reading `schema/theme-document.schema.json`
 * off disk so the drift guard compares against the published contract, and
 * turning a `file://` URL into a path. They are declared here, narrowly, so
 * adding a third is a visible act rather than an accident.
 *
 * DELETE THIS FILE if `@types/node` is ever added to the workspace — these
 * declarations would then conflict with the real ones.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
