/** Responsibility: the comparators — the pure decisions that say whether a declared value and a rendered value are the same reading. */

/** A CSS length in px that **every** value of a shorthand agrees on.
 *
 *  **A pure decision, so it is proved in `mockup-values.test.ts` rather than in a
 *  browser run.** Its defect — reading only the first token — was invisible for
 *  exactly the reason this file is unit-tested: `border-radius` is a shorthand of
 *  four corners and `getComputedStyle` serialises a non-uniform radius as
 *  `8px 8px 0px 0px`, so `border-radius: 8px 8px 0 0` on `.editor-shell-dialog`
 *  read as `8` and the modal shipped with two square corners a person can see. A
 *  comparator whose guard sits behind a desktop browser run is a comparator a
 *  `vitest run` cannot hold, and that is the failure it already had once.
 *
 *  Every token is therefore held: a value whose tokens disagree has no single
 *  length it means, so it is `null` and the row fails naming the whole rendered
 *  value rather than the first token of it. `normal` is `gap`'s own word for no
 *  gap and reads as `0`, and so is a bare `0` — the one length CSS lets a
 *  drawing write without a unit, so a row whose drawing says `padding-top:0`
 *  reads as flush rather than as a value this table cannot read. Anything else
 *  without `px` is not a length, and fails with its own text. A **single-value**
 *  radius is unchanged: `8px` is one token and still means `8`, as does
 *  `8px 8px 8px 8px` — the same radius spelled out. */
export function lengthInPx(value: string): number | null {
  const tokens = value
    .trim()
    .split(/[\s/]+/)
    .filter((part) => part !== "");
  if (tokens.length === 0) return null;
  if (tokens[0] === "normal") return 0;
  const lengths: number[] = [];
  for (const token of tokens) {
    if (token === "0") {
      lengths.push(0);
      continue;
    }
    const match = /^(-?[\d.]+)px$/.exec(token);
    if (match === null) return null;
    const px = Number.parseFloat(match[1] ?? "NaN");
    if (!Number.isFinite(px)) return null;
    lengths.push(px);
  }
  const first = lengths[0] ?? null;
  return lengths.every((length) => length === first) ? first : null;
}

/** How many tracks a `grid-template-columns` value declares or resolves to.
 *
 *  **A count is not a length.** `lengthInPx` returns `null` for the drawing's
 *  `repeat(3,1fr)` and for the product's computed track list alike, so a length
 *  row over the palette grid fails saying "not a length this table can compare"
 *  whatever either side does. The count is read from the same property on both
 *  sides: the drawing's declared `repeat(3,1fr)`, and the product's computed
 *  list, which a browser serialises for a fixed grid as `"146px 146px 146px"`.
 *
 *  `null` is a value this comparator cannot read — `none`, `subgrid`, an empty
 *  string, or a `repeat()` whose count is not a plain integer
 *  (`repeat(auto-fill, …)` is a bound, not a count) — and a row reading `null`
 *  fails naming the whole rendered value rather than passing as a zero.
 *
 *  `ponytail:` splitting a serialised track list at top-level whitespace is the
 *  ceiling here; a real grid-resolution model would be a second layout engine
 *  for a fixed column count.
 */
export function trackCount(value: string): number | null {
  const text = value.trim();
  if (text === "" || text === "none" || text === "subgrid") return null;
  const repeated = /^repeat\(\s*(\d+)\s*,/.exec(text);
  if (repeated !== null) {
    const count = Number.parseInt(repeated[1] ?? "", 10);
    return Number.isInteger(count) && count > 0 ? count : null;
  }
  // A `repeat()` this reader has no plain count for is `null` rather than one
  // track: `repeat(auto-fill, …)` is a bound, and counting the whole function as
  // a single token would answer `1` for a grid whose column count is not fixed.
  if (text.startsWith("repeat(")) return null;
  /** Top-level whitespace only: a `minmax(100px, 1fr)` track and a `[name]`
   *  line both carry spaces of their own, and neither is two tracks. */
  const tracks: string[] = [];
  let depth = 0;
  let track = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth === 0 && /\s/.test(char)) {
      if (track !== "") tracks.push(track);
      track = "";
      continue;
    }
    track += char;
  }
  if (track !== "") tracks.push(track);
  const counted = tracks.filter(
    (one) => !(one.startsWith("[") && one.endsWith("]")),
  );
  return counted.length === 0 ? null : counted.length;
}

/** One channel of an `rgb()`/`rgba()` argument, as an 8-bit integer. */
function channel(token: string): number | null {
  const percent = token.endsWith("%");
  const number = Number.parseFloat(token);
  if (!Number.isFinite(number)) return null;
  return Math.round(percent ? (number / 100) * 255 : number);
}

/** Alpha, as the same 8 bits — **not** through `channel`: alpha is written
 *  fractional (`0.451`) or as a percentage (`45.1%`), never as 0–255, so the
 *  first form has to be scaled rather than rounded. Reading `0.451` as a channel
 *  turns a 45% scrim into a fully transparent one. */
function alphaChannel(token: string): number | null {
  if (token.endsWith("%")) return channel(token);
  const number = Number.parseFloat(token);
  if (!Number.isFinite(number)) return null;
  return Math.round(number <= 1 ? number * 255 : number);
}

/** A colour as one canonical spelling, or `null` when the value is not one this
 *  comparator can read.
 *
 *  **A colour is not a length, and two spellings of one colour are not equal as
 *  strings.** DESIGN.md writes the modal's scrim `#00000073` and a browser
 *  computes the same colour as `rgba(0, 0, 0, 0.451)`, so a string comparison
 *  fails on a surface that is right — and `lengthInPx` fails on one that is read
 *  at all. The value is therefore parsed into 8-bit channels and returned as a
 *  single spelling, so two readings compare equal exactly when they are the same
 *  colour.
 *
 *  Hex (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()` with commas or
 *  spaces, integer or percentage channels, and `transparent` are read. Anything
 *  else — a `color-mix(…)`, a gradient, a named colour — is `null`, which a row
 *  fails on naming the whole value rather than comparing two unknowns. Alpha is
 *  quantised to the same 8 bits the channels are, so `0.45` and `0.451` are one
 *  colour: a finer distinction than an 8-bit channel can carry.
 */
export function colourValue(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (text === "transparent") return "rgba(0, 0, 0, 0)";
  const hex = /^#([0-9a-f]{3,8})$/.exec(text);
  if (hex !== null) {
    const digits = hex[1] ?? "";
    const wide = digits.length === 6 || digits.length === 8;
    if (!wide && digits.length !== 3 && digits.length !== 4) return null;
    const step = wide ? 2 : 1;
    const parts: number[] = [];
    for (let at = 0; at < digits.length; at += step) {
      const pair = digits.slice(at, at + step);
      parts.push(Number.parseInt(wide ? pair : pair + pair, 16));
    }
    const [r, g, b, a] = parts;
    return `rgba(${r ?? 0}, ${g ?? 0}, ${b ?? 0}, ${a ?? 255})`;
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(text);
  if (fn === null) return null;
  const parts = (fn[1] ?? "").split(/[\s,/]+/).filter((part) => part !== "");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const channels = parts.slice(0, 3).map(channel);
  if (channels.some((one) => one === null)) return null;
  const alpha = parts.length === 4 ? alphaChannel(parts[3] ?? "") : 255;
  if (alpha === null) return null;
  const [r, g, b] = channels;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
