import {
  type CatalogueEntry,
  type CatalogueRefusal,
  type CatalogueStatus,
  DASHBOARD_THEME_KIND,
  parseCatalogueIndex,
} from "@yunari/renderer-core";
import type { ItemSource, StoreItem } from "./local-source.js";
import { catalogueItemOf } from "./online-source.js";

/** The route the host proxies the author's own rows through. */
const MINE_PATH = "/api/store/mine";

/** The six states the wire declares. A row naming anything else is not one this
 *  build can read, so it is dropped rather than coerced into a state it never
 *  claimed. */
const STATUSES: readonly CatalogueStatus[] = [
  "draft",
  "pending",
  "published",
  "unpublished",
  "rejected",
  "removed",
];

const isStatus = (value: unknown): value is CatalogueStatus =>
  typeof value === "string" && (STATUSES as readonly string[]).includes(value);

/** One row's state, as the item carries it. */
interface ItemState {
  readonly status: CatalogueStatus;
  readonly statusReason?: string;
}

/**
 * The author's own listing as an `ItemSource`.
 *
 * The answer is `{ entries }` without the index's own `generatedAt`, and each
 * entry is a catalogue entry **plus the state the public wire shape has no room
 * for**. The entry rules are the public parser's, so the answer is wrapped in
 * the shape it reads rather than parsed a second time here; only the state is
 * this source's own, and a state it cannot name refuses the row.
 *
 * A failed read throws rather than answering an empty listing, as the catalogue
 * source does: `undefined` is what the region draws as "nothing to say", where
 * `[]` would claim the author has submitted nothing.
 */
export function mineThemeSource(
  options: { readonly url?: string; readonly fetch?: typeof fetch } = {},
): ItemSource {
  const url = options.url ?? MINE_PATH;
  let refused: readonly CatalogueRefusal[] = [];

  return {
    kind: DASHBOARD_THEME_KIND,
    async list(): Promise<readonly StoreItem[]> {
      // Cleared before the read, so `refused()` always describes the most recent
      // attempt: a failed read answers none, never the previous read's rows.
      refused = [];
      const response = await (options.fetch ?? fetch)(url);
      if (!response.ok) {
        throw new Error(`The store answered ${response.status}.`);
      }

      const rows = entriesOf(await response.json());
      const parsed = parseCatalogueIndex(
        { generatedAt: new Date().toISOString(), entries: rows },
        [DASHBOARD_THEME_KIND],
      );
      refused = parsed.refused;

      const states = statesOf(rows);
      return parsed.entries.flatMap((entry) => {
        const state = states.get(entry.id);
        return state === undefined ? [] : [itemOf(entry, state)];
      });
    },
    refused(): readonly CatalogueRefusal[] {
      return refused;
    },
  };
}

/** The answer's `entries`, or nothing when the document is not the shape. The
 *  parser reads a missing list as one unreadable document, which is the fact a
 *  body of some other shape is. */
function entriesOf(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }
  return Object.hasOwn(body, "entries")
    ? (body as Record<string, unknown>).entries
    : undefined;
}

/** Every row's state, by the id the entry declares. A row with no readable id
 *  or state contributes none, and the parsed entry it would have described is
 *  dropped: a state this build cannot name is not one it may show. */
function statesOf(rows: unknown): ReadonlyMap<string, ItemState> {
  const states = new Map<string, ItemState>();
  if (!Array.isArray(rows)) return states;

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as Record<string, unknown>;
    const id = record.id;
    const status = record.status;
    if (typeof id !== "string" || !isStatus(status)) continue;

    const reason = record.statusReason;
    states.set(
      id,
      typeof reason === "string" && reason.length > 0
        ? { status, statusReason: reason }
        : { status },
    );
  }
  return states;
}

function itemOf(entry: CatalogueEntry, state: ItemState): StoreItem {
  return {
    ...catalogueItemOf(entry),
    status: state.status,
    ...(state.statusReason === undefined
      ? {}
      : { statusReason: state.statusReason }),
  };
}
