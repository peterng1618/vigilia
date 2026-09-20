import { Shadow } from "fabric/es";
import type { ResolvedStyle } from "@vigilia/renderer-core";

/**
 * Fixed resolved-style → Fabric mapping; never pass arbitrary theme keys through.
 * Box/text mode is explicit because fill/stroke semantics differ. Unset Fabric
 * fill/stroke must be cleared because Fabric defaults to black fill/1px stroke.
 */

export type PaintMode = "box" | "text";
export type FabricPaint = Readonly<Record<string, unknown>>;

/** Report authored paint properties this canvas path cannot express. */
export function unsupportedPaint(
  style: ResolvedStyle,
  mode: PaintMode,
): readonly string[] {
  const unsupported: string[] = [];

  if (style["tabularNumerals"] === true) {
    unsupported.push("tabularNumerals");
  }

  if (mode === "text" && isDash(style["strokeDash"])) {
    unsupported.push("strokeDash");
  }

  if (
    mode === "text" &&
    asNumber(style["letterSpacing"]) !== undefined &&
    fontSizeOf(style) === undefined
  ) {
    unsupported.push("letterSpacing");
  }

  return unsupported;
}

export function paintFor(style: ResolvedStyle, mode: PaintMode): FabricPaint {
  return mode === "text" ? textPaint(style) : boxPaint(style);
}

function boxPaint(style: ResolvedStyle): FabricPaint {
  const stroke = asCss(style["strokeColor"]);
  const strokeWidth = asNumber(style["strokeWidth"]);
  const dashed = isDash(style["strokeDash"]);
  const painted =
    stroke !== undefined && strokeWidth !== undefined && strokeWidth > 0;

  return {
    fill: asCss(style["fill"]) ?? "",
    opacity: asNumber(style["opacity"]) ?? 1,
    stroke: painted ? stroke : null,
    strokeWidth: painted ? strokeWidth : 0,
    strokeDashArray:
      painted && dashed ? dashArrayFor(style["strokeDash"], strokeWidth) : null,
    shadow: shadowFor(style),
  };
}

function textPaint(style: ResolvedStyle): FabricPaint {
  const stroke = asCss(style["strokeColor"]);
  const strokeWidth = asNumber(style["strokeWidth"]);
  const painted =
    stroke !== undefined && strokeWidth !== undefined && strokeWidth > 0;
  const fontSize = fontSizeOf(style);
  const letterSpacing = asNumber(style["letterSpacing"]);
  const fontWeight = style["fontWeight"];
  const fontFamily = asCss(style["fontFamily"]);
  const lineHeight = asNumber(style["lineHeight"]);

  return {
    fill: asCss(style["color"]) ?? asCss(style["fill"]) ?? "",
    opacity: asNumber(style["opacity"]) ?? 1,
    stroke: painted ? stroke : null,
    strokeWidth: painted ? strokeWidth : 0,
    ...(painted ? { paintFirst: "stroke" } : {}),
    shadow: shadowFor(style),
    ...(fontFamily === undefined ? {} : { fontFamily }),
    ...(fontSize === undefined ? {} : { fontSize }),
    ...(typeof fontWeight === "number" || typeof fontWeight === "string"
      ? { fontWeight }
      : {}),
    ...(lineHeight === undefined ? {} : { lineHeight }),
    // Fabric charSpacing is 1/1000 em; conversion needs a resolved font size.
    ...(letterSpacing === undefined || fontSize === undefined
      ? {}
      : { charSpacing: (letterSpacing / fontSize) * 1000 }),
  };
}

/** Return null to actively remove a shadow from a previously styled object. */
function shadowFor(style: ResolvedStyle): Shadow | null {
  const color = asCss(style["shadowColor"]);

  if (color === undefined) {
    return null;
  }

  return new Shadow({
    color,
    blur: Math.max(0, asNumber(style["shadowBlur"]) ?? 0),
    offsetX: asNumber(style["shadowOffsetX"]) ?? 0,
    offsetY: asNumber(style["shadowOffsetY"]) ?? 0,
  });
}

/** Approximate CSS dashed/dotted patterns from stroke width. */
function dashArrayFor(dash: unknown, strokeWidth: number): number[] {
  const unit = Math.max(1, strokeWidth);

  return dash === "dotted" ? [unit, unit * 2] : [unit * 3, unit * 2];
}

function isDash(value: unknown): boolean {
  return value === "dashed" || value === "dotted";
}

function fontSizeOf(style: ResolvedStyle): number | undefined {
  return asNumber(style["fontSize"]);
}

function asCss(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
