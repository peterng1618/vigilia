import demoTheme from "../demo-theme.json" with { type: "json" };
import stress from "./stress.json" with { type: "json" };
import portraitCover from "./portrait-cover.json" with { type: "json" };
import assets from "./assets.json" with { type: "json" };
import invalidNewerVersion from "./invalid/newer-version.json" with {
  type: "json",
};
import invalidBrokenReferences from "./invalid/broken-references.json" with {
  type: "json",
};
import invalidAssetTraversal from "./invalid/asset-traversal.json" with {
  type: "json",
};
import invalidChartArity from "./invalid/chart-arity.json" with {
  type: "json",
};
import invalidImpossibleGeometry from "./invalid/impossible-geometry.json" with {
  type: "json",
};
import type { IssueCode } from "@vigilia/renderer-core";

/** Valid fixtures cover distinct rendering shapes; invalid fixtures target validator failures. */

export interface ValidThemeFixture {
  readonly name: string;
  readonly document: unknown;
  readonly summary: string;
  /** Declared so tests detect bindings added to or removed from static fixtures. */
  readonly staticOnly?: boolean;
}

export interface InvalidThemeFixture {
  readonly name: string;
  readonly document: unknown;
  readonly expect: readonly IssueCode[];
  /** Require exactly `expect`, with no additional issue codes. */
  readonly only?: boolean;
}

export const VALID_THEMES: readonly ValidThemeFixture[] = [
  {
    name: "demo",
    document: demoTheme,
    summary:
      "Landscape showcase dashboard: all four chart families, styled runs, contain.",
  },
  {
    name: "stress",
    document: stress,
    summary:
      "Valid but hostile: extremes, rotation, deep nesting, multilingual text, cover of every overflow mode.",
  },
  {
    name: "portrait-cover",
    document: portraitCover,
    summary: "Tall 9:19.5 artboard in cover mode, with content at every edge.",
  },
  {
    name: "assets",
    document: assets,
    summary:
      "Image nodes: three fit modes, monochrome recolouring, an SVG, and one unresolvable reference.",
    staticOnly: true,
  },
];

export const INVALID_THEMES: readonly InvalidThemeFixture[] = [
  {
    name: "newer-version",
    document: invalidNewerVersion,
    // Version refusal short-circuits all other validation.
    expect: ["newer-schema-version"],
    only: true,
  },
  {
    name: "broken-references",
    document: invalidBrokenReferences,
    expect: [
      "unresolved-global-ref",
      "duplicate-id",
      "style-value-ambiguous",
      "binding-count",
    ],
  },
  {
    name: "asset-traversal",
    document: invalidAssetTraversal,
    expect: ["invalid-asset-path"],
  },
  {
    name: "chart-arity",
    document: invalidChartArity,
    expect: ["binding-count", "unresolved-binding-ref"],
  },
  {
    name: "impossible-geometry",
    document: invalidImpossibleGeometry,
    expect: ["out-of-range"],
  },
];

export function validThemeByName(name: string): unknown {
  return VALID_THEMES.find((fixture) => fixture.name === name)?.document;
}
