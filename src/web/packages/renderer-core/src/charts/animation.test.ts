import { describe, expect, it } from "vitest";
import {
  ANIMATION_EASINGS,
  defaultAnimationSettings,
  toEngineAnimation,
  type AnimationSettings,
} from "./animation.js";
import { buildGaugeOption } from "./gauge.js";
import { buildLineOption } from "./line.js";
import { buildBarOption, defaultBarSettings } from "./bar.js";
import { buildPieOption, defaultPieSettings } from "./pie.js";
import { defaultGaugeSettings, type Sample } from "../types.js";
import { defaultLineSettings } from "./line.js";

function sample(value = 50): Sample {
  return {
    sensorId: "cpu.load",
    timestamp: "2026-01-01T00:00:00Z",
    status: "ok",
    value,
    unit: "%",
  };
}

describe("the default is a continuous glide", () => {
  it("matches the transition duration to the sampling interval", () => {
    // ECharts' own default is 300 ms with an ease-out curve, which on a 1 Hz
    // feed lunges for a third of a second and then sits still for two thirds.
    // Matching the interval means the value arrives exactly as the next sample
    // does, so nothing ever rests.
    expect(defaultAnimationSettings.durationMs).toBe(1000);
  });

  it("uses linear easing for updates", () => {
    // Constant speed between two real readings. An ease-out would make every
    // second look like a separate event, which is the stutter this replaces.
    expect(defaultAnimationSettings.easing).toBe("linear");
  });

  it("lets the first appearance be curved", () => {
    // An entrance is a different event from an update and can afford a curve.
    expect(defaultAnimationSettings.appearEasing).toBe("cubicOut");
    expect(defaultAnimationSettings.appearMs).toBeLessThan(
      defaultAnimationSettings.durationMs,
    );
  });

  it("offers no easing that implies motion the data does not have", () => {
    // bounce and elastic would make a temperature appear to overshoot and
    // spring back, which is a lie about the measurement.
    for (const easing of ANIMATION_EASINGS) {
      expect(easing).not.toMatch(/bounce|elastic|back/i);
    }
  });
});

describe("toEngineAnimation", () => {
  it("emits separate initial and update durations", () => {
    const result = toEngineAnimation(defaultAnimationSettings, true);

    expect(result).toEqual({
      animation: true,
      animationDuration: 650,
      animationEasing: "cubicOut",
      animationDurationUpdate: 1000,
      animationEasingUpdate: "linear",
    });
  });

  it("zeroes every duration when animation is off, not just the flag", () => {
    // Relying on one boolean to suppress four behaviours is how a capture ends
    // up catching a transition.
    expect(toEngineAnimation(defaultAnimationSettings, false)).toEqual({
      animation: false,
      animationDuration: 0,
      animationEasing: "linear",
      animationDurationUpdate: 0,
      animationEasingUpdate: "linear",
    });
  });

  it("falls back to the default when no settings are authored", () => {
    expect(toEngineAnimation(undefined, true).animationDurationUpdate).toBe(
      1000,
    );
  });

  it("honours an authored duration and easing", () => {
    const settings: AnimationSettings = {
      durationMs: 400,
      easing: "cubicInOut",
      appearMs: 200,
      appearEasing: "linear",
    };

    expect(toEngineAnimation(settings, true)).toMatchObject({
      animationDurationUpdate: 400,
      animationEasingUpdate: "cubicInOut",
      animationDuration: 200,
      animationEasing: "linear",
    });
  });

  it("caps a duration that would put the display seconds behind the sensor", () => {
    const settings: AnimationSettings = {
      ...defaultAnimationSettings,
      durationMs: 60_000,
    };
    expect(toEngineAnimation(settings, true).animationDurationUpdate).toBe(
      5000,
    );
  });

  it("replaces a nonsensical duration with the default rather than emitting it", () => {
    for (const durationMs of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const settings: AnimationSettings = {
        ...defaultAnimationSettings,
        durationMs,
      };
      expect(toEngineAnimation(settings, true).animationDurationUpdate).toBe(
        1000,
      );
    }
  });
});

describe("every family emits the animation fields", () => {
  it("gauge, at series level", () => {
    // A gauge's animation is a property of the arc rather than of the chart
    // around it, which is why it is not top-level here.
    const series = buildGaugeOption(defaultGaugeSettings, sample()).series[0];

    expect(series.animationDurationUpdate).toBe(1000);
    expect(series.animationEasingUpdate).toBe("linear");
  });

  it("line", () => {
    const option = buildLineOption(
      defaultLineSettings,
      [{ sensorId: "a", samples: [] }],
      0,
    );

    expect(option.animationDurationUpdate).toBe(1000);
    expect(option.animationEasingUpdate).toBe("linear");
  });

  it("bar", () => {
    const option = buildBarOption(defaultBarSettings, [
      { sensorId: "a", sample: sample() },
    ]);

    expect(option.animationDurationUpdate).toBe(1000);
  });

  it("pie", () => {
    const option = buildPieOption(defaultPieSettings, [
      { sensorId: "a", sample: sample() },
    ]);

    expect(option.animationDurationUpdate).toBe(1000);
  });

  it("all four go completely still when animation is off", () => {
    expect(
      buildGaugeOption(defaultGaugeSettings, sample(), false).series[0]
        .animation,
    ).toBe(false);
    expect(
      buildLineOption(defaultLineSettings, [], 0, false)
        .animationDurationUpdate,
    ).toBe(0);
    expect(
      buildBarOption(defaultBarSettings, [], false).animationDurationUpdate,
    ).toBe(0);
    expect(
      buildPieOption(defaultPieSettings, [], false).animationDurationUpdate,
    ).toBe(0);
  });
});
