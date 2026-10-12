import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

/**
 * A raw NUL byte in a source file is invisible at runtime but poisons every
 * reader that trusts grep: ripgrep declares the file binary and returns no
 * matches, which reads as "the symbol is not here". `plan.ts` carried two NULs
 * in an `Intl.NumberFormat` cache key for weeks and hid its own call sites
 * (vg-177). Nothing else asserts this, so this reader is the guard.
 *
 * Ceiling: a vitest reader over the source roots, not a `scripts/*.mjs` sweep,
 * so it rides `npm test` inside `gate` without a package.json change. Move it
 * to a root script if a non-Node source tree ever needs the same check.
 */

/** Offset of each NUL byte; the detector a case can redden on its own. */
function nulOffsets(bytes: Uint8Array): number[] {
  const found: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0) found.push(i);
  }
  return found;
}

const SKIP = new Set([
  "node_modules",
  "dist",
  ".vite",
  "coverage",
  "test-results",
]);
const SOURCE = /\.(?:[cm]?[jt]sx?|css|json)$/;

function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(join(dir, entry.name));
      } else if (SOURCE.test(entry.name)) {
        out.push(join(dir, entry.name));
      }
    }
  };
  walk(root);
  return out;
}

it("reports a NUL byte's offset, so the guard is not vacuous", () => {
  expect(nulOffsets(Buffer.from("const a\0b = 1"))).toEqual([7]);
  expect(nulOffsets(Buffer.from("const ab = 1"))).toEqual([]);
});

it("finds no raw NUL byte in any source file", () => {
  // Four levels up from src/web/tests/scripts → repo root.
  const repo = resolve(import.meta.dirname, "../../../..");
  const roots = [
    join(repo, "src/web/packages"),
    join(repo, "src/web/tests"),
    join(repo, "scripts"),
  ];
  const files = roots.flatMap(collectSourceFiles);
  // A walk that visited nothing would pass for the wrong reason.
  expect(files.length).toBeGreaterThan(100);
  const offenders = files
    .map((file) => ({ file, offsets: nulOffsets(readFileSync(file)) }))
    .filter(({ offsets }) => offsets.length > 0)
    .map(({ file, offsets }) => `${file} @ ${offsets.join(",")}`);
  expect(offenders).toEqual([]);
});
