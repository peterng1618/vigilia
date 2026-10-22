import type { CatalogueRefusal } from "@yunari/renderer-core";
import { useEffect, useRef, useState } from "react";
import { uiCopy } from "../ui-copy.js";
import { withInstalledVersions } from "./install-state.js";
import type { StoreItem } from "./local-source.js";
import { mineThemeSource } from "./mine-source.js";
import { useOnlineListing } from "./online-listing.js";

/** Where the host says whether it holds a store session. Read once, never
 *  polled: a sign-in happens in the settings surface, not this one. */
const SESSION_PATH = "/api/store/session";

/** The online half's empty words, chosen with its source: the catalogue's own
 *  against the author's own, because the two are different facts. */
const EMPTY_CATALOGUE = {
  lead: uiCopy.store.empty.catalogue,
  hint: uiCopy.store.empty.catalogueHint,
} as const satisfies {
  readonly lead: string;
  readonly hint: string | undefined;
};

const EMPTY_MINE = {
  lead: uiCopy.store.mine.empty,
  hint: undefined,
} as const satisfies {
  readonly lead: string;
  readonly hint: string | undefined;
};

/** What the online half lists, whichever source it chose. */
export interface OnlineListingShape {
  readonly items: readonly StoreItem[] | undefined;
  readonly refused: readonly CatalogueRefusal[];
}

export interface MineListing extends OnlineListingShape {
  /** Whether the host answered that a session is held. The toggle is drawn only
   *  then; a failed probe answers the same as no session and throws nothing. */
  readonly offered: boolean;
  readonly on: boolean;
  readonly setOn: (next: boolean) => void;
  /** The half's empty sentence, which belongs to the source that answered. */
  readonly empty: { readonly lead: string; readonly hint: string | undefined };
  /** The last author command the store refused, in its own words; empty when
   *  nothing was refused. The region's one live region speaks it. */
  readonly announcement: string;
  /** The author's own commands, drawn by the item's modal for the state that
   *  allows each. They post the command and re-read the listing rather than
   *  writing a state here. */
  readonly onUnpublish: (id: string) => void;
  readonly onRepublish: (id: string) => void;
}

/**
 * The online half's source choice, its Mine toggle and the session probe.
 *
 * It lives here rather than in the region because the region is at its line
 * stop: the probe, the toggle's state and which source answers are one fact
 * about the listing, so the region gains a call rather than forty lines.
 *
 * **Mine off is the public catalogue**, read through `useOnlineListing` and
 * joined against the library exactly as before. **Mine on is the author's own
 * rows**: read once each time it is turned on, and never merged with the
 * catalogue's, because the two are different answers to "what themes are there".
 *
 * A failed Mine read leaves the listing unset, never `[]`, for the region's own
 * reason: an empty array would claim the author has submitted nothing.
 */
export function useMineListing(
  local: readonly StoreItem[] | undefined,
  onEnabled?: () => void,
): MineListing {
  const catalogue = useOnlineListing(local);
  const [offered, setOffered] = useState(false);
  const [on, setOn] = useState(false);
  const [listing, setListing] = useState<
    | {
        readonly items: readonly StoreItem[];
        readonly refused: readonly CatalogueRefusal[];
      }
    | undefined
  >(undefined);
  // One source for the life of the region, as the catalogue half's is.
  const [source] = useState(() => mineThemeSource());

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await fetch(SESSION_PATH);
        if (!live || !response.ok) return;
        const body = (await response.json()) as { readonly signedIn?: unknown };
        if (live && body.signedIn === true) setOffered(true);
      } catch {
        // A failed probe leaves the toggle absent: no session is a fact this
        // surface can state, and guessing one would draw a control the host
        // would refuse.
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    let live = true;
    setListing(undefined);
    source.list().then(
      (items) => {
        if (live) setListing({ items, refused: source.refused() });
      },
      () => {
        // A failed read is not a fact about the author's rows, so nothing is
        // drawn for it and the listing stays unset.
      },
    );
    return () => {
      live = false;
    };
  }, [on, source]);

  /** Turning Mine on moves the region to the half it lists through; turning it
   *  off leaves the half where the person put it. The previous listing is
   *  cleared here rather than in the effect, so no frame paints Mine over the
   *  catalogue's rows the moment it is switched on. */
  const setOnAndReveal = (next: boolean): void => {
    if (next) setListing(undefined);
    setOn(next);
    if (next) onEnabled?.();
  };

  /** One command in flight per id. The state alone cannot refuse a second press
   *  in the same tick, because it reads the render before the first committed. */
  const inFlight = useRef<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  /**
   * **Posts one author command, and lets the listing answer it.** The Worker's
   * answer names the new state, but this surface keeps no copy of it: the
   * author's own rows are the source, so a successful change re-reads them and
   * a re-listing that disagrees wins. A non-2xx is the store's own sentence,
   * spoken in the region's one live region, and the row is left untouched.
   */
  const statusChange = (id: string, action: "unpublish" | "publish"): void => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setAnnouncement("");
    void (async () => {
      try {
        const response = await fetch(
          `/api/store/items/${encodeURIComponent(id)}/${action}`,
          { method: "POST" },
        );
        if (!response.ok) {
          setAnnouncement(await refusalOf(response));
          return;
        }
        const items = await source.list().catch(() => undefined);
        if (items === undefined) {
          setAnnouncement(uiCopy.store.status.unrefreshed);
          return;
        }
        setListing({ items, refused: source.refused() });
      } catch (error) {
        setAnnouncement(error instanceof Error ? error.message : String(error));
      } finally {
        inFlight.current.delete(id);
      }
    })();
  };

  return {
    offered,
    on,
    setOn: setOnAndReveal,
    announcement,
    onUnpublish: (id: string) => statusChange(id, "unpublish"),
    onRepublish: (id: string) => statusChange(id, "publish"),
    // Mine rows are joined against the library exactly as the catalogue's are:
    // what this PC installed is the library's fact, and without the join every
    // own row offers Install over the author's local copy.
    items: on
      ? listing === undefined
        ? undefined
        : withInstalledVersions(listing.items, local)
      : catalogue.items,
    refused: on ? (listing?.refused ?? []) : catalogue.refused,
    empty: on ? EMPTY_MINE : EMPTY_CATALOGUE,
  };
}

/** The host's own sentence for a refused command, or the composed fallback when
 *  the answer carries none: the store knows why it said no. */
async function refusalOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => undefined);
  const message =
    typeof body === "object" && body !== null
      ? (body as { readonly message?: unknown }).message
      : undefined;
  return typeof message === "string" && message.trim() !== ""
    ? message
    : uiCopy.store.status.changeRefused(response.status);
}
