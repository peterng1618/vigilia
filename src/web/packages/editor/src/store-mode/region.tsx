import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type * as React from "react";
import { useState } from "react";
import {
  type ControlOption,
  ControlSelect,
} from "../components/ui/control-select.js";
import {
  ControlWell,
  hitTargetClasses,
} from "../components/ui/control-well.js";
import type { ShellMode } from "../editor-shell/shell-layout.js";
import { uiCopy } from "../ui-copy.js";
import { type Facet, FacetRow } from "./facet-row.js";

/**
 * The store's two halves. `local` is the host's own library — what the author
 * already has — and `online` is the catalogue; Local is first for that reason.
 *
 * A half is **not** a shell mode and not a second bar: it is the region's own
 * control over what the region lists, the way a pane's title bar sits inside its
 * pane. The shell's navigation is the header, and §7.2 forbids a horizontal bar
 * under it — which is why the halves sit in the region's *first row* beside the
 * filter and the sort rather than in a strip of their own.
 */
export type StoreTab = "local" | "online";

/** The order the row draws them in, which is a separate decision from what each
 *  is called — the same split `MODE_ORDER` and `MODE_NAMES` make. */
const TAB_ORDER = ["local", "online"] as const satisfies readonly StoreTab[];

/** Each half's name, as a **total** lookup: a `StoreTab` added to the union
 *  without a label fails to compile here rather than rendering a segment with no
 *  name. */
const TAB_NAMES: Record<StoreTab, string> = {
  local: uiCopy.store.halves.local,
  online: uiCopy.store.halves.online,
};

/** The halves' group id, and the stem of each segment's — §5 rule 5 wants every
 *  control to carry an id, derived from the half the way `useControlIds` derives
 *  one from the control it names. */
const HALVES_ID = "vigilia-store-halves";

const halvesSegmentId = (tab: StoreTab): string => `${HALVES_ID}-${tab}`;

/** The sort well's id, named rather than minted: the row has one sort and the
 *  browser case reaches for it by name. */
const SORT_ID = "vigilia-store-sort";

/**
 * The sort keys, per half, because the two share none: the catalogue knows when
 * an item was published and how often it was taken, and the host's library knows
 * only what the author wrote.
 *
 * The keys are the record's own field names — `updatedAt` is the theme's, the
 * catalogue's is `updated` — so a key here cannot drift from the thing it sorts
 * by without a rename in one place.
 */
const SORT_KEYS: Readonly<Record<StoreTab, readonly ControlOption[]>> = {
  local: [
    { id: "name", name: uiCopy.store.sort.local.name },
    { id: "updatedAt", name: uiCopy.store.sort.local.updatedAt },
  ],
  online: [
    { id: "created", name: uiCopy.store.sort.online.created },
    { id: "updated", name: uiCopy.store.sort.online.updated },
    { id: "downloads", name: uiCopy.store.sort.online.downloads },
    { id: "favorites", name: uiCopy.store.sort.online.favorites },
  ],
};

/** What each half opens on: the library by name, the catalogue by the item that
 *  changed most recently, which is the order each half is browsed in. */
const DEFAULT_SORT: Readonly<Record<StoreTab, string>> = {
  local: "name",
  online: "updated",
};

/**
 * The two halves, as §5's `Segmented` in its **bare** form — the well holding
 * the labels, the chosen one lifted to `--stage` with `--text`, and no row label
 * beside it (`docs/decisions/0074`). The header's mode switch is the same
 * control in the same kind of strip, composed the same way for the same reason:
 * the region's header row is a bar rather than a field row, so there is no label
 * column to fill, and the set's one `ControlSegmented` is a labelled row.
 *
 * The group is its own name (§5 rule 5): a screen reader reaching two segments
 * is told what is being chosen, and each segment carries an id.
 */
