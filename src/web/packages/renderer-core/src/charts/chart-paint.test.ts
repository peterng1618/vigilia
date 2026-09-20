import { describe, expect, it } from "vitest";
import {
  reassignChartPaintReferences,
  resolveChartPaint,
} from "./chart-paint.js";

const palette = {
  none: {
    name: "None",
    value: { kind: "solid" as const, color: "transparent" },
  },
  accent: {
    name: "Accent",
    value: { kind: "solid" as const, color: "#00b8d9" },
  },
  glow: {
    name: "Glow",
    value: {
      kind: "gradient" as const,
      angle: 45,
      stops: [
        { offset: 0, color: "#00b8d9" },
        { offset: 1, color: "#6554c0" },
      ],
    },
  },
};

describe("chart paint", () => {
  it("resolves palette paint only while deriving engine input", () => {
    expect(resolveChartPaint({ ref: "palette.glow" }, palette)).toEqual({
      kind: "gradient",
      stops: palette.glow.value.stops,
    });
  });

  it("resolves threshold bands through solid palette tokens", () => {
    expect(
      resolveChartPaint(
        { kind: "thresholds", bands: [{ offset: 0.5, ref: "palette.accent" }] },
        palette,
      ),
    ).toEqual({
      kind: "thresholds",
      bands: [{ offset: 0.5, color: "#00b8d9" }],
    });
  });

  it("reassigns token references in chart settings before a palette deletion", () => {
    const settings = {
      track: { ref: "palette.old" },
      progress: {
        kind: "thresholds" as const,
        bands: [{ offset: 1, ref: "palette.old" }],
      },
    };
    expect(
      reassignChartPaintReferences(settings, "palette.old", "palette.new"),
    ).toEqual({
      track: { ref: "palette.new" },
      progress: {
        kind: "thresholds",
        bands: [{ offset: 1, ref: "palette.new" }],
      },
    });
  });
});
