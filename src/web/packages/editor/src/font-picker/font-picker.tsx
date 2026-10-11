import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useControlTooltip } from "../components/ui/control-icon-button.js";
import {
  type ControlOption,
  ControlSelect,
} from "../components/ui/control-select.js";
import { Glyph, STAR_GLYPH } from "../editor-shell/icons.js";
import type { CuratedFontFace, FontTrio } from "../font-catalog.js";
import {
  type CatalogQuery,
  catalogFacets,
  type FacetField,
  type FontSort,
  queryFaces,
  queryTrios,
} from "../font-catalog-query.js";
import type { SpecimenCache } from "../font-specimen-cache.js";
import { uiCopy } from "../ui-copy.js";

/** The row pitch, in one place because the scroll maths and the rendered
 *  height must agree: the list is `length * ROW_HEIGHT` tall and a row is
 *  placed at `index * ROW_HEIGHT`. Both are inline styles rather than a
 *  utility class, because a rem-based class would drift the moment the shell's
 *  root font-size is not 16px, and the window would land between two rows. */
const ROW_HEIGHT = 32;
/** Rows mounted at once. 261 faces at 32px is a scroll of 8352px; mounting
 *  all of them is 261 DOM subtrees and 261 `FontFace` objects to keep, and the
 *  cache exists to hold "many", not "all". */
const WINDOW = 15;
/** Rows fetched past the window, so scrolling does not outrun the network. */
const LOAD_AHEAD = WINDOW;

/** The facet kinds by what an author chooses between, read from the copy
 *  table's own record rather than mapped here. A local map would be a second
 *  place the three words live, and a literal in it spelling the same text the
 *  table holds passes every rendered-string check — the table would no longer
 *  own the word, and a rename would leave the control behind. */
const FACET_COPY: Readonly<Record<FacetField["field"], string>> =
  uiCopy.panels.fontFacetKinds;

/** One facet's choices. The empty id is **"any" as a real option** rather than
 *  a missing value: it is the first entry an author reads and the one the
 *  control returns to when a second kind is chosen, which clears this one. The
 *  count rides on the label the way the upstream tag does, so the author sees
 *  how many trios a chip reaches before choosing it. */
function facetOptions(field: FacetField): readonly ControlOption[] {
  return [
    { id: "", name: FACET_COPY[field.field] },
    ...field.options.map((option) => ({
      id: option.value,
      name: `${option.value} (${option.count})`,
    })),
  ];
}

/** Favourited is a filled star and unfavourited an outline one, as the layer
 *  row's lock is: §6's `filled` escape changes the fill without a second glyph
 *  and the icon keeps the shell's colour either way. */
function FavoriteStateIcon({ favorite }: { readonly favorite: boolean }) {
  return <Glyph icon={STAR_GLYPH} size={13} filled={favorite} />;
}

/**
 * A trio's favourite toggle. It declares one word per state, and that word is
 * both the accessible name and the tooltip — mounted from the control set's one
 * owner of the pairing (`useControlTooltip`, §6) so a reader hovering it and a
 * reader listening to it are told the same thing.
 */
