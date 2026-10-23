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
      // The selected row is the author's answer to "which one am I importing":
      // an accent edge and a tint, not only the pressed state a pointer cannot
      // see. Written as a branch rather than an `aria-pressed:` variant so the
      // test can read the choice off the element.
      className={`flex min-w-0 flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] border bg-[var(--panel-2)] p-[var(--space-8)] text-left ${
        selected
          ? "border-accent bg-accent/10 ring-1 ring-accent"
          : "border-edge"
      }`}
    >
      <span className="flex h-24 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] bg-[var(--bg)]">
        {result.preview === "" ? null : result.kind === "image" ? (
          <img
            src={result.preview}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        ) : (
          // A monochrome icon is drawn as a mask, never as an `<img>`: the
          // picture is the shape's alpha and the colour is the row's own text
          // colour, so a black-on-black set reads on a dark theme and a fixed
          // box gives every source the same apparent size.
          <span
            aria-hidden="true"
            data-yunari-asset-preview={result.kind}
            className="h-14 w-14 bg-current text-text"
            style={{
              maskImage: `url("${result.preview}")`,
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
            }}
          />
        )}
      </span>
      <span className="truncate text-sm">{result.name}</span>
      {/* The source's own second word: an icon style, or a photographer. */}
      {result.subtitle === undefined ? null : (
        <span className="truncate text-xs text-faint">{result.subtitle}</span>
      )}
      <span className="flex items-center justify-between gap-[var(--space-6)] text-xs text-muted">
        <span className="truncate">{sourceLabel}</span>
        <span className="shrink-0">{result.licence}</span>
      </span>
    </button>
  );
}
