/**
 * Shared cartesian grid policy. ECharts 6 deprecates `containLabel`; use
 * `outerBoundsMode`/`outerBoundsContain` instead. Bare charts use `none` so the
 * plot reaches authored edges.
 */

export interface GridInset {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export type CartesianGrid = GridInset &
  (
    | {
        readonly outerBoundsMode: "same";
        readonly outerBoundsContain: "axisLabel";
      }
    | { readonly outerBoundsMode: "none" }
  );

/** Allow axis labels to shrink the plot only when labels are actually drawn. */
export function cartesianGrid(
  inset: GridInset,
  containLabels: boolean,
): CartesianGrid {
  return containLabels
    ? { ...inset, outerBoundsMode: "same", outerBoundsContain: "axisLabel" }
    : { ...inset, outerBoundsMode: "none" };
}
