// @vitest-environment jsdom
import { Canvas, Rect } from "fabric/es";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createIndicatorManager, formatAngle, formatSize } from "./index.js";

function pointer(): MouseEvent {
  return new MouseEvent("mousemove", { clientX: 40, clientY: 60 });
}

// Fabric's render pass touches the 2D context; jsdom's real context cannot
// drawImage an undecoded img, so the paint is made inert (browser covers paint).
beforeEach(() => {
  const real = document.createElement("canvas").getContext("2d");
  if (real !== null) {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        new Proxy(real, {
          get(target, property) {
            if (property === "drawImage") return (): void => {};
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
          set(target, property, value) {
            if (property === "patternQuality") return true;
            return Reflect.set(target, property, value);
          },
        }) as unknown as CanvasRenderingContext2D,
    );
  }
});

describe("formatAngle", () => {
  it("rounds to a whole degree with the degree sign", () => {
    expect(formatAngle(12.4)).toBe("12°");
    expect(formatAngle(0)).toBe("0°");
  });

  it("normalises to the range -180 to 180", () => {
    expect(formatAngle(190)).toBe("-170°");
    expect(formatAngle(-190)).toBe("170°");
    expect(formatAngle(720)).toBe("0°");
  });

  it("keeps a negative sign and never prepends a plus", () => {
    expect(formatAngle(-45)).toBe("-45°");
    expect(formatAngle(45)).toBe("45°");
  });
});

describe("formatSize", () => {
  it("rounds each dimension and joins them", () => {
    expect(formatSize({ width: 100.4, height: 50.6 })).toBe("100 × 51");
  });

  it("rounds a .5 boundary up despite float error", () => {
    expect(formatSize({ width: 0.5, height: 1.5 })).toBe("1 × 2");
  });

  it("separates thousands with a space", () => {
    expect(formatSize({ width: 1234, height: 12345 })).toBe("1 234 × 12 345");
  });

  it("takes the absolute value so a flip still reads correctly", () => {
    expect(formatSize({ width: -100, height: 50 })).toBe("100 × 50");
  });

  it("is undefined for a non-finite dimension", () => {
    expect(formatSize({ width: Number.NaN, height: 50 })).toBeUndefined();
    expect(
      formatSize({ width: Number.POSITIVE_INFINITY, height: 5 }),
    ).toBeUndefined();
  });
});

describe("IndicatorManager", () => {
  it("shows the angle while rotating and hides it when modified", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, angle: 30 });
    canvas.add(object);
    const indicators = createIndicatorManager({ canvas });

    canvas.fire(
      "object:rotating" as never,
      { transform: { target: object }, e: pointer() } as never,
    );
    const element = document.querySelector<HTMLElement>(
      ".vigilia-angle-indicator",
    );
    expect(element?.textContent).toBe("30°");
    expect(element?.style.display).not.toBe("none");

    canvas.fire("object:modified" as never, { target: object } as never);
    expect(element?.style.display).toBe("none");
    indicators.destroy();
  });

  it("shows the scaled size while scaling", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({
      id: "shape",
      width: 100,
      height: 50,
      strokeWidth: 0,
    });
    canvas.add(object);
    const indicators = createIndicatorManager({ canvas });

    canvas.fire(
      "object:scaling" as never,
      { transform: { target: object }, e: pointer() } as never,
    );

    expect(
      document.querySelector<HTMLElement>(".vigilia-size-indicator")
        ?.textContent,
    ).toBe("100 × 50");
    indicators.destroy();
  });

  it("stays silent when its option is off", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({ id: "shape", width: 10, height: 10, angle: 30 });
    canvas.add(object);
    const indicators = createIndicatorManager({
      canvas,
      showRotationAngle: false,
    });

    canvas.fire(
      "object:rotating" as never,
      { transform: { target: object }, e: pointer() } as never,
    );

    expect(
      document.querySelector<HTMLElement>(".vigilia-angle-indicator")?.style
        .display,
    ).toBe("none");
    indicators.destroy();
  });

  it("suppresses the size indicator for a locked object", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const object = new Rect({
      id: "shape",
      width: 10,
      height: 10,
      locked: true,
    });
    canvas.add(object);
    const indicators = createIndicatorManager({ canvas });

    canvas.fire(
      "object:scaling" as never,
      { transform: { target: object }, e: pointer() } as never,
    );

    expect(
      document.querySelector<HTMLElement>(".vigilia-size-indicator")?.style
        .display,
    ).toBe("none");
    indicators.destroy();
  });

  it("removes both elements on destroy", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const indicators = createIndicatorManager({ canvas });

    indicators.destroy();

    expect(document.querySelector(".vigilia-angle-indicator")).toBeNull();
    expect(document.querySelector(".vigilia-size-indicator")).toBeNull();
  });
});
