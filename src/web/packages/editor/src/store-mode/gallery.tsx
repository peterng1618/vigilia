import type * as React from "react";
import { useState } from "react";
import { ControlIconButton } from "../components/ui/control-icon-button.js";
import {
  ASSIGN_ITEM_GLYPH,
  DELETE_ITEM_GLYPH,
  EXPORT_ITEM_GLYPH,
  Glyph,
  type LucideIcon,
  OPEN_ITEM_GLYPH,
} from "../editor-shell/icons.js";
import { uiCopy } from "../ui-copy.js";
import type { CellAction, StoreItem } from "./local-source.js";

/**
 * The gallery: the drawing's cell, and the grid of them.
 *
 * It is handed its items and narrows nothing — A.5 owns what a query and a
 * facet selection filter, A.6 mounts it in the region and owns the empty states,
 * and the source it reads is A.4's. What is here is the cell's own geometry,
 * taken from `docs/design/mockups/current/store-themes.html`.
 */

/** The four actions in the drawing's own order: open, assign, export, delete. */
const CELL_ACTIONS = [
  "open",
  "assign",
  "export",
  "delete",
] as const satisfies readonly CellAction[];

/** One glyph per action, as a **total** lookup: an action added to `CellAction`
 *  without a mark fails to compile here rather than drawing a nameless square. */
const CELL_ACTION_GLYPHS: Readonly<Record<CellAction, LucideIcon>> = {
  open: OPEN_ITEM_GLYPH,
  assign: ASSIGN_ITEM_GLYPH,
  export: EXPORT_ITEM_GLYPH,
  delete: DELETE_ITEM_GLYPH,
};

/**
 * The grid of cells.
 *
 * **`repeat(auto-fill, minmax(272px, 1fr))`, and the 272 is not this half's
 * number.** It is derived from the *online* half's busiest facts band — its
 * badge, its counts and its actions — so a person switching halves does not
 * watch the grid change shape; the drawing states it and DESIGN.md's Layout
 * section carries it as a design-language value. `auto-fill` answers the column
 * count from the width, so there is no measured count and no breakpoint to keep
 * in step with the window.
 *
 * The four actions travel through one `onAction`, because a cell draws four and
 * a callback per action would be four props a caller can half-wire.
 */
export function Gallery(props: {
  readonly items: readonly StoreItem[];
  readonly onAction: (action: CellAction, id: string) => void;
}): React.JSX.Element {
  return (
    <ul
      data-vigilia-store-gallery=""
      className="grid grid-cols-[repeat(auto-fill,minmax(272px,1fr))] gap-[var(--space-12)]"
    >
      {props.items.map((item) => (
        <Cell key={item.id} item={item} onAction={props.onAction} />
      ))}
    </ul>
  );
}

/**
 * One item: its picture, its name, its byline and its facts band.
 *
 * The bands are the drawing's exactly — the picture at `2/1` with `object-fit:
 * cover`, the name, the mono byline, and the 26px band — and the band's left
 * slot is deliberately **empty**: the origin badge is phase B's, and inventing
 * one here would be an origin record this phase has no producer for.
 */
function Cell(props: {
  readonly item: StoreItem;
  readonly onAction: (action: CellAction, id: string) => void;
}): React.JSX.Element {
  const { item, onAction } = props;

  return (
    <li
      data-vigilia-store-cell={item.id}
      className="flex flex-col overflow-hidden rounded-lg border border-edge bg-panel-2"
    >
      <Picture item={item} />
      <div className="flex flex-col gap-[var(--space-6)] p-[var(--space-10)]">
        <span
          data-vigilia-store-cell-name=""
          className="truncate text-sm text-text"
        >
          {item.name}
        </span>
        <span
          data-vigilia-store-cell-byline=""
          className="truncate font-mono text-xs text-muted"
        >
          {byline(item)}
        </span>
        <span className="flex h-[26px] items-center gap-[var(--space-6)]">
          <span className="flex-1" />
          {CELL_ACTIONS.map((action) => (
            <ControlIconButton
              key={action}
              id={`vigilia-store-cell-${item.id}-${action}`}
              label={uiCopy.store.cell.actions[action]}
              destructive={action === "delete"}
              data={{ "data-vigilia-store-cell-action": action }}
              onClick={() => onAction(action, item.id)}
            >
              <Glyph icon={CELL_ACTION_GLYPHS[action]} size={14} />
            </ControlIconButton>
          ))}
        </span>
      </div>
    </li>
  );
}

/**
 * The picture box, and the theme's own ground behind it.
 *
 * **A theme with no picture draws its ground, not a broken image.** The host
 * answers `404` at a theme's thumbnail address when it has stored none
 * (`server.ts`), so the address being present says nothing about the picture
 * being there: the box carries the ground from the first paint, and the `<img>`
 * that fails is dropped rather than left showing a browser's broken mark. With
 * no address at all the box is the ground alone.
 *
 * **What failed is the address and the theme's own time, not the box.** The host
 * builds the address from the theme's id (`theme-library-client.ts`), so it is
 * the same one across a re-listing and the address alone cannot say a picture
 * arrived; `updatedAt` is what a save changes. Keying on both means a cell whose
 * picture is replaced — a save that stores a thumbnail, a listing refreshed —
 * draws the new picture instead of the neutral box the old one left behind,
 * while a re-listing that changed nothing does not ask for a picture it already
 * knows is missing. A latched flag would be a cell that never shows a picture
 * again for as long as it is mounted.
 *
 * The image is `alt=""` because the cell names the theme beside it: a picture
 * repeating the name is read twice.
 */
function Picture(props: { readonly item: StoreItem }): React.JSX.Element {
  const { item } = props;
  const picture =
    item.thumbnailUrl === undefined
      ? undefined
      : {
          url: item.thumbnailUrl,
          key: `${item.thumbnailUrl} ${item.updatedAt ?? ""}`,
        };
  const [broken, setBroken] = useState<string | undefined>(undefined);
  const showPicture = picture !== undefined && picture.key !== broken;

  return (
    <span
      data-vigilia-store-picture=""
      aria-hidden
      className="aspect-[2/1] w-full"
      style={
        item.ground === undefined ? undefined : { background: item.ground }
      }
    >
      {picture !== undefined && showPicture ? (
        <img
          src={picture.url}
          alt=""
          className="size-full object-cover"
          onError={() => setBroken(picture.key)}
        />
      ) : null}
    </span>
  );
}

/**
 * The mono line under the name: `@mira-k · 2026-10-15`, or the drawing's own
 * *No author* in the same slot — a fact about the theme rather than a missing
 * reading.
 *
 * The date is `updatedAt`'s day. The host sends an ISO-8601 instant and the
 * drawing prints a day, and the first ten characters of ISO-8601 *are* that day
 * in UTC — so no reader sees a different one, which a locale-formatted date
 * would give them. An entry with no time at all (a template) prints the author
 * alone rather than a separator with nothing after it.
 */
function byline(item: StoreItem): string {
  const author =
    item.author === undefined ? uiCopy.store.cell.noAuthor : `@${item.author}`;
  const date = item.updatedAt?.slice(0, 10);
  return date === undefined || date === ""
    ? author
    : `${author}${uiCopy.store.cell.authorSeparator}${date}`;
}
