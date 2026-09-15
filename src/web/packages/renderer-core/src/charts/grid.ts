/**
 * The cartesian grid rect, and whether axis labels are allowed to shrink it.
 *
 * One owner because the line and bar families need the identical object and
 * used to declare it twice — same five keys, same intent, written out in both
 * builders. The second copy is also what kept a defect alive: see below.
 *
 * ## `containLabel` was inert, app-wide
 *
 * Both builders emitted `grid.containLabel`, which ECharts 6 **deprecated**.
 * Reaching it now requires registering `LegacyGridContainLabel` from
 * `echarts/features`, and nothing in this repository ever did — so axis labels
 * reserved no space anywhere and a real mount printed
 * `[ECharts] Specified grid.containLabel but no use(LegacyGridContainLabel)`.
 * Two unit tests asserted the key and passed throughout, which is what a test
 * that asserts a key rather than a behaviour buys you.
 *
 * The fix is ECharts' own replacement rather than the legacy shim, quoting the
 * deprecation note in `GridOption`: "`grid.containLabel` is equivalent to
 * `{outerBoundsMode: 'same', outerBoundsContain: 'axisLabel'}`". So nothing is
 * registered, nothing deprecated is emitted, and the behaviour is the one the
 * builders always meant.
 *
 * `'none'` is the deliberate other half: it makes the outer bounds infinite, so
 * a sparkline reaches the edges of the box the author laid out instead of being
 * shrunk to fit labels that are not drawn. Leaving the mode unset would take
 * ECharts' `'auto'`, which contains against the *canvas* — a silent margin on
 * an element that asked for none.
 */

/** Grid margins in pixels, inside the chart element. */
export interface GridInset {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * The emitted `grid` option.
 *
 * `outerBoundsContain` is present only in the containing case, because
 * `exactOptionalPropertyTypes` makes an explicit `undefined` a different type
 * from an absent key — and an absent key is what "ECharts decides" means.
 */
export type CartesianGrid = GridInset &
  (
    | { readonly outerBoundsMode: 'same'; readonly outerBoundsContain: 'axisLabel' }
    | { readonly outerBoundsMode: 'none' }
  );

/**
 * Builds the grid option.
 *
 * @param containLabels whether axis labels may take space from the grid rect.
 *   True when any axis or category label is drawn; false for a sparkline or a
 *   bare progress bar, which must reach the authored edges.
 */
export function cartesianGrid(inset: GridInset, containLabels: boolean): CartesianGrid {
  return containLabels
    ? { ...inset, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' }
    : { ...inset, outerBoundsMode: 'none' };
}
