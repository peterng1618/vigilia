import type { ResolvedStyle, ScenePlan } from "./plan.js";

/** Font availability diagnostics via metric comparison, not `document.fonts.check`. */

/** Generic families always resolve and are excluded from missing-font diagnostics. */
export const GENERIC_FAMILIES: readonly string[] = [
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
  "inherit",
  "initial",
  "unset",
];

export function isGenericFamily(family: string): boolean {
  return GENERIC_FAMILIES.includes(family.trim().toLowerCase());
}

/** Splits ordinary CSS font stacks; escaped commas in family names are not supported. */
export function parseFontStack(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .trim(),
    )
    .filter((part) => part.length > 0);
}

/** Specific font families requested by a plan, in first-seen order. */
export function requestedFontFamilies(plan: ScenePlan): string[] {
  const families: string[] = [];

  const add = (style: ResolvedStyle): void => {
    for (const family of parseFontStack(style["fontFamily"])) {
      if (!isGenericFamily(family) && !families.includes(family)) {
        families.push(family);
      }
    }
  };

  const walk = (nodes: ScenePlan["nodes"]): void => {
    for (const node of nodes) {
      add(node.style);

      if (node.content.kind === "text") {
        for (const segment of node.content.segments) {
          add(segment.style);
        }
      }

      walk(node.children);
    }
  };

  walk(plan.nodes);

  return families;
}

const PROBE_SIZE = 72;
const PROBE_TEXT = "mmmmmmmmmmlliWWWW@";

/** Browser-only metric probe for families unavailable to canvas text rendering. */
export function unavailableFontFamilies(families: readonly string[]): string[] {
  const context = document.createElement("canvas").getContext("2d");

  if (context === null) {
    return [];
  }

  const measure = (font: string): number => {
    context.font = `${PROBE_SIZE}px ${font}`;
    return context.measureText(PROBE_TEXT).width;
  };

  // Two distinct fallbacks reduce false availability matches from equal metrics.
  const baselines: [string, number][] = [
    ["monospace", measure("monospace")],
    ["serif", measure("serif")],
  ];

  const missing: string[] = [];

  for (const family of families) {
    const quoted = `"${family.replace(/"/g, "")}"`;
    const contributed = baselines.some(
      ([fallback, baseline]) => measure(`${quoted}, ${fallback}`) !== baseline,
    );

    if (!contributed) {
      missing.push(family);
    }
  }

  return missing;
}

export function missingFontFamilies(plan: ScenePlan): string[] {
  return unavailableFontFamilies(requestedFontFamilies(plan));
}
