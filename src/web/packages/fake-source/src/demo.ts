import { validateThemeDocument, type ThemeDocument } from '@vigilia/renderer-core';
import demoThemeJson from './demo-theme.json' with { type: 'json' };
import { FakeSampleSource, type FakeSourceOptions } from './index.js';
import { validThemeByName } from './themes/index.js';

/**
 * The development fixture: one dashboard document plus the source that feeds it.
 *
 * The theme is stored as **JSON**, not as a TypeScript object, on purpose. Loading
 * it exercises the path a real theme takes — parse, validate, then render — so a
 * schema mistake surfaces here rather than at the first import of a user's file.
 * A typed literal would be checked by the compiler and prove nothing about the
 * format.
 */

/**
 * The demo source's configuration, and why each part of it exists.
 *
 * Every option here makes a *rendering* case visible that a well-behaved feed
 * never would:
 *
 * - `gpu.temp` goes out for 6 of every 24 seconds, so the line's gap rule and
 *   the bar's null item can be watched rather than argued about (§83).
 * - `disk.nvme.queue-depth` is unmapped, so the placeholder and the
 *   `unmapped-key` plan issue appear in a real frame (§141).
 * - `cpu.fan` is pinned to `unavailable`, which is the honest state for a sensor
 *   that needs a driver this machine does not have (ADR-0004).
 */
export const demoSourceOptions: FakeSourceOptions = {
  sampleIntervalMs: 1000,
  outages: [{ semanticKey: 'gpu.temp', everySeconds: 24, forSeconds: 6, status: 'error' }],
  // Both keys exist only to be unmapped. Without listing them here the source
  // would invent a value for each — it generates for ANY key — and the fixtures
  // that exist to show the placeholder would silently show a number instead.
  unmappedKeys: ['disk.nvme.queue-depth', 'nonexistent.sensor'],
  forcedStatus: { 'cpu.fan': 'unavailable' },
  textValues: { 'gpu.name': 'Reference GPU' },
};

/**
 * Parses and validates a development theme.
 *
 * @param name One of the {@link VALID_THEMES} fixture names. Defaults to the
 *   showcase dashboard. An unknown name falls back to it rather than throwing,
 *   because the caller is usually a URL a person typed.
 * @throws Error if the fixture does not validate. Fixtures are checked in, so an
 *   invalid one is a repository bug that should stop the build rather than
 *   degrade a demo into something misleading.
 */
export function loadDemoTheme(name = 'demo'): ThemeDocument {
  const selected = validThemeByName(name) ?? demoThemeJson;
  const result = validateThemeDocument(selected);

  if (!result.ok) {
    throw new Error(
      `The demo theme fixture is invalid:\n${result.issues
        .map((issue) => `  ${issue.path || '/'}: ${issue.message}`)
        .join('\n')}`,
    );
  }

  return result.document;
}

/** The raw fixture, for tests that want to mutate it before validating. */
export const demoThemeSource: unknown = demoThemeJson;

/** A source configured for the demo theme. */
export function createDemoSource(nowMs: number): FakeSampleSource {
  return new FakeSampleSource(nowMs, demoSourceOptions);
}
