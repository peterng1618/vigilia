import type { ResolvedStyle, ScenePlan } from './plan.js';

/**
 * Font availability diagnostics (§89).
 *
 * ## Why `document.fonts.check` is not used
 *
 * It looks like the right API and is not. `FontFaceSet.check(font)` reports
 * whether the faces **in the set** that match `font` have finished loading — and
 * a family that was never declared has *no* matching faces, so the answer is
 * vacuously `true`. Asked about `16px "Vigilia No Such Font"`, Chromium returns
 * true. Verified in a browser on 2026-09-12, after an implementation built on it
 * reported nothing missing, ever.
 *
 * It is the right API for a different question — "has the web font I declared
 * finished downloading?" — which becomes useful once the asset pipeline can
 * register packaged fonts.
 *
 * ## What is used instead
 *
 * Metric comparison. Text is measured with `<family>, <fallback>` and with
 * `<fallback>` alone, against two very different fallbacks. If both pairs match
 * exactly, the family contributed nothing and is not available. This is the only
 * way to ask about a *system* font from script.
 *
 * ## What this cannot tell you
 *
 * Whether the face that resolved is the one the author packaged, or a local
 * font that happens to share its name. That distinction needs the asset
 * pipeline, and until then a same-named local font is indistinguishable from the
 * intended one.
 */

/**
 * CSS generic families, which always resolve to something.
 *
 * Reporting one of these as missing would be noise: a stack ending in
 * `sans-serif` always has a face, and the interesting diagnostic is about the
 * *specific* family in front of it that did not.
 */
export const GENERIC_FAMILIES: readonly string[] = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'inherit',
  'initial',
  'unset',
];

export function isGenericFamily(family: string): boolean {
  return GENERIC_FAMILIES.includes(family.trim().toLowerCase());
}

/**
 * Splits a CSS font stack into individual family names, quotes removed.
 *
 * Naive on purpose: it splits on commas, which is wrong for a family name
 * containing an escaped comma. No such font name is plausible here, and the
 * alternative is a CSS tokeniser in the renderer.
 */
export function parseFontStack(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, '').trim())
    .filter((part) => part.length > 0);
}

/**
 * Every specific font family a plan asks for, in first-seen order.
 *
 * Generic families are excluded. Pure, so the collection logic is tested in Node
 * and only the measuring is left to a browser.
 */
export function requestedFontFamilies(plan: ScenePlan): string[] {
  const families: string[] = [];

  const add = (style: ResolvedStyle): void => {
    for (const family of parseFontStack(style['fontFamily'])) {
      if (!isGenericFamily(family) && !families.includes(family)) {
        families.push(family);
      }
    }
  };

  const walk = (nodes: ScenePlan['nodes']): void => {
    for (const node of nodes) {
      add(node.style);

      if (node.content.kind === 'text') {
        for (const segment of node.content.segments) {
          add(segment.style);
        }
      }

      walk(node.children);
    }
  };

  walk(plan.nodes);

  return families;
}

/** Sizes and text used for the metric comparison. */
const PROBE_SIZE = 72;
const PROBE_TEXT = 'mmmmmmmmmmlliWWWW@';

/**
 * Which of `families` the browser cannot provide.
 *
 * Browser only — needs a canvas. A large probe size exaggerates the metric
 * difference, and the probe string mixes wide and narrow glyphs so two fonts are
 * unlikely to agree on its width by coincidence.
 */
export function unavailableFontFamilies(families: readonly string[]): string[] {
  const context = document.createElement('canvas').getContext('2d');

  if (context === null) {
    // No 2D context means no way to ask. Reporting everything as missing would
    // be worse than reporting nothing: the diagnostic would be pure noise.
    return [];
  }

  const measure = (font: string): number => {
    context.font = `${PROBE_SIZE}px ${font}`;
    return context.measureText(PROBE_TEXT).width;
  };

  // Two fallbacks with very different metrics. One would be enough for most
  // fonts, but a family that happens to match monospace exactly would be missed.
  const baselines: [string, number][] = [
    ['monospace', measure('monospace')],
    ['serif', measure('serif')],
  ];

  const missing: string[] = [];

  for (const family of families) {
    const quoted = `"${family.replace(/"/g, '')}"`;
    const contributed = baselines.some(
      ([fallback, baseline]) => measure(`${quoted}, ${fallback}`) !== baseline,
    );

    if (!contributed) {
      missing.push(family);
    }
  }

  return missing;
}

/**
 * Families a plan asks for that the browser cannot provide.
 *
 * Browser only. Combines the pure collection with the metric probe.
 */
export function missingFontFamilies(plan: ScenePlan): string[] {
  return unavailableFontFamilies(requestedFontFamilies(plan));
}