function TrioFavoriteButton({
  favorite,
  onToggle,
}: {
  readonly favorite: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const label = favorite
    ? uiCopy.panels.fontUnfavorite
    : uiCopy.panels.fontFavorite;
  useControlTooltip(ref, label);
  return (
    <button
      ref={ref}
      type="button"
      data-vigilia-font-favorite=""
      aria-pressed={favorite}
      aria-label={label}
      onClick={onToggle}
    >
      <FavoriteStateIcon favorite={favorite} />
    </button>
  );
}

export interface FontPickerProps {
  /** The trios and faces this picker browses. The query filters within them
   *  rather than over the whole catalogue, so a host that hands over a subset
   *  gets that subset. */
  readonly trios: readonly FontTrio[];
  readonly faces: readonly CuratedFontFace[];
  readonly favorites: readonly string[];
  readonly cache: SpecimenCache;
  readonly onApplyTrio: (trioId: string) => void;
  readonly onApplyFace: (face: CuratedFontFace) => void;
  readonly onToggleFavorite: (trioId: string) => void;
}

/**
 * Browses the curated catalogue. Controlled: the host owns the query and the
 * favourites, and this reports intent through three callbacks and holds no
 * state the host would have to reconcile.
 *
 * A face is applied by clicking its row, so the row is the control that
 * carries `data-vigilia-font-face`; the trio chooser and its apply button keep
 * the two selectors the panel's browser tests read. Every chooser is
 * `ControlSelect`, so each is a keyboard-operable combobox in a well rather
 * than a hand-authored native control (§2.2).
 */
export function FontPicker({
  trios,
  faces,
  favorites,
  cache,
  onApplyTrio,
  onApplyFace,
  onToggleFavorite,
}: FontPickerProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [facet, setFacet] = useState<CatalogQuery["facet"]>(undefined);
  const [sort, setSort] = useState<FontSort>("name");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [trioId, setTrioId] = useState(trios[0]?.id ?? "");
  const [start, setStart] = useState(0);
  /** Faces whose `ensure` has settled, resident or not. A row reads this to
   *  decide between "still coming" and "will never arrive" — which is the
   *  difference between a specimen that is slow and a CDN 404. */
  const [settled, setSettled] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const asked = useRef<ReadonlySet<string>>(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Memoised because it is the dependency of every query below, and a fresh
   *  object literal each render would invalidate all of them — the face list
   *  would re-filter 261 entries per render, and the loading effect would
   *  re-run every render too. */
  const query: CatalogQuery = useMemo(
    () => ({
      search,
      facet,
      favoritesFirst: favorites.length > 0,
      sort,
    }),
    [search, facet, favorites.length, sort],
  );
  const browsedFaces = useMemo(
    () => new Set(faces.map((face) => face.id)),
    [faces],
  );
  const browsedTrios = useMemo(
    () => new Set(trios.map((trio) => trio.id)),
    [trios],
  );
  const visibleTrios = useMemo(() => {
    const matched = queryTrios(query, favorites).filter((trio) =>
      browsedTrios.has(trio.id),
    );
    // Filtering the query's own output, never the stored list: a favourite
    // naming a trio the catalogue dropped matches nothing here, so no dead
    // chip can be rendered from it.
    return favoritesOnly
      ? matched.filter((trio) => favorites.includes(trio.id))
      : matched;
  }, [query, favorites, favoritesOnly, browsedTrios]);

  const visibleFaces = useMemo(
    () =>
      favoritesOnly
        ? []
        : queryFaces(query, favorites).filter((face) =>
            browsedFaces.has(face.id),
          ),
    [query, favorites, favoritesOnly, browsedFaces],
  );

  /** Clamped so a search that shortens the list cannot leave the window past
   *  its end — the container resets `scrollTop` on its own, but `start` is
   *  state and would not. */
  const first = Math.min(start, Math.max(0, visibleFaces.length - WINDOW));
  const rows = visibleFaces.slice(first, first + WINDOW);

  // One effect over the window plus the rows ahead of it. The rows in the
  // window are already the viewport's neighbourhood, so an observer would only
  // re-derive what `first` knows — and `ensure` already deduplicates, so a row
  // that scrolls back into view costs nothing. `ensure` resolves for a fetch
  // that throws, a body that will not read and a payload `FontFace` rejects
  // alike, so the settle below always runs and never needs a catch.
  useEffect(() => {
    const ahead = visibleFaces.slice(first, first + WINDOW + LOAD_AHEAD);
    const fresh = ahead.filter((face) => !asked.current.has(face.id));
    if (fresh.length === 0) return;
    asked.current = new Set([
      ...asked.current,
      ...fresh.map((face) => face.id),
    ]);
    void Promise.all(fresh.map((face) => cache.ensure(face))).then(() => {
      setSettled(
        (current) => new Set([...current, ...fresh.map((face) => face.id)]),
      );
    });
  }, [visibleFaces, first, cache]);

  const onScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element === null) return;
    // Re-mounting the window on every pixel of scroll is the thing
    // virtualisation exists to avoid, so a row's worth of movement is the
    // threshold rather than one pixel.
    const next = Math.floor(element.scrollTop / ROW_HEIGHT);
    setStart((current) => (Math.abs(current - next) > 4 ? next : current));
  }, []);

  const faceRow = (face: CuratedFontFace, index: number): React.JSX.Element => {
    const resident = cache.resident(face.id);
    const loading = resident === undefined && !settled.has(face.id);
    return (
      <button
        type="button"
        key={face.id}
        // Two names for one element: `…-font-face-row` is this row's own
        // marker, and `…-font-face` is the selector the panel's browser tests
        // and the archived plan read for "the control that applies a face".
        data-vigilia-font-face-row=""
        data-vigilia-font-face=""
        data-vigilia-font-family={face.family}
        data-vigilia-font-clamped={face.clamped === true ? "true" : "false"}
        className="flex items-baseline gap-2 px-1 text-left"
        style={{
          position: "absolute",
          top: index * ROW_HEIGHT,
          left: 0,
          right: 0,
          height: ROW_HEIGHT,
          // The editor shell gives every button a 3px vertical margin, which
          // would push each row 6px past the pitch the scroll maths assumes.
          margin: 0,
          fontFamily: resident ?? "inherit",
        }}
        onClick={() => onApplyFace(face)}
      >
        <span className="truncate">{face.family}</span>
        <span className="ml-auto shrink-0">{face.weight}</span>
        {face.clamped === true && (
          <span data-vigilia-font-note="" className="shrink-0 text-[11px]">
            {uiCopy.panels.fontClamped}
          </span>
        )}
        {loading && (
          <span data-vigilia-font-note="" className="shrink-0 text-[11px]">
            {uiCopy.panels.loadingFont}
          </span>
        )}
      </button>
    );
  };

  return (
    <div data-vigilia-font-picker="" className="grid gap-1.5">
      <input
        type="search"
        aria-label={uiCopy.panels.fontSearch}
        className="w-full"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {catalogFacets().map((field) => (
        <ControlSelect
          key={field.field}
          id={`vigilia-font-facet-${field.field}`}
          label={FACET_COPY[field.field]}
          data={{ "data-vigilia-font-facet": field.field }}
          value={facet?.field === field.field ? facet.value : ""}
          options={facetOptions(field)}
          // A second kind replaces the first, because the query holds one facet;
          // the "any" entry is how the author clears the one that is holding.
          onChange={(id) =>
            setFacet(id === "" ? undefined : { field: field.field, value: id })
          }
        />
      ))}
      <p className="m-0 text-[11px] opacity-70">
        {uiCopy.panels.fontFacetRule}
      </p>
      <ControlSelect
        id="vigilia-font-sort"
        label={uiCopy.panels.fontSort}
        data={{ "data-vigilia-font-sort": "" }}
        value={sort}
        options={[
          { id: "name", name: uiCopy.panels.fontSortName },
          { id: "family", name: uiCopy.panels.fontSortFamily },
        ]}
        // Anything the control cannot commit as a sort is refused rather than
        // coerced, so a widened option list cannot write a sort nothing reads.
        onChange={(id) => setSort(id === "family" ? "family" : "name")}
      />
      <label className="flex items-center gap-1.5 text-[11px]">
        <input
          type="checkbox"
          checked={favoritesOnly}
          onChange={(event) => setFavoritesOnly(event.target.checked)}
        />
        {uiCopy.panels.fontFavoritesOnly}
      </label>
      <ControlSelect
        // `…-font-trio` is the archived plan's selector for the trio chooser,
        // and the browser tests read it to pick a trio.
        id="vigilia-font-trio"
        label={uiCopy.panels.trio}
        data={{ "data-vigilia-font-trio": "" }}
        value={trioId}
        options={trios.map((trio) => ({ id: trio.id, name: trio.name }))}
        onChange={setTrioId}
      />
      {/* Two names for one element: this is the trio apply button, and
        `…-font-apply` is what the archived plan's tests reach for. */}
      <button
        type="button"
        data-vigilia-font-trio-apply=""
        data-vigilia-font-apply=""
        className="self-start"
        onClick={() => onApplyTrio(trioId)}
      >
        {uiCopy.panels.applyTrio}
      </button>
      {favoritesOnly ? null : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="max-h-80 overflow-y-auto"
          >
            <div
              className="relative"
              style={{ height: visibleFaces.length * ROW_HEIGHT }}
            >
              {rows.map((face, index) => faceRow(face, first + index))}
            </div>
          </div>
          {visibleFaces.length === 0 && (
            <p className="m-0 text-[11px]">{uiCopy.panels.noFontMatches}</p>
          )}
        </>
      )}
      <ul
        data-vigilia-font-trio-list=""
        aria-label={uiCopy.panels.fontTrios}
        className="m-0 max-h-40 list-none overflow-y-auto p-0"
      >
        {visibleTrios.map((trio) => (
          <li key={trio.id} className="flex items-center gap-1.5">
            <TrioFavoriteButton
              favorite={favorites.includes(trio.id)}
              onToggle={() => onToggleFavorite(trio.id)}
            />
            <button
              type="button"
              data-vigilia-font-trio-row=""
              className="min-w-0 flex-1 truncate text-left"
              onClick={() => onApplyTrio(trio.id)}
            >
              {trio.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
