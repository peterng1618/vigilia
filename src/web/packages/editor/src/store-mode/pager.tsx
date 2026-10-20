import type * as React from "react";
import { ControlIconButton } from "../components/ui/control-icon-button.js";
import {
  type ControlOption,
  ControlSelect,
} from "../components/ui/control-select.js";
import {
  Glyph,
  NEXT_PAGE_GLYPH,
  PREVIOUS_PAGE_GLYPH,
} from "../editor-shell/icons.js";
import { type PageSize, pageSizes } from "../editor-shell/page-size.js";
import { uiCopy } from "../ui-copy.js";

/**
 * The pager: the per-page well at the left, the numbered pages at the right.
 *
 * **It is handed its numbers and moves nothing.** `current`, `total` and `size`
 * are the region's, and the two callbacks report a press — what a page number
 * *means*, which items are on it, and what a changed filter does to it, belongs
 * to whoever holds the items (Task A.6). **A changed filter returns to page
 * one** for the same reason: it lives where the filter is applied rather than
 * here, so the pager cannot hold a page number a filter has invalidated.
 *
 * The bar is the drawing's own: a 12px gap, 8px over 16px of padding, and a 1px
 * `--edge` above it.
 */

/** The well's id, named rather than minted: the region has one pager and a
 *  driver reaches the size well by name. */
const PAGE_SIZE_ID = "vigilia-store-page-size";

/** The well's list, in `pageSizes`' own order. Each entry is labelled with its
 *  own number — the sizes are data — and `all` with the table's word for it,
 *  which is the one entry that is not a number. */
const PAGE_SIZE_OPTIONS: readonly ControlOption[] = pageSizes.map((size) => ({
  id: String(size),
  name: size === "all" ? uiCopy.store.pager.all : String(size),
}));

/** The pages a numbered pager shows at once: the current one and two either
 *  side. Five rather than every page because a catalogue of four hundred items
 *  is thirty-four pages, and a row of thirty-four numerals is not navigation. */
const PAGE_WINDOW = 5;

/** Seven or fewer pages is where the numbers *are* the list, so the window is
 *  not used at all — five plus the page on either side of it. */
const NO_GAP_TOTAL = PAGE_WINDOW + 2;

/** Every page from `from` to `to`, both included. */
function pagesIn(from: number, to: number): number[] {
  const pages: number[] = [];
  for (let page = from; page <= to; page += 1) pages.push(page);
  return pages;
}

/**
 * The numerals a numbered pager draws, in order, with `"gap"` where pages are
 * skipped.
 *
 * **The five pages nearest the current one, and the first and the last.** Both
 * ends are always reachable, the window slides rather than shrinks so the
 * current page is always one of the five, and a total of seven or fewer shows
 * every page.
 *
 * **A gap is drawn only where it stands for pages.** A skipped run of one page
 * is drawn as that page: a gap beside the number it stands for, or one standing
 * for nothing between two adjacent numbers, is a mark an author reads as "there
 * is something here" when there is not. That is why `pageNumbers(5, 8)` ends
 * `…, 7, 8` rather than `…, 7, "gap", 8`, and why the near end of
 * `pageNumbers(11, 12)` begins `1, "gap", 8, …`.
 *
 * It is pure and total: a page outside the listing is clamped into it, so a
 * number a filter left behind still numbers something, and a listing with no
 * pages numbers nothing rather than inventing page one.
 */
export function pageNumbers(
  current: number,
  total: number,
): readonly (number | "gap")[] {
  if (!Number.isFinite(total) || total < 1) return [];
  if (total <= NO_GAP_TOTAL) return pagesIn(1, total);

  const page = Math.min(Math.max(Math.trunc(current) || 1, 1), total);
  const start = Math.min(Math.max(page - 2, 1), total - PAGE_WINDOW + 1);
  const end = start + PAGE_WINDOW - 1;

  const shown: (number | "gap")[] = [];
  // The window's own first page is drawn below, so the page before it is the
  // only one that can be missing here — and it is drawn rather than gapped.
  if (start === 2) shown.push(1);
  else if (start > 2) shown.push(1, "gap");
  shown.push(...pagesIn(start, end));
  if (end < total - 1) shown.push("gap");
  if (end < total) shown.push(total);
  return shown;
}

