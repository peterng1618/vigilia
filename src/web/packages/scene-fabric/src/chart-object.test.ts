import { describe, expect, it } from 'vitest';
import {
  CHART_SERIALISED_KEYS,
  DEFAULT_RENDER_SCALE,
  MAX_RENDER_SCALE,
  clampRenderScale,
  withoutEngineAnimation,
} from './chart-object.js';

/**
 * The chart object's pure decisions.
 *
 * Deliberately narrow. `vitest.config.ts` runs in a **node** environment and
 * says why: unit tests cover the shared renderer's pure logic, and visual or
 * cross-device behaviour belongs to Playwright. Instantiating a `VigiliaChart`
 * needs a document, a 2D context and a live ECharts instance, so mounting,
 * rotation, live redraw, disposal and the JSON round-trip are browser tests —
 * asserting them here would mean asserting against a fake canvas, which proves
 * nothing about the thing that actually draws.
 *
 * What *is* testable here is every rule that is a decision rather than a
 * rendering, and the serialised surface is the important one.
 */

describe('the serialised surface', () => {
  it('carries only authored configuration, never a sample', () => {
    // The §67 rule, asserted rather than reviewed: live telemetry must not
    // reach a property Fabric writes out. `option` is the rebuilt plan option
    // and is replaced wholesale; the other two are authored. If a key like
    // `value`, `samples` or `history` ever appears here, a canvas snapshot
    // starts capturing readings and undo starts restoring stale ones.
    expect([...CHART_SERIALISED_KEYS]).toEqual(['family', 'option', 'renderScale']);
  });

  it('names nothing that sounds like live data', () => {
    // A deliberately blunt second net, because the list above is easy to extend
    // without thinking and the failure it guards against is silent.
    const telemetryShaped = /sample|value|reading|history|series|latest|now|tick/i;
    const offenders = CHART_SERIALISED_KEYS.filter((key) => telemetryShaped.test(key));

    expect(offenders).toEqual([]);
  });
});

describe('clampRenderScale', () => {
  it('caps the oversample factor', () => {
    // 13.18 MB for one 300x180 chart at scale 4 is why there is a ceiling.
    expect(clampRenderScale(4)).toBe(MAX_RENDER_SCALE);
    expect(clampRenderScale(100)).toBe(MAX_RENDER_SCALE);
  });

  it('passes through anything within the cap', () => {
    expect(clampRenderScale(1)).toBe(1);
    expect(clampRenderScale(2.75)).toBe(2.75);
    expect(clampRenderScale(MAX_RENDER_SCALE)).toBe(MAX_RENDER_SCALE);
  });

  it('refuses a scale that would produce a zero-sized canvas', () => {
    // `echarts.init` on a 0x0 element does not fail loudly, it just never
    // draws — so a bad scale has to be refused here rather than discovered on
    // screen. Refuse rather than coerce: fall back to the default, never to 0.
    expect(clampRenderScale(0)).toBe(DEFAULT_RENDER_SCALE);
    expect(clampRenderScale(-2)).toBe(DEFAULT_RENDER_SCALE);
    expect(clampRenderScale(Number.NaN)).toBe(DEFAULT_RENDER_SCALE);
    expect(clampRenderScale(Number.POSITIVE_INFINITY)).toBe(DEFAULT_RENDER_SCALE);
  });
});

describe('withoutEngineAnimation', () => {
  it('disables the engine animation loop', () => {
    // Measured: with animation on, one data push fires the invalidation hook
    // ~31 times and repaints the whole canvas each time, for one visible
    // change. Vigilia's own appear animations live in the plan instead.
    const option = { series: [{ type: 'line' }] } as never;

    expect(withoutEngineAnimation(option)).toMatchObject({ animation: false });
  });

  it('overrides an option that asked for animation', () => {
    const option = { animation: true, series: [] } as never;

    expect(withoutEngineAnimation(option)).toMatchObject({ animation: false });
  });

  it('does not mutate the plan option it was given', () => {
    // The option comes from `plan.ts`, which is pure and may share a value
    // between frames. Mutating it would reach back into the plan.
    const option = { animation: true, series: [] };

    withoutEngineAnimation(option as never);

    expect(option.animation).toBe(true);
  });

  it('keeps everything else the option said', () => {
    const option = { series: [{ type: 'gauge' }], grid: { left: 4 } } as never;

    expect(withoutEngineAnimation(option)).toMatchObject({
      series: [{ type: 'gauge' }],
      grid: { left: 4 },
    });
  });
});
