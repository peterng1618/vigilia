import type {
  AssetPage,
  AssetSearchAnswer,
  AssetSearchRequest,
  AssetSourceListing,
} from "@yunari/renderer-core";

/**
 * The finder's half of the host routes, fetch-only.
 *
 * Nothing here throws at the modal: an unreachable host is a listing with no
 * sources and a search whose every asked source says it failed, because a
 * closed dialog is a worse answer than a sentence that says what happened.
 */
export interface ClientOptions {
  readonly baseUrl?: string;
  readonly fetch?: typeof fetch;
}

export interface AssetBytes {
  readonly bytes: Uint8Array;
  readonly filename: string;
}

function request(options?: ClientOptions): {
  readonly fetcher: typeof fetch;
  readonly url: (path: string) => string;
} {
  return {
    fetcher: options?.fetch ?? globalThis.fetch.bind(globalThis),
    url: (path) => `${options?.baseUrl ?? ""}${path}`,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failed(source: string, message: string): AssetPage {
  return {
    source,
    results: [],
    next: undefined,
    failure: { reason: "failed", message },
  };
}

export async function listSources(
  options?: ClientOptions,
): Promise<readonly AssetSourceListing[]> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(url("/api/assets/sources"));
    if (!response.ok) return [];

    const body = (await response.json()) as unknown;
    const sources = (body as { sources?: unknown }).sources;
    return Array.isArray(sources)
      ? (sources as readonly AssetSourceListing[])
      : [];
  } catch {
    return [];
  }
}

export async function searchAssets(
  search: AssetSearchRequest,
  options?: ClientOptions,
): Promise<AssetSearchAnswer> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(url("/api/assets/search"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(search),
    });
    if (!response.ok) {
      return {
        pages: search.enabled.map((source) =>
          failed(source, `The host answered ${response.status}.`),
        ),
      };
    }

    const body = (await response.json()) as unknown;
    const pages = (body as { pages?: unknown }).pages;
    return {
      pages: Array.isArray(pages) ? (pages as readonly AssetPage[]) : [],
    };
  } catch (error: unknown) {
    const message = messageOf(error);
    return { pages: search.enabled.map((source) => failed(source, message)) };
  }
}

export async function assetBytes(
  source: string,
  id: string,
  options?: ClientOptions,
): Promise<AssetBytes | undefined> {
  const { fetcher, url } = request(options);

  try {
    const response = await fetcher(
      url(
        `/api/assets/bytes?source=${encodeURIComponent(source)}&id=${encodeURIComponent(id)}`,
      ),
    );
    if (!response.ok) return undefined;

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      filename: response.headers.get("x-yunari-filename") ?? id,
    };
  } catch {
    return undefined;
  }
}
