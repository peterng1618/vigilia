import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MANAGER_REGISTRATIONS } from './registrations.js';

/**
 * The architecture rules, asserted rather than remembered.
 *
 * `architecture.md` §4 states the manager contract, the folder taxonomy and a
 * size ceiling. A rule stated in prose is a reminder; these are the
 * mechanisms. Every one of them exists because the alternative is a comment
 * saying "keep these in sync", which is the defect rather than the guard.
 */

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every non-test TypeScript file under the editor's `src`, repo-relative. */
function sourceFiles(directory: string = SOURCE_ROOT): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);

    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }

    return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [full] : [];
  });
}

const relativeToSource = (file: string): string => relative(SOURCE_ROOT, file).replaceAll('\\', '/');

interface ImportRecord {
  readonly specifier: string;
  /** Written as `import type …`, so it vanishes at runtime. */
  readonly typeOnly: boolean;
}

/** The specifiers a module imports, as written. */
function importsOf(file: string): ImportRecord[] {
  const source = readFileSync(file, 'utf8');

  return [
    ...source.matchAll(/(?:^|\n)\s*(?:import|export)(\s+type)?\b[^'"\n]*?from\s*['"]([^'"]+)['"]/g),
  ].map((match) => ({ specifier: match[2]!, typeOnly: match[1] !== undefined }));
}

describe('the registration table matches the filesystem', () => {
  it('has a folder named for every manager', () => {
    // The table names the folder as well as the field. If they drift, the
    // convention "one manager per domain folder" is no longer readable from
    // the tree, which is most of what it is for.
    for (const registration of MANAGER_REGISTRATIONS) {
      const folder = join(SOURCE_ROOT, registration.key);

      expect(statSync(folder).isDirectory(), `expected a ${registration.key}/ folder`).toBe(true);
    }
  });
});

describe('peers are reached through the root, not by importing each other', () => {
  it('no manager imports a peer manager at runtime', () => {
    // The rule that keeps the manager graph acyclic: runtime access is
    // `this.editor.<peer>`, and the only compile-time edge is `import type`.
    //
    // A peer's **facade** (`<peer>/index.ts`) is off limits either way — that
    // is the implementation, and importing it is the cycle. A peer's domain
    // modules hold contracts, which architecture.md §4 permits, but only as
    // `import type`: a value import of one is a runtime edge wearing a
    // contract's clothes.
    const managerFolders = MANAGER_REGISTRATIONS.map((registration) => registration.key);
    const offences: string[] = [];

    for (const file of sourceFiles()) {
      const path = relativeToSource(file);
      const owner = managerFolders.find((folder) => path.startsWith(`${folder}/`));

      if (owner === undefined) {
        continue;
      }

      for (const { specifier, typeOnly } of importsOf(file)) {
        const peer = managerFolders.find(
          (folder) => folder !== owner && specifier.includes(`../${folder}/`),
        );

        if (peer === undefined) {
          continue;
        }

        if (specifier.endsWith(`../${peer}/index.js`)) {
          offences.push(`${path} imports the ${peer} facade — reach it as editor.${peer} instead`);
          continue;
        }

        if (!typeOnly) {
          offences.push(
            `${path} value-imports ${specifier} — a peer's contract may only be an "import type"`,
          );
        }
      }
    }

    expect(offences).toEqual([]);
  });

  it('core/ depends on managers only through the registration table', () => {
    // The root is a composition point. If behaviour starts reaching into
    // managers from anywhere else in core/, the root has become a manager.
    const managerFolders = MANAGER_REGISTRATIONS.map((registration) => registration.key);
    const offences: string[] = [];

    for (const file of sourceFiles(join(SOURCE_ROOT, 'core'))) {
      const path = relativeToSource(file);

      if (path === 'core/registrations.ts') {
        continue;
      }

      for (const { specifier } of importsOf(file)) {
        if (managerFolders.some((folder) => specifier.includes(`../${folder}/`))) {
          offences.push(`${path} imports ${specifier} — register it instead`);
        }
      }
    }

    expect(offences).toEqual([]);
  });
});

/**
 * Files currently over the ceiling, with the count they may not exceed.
 *
 * A ratchet rather than an exemption: an entry here cannot grow, and it is
 * deleted when the file drops under the limit. `main.ts` is the subject of the
 * restructure and loses this entry in Phase 4.
 *
 * The ceiling is editor-only for now. `renderer-core/src/theme/validate.ts`
 * (1,138) is the other file over it repo-wide; Phase 6 splits it into
 * `validate/` role files, and this test widens to every package then.
 */
const RATCHET: Readonly<Record<string, number>> = {
  'main.ts': 1301,
};

const MAX_LINES = 800;

describe('the size ceiling', () => {
  const measured = sourceFiles().map((file) => ({
    path: relativeToSource(file),
    lines: readFileSync(file, 'utf8').split('\n').length,
  }));

  it('holds for every file that is not on the ratchet', () => {
    // 800 is the stop. It exists because main.ts reached 1,349 lines holding
    // nine unrelated concerns and nothing objected.
    const over = measured
      .filter((file) => file.lines > MAX_LINES && RATCHET[file.path] === undefined)
      .map((file) => `${file.path} is ${file.lines} lines (max ${MAX_LINES})`);

    expect(over).toEqual([]);
  });

  it('does not let a ratcheted file grow', () => {
    const grown = measured
      .filter((file) => {
        const allowed = RATCHET[file.path];

        return allowed !== undefined && file.lines > allowed;
      })
      .map((file) => `${file.path} grew to ${file.lines}, over its ${RATCHET[file.path]!} ratchet`);

    expect(grown).toEqual([]);
  });

  it('has no stale ratchet entries', () => {
    // An entry for a file that is now under the limit, or gone, reads as a
    // live exemption. Deleting it is part of finishing the work.
    const stale = Object.keys(RATCHET).filter((path) => {
      const file = measured.find((candidate) => candidate.path === path);

      return file === undefined || file.lines <= MAX_LINES;
    });

    expect(stale).toEqual([]);
  });
});
