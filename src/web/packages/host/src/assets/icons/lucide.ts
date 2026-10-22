import type { AssetResult } from "@yunari/renderer-core";
import type { AssetSource, SearchPage, SourceBytes } from "../source.js";
import { LUCIDE_ICONS } from "./lucide-icons.generated.js";

export { LUCIDE_ICONS };

export interface LucideIcon {
  readonly name: string;
  readonly svg: string;
}

const SOURCE_URL = "https://lucide.dev/icons/";
const PAGE = 40;

const byName = new Map(LUCIDE_ICONS.map((icon) => [icon.name, icon]));

/** Spaces and hyphens are one separator, so "arrow down" finds `arrow-down`. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, "-");
}

/** A cursor is an offset; anything else is the first page rather than a fault. */
function offsetOf(cursor: string | undefined): number {
  return cursor !== undefined && /^\d+$/.test(cursor) ? Number(cursor) : 0;
}

function previewOf(icon: LucideIcon): string {
  // A data URL rather than a host round-trip: the icon is already here, and the
  // grid renders it offline. `<img>` does not execute a script in an SVG.
  return `data:image/svg+xml;base64,${Buffer.from(icon.svg).toString("base64")}`;
}

function resultOf(icon: LucideIcon): AssetResult {
  return {
    id: icon.name,
    name: icon.name,
    preview: previewOf(icon),
    subtitle: undefined,
    licence: "ISC",
    sourceUrl: `${SOURCE_URL}${icon.name}`,
  };
}

export function searchLucide(
  query: string,
  cursor: string | undefined,
): SearchPage {
  const wanted = normalize(query);
  const matches =
    wanted === ""
      ? LUCIDE_ICONS
      : LUCIDE_ICONS.filter((icon) => normalize(icon.name).includes(wanted));

  const offset = offsetOf(cursor);
  const page = matches.slice(offset, offset + PAGE);
  const next =
    offset + PAGE < matches.length ? String(offset + PAGE) : undefined;

  return { results: page.map(resultOf), next };
}

export const lucideSource: AssetSource = {
  id: "lucide",
  label: "Lucide",
  category: "icon",
  body: "grid",
  requires: undefined,
  configurable: true,

  async search(query, cursor) {
    return searchLucide(query, cursor);
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

  creditsOf(result) {
    return {
      kind: "icon",
      title: result.name,
      license: "ISC",
      changes: "Imported unchanged",
      source: { url: result.sourceUrl },
    };
  },
};
