import { Point, Rect, type FabricObject } from "fabric/es";
import { type Mock, describe, expect, it, vi } from "vitest";
import type { ObjectBounds } from "../bounds.js";
import {
  createRectangularScaleGestureProjection,
  createRectangularScaleProjectionModes,
  createRectangularScaleValues,
  projectRectangularScaleBounds,
  resolveRectangularScaleModeProjection,
  resolveRectangularScaleMovingEdges,
  resolveRectangularScaleMultipliers,
  resolveRectangularScalePointerMultipliers,
  type RectangularScaleControlKey,
  type RectangularScaleGestureMode,
  type RectangularScaleGestureTransform,
  type RectangularScaleMultipliers,
  type RectangularScalePoint,
} from "./rectangular-scale-gesture-projection.js";

// The gesture fixture is ported from the fork's own unit fixture
// (`specs/test-utils/snapping/rectangular-scale-gesture-projection.ts`), minus
// its `jest.Mock` and `ImageEditor` couplings. `projectFixtureBounds` is an
// independent re-derivation of the expected bounds, which is what makes the
// bounds assertions below real rather than circular.

/** The test geometry of one rectangular scale gesture. */
type RectangularScaleProjectionFixtureOptions = Readonly<{
  controlKey: RectangularScaleControlKey;
  angle?: number;
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  centered?: boolean;
  originalScaleX?: number;
  originalScaleY?: number;
}>;

/** The full start geometry used by the scaling calculation's tests. */
type RectangularScaleProjectionFixture = Readonly<{
  target: FabricObject;
  transform: RectangularScaleGestureTransform;
  transformOriginal: {
    scaleX: number;
    scaleY: number;
  };
  pointerStart: RectangularScalePoint;
  control: RectangularScalePoint;
  origin: RectangularScalePoint;
  fixedAnchor: RectangularScalePoint;
  topLeft: RectangularScalePoint;
  u: RectangularScalePoint;
  v: RectangularScalePoint;
  sourceCorners: readonly Point[];
  baselineBounds: ObjectBounds;
  getCoordsMock: Mock<() => Point[]>;
}>;

/** One handle and rotation angle of the parameterized tests. */
type RectangularScaleControlRotationCase = Readonly<{
  controlKey: RectangularScaleControlKey;
  angle: number;
}>;

/** All eight rectangular scale handles. */
const RECTANGULAR_SCALE_CONTROL_KEYS: readonly RectangularScaleControlKey[] =
  Object.freeze(["tl", "tr", "bl", "br", "ml", "mr", "mt", "mb"]);

/** The angles covering unrotated and rotated objects. */
const RECTANGULAR_SCALE_TEST_ANGLES: readonly number[] = Object.freeze([
  0, 30, 90,
]);

/** Every combination of the eight handles and three angles. */
const RECTANGULAR_SCALE_CONTROL_ROTATION_CASES: readonly RectangularScaleControlRotationCase[] =
  Object.freeze(
    RECTANGULAR_SCALE_CONTROL_KEYS.reduce<
      RectangularScaleControlRotationCase[]
    >((cases, controlKey) => {
      for (const angle of RECTANGULAR_SCALE_TEST_ANGLES) {
        cases.push(Object.freeze({ controlKey, angle }));
      }

      return cases;
    }, []),
  );

/** The normalized local coordinates of the scale handles. */
const CONTROL_COORDINATES: Readonly<
  Record<RectangularScaleControlKey, RectangularScalePoint>
> = Object.freeze({
  tl: Object.freeze({ x: 0, y: 0 }),
  tr: Object.freeze({ x: 1, y: 0 }),
  bl: Object.freeze({ x: 0, y: 1 }),
  br: Object.freeze({ x: 1, y: 1 }),
  ml: Object.freeze({ x: 0, y: 0.5 }),
  mr: Object.freeze({ x: 1, y: 0.5 }),
  mt: Object.freeze({ x: 0.5, y: 0 }),
  mb: Object.freeze({ x: 0.5, y: 1 }),
});

