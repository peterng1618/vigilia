import { Gradient } from "fabric/es";

/** Converts the v2 palette paint owned by renderer-core at the Fabric boundary. */
export function fabricArtboardPaint(
  value: unknown,
  width: number,
  height: number,
): string | Gradient<"linear"> | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (isSolid(value)) return value.color;
  if (!isGradient(value)) return undefined;

  const radians = (value.angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const reach = Math.abs((width * dx) / 2) + Math.abs((height * dy) / 2);
  return new Gradient({
    type: "linear",
    gradientUnits: "pixels",
    coords: {
      x1: width / 2 - dx * reach,
      y1: height / 2 - dy * reach,
      x2: width / 2 + dx * reach,
      y2: height / 2 + dy * reach,
    },
    colorStops: [...value.stops],
  });
}

/** CSS is the matching paint form for letterbox bars outside the Fabric canvas. */
export function cssArtboardPaint(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (isSolid(value)) return value.color;
  if (!isGradient(value)) return undefined;
  return `linear-gradient(${90 - value.angle}deg, ${value.stops.map((stop) => `${stop.color} ${stop.offset * 100}%`).join(", ")})`;
}

/** Cheap identity for a resolved artboard paint, so a repaint can skip rebuilding
 * a Gradient. Two paints with the same key are interchangeable for `fabricArtboardPaint`. */
export function artboardPaintKey(value: unknown): string {
  if (typeof value === "string") return `s:${value}`;
  if (isSolid(value)) return `o:${value.color}`;
  if (isGradient(value))
    return `g:${value.angle}:${value.stops.map((stop) => `${stop.offset}/${stop.color}`).join(",")}`;
  return "none";
}

function isSolid(
  value: unknown,
): value is { readonly kind: "solid"; readonly color: string } {
  const color =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)["color"]
      : undefined;
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)["kind"] === "solid" &&
    typeof color === "string" &&
    color.length > 0
  );
}

function isGradient(value: unknown): value is {
  readonly kind: "gradient";
  readonly angle: number;
  readonly stops: readonly {
    readonly offset: number;
    readonly color: string;
  }[];
} {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>)["kind"] === "gradient" &&
    typeof (value as Record<string, unknown>)["angle"] === "number" &&
    Array.isArray((value as Record<string, unknown>)["stops"])
  );
}
