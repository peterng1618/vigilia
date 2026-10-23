import type { AssetResult } from "@yunari/renderer-core";
import type { AssetSource, SearchPage, SourceBytes } from "../source.js";

/** One icon in a generated manifest: a name and its own SVG markup. */
export interface LocalIcon {
  readonly name: string;
  readonly svg: string;
}

export type IconSearch = (
  query: string,
  cursor: string | undefined,
) => SearchPage;

const PAGE = 40;

/** Spaces and hyphens are one separator, so "arrow down" finds `arrow-down`. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "-");
}

/** A cursor is an offset; anything else is the first page rather than a fault. */
function offsetOf(cursor: string | undefined): number {
  return cursor !== undefined && /^\d+$/.test(cursor) ? Number(cursor) : 0;
}

function previewOf(icon: LocalIcon): string {
  // A data URL rather than a host round-trip: the icon is already here, and the
  // grid renders it offline. `<img>` does not execute a script in an SVG.
  return `data:image/svg+xml;base64,${Buffer.from(icon.svg).toString("base64")}`;
}

function resultOf(icon: LocalIcon, homeUrl: string): AssetResult {
  return {
    id: icon.name,
    name: icon.name,
    kind: "icon",
    preview: previewOf(icon),
    subtitle: undefined,
    licence: "unknown",
    sourceUrl: `${homeUrl}${icon.name}`,
  };
}

/**
 * A generated icon manifest as a source.
 *
 * Lucide and Lineicons differ only in where their data came from, so they share
 * this search, paging and bytes shape rather than keeping two copies that can
 * drift.
 */
export function createLocalIconSource(config: {
  readonly id: string;
  readonly label: string;
  readonly licence: string;
  /** Where a person reads the icon and its terms; the icon's name is appended. */
  readonly homeUrl: string;
  readonly icons: readonly LocalIcon[];
}): { readonly source: AssetSource; readonly search: IconSearch } {
  const byName = new Map(config.icons.map((icon) => [icon.name, icon]));

  function search(query: string, cursor: string | undefined): SearchPage {
    const wanted = normalize(query);
    const matches =
      wanted === ""
        ? config.icons
        : config.icons.filter((icon) => normalize(icon.name).includes(wanted));

    const offset = offsetOf(cursor);
    const page = matches.slice(offset, offset + PAGE);
    const next =
      offset + PAGE < matches.length ? String(offset + PAGE) : undefined;

    return {
      results: page.map((icon) => ({
        ...resultOf(icon, config.homeUrl),
        licence: config.licence,
      })),
      next,
    };
  }

  const source: AssetSource = {
    id: config.id,
    label: config.label,
    category: "icon",
    body: "grid",
    requires: undefined,
    configurable: true,

    async search(query, cursor) {
      return search(query, cursor);
    },

    async bytesOf(resultId): Promise<SourceBytes | undefined> {
      const icon = byName.get(resultId);
      if (icon === undefined) return undefined;

      return {
        bytes: new TextEncoder().encode(icon.svg),
        contentType: "image/svg+xml",
        filename: `${icon.name}.svg`,
      };
    },
  };

  return { source, search };
}
