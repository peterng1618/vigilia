import { describe, expect, it } from "vitest";

import { CHART_FAMILIES, type ChartFamily } from "../theme/document.js";
import { defaultGaugeSettings } from "../types.js";
import { ANIMATION_EASINGS } from "./animation.js";
import { defaultBarSettings } from "./bar.js";
import { defaultLineSettings } from "./line.js";
import { defaultPieSettings } from "./pie.js";
import {
  CHART_PAINT_FIELDS,
  CHART_SETTINGS_FIELDS,
  chartPaintFieldsFor,
  NON_SCALAR_SETTINGS,
  SETTINGS_SECTIONS,
  settingsFieldsFor,
  settingsKeyFor,
} from "./settings-fields.js";

describe("the chart settings declaration", () => {
  it("has a row for every chart family", () => {
    expect(Object.keys(CHART_SETTINGS_FIELDS).sort()).toEqual(
      [...CHART_FAMILIES].sort(),
    );
  });

  it("declares each property once per family", () => {
    for (const family of CHART_FAMILIES) {
      const properties = settingsFieldsFor(family).map(
        (field) => field.property,
      );

      expect(new Set(properties).size).toBe(properties.length);
    }
  });

  it("gives every field a label and a kind", () => {
    for (const family of CHART_FAMILIES) {
      for (const field of settingsFieldsFor(family)) {
        expect(field.label.length).toBeGreaterThan(0);
        expect(["number", "boolean", "select"]).toContain(field.kind);
      }
    }
  });

  it("gives every select its options", () => {
    for (const family of CHART_FAMILIES) {
      for (const field of settingsFieldsFor(family)) {
        if (field.kind === "select") {
          expect(field.options?.length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("declares no default values — the default*Settings objects own those", () => {
    // A default repeated here would be a fifth home for a number that is only
    // correct in one place.
    for (const family of CHART_FAMILIES) {
      for (const field of settingsFieldsFor(family)) {
        expect("default" in field).toBe(false);
      }
    }
  });
});

describe("the chart paint declaration", () => {
  it("has a labelled row for every persisted paint setting", () => {
    expect(Object.keys(CHART_PAINT_FIELDS).sort()).toEqual(
      [...CHART_FAMILIES].sort(),
    );
    for (const family of CHART_FAMILIES) {
      const properties = chartPaintFieldsFor(family).map(
        (field) => field.property,
      );
      expect(new Set(properties).size).toBe(properties.length);
      expect(properties).toEqual(
        NON_SCALAR_SETTINGS[family].filter(
          (property) => property !== "animation" && property !== "total",
        ),
      );
      expect(
        chartPaintFieldsFor(family).every((field) => field.label.length > 0),
      ).toBe(true);
    }
  });
});

describe("coverage against the real settings shapes", () => {
  // The point of these: a setting added to an interface but not declared here
  // is simply invisible in the editor, which is the state every chart setting
  // was in before this file existed.
  const shapes = {
    gauge: defaultGaugeSettings,
    line: defaultLineSettings,
    bar: defaultBarSettings,
    pie: defaultPieSettings,
  } as const;

  for (const family of CHART_FAMILIES) {
    it(`accounts for every property of ${family}Settings`, () => {
      const declared = new Set(
        settingsFieldsFor(family).map((field) => field.property),
      );
      const excluded = new Set(NON_SCALAR_SETTINGS[family]);
      const actual = Object.keys(shapes[family]);

      const unaccounted = actual.filter(
        (property) => !declared.has(property) && !excluded.has(property),
      );

      expect(unaccounted).toEqual([]);
    });
  }

  it("excludes only paint and animation, and says so", () => {
    // Colour is theme-level (spec 0011 D3), so a `Fill` editor writing a
    // literal onto an element would contradict that the day it shipped.
    for (const family of CHART_FAMILIES) {
      for (const excluded of NON_SCALAR_SETTINGS[family]) {
        expect(
          settingsFieldsFor(family).some((f) => f.property === excluded),
        ).toBe(false);
      }
    }
  });
});

describe("the section vocabulary", () => {
  it("orders the five questions, each with a label", () => {
    expect(SETTINGS_SECTIONS.map((section) => section.id)).toEqual([
      "content",
      "position",
      "layer",
      "paint",
      "spends",
    ]);
    expect(SETTINGS_SECTIONS.every((section) => section.label.length > 0)).toBe(
      true,
    );
  });
});

describe("every descriptor answers a question", () => {
  it("uses a section from the vocabulary, for settings and paint alike", () => {
    const ids = SETTINGS_SECTIONS.map((section) => section.id);

    for (const family of CHART_FAMILIES) {
      for (const field of [
        ...settingsFieldsFor(family),
        ...chartPaintFieldsFor(family),
      ]) {
        expect(ids).toContain(field.section);
      }
    }
  });

  it("makes every paint descriptor answer Paint", () => {
    for (const family of CHART_FAMILIES) {
      expect(
        chartPaintFieldsFor(family).every((field) => field.section === "paint"),
      ).toBe(true);
    }
  });
});

describe("every descriptor carries a hint that earns it", () => {
  it("is non-empty, and never just the label again", () => {
    for (const family of CHART_FAMILIES) {
      for (const field of [
        ...settingsFieldsFor(family),
        ...chartPaintFieldsFor(family),
      ]) {
        expect(field.hint.trim().length).toBeGreaterThan(0);
        expect(field.hint).not.toBe(field.label);
      }
    }
  });
});

describe("descriptor order is the likelihood order", () => {
  // Written from the table as it stood before sections and hints were added,
  // with the two nested settings appended where Task 3 put them. A re-sort would
  // silently change which settings surface first, so the order is pinned here
  // rather than re-derived from the table it guards.
  const ANIMATION_PROPERTIES = [
    "animation.durationMs",
    "animation.easing",
    "animation.appearMs",
    "animation.appearEasing",
  ];

  const expected: Record<ChartFamily, readonly string[]> = {
    gauge: [
      "startAngle",
      "endAngle",
      "min",
      "max",
      "thickness",
      "roundCap",
      "gradientSegments",
      ...ANIMATION_PROPERTIES,
    ],
    line: [
      "lineWidth",
      "interpolation",
      "dash",
      "showMarkers",
      "markerSize",
      "windowSeconds",
      "maxPoints",
      "min",
      "max",
      "showAxes",
      "sampling",
      ...ANIMATION_PROPERTIES,
    ],
    bar: [
      "orientation",
      "min",
      "max",
      "barWidth",
      "categoryGapPercent",
      "cornerRadius",
      "trackCornerRadius",
      "showAxes",
      "showCategoryLabels",
      ...ANIMATION_PROPERTIES,
    ],
    pie: [
      "innerRadiusPercent",
      "outerRadiusPercent",
      "startAngle",
      "endAngle",
      "padAngle",
      "cornerRadius",
      "total",
      "total.value",
      "showLabels",
      ...ANIMATION_PROPERTIES,
    ],
  };

  for (const family of CHART_FAMILIES) {
    it(`keeps ${family}'s settings in their authored order`, () => {
      expect(settingsFieldsFor(family).map((field) => field.property)).toEqual(
        expected[family],
      );
    });
  }

  const expectedPaint: Record<ChartFamily, readonly string[]> = {
    gauge: ["track", "progress"],
    line: ["stroke", "palette", "area"],
    bar: ["fill", "track"],
    pie: ["remainderFill", "palette"],
  };

  for (const family of CHART_FAMILIES) {
    it(`keeps ${family}'s paint fields in their authored order`, () => {
      expect(
        chartPaintFieldsFor(family).map((field) => field.property),
      ).toEqual(expectedPaint[family]);
    });
  }
});

describe("the two settings one level down", () => {
  it("keeps pie's fixed total directly below the tag it depends on", () => {
    const properties = settingsFieldsFor("pie").map((field) => field.property);
    const tag = properties.indexOf("total");

    expect(tag).toBeGreaterThan(-1);
    expect(properties[tag + 1]).toBe("total.value");
  });

  it("writes the total through its nested path, and asks for the number only when fixed", () => {
    const total = settingsFieldsFor("pie").find((f) => f.property === "total");
    const value = settingsFieldsFor("pie").find(
      (f) => f.property === "total.value",
    );

    expect(total?.path).toEqual(["total", "kind"]);
    expect(total?.options?.map((option) => option.value)).toEqual([
      "sum",
      "fixed",
    ]);
    expect(total?.options?.map((option) => option.label)).toEqual([
      "Sum of the parts",
      "A fixed total",
    ]);
    expect(value?.path).toEqual(["total", "value"]);
    expect(value?.visibleWhen).toEqual({
      path: ["total", "kind"],
      equals: "fixed",
    });
  });

  it("declares the same four animation fields for every family", () => {
    for (const family of CHART_FAMILIES) {
      const animation = settingsFieldsFor(family).filter((field) =>
        field.property.startsWith("animation."),
      );

      expect(animation.map((field) => field.property)).toEqual([
        "animation.durationMs",
        "animation.easing",
        "animation.appearMs",
        "animation.appearEasing",
      ]);
      expect(animation.every((field) => field.section === "layer")).toBe(true);
      expect(animation.every((field) => field.path?.[0] === "animation")).toBe(
        true,
      );
      // The obscure half is collapsed and counted, never removed.
      expect(
        animation.filter((field) => field.advanced).map((f) => f.property),
      ).toEqual(["animation.appearMs", "animation.appearEasing"]);
    }
  });

  it("names every easing for an author rather than showing its identifier", () => {
    for (const family of CHART_FAMILIES) {
      for (const property of ["animation.easing", "animation.appearEasing"]) {
        const field = settingsFieldsFor(family).find(
          (f) => f.property === property,
        );

        expect(field?.kind).toBe("select");
        expect(field?.options?.map((option) => option.value)).toEqual([
          ...ANIMATION_EASINGS,
        ]);
        expect(
          field?.options?.every((option) => option.label.trim().length > 0),
        ).toBe(true);
        expect(
          field?.options?.every((option) => option.label !== option.value),
        ).toBe(true);
      }
    }
  });
});

describe("settingsKeyFor", () => {
  it("derives the key the validator and schema already use", () => {
    expect(settingsKeyFor("gauge")).toBe("gaugeSettings");
    expect(settingsKeyFor("pie")).toBe("pieSettings");
  });
});