function Halves(props: {
  readonly tab: StoreTab;
  readonly onTab: (tab: StoreTab) => void;
}): React.JSX.Element {
  return (
    <ToggleGroup
      id={HALVES_ID}
      data-vigilia-store-halves=""
      aria-label={uiCopy.store.halves.label}
      value={[props.tab]}
      onValueChange={(next) => {
        const chosen = next[0];
        if (chosen !== undefined) props.onTab(chosen as StoreTab);
      }}
      className="flex flex-none gap-[var(--space-4)] rounded-md border border-edge bg-panel-2 p-[var(--space-4)]"
    >
      {TAB_ORDER.map((tab) => (
        <Toggle
          key={tab}
          id={halvesSegmentId(tab)}
          value={tab}
          className={`${hitTargetClasses} rounded-sm px-[var(--space-8)] py-[var(--space-4)] text-xs text-muted data-[pressed]:text-text data-[pressed]:[background:var(--stage)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
        >
          {TAB_NAMES[tab]}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

/**
 * The Themes mode's region — the surface the shell's `[data-vigilia-mode-region]`
 * seam was left for.
 *
 * **It renders its own header row and nothing above it.** The shell's header
 * carries the mode switch and the mode's own actions; this row is the region's
 * first row, so §7.2's forbidden second bar does not appear between them. What
 * the row holds is the region's controls over what the region lists: which half,
 * a search, the five facets and a sort.
 *
 * **The mode is a prop rather than state read here.** A.8 mounts the Host mode's
 * own region in the same section, and one component reading the answer from the
 * shell's one owner is what the A.1 seam establishes — so this region draws
 * itself in Themes and in no other mode, rather than the shell deciding which
 * region to render.
 *
 * **What is deliberately not here.** The gallery's cells (A.4), paging (A.5), an
 * item's own surface (A.6), import (A.7) and the Host region (A.8). The facet
 * values are A.3's record to derive, so the five facets are drawn by name with
 * no values behind them yet, and the search and the sort hold their own values
 * and move nothing: A.4 and A.5 own what a query filters and pages.
 */
export function StoreModeRegion(props: {
  readonly mode: ShellMode;
}): React.JSX.Element | null {
  return props.mode === "themes" ? <StoreRegion /> : null;
}

/** The region's own state, in its own component so a mode that is not Themes
 *  holds none of it: the half, the search and the sort are the surface's, and
 *  they are not persisted — leaving the mode and coming back opens on the same
 *  row a fresh mount does. Whether a filter outlives the mode is A.5's. */
function StoreRegion(): React.JSX.Element {
  const [tab, setTab] = useState<StoreTab>("local");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Record<StoreTab, string>>({
    ...DEFAULT_SORT,
  });

  return (
    <div data-vigilia-store-region="" className="flex min-h-0 flex-1 flex-col">
      <div
        data-vigilia-store-header=""
        className="flex flex-none flex-wrap items-center gap-[var(--space-16)] px-[var(--space-16)] pt-[var(--space-12)]"
      >
        <Halves tab={tab} onTab={setTab} />
        {/* §5's well with the query in it, and no magnifier glyph: the well is
            the control, the placeholder is the word, and a mark beside a word
            is read twice (§6). */}
        <ControlWell widthClassName="w-[180px] flex-none">
          <input
            type="search"
            data-vigilia-store-search=""
            aria-label={uiCopy.store.search}
            placeholder={uiCopy.store.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-full w-full bg-transparent text-sm text-text outline-none"
          />
        </ControlWell>
        <FacetRow facets={STORE_FACETS} />
        {/* §5's select, which is a **labelled row** and stays one here: the set
            has one select and this is it, and a bare well with a chevron would
            be a second copy of its popup, its keyboard model and its `readOnly`
            refusal to keep in step. §5 rule 5's label is the row's own rather
            than a name only a screen reader hears, which is what the drawing's
            unlabelled well would leave it with. */}
        <ControlSelect
          id={SORT_ID}
          label={uiCopy.store.sort.label}
          data={{ "data-vigilia-store-sort": "" }}
          value={sort[tab]}
          options={SORT_KEYS[tab]}
          onChange={(id) => {
            // A value the half's own keys do not name is refused rather than
            // written: a widened option list must not be able to set a sort
            // nothing reads.
            if (!SORT_KEYS[tab].some((key) => key.id === id)) return;
            setSort((current) => ({ ...current, [tab]: id }));
          }}
        />
      </div>
    </div>
  );
}

/**
 * The five facets, in the row's order, with **no values** — A.3 owns the record
 * that derives them, and a value invented here would be a facet that filters by
 * something no theme said.
 *
 * The names are the row's own copy; the values arrive as props, so filling them
 * is a change to this constant and to nothing in `facet-row.tsx`.
 */
const STORE_FACETS: readonly Facet[] = [
  { id: "author", name: uiCopy.store.facets.author, options: [] },
  { id: "colour-mode", name: uiCopy.store.facets.colourMode, options: [] },
  { id: "sensors", name: uiCopy.store.facets.sensors, options: [] },
  { id: "shape", name: uiCopy.store.facets.shape, options: [] },
  { id: "style", name: uiCopy.store.facets.style, options: [] },
];
