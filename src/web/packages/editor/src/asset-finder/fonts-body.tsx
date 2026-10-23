import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import type { FavoritesClient } from "../favorites-client.js";
import {
  type CuratedFontFace,
  catalogFaces,
  type FontTrio,
  fontTrios,
} from "../font-catalog.js";
import { FontPicker } from "../font-picker/font-picker.js";
import {
  createSpecimenCache,
  type SpecimenCache,
} from "../font-specimen-cache.js";

/** The finder's Fonts body: the catalogue browser, unchanged.
 *
 * The picker is the font catalogue plan's own control (`vg-268`); this only
 * hands it the data and the three writes, so nothing about the catalogue is
 * re-derived here.
 */
export function FontsBody(props: {
  readonly trios: readonly FontTrio[];
  readonly faces: readonly CuratedFontFace[];
  readonly favorites: readonly string[];
  readonly cache: SpecimenCache;
  readonly onApplyFace: (face: CuratedFontFace) => void;
  readonly onApplyTrio: (trioId: string) => void;
  readonly onToggleFavorite: (trioId: string) => void;
}): React.JSX.Element {
  return (
    <FontPicker
      trios={props.trios}
      faces={props.faces}
      favorites={props.favorites}
      cache={props.cache}
      onApplyFace={props.onApplyFace}
      onApplyTrio={props.onApplyTrio}
      onToggleFavorite={props.onToggleFavorite}
    />
  );
}

/**
 * `FontsBody` with the things a value cannot carry: the specimen cache, which
 * holds live `FontFace` objects for as long as the body is mounted, and the
 * author's favourites, which live on the host and are read rather than
 * projected.
 *
 * The body owns both because it is the only thing that renders the picker now.
 */
export function FontsBodyHost(props: {
  readonly favoritesClient?: FavoritesClient;
  readonly onApplyFace: (face: CuratedFontFace) => void;
  readonly onApplyTrio: (trioId: string) => void;
}): React.JSX.Element {
  const cache = useMemo(() => createSpecimenCache(), []);
  const [favorites, setFavorites] = useState<readonly string[]>([]);

  // Released with the body: a cache left behind keeps every face it fetched
  // for the page's lifetime.
  useEffect(() => () => cache.release(), [cache]);

  useEffect(() => {
    let live = true;
    void (
      props.favoritesClient?.list() ?? Promise.resolve<readonly string[]>([])
    ).then((stored) => {
      if (live) setFavorites(stored);
    });
    return () => {
      live = false;
    };
  }, [props.favoritesClient]);

  const toggleFavorite = (trioId: string): void => {
    const next = favorites.includes(trioId)
      ? favorites.filter((id) => id !== trioId)
      : [...favorites, trioId];
    setFavorites(next);
    const client = props.favoritesClient;
    if (client !== undefined) {
      void client.save(next).then(setFavorites);
    }
  };

  return (
    <FontsBody
      trios={fontTrios()}
      faces={catalogFaces()}
      favorites={favorites}
      cache={cache}
      onApplyFace={props.onApplyFace}
      onApplyTrio={props.onApplyTrio}
      onToggleFavorite={toggleFavorite}
    />
  );
}
