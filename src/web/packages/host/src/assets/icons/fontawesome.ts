import type { AssetResult } from "@yunari/renderer-core";
import type {
  AssetSource,
  SearchPage,
  SourceBytes,
  SourceContext,
} from "../source.js";

export const FONTAWESOME_VERSION = "6.7.2";

const BASE = `https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@${FONTAWESOME_VERSION}/`;
const HOME = "https://fontawesome.com/icons/";
/** A style and a name both become a path segment; nothing else may. */
const STYLE = /^[a-z]+$/;
const NAME = /^[a-z0-9-]+$/;

interface IconEntry {
  readonly label?: string;
  readonly styles?: readonly string[];
}

interface Metadata {
  readonly licence: string;
  readonly icons: ReadonlyMap<string, IconEntry>;
}

/**
 * One fetch per fetcher for the process.
 *
 * Keyed by the fetcher so a test's stub gets its own metadata instead of
 * inheriting whatever ran before it.
 */
const cached = new WeakMap<typeof fetch, Promise<Metadata>>();

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

async function fetched<T>(
  ctx: SourceContext,
  path: string,
  what: string,
): Promise<T> {
  const response = await ctx.fetch(`${BASE}${path}`, { signal: ctx.signal });
  if (!response.ok) {
    throw new Error(`Font Awesome ${what} answered ${response.status}`);
  }
  return (await response.json()) as T;
}

async function load(ctx: SourceContext): Promise<Metadata> {
  const [icons, pkg] = await Promise.all([
    fetched<Record<string, IconEntry>>(ctx, "metadata/icons.json", "metadata"),
    fetched<{ license?: unknown }>(ctx, "package.json", "package"),
  ]);

  return {
    licence: typeof pkg.license === "string" ? pkg.license : "unknown",
    icons: new Map(Object.entries(icons)),
  };
}

function metadataOf(ctx: SourceContext): Promise<Metadata> {
  const pending = cached.get(ctx.fetch);
  if (pending !== undefined) return pending;

  const loading = load(ctx).catch((error: unknown) => {
    // A failed fetch is not the process's answer forever.
    cached.delete(ctx.fetch);
    throw error;
  });
  cached.set(ctx.fetch, loading);

  return loading;
}

function resultOf(name: string, style: string, licence: string): AssetResult {
  return {
    id: `${style}:${name}`,
    name,
    kind: "icon",
    preview: `${BASE}svgs/${style}/${name}.svg`,
    subtitle: style,
    licence,
    sourceUrl: `${HOME}${name}?f=${style}`,
  };
}

/**
 * Font Awesome Free, read through the pinned package on jsDelivr.
 *
 * The set is the free one by construction, and the licence comes from the
 * package's own metadata rather than a constant that could drift from it.
 */
export const fontAwesomeSource: AssetSource = {
  id: "fontawesome-free",
  label: "Font Awesome Free",
  category: "icon",
  body: "grid",
  requires: undefined,
  configurable: true,

  async search(query, _cursor, ctx): Promise<SearchPage> {
    const { icons, licence } = await metadataOf(ctx);
    const wanted = normalize(query);

    const results: AssetResult[] = [];
    for (const [name, entry] of icons) {
      if (
        wanted !== "" &&
        !normalize(name).includes(wanted) &&
        !normalize(entry.label ?? "").includes(wanted)
      ) {
        continue;
      }

      for (const style of entry.styles ?? []) {
        if (STYLE.test(style)) results.push(resultOf(name, style, licence));
      }
    }

    // The whole free set is small enough to answer in one page.
    return { results, next: undefined };
  },

  async bytesOf(resultId, ctx): Promise<SourceBytes | undefined> {
    const [style, name, ...rest] = resultId.split(":");
    if (rest.length > 0 || style === undefined || name === undefined) {
      return undefined;
    }
    if (!STYLE.test(style) || !NAME.test(name)) return undefined;

    const response = await ctx.fetch(`${BASE}svgs/${style}/${name}.svg`, {
      signal: ctx.signal,
    });
    if (!response.ok) {
      throw new Error(`Font Awesome icon answered ${response.status}`);
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: "image/svg+xml",
      filename: `${name}.svg`,
    };
  },

  creditsOf(result) {
    return {
      kind: "icon",
      title: result.name,
      license: result.licence,
      changes: "Imported unchanged",
      source: { url: result.sourceUrl },
    };
  },
};