/** The anchor diagonally opposite the given corner handle, and its fixed edges. */
const OPPOSITE_CORNER: Readonly<Record<string, RectangularScaleControlKey>> =
  Object.freeze({
    tl: "br",
    tr: "bl",
    bl: "tr",
    br: "tl",
  });

/** The baseline edges a corner handle leaves in place, as [horizontal, vertical]. */
type FixedCornerEdges = readonly ["left" | "right", "top" | "bottom"];

const FIXED_EDGES_BY_CONTROL: Readonly<Record<string, FixedCornerEdges>> =
  Object.freeze({
    tl: ["right", "bottom"],
    tr: ["left", "bottom"],
    bl: ["right", "top"],
    br: ["left", "top"],
  });

/** A constant pointer offset from the handle's centre. */
const POINTER_HIT_OFFSET: RectangularScalePoint = Object.freeze({
  x: 3,
  y: -2,
});

/** Returns the Fabric action matching the chosen handle. */
function resolveScaleAction({
  controlKey,
}: {
  controlKey: string;
}): RectangularScaleGestureTransform["action"] {
  if (controlKey === "ml" || controlKey === "mr") return "scaleX";
  if (controlKey === "mt" || controlKey === "mb") return "scaleY";

  return "scale";
}

/** Converts degrees to radians. */
function toRadians({ angle }: { angle: number }): number {
  return angle * (Math.PI / 180);
}

/** Builds the rotated rectangle's basis from its visible width and height. */
function createBasis({
  angle,
  width,
  height,
}: {
  angle: number;
  width: number;
  height: number;
}): { u: RectangularScalePoint; v: RectangularScalePoint } {
  const radians = toRadians({ angle });
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return {
    u: Object.freeze({
      x: width * cosine,
      y: width * sine,
    }),
    v: Object.freeze({
      x: -height * sine,
      y: height * cosine,
    }),
  };
}

/** Returns the opposite handle's anchor, or the centre when scaling from the centre. */
function resolveFixtureOrigin({
  control,
  centered,
}: {
  control: RectangularScalePoint;
  centered: boolean;
}): RectangularScalePoint {
  if (centered) return Object.freeze({ x: 0.5, y: 0.5 });

  return Object.freeze({
    x: control.x === 0.5 ? 0.5 : 1 - control.x,
    y: control.y === 0.5 ? 0.5 : 1 - control.y,
  });
}

/** Converts normalized local coordinates into canvas coordinates. */
function projectFixturePoint({
  topLeft,
  u,
  v,
  coordinates,
}: {
  topLeft: RectangularScalePoint;
  u: RectangularScalePoint;
  v: RectangularScalePoint;
  coordinates: RectangularScalePoint;
}): RectangularScalePoint {
  return Object.freeze({
    x: topLeft.x + coordinates.x * u.x + coordinates.y * v.x,
    y: topLeft.y + coordinates.x * u.y + coordinates.y * v.y,
  });
}

/** Builds the start corners in Fabric's order: tl, tr, br, bl. */
function createFixtureCorners({
  topLeft,
  u,
  v,
}: {
  topLeft: RectangularScalePoint;
  u: RectangularScalePoint;
  v: RectangularScalePoint;
}): Point[] {
  const topRight = projectFixturePoint({
    topLeft,
    u,
    v,
    coordinates: CONTROL_COORDINATES.tr,
  });
  const bottomRight = projectFixturePoint({
    topLeft,
    u,
    v,
    coordinates: CONTROL_COORDINATES.br,
  });
  const bottomLeft = projectFixturePoint({
    topLeft,
    u,
    v,
    coordinates: CONTROL_COORDINATES.bl,
  });

  return [
    new Point(topLeft.x, topLeft.y),
    new Point(topRight.x, topRight.y),
    new Point(bottomRight.x, bottomRight.y),
    new Point(bottomLeft.x, bottomLeft.y),
  ];
}

