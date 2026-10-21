import type { CatalogueRefusal } from "@vigilia/renderer-core";
import { useEffect, useState } from "react";
import { withInstalledVersions } from "./install-state.js";
import type { StoreItem } from "./local-source.js";
import { onlineThemeSource } from "./online-source.js";

/**
 * The online half's own reading: one catalogue read, the join against the
 * library, and what that read skipped.
 *
 * It lives here rather than in the region because the region is a surface and
 * this is a fact: `region.tsx` is at its line stop, and the half's reading is
 * the piece that can move without touching what the surface draws.
 *
 * **A failed read leaves the listing unset, never `[]`.** The rejection arm is
 * deliberately empty — `undefined` is what the body reads as "nothing to say",
 * where an empty array would claim the store has nothing.
 */
export function useOnlineListing(local: readonly StoreItem[] | undefined): {
  readonly items: readonly StoreItem[] | undefined;
  readonly refused: readonly CatalogueRefusal[];
} {
  // One source for the life of the region, as the local half's is: a source
  // rebuilt per render would reach the origin again on every keystroke.
  const [source] = useState(() => onlineThemeSource());
  const [listing, setListing] = useState<
    | {
        readonly items: readonly StoreItem[];
        readonly refused: readonly CatalogueRefusal[];
      }
    | undefined
  >(undefined);

  useEffect(() => {
    let live = true;
    source.list().then(
      (items) => {
        if (live) setListing({ items, refused: source.refused() });
      },
      () => {
        // A failed read is not a fact about the catalogue, so nothing is drawn
        // for it and the listing stays unset.
      },
    );
    return () => {
      live = false;
    };
  }, [source]);

  // The join reads the library on every render rather than being baked into the
  // state: the two reads settle in either order, and a joined copy held in state
  // would keep the first answer after the library moved.
  return {
    items:
      listing === undefined
        ? undefined
        : withInstalledVersions(listing.items, local),
    refused: listing?.refused ?? [],
  };
}
