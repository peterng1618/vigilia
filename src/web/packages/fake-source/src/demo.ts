import { validateThemeDocument, type ThemeDocument } from '@vigilia/renderer-core';
import demoThemeJson from './demo-theme.json' with { type: 'json' };
import { FakeSampleSource, type FakeSourceOptions } from './index.js';
import { validThemeByName } from './themes/index.js';

/** JSON fixture plus deterministic source, exercising the real validate/render path. */

/** Includes outage, unmapped, unavailable, and text-value cases for renderer coverage. */
export const demoSourceOptions: FakeSourceOptions = {
  sampleIntervalMs: 1000,
  outages: [{ semanticKey: 'gpu.temp', everySeconds: 24, forSeconds: 6, status: 'error' }],
  // These must stay unmapped; otherwise the synthetic source would invent values for them.
  unmappedKeys: ['disk.nvme.queue-depth', 'nonexistent.sensor'],
  forcedStatus: { 'cpu.fan': 'unavailable' },
  textValues: { 'gpu.name': 'Reference GPU' },
};

/** Loads and validates a named development fixture, falling back to `demo`. */
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

/** Raw fixture for validation tests. */
export const demoThemeSource: unknown = demoThemeJson;

export function createDemoSource(nowMs: number): FakeSampleSource {
  return new FakeSampleSource(nowMs, demoSourceOptions);
}