/** Calculates the exact bounds of the given corners. */
function createFixtureBounds({
  points,
}: {
  points: readonly RectangularScalePoint[];
}): ObjectBounds {
  const xCoordinates = points.map(({ x }) => x);
  const yCoordinates = points.map(({ y }) => y);
  const left = Math.min(...xCoordinates);
  const right = Math.max(...xCoordinates);
  const top = Math.min(...yCoordinates);
  const bottom = Math.max(...yCoordinates);

  return {
    left,
    right,
    top,
    bottom,
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2,
  };
}

/** Creates a test rectangle whose getCoords result is controlled. */
function createFixtureTarget({
  sourceCorners,
  width,
  height,
  centerX,
  centerY,
  angle,
  originalScaleX,
  originalScaleY,
}: {
  sourceCorners: Point[];
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  angle: number;
  originalScaleX: number;
  originalScaleY: number;
}): { target: FabricObject; getCoordsMock: Mock<() => Point[]> } {
  const target = new Rect({
    left: centerX,
    top: centerY,
    width,
    height,
    angle,
    scaleX: originalScaleX,
    scaleY: originalScaleY,
    skewX: 0,
    skewY: 0,
  });
  const getCoordsMock = vi.fn(() => sourceCorners);

  target.getCoords = getCoordsMock;

  return { target, getCoordsMock };
}

/** Creates the full start geometry of one rectangular scale gesture. */
function createRectangularScaleProjectionFixture({
  controlKey,
  angle = 0,
  width = 200,
  height = 100,
  centerX = 400,
  centerY = 300,
  centered = false,
  originalScaleX = 1.25,
  originalScaleY = 0.8,
}: RectangularScaleProjectionFixtureOptions): RectangularScaleProjectionFixture {
  const control = CONTROL_COORDINATES[controlKey];
  const origin = resolveFixtureOrigin({ control, centered });
  const { u, v } = createBasis({ angle, width, height });
  const topLeft = Object.freeze({
    x: centerX - (u.x + v.x) / 2,
    y: centerY - (u.y + v.y) / 2,
  });
  const sourceCorners = createFixtureCorners({ topLeft, u, v });
  const { target, getCoordsMock } = createFixtureTarget({
    sourceCorners,
    width,
    height,
    centerX,
    centerY,
    angle,
    originalScaleX,
    originalScaleY,
  });
  const transformOriginal = { scaleX: originalScaleX, scaleY: originalScaleY };
  const fixedAnchor = projectFixturePoint({
    topLeft,
    u,
    v,
    coordinates: origin,
  });
  const controlPoint = projectFixturePoint({
    topLeft,
    u,
    v,
    coordinates: control,
  });
  const pointerStart = Object.freeze({
    x: controlPoint.x + POINTER_HIT_OFFSET.x,
    y: controlPoint.y + POINTER_HIT_OFFSET.y,
  });

  return Object.freeze({
    target,
    transform: Object.freeze({
      target,
      action: resolveScaleAction({ controlKey }),
      corner: controlKey,
      originX: origin.x,
      originY: origin.y,
      original: transformOriginal,
    }),
    transformOriginal,
    pointerStart,
    control,
    origin,
    fixedAnchor,
    topLeft,
    u,
    v,
    sourceCorners,
    baselineBounds: createFixtureBounds({ points: sourceCorners }),
    getCoordsMock,
  });
}

/** Returns the free scale mode of the given handle. */
function resolveFixtureFreeMode({
  controlKey,
}: {
  controlKey: RectangularScaleControlKey;
}): RectangularScaleGestureMode {
  if (controlKey === "ml" || controlKey === "mr") return "horizontal";
  if (controlKey === "mt" || controlKey === "mb") return "vertical";

  return "free";
}

/** Calculates the new pointer position for the given size multipliers. */
function moveFixturePointer({
  fixture,
  multipliers,
}: {
  fixture: RectangularScaleProjectionFixture;
  multipliers: RectangularScaleMultipliers;
}): RectangularScalePoint {
  const leverX = fixture.control.x - fixture.origin.x;
  const leverY = fixture.control.y - fixture.origin.y;
  const deltaX = leverX * (multipliers.x - 1);
  const deltaY = leverY * (multipliers.y - 1);

  return Object.freeze({
    x: fixture.pointerStart.x + deltaX * fixture.u.x + deltaY * fixture.v.x,
    y: fixture.pointerStart.y + deltaX * fixture.u.y + deltaY * fixture.v.y,
  });
}

