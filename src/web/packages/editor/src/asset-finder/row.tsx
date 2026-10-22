import type { AssetResult } from "@yunari/renderer-core";
import type * as React from "react";

/** One asset in the grid: its picture, its name, the source that supplied it
 *  and the licence the author takes on by choosing it. */
export function AssetRow({
  result,
  sourceLabel,
  selected,
  onSelect,
}: {
  readonly result: AssetResult;
  readonly sourceLabel: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-yunari-asset-row={result.id}
      data-selected={selected ? "" : undefined}
      className="flex min-w-0 flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] border border-edge bg-[var(--panel-2)] p-[var(--space-8)] text-left"
    >
      <span className="flex h-24 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg)]">
        {result.preview === "" ? null : (
          <img
            src={result.preview}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain"
          />
        )}
      </span>
      <span className="truncate text-sm">{result.name}</span>
      <span className="flex items-center justify-between gap-[var(--space-6)] text-xs text-muted">
        <span className="truncate">{sourceLabel}</span>
        <span className="shrink-0">{result.licence}</span>
      </span>
    </button>
  );
}
