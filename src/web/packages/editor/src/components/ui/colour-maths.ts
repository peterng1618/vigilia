/**
 * Colour arithmetic for the picker, kept away from the DOM so it can be tested.
 *
 * The palette's paints carry alpha — `panel` is 85%, `frost` is 30% — so 8-digit
 * hex is the storage form throughout and a picker without a real alpha channel
 * is a way to lose the value. `<input type="color">` has none, which is why it
 * stays ruled out for this field.
 */

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0–1. The one member that is not a 0–255 byte. */
  readonly a: number;
}

export interface Hsva {
  /** 0–360. */
  readonly h: number;
  readonly s: number;
  readonly v: number;
  readonly a: number;
}

type Triple = readonly [number, number, number];

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const clampByte = (n: number): number =>
  Math.round(n < 0 ? 0 : n > 255 ? 255 : n);
const hexByte = (n: number): string =>
  clampByte(n).toString(16).padStart(2, "0");

/** The six hue sectors, written once so both conversions agree on them. */
function sectorRgb(c: number, x: number, sector: number): Triple {
  const table: readonly Triple[] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  return table[sector % table.length] ?? [0, 0, 0];
}

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, with or without the hash. */
export function parseHex(input: string): Rgba | undefined {
  const hex = input.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(hex)) return undefined;
  // `noUncheckedIndexedAccess` is on and these lengths are already checked, so
  // each read is a nibble the caller can trust.
  if (hex.length === 3 || hex.length === 4) {
    const nibble = (i: number): number =>
      Number.parseInt(hex[i]! + hex[i]!, 16);
    return {
      r: nibble(0),
      g: nibble(1),
      b: nibble(2),
      a: hex.length === 4 ? nibble(3) / 255 : 1,
    };
  }
  if (hex.length === 6 || hex.length === 8) {
    const pair = (i: number): number =>
      Number.parseInt(hex.slice(i, i + 2), 16);
    return {
      r: pair(0),
      g: pair(2),
      b: pair(4),
      a: hex.length === 8 ? pair(6) / 255 : 1,
    };
  }
  return undefined;
}

/** 8-digit when the colour is not fully opaque, so the alpha survives a round trip. */
export function toHex({ r, g, b, a }: Rgba): string {
  const base = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
  // Alpha is 0–1 where the channels are 0–255; scaling it like a channel is how
  // 85% turned into 1/255 and the value was quietly destroyed.
  return a >= 1 ? base : `${base}${hexByte(a * 255)}`;
}

export function rgbaToHsva({ r, g, b, a }: Rgba): Hsva {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max, a };
}

export function hsvaToRgba({ h, s, v, a }: Hsva): Rgba {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = sectorRgb(c, x, Math.floor(h / 60));
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
    a: clamp01(a),
  };
}

/** `hsl()` / `hsla()`, which the theme's own tokens are written in. */
export function hslaToHex(hsl: string): string | undefined {
  const match =
    /^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s/]+([\d.]+%?))?\s*\)$/i.exec(
      hsl.trim(),
    );
  if (match === null) return undefined;
  const [, hueText, satText, lightText, alphaText] = match;
  // `alpha`, not the raw capture: for a three-argument hsl() the capture is
  // undefined, and passing it through produced "NaN" in the hex.
  const alpha =
    alphaText === undefined
      ? 1
      : Number.parseFloat(alphaText) / (alphaText.endsWith("%") ? 100 : 1);
  const hue = Number.parseFloat(hueText ?? "0");
  const sat = Number.parseFloat(satText ?? "0") / 100;
  const light = Number.parseFloat(lightText ?? "0") / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;
  const [r, g, b] = sectorRgb(c, x, Math.floor(hue / 60));
  return toHex({
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
    a: alpha,
  });
}

/** What the picker accepts: hex in any length, `hsl()`, or `transparent`. */
export function parseColour(input: string): Rgba | undefined {
  const trimmed = input.trim();
  // The theme's own no-paint token; any other bare word is a CSS keyword this
  // picker does not know, and must not accept as if it did.
  if (trimmed.toLowerCase() === "transparent")
    return { r: 0, g: 0, b: 0, a: 0 };
  if (trimmed.toLowerCase().startsWith("hsl")) {
    const hex = hslaToHex(trimmed);
    return hex === undefined ? undefined : parseHex(hex);
  }
  return parseHex(trimmed);
}