/** Independently calculates the expected bounds for the given multipliers. */
function projectFixtureBounds({
  fixture,
  multipliers,
}: {
  fixture: RectangularScaleProjectionFixture;
  multipliers: RectangularScaleMultipliers;
}): ObjectBounds {
  const coordinates = [
    CONTROL_COORDINATES.tl,
    CONTROL_COORDINATES.tr,
    CONTROL_COORDINATES.br,
    CONTROL_COORDINATES.bl,
  ];
  const points = coordinates.map((coordinate) => {
    const localX = coordinate.x - fixture.origin.x;
    const localY = coordinate.y - fixture.origin.y;

    return {
      x:
        fixture.fixedAnchor.x +
        localX * multipliers.x * fixture.u.x +
        localY * multipliers.y * fixture.v.x,
      y:
        fixture.fixedAnchor.y +
        localX * multipliers.x * fixture.u.y +
        localY * multipliers.y * fixture.v.y,
    };
  });

  return createFixtureBounds({ points });
}

/** Creates the projection of the given fixture, failing the test when unsupported. */
function createProjectionFor(fixture: RectangularScaleProjectionFixture) {
  const projection = createRectangularScaleGestureProjection({
    transform: fixture.transform,
    pointerStart: fixture.pointerStart,
  });
  if (!projection) {
    throw new Error("Projection must exist for a supported rectangular handle");
  }

  return projection;
}

/** The corner handles, whose rotation cases cover the corner-specific behaviour. */
const CORNER_ROTATION_CASES = RECTANGULAR_SCALE_CONTROL_ROTATION_CASES.filter(
  ({ controlKey }) =>
    controlKey === "tl" ||
    controlKey === "tr" ||
    controlKey === "bl" ||
    controlKey === "br",
);

