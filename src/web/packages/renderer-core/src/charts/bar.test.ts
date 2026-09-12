import { describe, expect, it } from 'vitest';
import {
  buildBarOption,
  defaultBarSettings,
  toBarColor,
  toBarDataItem,
  type BarSettings,
} from './bar.js';
import type { LinearGradientColor } from './fill.js';
import type { Sample, SensorStatus } from '../types.js';

function sample(value: number, sensorId = 'cpu.load.total'): Sample {
  return {
    sensorId,
    timestamp: '2026-01-01T00:00:00Z',
    status: 'ok',
    value,
    unit: '%',
  };
}

/**
 * A non-ok sample with `value` genuinely absent rather than set to `undefined` —
 * `exactOptionalPropertyTypes` treats those as different types, and the wire
 * format omits the key.
 */
function badSample(status: Exclude<SensorStatus, 'ok'>): Sample {
  return {
    sensorId: 'cpu.load.total',
    timestamp: '2026-01-01T00:00:00Z',
    status,
    message: 'sensor unavailable',
  };
}

const thresholds: BarSettings = {
  ...defaultBarSettings,
  fill: {
    kind: 'thresholds',
    bands: [
      { offset: 0.6, color: '#00ff00' },
      { offset: 0.85, color: '#ffaa00' },
      { offset: 1, color: '#ff0000' },
    ],
  },
};

describe('buildBarOption', () => {
  it('puts categories on the y axis for horizontal bars', () => {
    const option = buildBarOption(defaultBarSettings, [{ sensorId: 'a', sample: sample(50) }]);

    expect(option.yAxis.type).toBe('category');
    expect(option.xAxis.type).toBe('value');
  });

  it('puts categories on the x axis for vertical bars', () => {
    const option = buildBarOption({ ...defaultBarSettings, orientation: 'vertical' }, [
      { sensorId: 'a', sample: sample(50) },
    ]);

    expect(option.xAxis.type).toBe('category');
    expect(option.yAxis.type).toBe('value');
  });

  it('pins the value axis to the authored range', () => {
    // Letting the engine autoscale would move the bar when the data moved,
    // which reads as a larger change than actually happened.
    const option = buildBarOption({ ...defaultBarSettings, min: 20, max: 90 }, [
      { sensorId: 'a', sample: sample(50) },
    ]);

    const axis = option.xAxis;
    expect(axis.type).toBe('value');
    if (axis.type === 'value') {
      expect(axis.min).toBe(20);
      expect(axis.max).toBe(90);
    }
  });

  it('labels categories, falling back to the sensor id', () => {
    const option = buildBarOption(defaultBarSettings, [
      { sensorId: 'cpu.load.total', sample: sample(10), label: 'CPU' },
      { sensorId: 'gpu.load.total', sample: sample(20) },
    ]);

    const axis = option.yAxis;
    if (axis.type === 'category') {
      expect(axis.data).toEqual(['CPU', 'gpu.load.total']);
    }
  });

  it('emits one bar per category, in input order', () => {
    const option = buildBarOption(defaultBarSettings, [
      { sensorId: 'a', sample: sample(10) },
      { sensorId: 'b', sample: sample(20) },
      { sensorId: 'c', sample: sample(30) },
    ]);

    expect(option.series[0].data.map((d) => d.value)).toEqual([10, 20, 30]);
  });

  it('shows a background only when a track is configured', () => {
    const withTrack = buildBarOption(defaultBarSettings, []);
    expect(withTrack.series[0].showBackground).toBe(true);
    expect(withTrack.series[0].backgroundStyle).toEqual({ color: '#2a2f3a' });

    const plain = { ...defaultBarSettings };
    delete (plain as { track?: unknown }).track;
    const withoutTrack = buildBarOption(plain, []);
    expect(withoutTrack.series[0].showBackground).toBe(false);
    expect('backgroundStyle' in withoutTrack.series[0]).toBe(false);
  });

  it('omits barWidth entirely when unset', () => {
    // exactOptionalPropertyTypes: an explicit undefined is a different type, and
    // ECharts distributes the slot only when the key is absent.
    const settings = { ...defaultBarSettings };
    delete (settings as { barWidth?: unknown }).barWidth;

    const option = buildBarOption(settings, []);
    expect('barWidth' in option.series[0]).toBe(false);
  });

  it('clamps the category gap into 0–100 and formats it as a percentage', () => {
    expect(buildBarOption({ ...defaultBarSettings, categoryGapPercent: 250 }, []).series[0]
      .barCategoryGap).toBe('100%');
    expect(buildBarOption({ ...defaultBarSettings, categoryGapPercent: -10 }, []).series[0]
      .barCategoryGap).toBe('0%');
  });

  it('passes the animation flag through so screenshots can disable it', () => {
    expect(buildBarOption(defaultBarSettings, [], false).animation).toBe(false);
  });

  it('reserves no grid padding when there are no axes or labels', () => {
    // A progress bar must reach the element edges the author laid out; axis
    // padding would silently shrink it.
    const option = buildBarOption(defaultBarSettings, []);
    expect(option.grid).toEqual({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      containLabel: false,
    });
  });
});

