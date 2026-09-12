import demoTheme from '../demo-theme.json' with { type: 'json' };
import stress from './stress.json' with { type: 'json' };
import portraitCover from './portrait-cover.json' with { type: 'json' };
import assets from './assets.json' with { type: 'json' };
import invalidNewerVersion from './invalid/newer-version.json' with { type: 'json' };
import invalidBrokenReferences from './invalid/broken-references.json' with { type: 'json' };
import invalidAssetTraversal from './invalid/asset-traversal.json' with { type: 'json' };
import invalidChartArity from './invalid/chart-arity.json' with { type: 'json' };
import invalidImpossibleGeometry from './invalid/impossible-geometry.json' with { type: 'json' };
import type { IssueCode } from '@vigilia/renderer-core';

/**
 * The development theme fixtures.
 *
 * One showcase theme proves the renderer works on the layout it was designed
 * against, which is the weakest possible evidence. These exist so a change has
 * several *different* shapes to break:
 *
 * - `demo` — the showcase dashboard. Landscape, `contain`, four families.
 * - `stress` — hostile but valid. Extreme ranges, rotation, negative offsets,
 *   deep nesting, arbitrary sweeps, non-Latin scripts, every overflow mode, and
 *   values pushed past their axis by a binding scale.
 * - `portrait-cover` — a tall artboard in `cover` mode, which the showcase theme
 *   never exercises. Content sits at every edge, and the bar colour is magenta
 *   so a letterbox appearing in cover mode is unmissable.
 * - `assets` — the image node type, which nothing else covers because nothing
 *   resolved an asset ID to a URL until there was a resolver. Includes one
 *   reference that is declared and deliberately not shipped.
 *
 * The invalid set is separate and is *expected* to fail. Each file carries one
 * family of mistake and states in its `metadata.description` what it is for, so
 * a validator change that stops catching something shows up as a named
 * failure rather than a silent gap.
 */

/** A theme fixture that must validate. */
export interface ValidThemeFixture {
  readonly name: string;
  readonly document: unknown;
  readonly summary: string;
  /**
   * True when the fixture binds no sensors at all.
   *
   * Declared rather than inferred so the suite can assert in **both**
   * directions: a data fixture that lost its bindings fails, and a static
   * fixture that gained one fails too. Inferring it would make either change
   * invisible.
   */
  readonly staticOnly?: boolean;
}

/** A theme fixture that must NOT validate, with the codes it should produce. */
export interface InvalidThemeFixture {
  readonly name: string;
  readonly document: unknown;
  /** Codes the validator must report. Others may also appear unless `only` is set. */
  readonly expect: readonly IssueCode[];
  /** When true, the reported codes must be exactly `expect` and nothing else. */
  readonly only?: boolean;
}

export const VALID_THEMES: readonly ValidThemeFixture[] = [
  {
    name: 'demo',
    document: demoTheme,
    summary: 'Landscape showcase dashboard: all four chart families, styled runs, contain.',
  },
  {
    name: 'stress',
    document: stress,
    summary: 'Valid but hostile: extremes, rotation, deep nesting, multilingual text, cover of every overflow mode.',
  },
  {
    name: 'portrait-cover',
    document: portraitCover,
    summary: 'Tall 9:19.5 artboard in cover mode, with content at every edge.',
  },
  {
    name: 'assets',
    document: assets,
    summary: 'Image nodes: three fit modes, monochrome recolouring, an SVG, and one unresolvable reference.',
    staticOnly: true,
  },
];

export const INVALID_THEMES: readonly InvalidThemeFixture[] = [
  {
    name: 'newer-version',
    document: invalidNewerVersion,
    // §141: fail without changing the library, and report ONLY the version.
    // Everything else in that file is also broken, and none of it may surface.
    expect: ['newer-schema-version'],
    only: true,
  },
  {
    name: 'broken-references',
    document: invalidBrokenReferences,
    expect: ['unresolved-global-ref', 'duplicate-id', 'style-value-ambiguous', 'binding-count'],
  },
  {
    name: 'asset-traversal',
    document: invalidAssetTraversal,
    expect: ['invalid-asset-path'],
  },
  {
    name: 'chart-arity',
    document: invalidChartArity,
    expect: ['binding-count', 'unresolved-binding-ref'],
  },
  {
    name: 'impossible-geometry',
    document: invalidImpossibleGeometry,
    expect: ['out-of-range'],
  },
];

/** Looks up a valid fixture by name. */
export function validThemeByName(name: string): unknown {
  return VALID_THEMES.find((fixture) => fixture.name === name)?.document;
}
