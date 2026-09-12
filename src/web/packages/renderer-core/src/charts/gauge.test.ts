import { describe, expect, it } from 'vitest';
import { approximateGradient, buildGaugeOption, mixHex, toColorSegments } from './gauge.js';
import { defaultGaugeSettings, type Sample, type SensorStatus } from '../types.js';

/** An ok sample carrying a plottable value. */
function sample(value = 50): Sample {
  return {
    sensorId: 'cpu.load.total',
    timestamp: '2026-01-01T00:00:00Z',
    status: 'ok',
    value,
    unit: '%',
  };
}

/**
 * A non-ok sample with `value` genuinely absent rather than set to `undefined`.
 * The distinction matters: `exactOptionalPropertyTypes` treats an explicit
 * `undefined` as a different type, and the wire format omits the key entirely.
 */
function sampleWithoutValue(status: Exclude<SensorStatus, 'ok'>): Sample {
  return {
    sensorId: 'cpu.load.total',
    timestamp: '2026-01-01T00:00:00Z',
    status,
    unit: '%',
  };
}

describe('buildGaugeOption', () => {
  it('passes arbitrary sweep angles straight through', () => {
    // Verified 2026-09-12: ECharts accepts −360…360 for both, so half and
    // arbitrary-sweep gauges need no workaround.
    const option = buildGaugeOption(
      { ...defaultGaugeSettings, startAngle: 180, endAngle: 0 },
      sample(),
    );

    expect(option.series[0].startAngle).toBe(180);
    expect(option.series[0].endAngle).toBe(0);
  });

  it('clamps the displayed value without losing the raw reading', () => {
    const option = buildGaugeOption({ ...defaultGaugeSettings, min: 0, max: 100 }, sample(137));

    // §83: display clamps, the sample itself is untouched.
    expect(option.series[0].data[0]!.value).toBe(100);
  });

  it.each(['missing', 'error', 'unavailable', 'stale'] as const)(
    'draws no progress arc for a %s sample',
    (status) => {
      const option = buildGaugeOption(defaultGaugeSettings, sampleWithoutValue(status));

      // §83: a gap, not a zero. A visible zero-length arc would read as "0 %".
      expect(option.series[0].progress.show).toBe(false);
    },
  );

  it('draws the progress arc for an ok sample', () => {
    const option = buildGaugeOption(defaultGaugeSettings, sample());
    expect(option.series[0].progress.show).toBe(true);
  });

  it('treats an undefined sample as missing rather than zero', () => {
    const option = buildGaugeOption(defaultGaugeSettings, undefined);
    expect(option.series[0].progress.show).toBe(false);
  });

  it('disables animation when asked, for deterministic screenshots', () => {
    const option = buildGaugeOption(defaultGaugeSettings, sample(), false);
    expect(option.series[0].animation).toBe(false);
  });
});

describe('toColorSegments', () => {
  it('maps a solid fill to one full-span segment', () => {
    expect(toColorSegments({ kind: 'solid', color: '#ff0000' }, defaultGaugeSettings)).toEqual([
      [1, '#ff0000'],
    ]);
  });

  it('keeps threshold bands exact and ascending', () => {
    const segments = toColorSegments(
      {
        kind: 'thresholds',
        // Deliberately out of order — authored data cannot be trusted to be sorted.
        bands: [
          { offset: 0.9, color: '#ff0000' },
          { offset: 0.3, color: '#00ff00' },
          { offset: 0.6, color: '#ffff00' },
        ],
      },
      defaultGaugeSettings,
    );

    expect(segments.map((s) => s[0])).toEqual([0.3, 0.6, 0.9, 1]);
    expect(segments[0]![1]).toBe('#00ff00');
  });

  it('covers the ring tail so no arc is left unpainted', () => {
    const segments = toColorSegments(
      { kind: 'thresholds', bands: [{ offset: 0.5, color: '#abcdef' }] },
      defaultGaugeSettings,
    );

    expect(segments.at(-1)![0]).toBe(1);
  });
});

describe('approximateGradient', () => {
  it('emits the requested number of ascending segments ending at 1', () => {
    const segments = approximateGradient(
      [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff' },
      ],
      16,
    );

    expect(segments).toHaveLength(16);
    expect(segments.at(-1)![0]).toBeCloseTo(1);

    const offsets = segments.map((s) => s[0]);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it('interpolates towards the end colour across the ring', () => {
    const segments = approximateGradient(
      [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff' },
      ],
      8,
    );

    const first = parseInt(segments[0]![1].slice(1, 3), 16);
    const last = parseInt(segments.at(-1)![1].slice(1, 3), 16);

    expect(first).toBeLessThan(last);
  });

  it('collapses a single stop to a solid ring', () => {
    expect(approximateGradient([{ offset: 0.4, color: '#123456' }], 32)).toEqual([
      [1, '#123456'],
    ]);
  });

  it('caps the segment count to keep option size bounded', () => {
    expect(
      approximateGradient(
        [
          { offset: 0, color: '#000000' },
          { offset: 1, color: '#ffffff' },
        ],
        10_000,
      ),
    ).toHaveLength(256);
  });
});

describe('mixHex', () => {
  it('mixes six-digit hex in sRGB', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('expands three-digit shorthand', () => {
    expect(mixHex('#000', '#fff', 1)).toBe('#ffffff');
  });

  it('falls back to the nearer endpoint for uninterpolatable colours', () => {
    // Named colours cannot be mixed here; returning a valid endpoint beats
    // emitting a malformed colour the engine would silently drop.
    expect(mixHex('rebeccapurple', '#ffffff', 0.2)).toBe('rebeccapurple');
    expect(mixHex('rebeccapurple', '#ffffff', 0.8)).toBe('#ffffff');
  });
});
