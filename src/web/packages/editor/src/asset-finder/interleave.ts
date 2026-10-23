import type { AssetPage, AssetResult } from "@yunari/renderer-core";

/**
 * Every enabled source's rows in one list: round-robin over each page's rows,
 * appended after `previous`, so a later page never reorders rows already shown.
 */
export function interleave(
  pages: readonly AssetPage[],
  previous: readonly AssetResult[],
): readonly AssetResult[] {
  const rows = [...previous];
  const longest = Math.max(0, ...pages.map((page) => page.results.length));
  for (let index = 0; index < longest; index += 1) {
    for (const page of pages) {
      const result = page.results[index];
      if (result !== undefined) rows.push(result);
    }
  }
  return rows;
}