/** One numeral: §5's icon button carrying the page's own number.
 *
 *  The page in force takes the chosen treatment every other chosen thing in this
 *  store takes — the raised `--stage` behind a `--text` numeral, never an accent
 *  fill (§4). Its name is the table's, because a bare `6` is announced as a
 *  number and says nothing about what pressing it does. */
function PageNumber(props: {
  readonly page: number;
  readonly current: boolean;
  readonly onPage: (page: number) => void;
}): React.JSX.Element {
  const { page, current, onPage } = props;
  return (
    <button
      type="button"
      id={`vigilia-store-page-${page}`}
      data-vigilia-store-page={page}
      aria-label={uiCopy.store.pager.page(page)}
      aria-current={current ? "page" : undefined}
      onClick={() => onPage(page)}
      className={`inline-flex size-[26px] flex-none items-center justify-center rounded-md border border-transparent font-mono text-sm hover:border-edge hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
        current
          ? "[background:var(--stage)] text-text font-medium"
          : "text-muted"
      }`}
    >
      {page}
    </button>
  );
}

/** The mark a skipped run leaves: the drawing's ellipsis, in a numeral's own box
 *  so the row's rhythm does not shift where pages are missing. It is decoration
 *  — the numbers either side say which run is skipped — so it is not read. */
function PageGap(): React.JSX.Element {
  return (
    <span
      data-vigilia-store-page-gap=""
      aria-hidden
      className="inline-flex size-[26px] flex-none items-center justify-center text-sm text-muted"
    >
      …
    </span>
  );
}

export function Pager(props: {
  readonly current: number;
  readonly total: number;
  readonly size: PageSize;
  readonly onPage: (page: number) => void;
  readonly onSize: (size: PageSize) => void;
}): React.JSX.Element {
  const { current, total, size, onPage, onSize } = props;

  return (
    <div
      data-vigilia-store-pager=""
      className="flex flex-none items-center gap-[var(--space-12)] border-t border-edge px-[var(--space-16)] py-[var(--space-8)]"
    >
      {/* §5's select, and the drawing's 76px well (`DESIGN.md` §5). The row is
          that well's own 76px column, so the `Per page` label takes the line
          above it rather than a 74px label column beside it — the well is what
          the drawing fixes, and a field row's column would leave it the rest of
          a bar instead. */}
      <span className="w-[76px] flex-none">
        <ControlSelect
          id={PAGE_SIZE_ID}
          label={uiCopy.store.pager.perPage}
          data={{ "data-vigilia-store-page-size": "" }}
          value={String(size)}
          options={PAGE_SIZE_OPTIONS}
          onChange={(id) => {
            // A value the list does not name is refused rather than written: a
            // widened option list must not be able to set a size nothing reads.
            const chosen = pageSizes.find((option) => String(option) === id);
            if (chosen === undefined) return;
            onSize(chosen);
          }}
        />
      </span>
      <span className="flex-1" />
      <span className="flex items-center gap-[var(--space-4)]">
        <ControlIconButton
          id="vigilia-store-page-previous"
          label={uiCopy.store.pager.previous}
          data={{ "data-vigilia-store-page-previous": "" }}
          disabled={current <= 1}
          onClick={() => onPage(current - 1)}
        >
          <Glyph icon={PREVIOUS_PAGE_GLYPH} size={14} />
        </ControlIconButton>
        {pageNumbers(current, total).map((entry, at) =>
          entry === "gap" ? (
            // The index is the key because two gaps can be on screen at once
            // and neither is a page the pager could name.
            <PageGap key={`gap-${at}`} />
          ) : (
            <PageNumber
              key={entry}
              page={entry}
              current={entry === current}
              onPage={onPage}
            />
          ),
        )}
        <ControlIconButton
          id="vigilia-store-page-next"
          label={uiCopy.store.pager.next}
          data={{ "data-vigilia-store-page-next": "" }}
          disabled={current >= total}
          onClick={() => onPage(current + 1)}
        >
          <Glyph icon={NEXT_PAGE_GLYPH} size={14} />
        </ControlIconButton>
      </span>
    </div>
  );
}