describe("rectangular scale gesture projection", () => {
  describe("mode multipliers", () => {
    it.each<{
      effectiveValues: readonly number[];
      mode: RectangularScaleGestureMode;
      multipliers: RectangularScaleMultipliers;
    }>([
      {
        mode: "horizontal",
        multipliers: { x: 1.25, y: 1 },
        effectiveValues: [1.25],
      },
      {
        mode: "vertical",
        multipliers: { x: 1, y: 0.8 },
        effectiveValues: [0.8],
      },
      {
        mode: "free",
        multipliers: { x: 1.25, y: 0.8 },
        effectiveValues: [1.25, 0.8],
      },
      {
        mode: "uniform",
        multipliers: { x: 1.25, y: 1.25 },
        effectiveValues: [1.25],
      },
    ])(
      "encodes and restores the multipliers for mode $mode",
      ({ effectiveValues, mode, multipliers }) => {
        const values = createRectangularScaleValues({ mode, multipliers });
        const restoredMultipliers = resolveRectangularScaleMultipliers({
          projectionMode: mode,
          effectiveValues: values,
        });

        expect(values).toEqual(effectiveValues);
        expect(restoredMultipliers).toEqual(multipliers);
        expect(Object.isFrozen(values)).toBe(true);
        expect(Object.isFrozen(restoredMultipliers)).toBe(true);
      },
    );

    it("rejects incomplete and unknown scale mode values", () => {
      expect(() => {
        resolveRectangularScaleMultipliers({
          projectionMode: "free",
          effectiveValues: [1.25],
        });
      }).toThrow("Free rectangular scale requires two finite multipliers");
      expect(() => {
        resolveRectangularScaleMultipliers({
          projectionMode: "custom",
          effectiveValues: [1.25],
        });
      }).toThrow('Unsupported rectangular scale projection mode "custom"');
      expect(() => {
        resolveRectangularScaleMultipliers({
          projectionMode: "free",
          effectiveValues: [],
        });
      }).toThrow(
        "Rectangular scale values must contain a finite first multiplier",
      );
    });
  });

  it("returns null for a control key it does not support", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
    });

    expect(
      createRectangularScaleGestureProjection({
        transform: { ...fixture.transform, corner: "not-a-control" },
        pointerStart: { x: 0, y: 0 },
      }),
    ).toBeNull();
    expect(fixture.getCoordsMock).not.toHaveBeenCalled();
  });

  it.each([
    { controlKey: "mr", action: "skewY" },
    { controlKey: "mt", action: "skewX" },
    { controlKey: "br", action: "scaleX" },
  ] as const)(
    "rejects action $action as a scale for control $controlKey",
    ({ controlKey, action }) => {
      const fixture = createRectangularScaleProjectionFixture({ controlKey });

      expect(
        createRectangularScaleGestureProjection({
          transform: { ...fixture.transform, action },
          pointerStart: fixture.pointerStart,
        }),
      ).toBeNull();
      expect(fixture.getCoordsMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid mouse-down pointer and an invalid original scale", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
    });

    expect(
      createRectangularScaleGestureProjection({
        transform: fixture.transform,
        pointerStart: { x: Number.NaN, y: 100 },
      }),
    ).toBeNull();
    expect(
      createRectangularScaleGestureProjection({
        transform: {
          ...fixture.transform,
          original: { scaleX: 0, scaleY: 1 },
        },
        pointerStart: fixture.pointerStart,
      }),
    ).toBeNull();
    expect(
      createRectangularScaleGestureProjection({
        transform: { ...fixture.transform, originX: Number.NaN },
        pointerStart: fixture.pointerStart,
      }),
    ).toBeNull();
    expect(fixture.getCoordsMock).not.toHaveBeenCalled();
  });

  it("rejects degenerate geometry that Fabric could not scale", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
    });
    fixture.getCoordsMock.mockReturnValue([
      new Point(10, 20),
      new Point(10, 20),
      new Point(10, 20),
      new Point(10, 20),
    ]);

    expect(
      createRectangularScaleGestureProjection({
        transform: fixture.transform,
        pointerStart: fixture.pointerStart,
      }),
    ).toBeNull();
    expect(fixture.getCoordsMock).toHaveBeenCalledTimes(1);
  });

  it.each(RECTANGULAR_SCALE_CONTROL_ROTATION_CASES)(
    "reads raw pointer multipliers for control $controlKey at $angle°",
    ({ controlKey, angle }) => {
      const fixture = createRectangularScaleProjectionFixture({
        controlKey,
        angle,
      });
      const projection = createProjectionFor(fixture);
      const pointer = moveFixturePointer({
        fixture,
        multipliers: { x: 1.4, y: 0.65 },
      });
      const mode = resolveFixtureFreeMode({ controlKey });
      const multipliers = resolveRectangularScalePointerMultipliers({
        projection,
        pointer,
        mode,
      });

      expect(multipliers).not.toBeNull();
      expect(multipliers?.x).toBeCloseTo(mode === "vertical" ? 1 : 1.4, 9);
      expect(multipliers?.y).toBeCloseTo(mode === "horizontal" ? 1 : 0.65, 9);
    },
  );

  it.each(CORNER_ROTATION_CASES)(
    "reads the uniform pointer multiplier for control $controlKey at $angle°",
    ({ controlKey, angle }) => {
      const fixture = createRectangularScaleProjectionFixture({
        controlKey,
        angle,
      });
      const projection = createProjectionFor(fixture);
      const pointer = moveFixturePointer({
        fixture,
        multipliers: { x: 1.35, y: 1.35 },
      });
      const multipliers = resolveRectangularScalePointerMultipliers({
        projection,
        pointer,
        mode: "uniform",
      });

      expect(multipliers?.x).toBeCloseTo(1.35, 9);
      expect(multipliers?.y).toBeCloseTo(1.35, 9);
    },
  );

  it("projects a rotated drag on the object's own axes", () => {
    // At 45° a screen-axis stretch would leave the bottom edge still; the
    // object-axis stretch moves it by the rotated u vector's y component.
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
      angle: 45,
    });
    const projection = createProjectionFor(fixture);
    const multipliers = { x: 1.5, y: 1 };
    const projected = projectRectangularScaleBounds({
      projection,
      multipliers,
    });
    const expected = projectFixtureBounds({ fixture, multipliers });
    if (!projected) throw new Error("Projected bounds must exist");

    expect(fixture.u.y).not.toBeCloseTo(0, 9);
    expect(projected.left).toBeCloseTo(fixture.baselineBounds.left, 9);
    expect(projected.top).toBeCloseTo(fixture.baselineBounds.top, 9);
    expect(projected.right).toBeCloseTo(
      fixture.baselineBounds.right + 0.5 * fixture.u.x,
      9,
    );
    expect(projected.bottom).toBeCloseTo(
      fixture.baselineBounds.bottom + 0.5 * fixture.u.y,
      9,
    );
    expect(projected.left).toBeCloseTo(expected.left, 9);
    expect(projected.right).toBeCloseTo(expected.right, 9);
    expect(projected.top).toBeCloseTo(expected.top, 9);
    expect(projected.bottom).toBeCloseTo(expected.bottom, 9);
  });

  it.each(CORNER_ROTATION_CASES)(
    "keeps the opposite corner fixed for control $controlKey at $angle°",
    ({ controlKey, angle }) => {
      const fixture = createRectangularScaleProjectionFixture({
        controlKey,
        angle,
      });
      const projection = createProjectionFor(fixture);
      const opposite = OPPOSITE_CORNER[controlKey];
      if (!opposite) throw new Error("Corner handle needs an opposite corner");
      const expectedAnchor = projectFixturePoint({
        topLeft: fixture.topLeft,
        u: fixture.u,
        v: fixture.v,
        coordinates: CONTROL_COORDINATES[opposite],
      });

      expect(projection.fixedAnchor.x).toBeCloseTo(expectedAnchor.x, 9);
      expect(projection.fixedAnchor.y).toBeCloseTo(expectedAnchor.y, 9);
    },
  );

  it.each(["tl", "tr", "bl", "br"] as const)(
    "holds the anchor-side edges of control %s while scaling",
    (controlKey) => {
      const fixture = createRectangularScaleProjectionFixture({ controlKey });
      const projection = createProjectionFor(fixture);
      const projected = projectRectangularScaleBounds({
        projection,
        multipliers: { x: 1.3, y: 0.7 },
      });
      if (!projected) throw new Error("Projected bounds must exist");
      const fixedEdges = FIXED_EDGES_BY_CONTROL[controlKey];
      if (!fixedEdges) throw new Error("Corner handle needs fixed edges");
      const [horizontalFixedEdge, verticalFixedEdge] = fixedEdges;

      expect(projected[horizontalFixedEdge]).toBeCloseTo(
        fixture.baselineBounds[horizontalFixedEdge],
        9,
      );
      expect(projected[verticalFixedEdge]).toBeCloseTo(
        fixture.baselineBounds[verticalFixedEdge],
        9,
      );
    },
  );

  it("reports every edge the handle can move", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
    });
    const projection = createProjectionFor(fixture);
    const projectionModes = createRectangularScaleProjectionModes({
      projection,
    });

    expect(projectionModes.map(({ id }) => id)).toEqual(["free", "uniform"]);
    expect(
      [...resolveRectangularScaleMovingEdges({ projectionModes })].sort(),
    ).toEqual(["bottom", "right"]);
  });

  it("reports the moving edges of a rotated side handle", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "mr",
      angle: 30,
    });
    const projection = createProjectionFor(fixture);
    const modeProjection = resolveRectangularScaleModeProjection({
      projection,
      mode: "horizontal",
    });
    const projected = projectRectangularScaleBounds({
      projection,
      multipliers: { x: 1.4, y: 1 },
    });
    if (!modeProjection || !projected)
      throw new Error("Side projection and bounds must exist");

    expect(modeProjection.variables).toEqual(["multiplier-x"]);
    expect(modeProjection.edges.map(({ edge }) => edge)).toEqual([
      "right",
      "bottom",
    ]);

    const positions = {
      left: projected.left,
      right: projected.right,
      top: projected.top,
      bottom: projected.bottom,
    };
    for (const edge of modeProjection.edges) {
      expect(
        edge.baselinePosition + (edge.coefficients[0] ?? 0) * 0.4,
      ).toBeCloseTo(positions[edge.edge], 9);
    }
  });

  it("resolves the uniform mode's edge coefficients from both axes", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
      angle: 30,
      centered: true,
    });
    const projection = createProjectionFor(fixture);
    const modeProjection = resolveRectangularScaleModeProjection({
      projection,
      mode: "uniform",
    });
    const projected = projectRectangularScaleBounds({
      projection,
      multipliers: { x: 1.3, y: 1.3 },
    });
    if (!modeProjection || !projected)
      throw new Error("Uniform projection and bounds must exist");

    expect(modeProjection.variables).toEqual(["uniform-multiplier"]);
    expect(modeProjection.edges.map(({ edge }) => edge)).toEqual([
      "left",
      "right",
      "top",
      "bottom",
    ]);

    const positions = {
      left: projected.left,
      right: projected.right,
      top: projected.top,
      bottom: projected.bottom,
    };
    for (const edge of modeProjection.edges) {
      expect(
        edge.baselinePosition + (edge.coefficients[0] ?? 0) * 0.3,
      ).toBeCloseTo(positions[edge.edge], 9);
    }
  });

  it("returns no pointer intent or coefficients for an incompatible control mode", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "mr",
    });
    const projection = createProjectionFor(fixture);
    const pointer = moveFixturePointer({
      fixture,
      multipliers: { x: 1.2, y: 1 },
    });

    expect(
      resolveRectangularScalePointerMultipliers({
        projection,
        pointer,
        mode: "uniform",
      }),
    ).toBeNull();
    expect(
      resolveRectangularScaleModeProjection({ projection, mode: "free" }),
    ).toBeNull();
  });

  it("stops the uniform scale once the pointer crosses the fixed point", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
    });
    const projection = createProjectionFor(fixture);
    const pointer = moveFixturePointer({
      fixture,
      multipliers: { x: -0.1, y: -0.1 },
    });

    expect(
      resolveRectangularScalePointerMultipliers({
        projection,
        pointer,
        mode: "uniform",
      }),
    ).toBeNull();
  });

  it("keeps the start snapshot independent of the target and its source corners", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
      angle: 30,
    });
    const projection = createProjectionFor(fixture);
    const pointer = moveFixturePointer({
      fixture,
      multipliers: { x: 1.45, y: 0.7 },
    });
    const firstResult = resolveRectangularScalePointerMultipliers({
      projection,
      pointer,
      mode: "free",
    });

    fixture.target.set({
      width: 1,
      height: 999,
      scaleX: 8,
      scaleY: 0.02,
    });
    const firstCorner = fixture.sourceCorners[0];
    if (firstCorner) firstCorner.x += 1000;
    fixture.transformOriginal.scaleX = 99;
    fixture.transformOriginal.scaleY = 77;

    const repeatedResult = resolveRectangularScalePointerMultipliers({
      projection,
      pointer,
      mode: "free",
    });

    expect(firstResult?.x).toBeCloseTo(1.45, 9);
    expect(firstResult?.y).toBeCloseTo(0.7, 9);
    expect(repeatedResult).toEqual(firstResult);
    expect(projection.originalScales).toEqual({ x: 1.25, y: 0.8 });
    expect(fixture.getCoordsMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-finite pointer and non-finite multipliers after the snapshot", () => {
    const fixture = createRectangularScaleProjectionFixture({
      controlKey: "br",
    });
    const projection = createProjectionFor(fixture);

    expect(
      resolveRectangularScalePointerMultipliers({
        projection,
        pointer: { x: Number.POSITIVE_INFINITY, y: 0 },
        mode: "free",
      }),
    ).toBeNull();
    expect(
      projectRectangularScaleBounds({
        projection,
        multipliers: { x: Number.NaN, y: 1 },
      }),
    ).toBeNull();
  });
});