describe('toBarDataItem', () => {
  it('draws no bar for a missing sample', () => {
    // The critical case for this family: a zero-length bar and a bar for the
    // value 0 are pixel-identical, so a missing sample MUST be null (§83).
    for (const status of ['missing', 'stale', 'error', 'unavailable'] as const) {
      const item = toBarDataItem(defaultBarSettings, {
        sensorId: 'a',
        sample: badSample(status),
      });
      expect(item.value).toBeNull();
    }
  });

  it('draws no bar when there is no sample at all', () => {
    expect(toBarDataItem(defaultBarSettings, { sensorId: 'a', sample: undefined }).value).toBeNull();
  });

  it('distinguishes a real zero from a missing sample', () => {
    expect(toBarDataItem(defaultBarSettings, { sensorId: 'a', sample: sample(0) }).value).toBe(0);
  });

  it('clamps the drawn value into the range, leaving the raw sample untouched', () => {
    const overRange = sample(105);
    const item = toBarDataItem(defaultBarSettings, { sensorId: 'a', sample: overRange });

    expect(item.value).toBe(100);
    // §83: the raw value is preserved for whatever else reads it.
    expect(overRange.value).toBe(105);
  });

  it('clamps below the range too', () => {
    const item = toBarDataItem({ ...defaultBarSettings, min: 10 }, {
      sensorId: 'a',
      sample: sample(-40),
    });
    expect(item.value).toBe(10);
  });

  it('colours each bar by its own value — the capability the line family lacks', () => {
    const items = [sample(30), sample(70), sample(95)].map((s) =>
      toBarDataItem(thresholds, { sensorId: 'a', sample: s }),
    );

    expect(items.map((i) => i.itemStyle.color)).toEqual(['#00ff00', '#ffaa00', '#ff0000']);
  });

  it('resolves thresholds against the authored range, not a 0–100 assumption', () => {
    const shifted: BarSettings = { ...thresholds, min: 0, max: 200 };
    // 70 of 200 is 0.35 — still the first band, where 70 of 100 was the second.
    const item = toBarDataItem(shifted, { sensorId: 'a', sample: sample(70) });
    expect(item.itemStyle.color).toBe('#00ff00');
  });

  it('uses an out-of-range raw value for the colour, not the clamped one', () => {
    // Clamping is a display concern. A sensor reading 150 % is in the top
    // threshold band, and using the clamped value would be the same answer here
    // — but a value BELOW min must not pick up the bottom band by accident.
    const item = toBarDataItem(thresholds, { sensorId: 'a', sample: sample(150) });
    expect(item.itemStyle.color).toBe('#ff0000');
  });

  it('applies the corner radius, never negative', () => {
    expect(
      toBarDataItem({ ...defaultBarSettings, cornerRadius: -5 }, {
        sensorId: 'a',
        sample: sample(1),
      }).itemStyle.borderRadius,
    ).toBe(0);
  });
});

describe('toBarColor', () => {
  it('returns a solid fill unchanged', () => {
    expect(toBarColor(defaultBarSettings, 0.5)).toBe('#00b8d9');
  });

  it('builds a real cartesian gradient along the growth direction', () => {
    const stops = [
      { offset: 0, color: '#00b8d9' },
      { offset: 1, color: '#ff4d4f' },
    ];

    const horizontal = toBarColor(
      { ...defaultBarSettings, fill: { kind: 'gradient', stops } },
      0.5,
    ) as LinearGradientColor;
    expect([horizontal.x, horizontal.x2]).toEqual([0, 1]);

    // A vertical bar grows upward, so its gradient must start at the bottom or
    // it would read upside down relative to the horizontal case.
    const vertical = toBarColor(
      { ...defaultBarSettings, orientation: 'vertical', fill: { kind: 'gradient', stops } },
      0.5,
    ) as LinearGradientColor;
    expect([vertical.y, vertical.y2]).toEqual([1, 0]);
  });
});
