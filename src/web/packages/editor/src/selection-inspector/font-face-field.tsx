import type * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { catalogFaces, fontTrios } from "../font-catalog.js";
import { FontPicker } from "../font-picker/font-picker.js";
import { createSpecimenCache } from "../font-specimen-cache.js";
import { uiCopy } from "../ui-copy.js";
import type { FontFaceEdits, FontFaceView } from "./view.js";

/**
 * The text object's face field: the catalogue browser, mounted where an author
 * chooses what their selection is set in.
 *
 * **`FontPicker` is the control, not a copy of it** (`vg-268`): it is the font
 * catalogue plan's own output, it is tested, and this is the surface the ruling
 * named as its owner. Nothing about the catalogue — the trios, the faces, the
 * query — is re-derived here.
 *
 * The two things the field owns are the ones a projected value cannot carry: a
 * specimen cache, which holds live `FontFace` objects and must be released when
 * the field goes, and the author's favourites, which live on the host and are
 * therefore read rather than projected. Everything else crosses as a value.
 */
export function FontFaceField(props: {
  readonly view: FontFaceView;
  readonly edits: FontFaceEdits;
}): React.JSX.Element {
  const { view, edits } = props;
  const cache = useMemo(() => createSpecimenCache(), []);
  const [favorites, setFavorites] = useState<readonly string[]>([]);

  // Released on the way out, because the cache holds every face it fetched for
  // the page's lifetime otherwise — 15 rows of a 261-face catalogue is 15
  // `FontFace` objects the document keeps for a field that is no longer there.
  useEffect(() => () => cache.release(), [cache]);

  useEffect(() => {
    let live = true;
    void edits.listFavorites().then((stored) => {
      if (live) setFavorites(stored);
    });
    return () => {
      live = false;
    };
  }, [edits]);

  const toggleFavorite = useCallback(
    (trioId: string) => {
      // Optimistic, then the host's answer: a star that waited on a round trip
      // would read as a press that did nothing, and the store drops an id it
      // cannot keep, so what comes back is what is stored rather than what was
      // sent.
      const next = favorites.includes(trioId)
        ? favorites.filter((id) => id !== trioId)
        : [...favorites, trioId];
      setFavorites(next);
      void edits.saveFavorites(next).then(setFavorites);
    },
    [edits, favorites],
  );

  return (
    <div
      data-vigilia-font-face-field=""
      className="flex flex-col gap-[var(--space-6)]"
    >
      <h3 className="m-0 text-xs font-semibold text-muted">
        {uiCopy.panels.fontFace}
      </h3>
      <FontPicker
        trios={fontTrios()}
        faces={catalogFaces()}
        favorites={favorites}
        cache={cache}
        // A face is bound to the preset the object is set in, so the write goes
        // to that preset rather than to the object — the same action the Tokens
        // pane performs, asked for through the same owner.
        onApplyFace={(face) => void edits.applyFace(view.presetId, face)}
        onApplyTrio={(trioId) => void edits.applyTrio(trioId)}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
