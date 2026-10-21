import { MAX_ARCHIVE_BYTES } from "@vigilia/theme-package";

/**
 * Fetches one catalogue package. The address is data from a remote document,
 * so this is where the trust boundary is held: https only, four hosts, one
 * redirect that may not leave them, and the reader's own cap enforced while the
 * body streams. The bytes then go to the owners that already exist
 * (`importThemePackage`, `ThemeStore`, `ThemeOriginsStore`); this module writes
 * nothing. See docs/decisions/0089.
 */

export interface DownloadOptions {
  /** Injected so a unit test drives this without a network. */
  readonly fetch?: typeof fetch;
  /** Aborts the read when the store's own patience runs out. */
  readonly timeoutMs?: number;
}

export type DownloadResult =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly message: string };

/** The hosts the hosting decision's two options can legitimately produce: a
 *  release asset (both its redirect target and the older object host) and a
 *  file in the catalogue repository. */
const ALLOWED_HOSTS = new Set([
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "raw.githubusercontent.com",
]);

const DEFAULT_TIMEOUT_MS = 60_000;

/** A release asset is exactly one hop (`github.com` → the asset host), so a
 *  second is a redirect this module did not ask for. */
const MAX_REDIRECTS = 1;

export async function downloadPackage(
  url: string,
  options?: DownloadOptions,
): Promise<DownloadResult> {
  const target = parseUrl(url);
  if (target === undefined)
    return refuse("That is not a URL a catalogue can produce.");
  if (target.protocol !== "https:")
    return refuse("A catalogue package must be downloaded over https.");
  if (!isCatalogueHost(target))
    return refuse("That host cannot serve a catalogue package.");

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    return refuse(
      "A download timeout must be a positive number of milliseconds.",
    );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // The signal aborts the network; this races the *reading* too, so a body that
  // stops arriving cannot leave the caller waiting on a reader that will never
  // settle.
  const timedOut = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener(
      "abort",
      () => reject(new Error("The download did not finish in time.")),
      { once: true },
    );
  });

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const running = read(
    target,
    options?.fetch ?? fetch,
    controller.signal,
    MAX_REDIRECTS,
    (opened) => {
      reader = opened;
    },
  );
  // If the timeout wins the race, this rejection has no other handler.
  running.catch(() => undefined);

  try {
    return await Promise.race([running, timedOut]);
  } catch (error) {
    if (controller.signal.aborted)
      return refuse("The download did not finish in time.");
    return refuse(
      error instanceof Error ? error.message : "The download failed.",
    );
  } finally {
    clearTimeout(timer);
    // Releasing a read that lost the race is also what makes the cap a cap on
    // traffic rather than on the array we eventually build. Awaited so the
    // caller's refusal is not answered while the origin is still sending.
    await reader?.cancel().catch(() => undefined);
  }
}

async function read(
  target: URL,
  fetcher: typeof fetch,
  signal: AbortSignal,
  redirectsLeft: number,
  opened: (reader: ReadableStreamDefaultReader<Uint8Array>) => void,
): Promise<DownloadResult> {
  const response = await fetcher(target.href, { redirect: "manual", signal });

  if (response.status >= 300 && response.status < 400) {
    if (redirectsLeft <= 0)
      return refuse("The catalogue redirected too many times.");
    const next = redirectTarget(response, target);
    if (next === undefined)
      return refuse("The download left the catalogue's hosts.");
    return read(next, fetcher, signal, redirectsLeft - 1, opened);
  }

  if (!response.ok)
    return refuse(`The download was refused (HTTP ${response.status}).`);

  // A hint, not enforcement: an origin may omit it or lie, and the counter
  // below is the rule. Checking it first only saves reading a body we already
  // know is too big.
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > MAX_ARCHIVE_BYTES)
      return refuse("That package is too large to download.");
  }

  if (response.body === null)
    return refuse("The download answered no package.");

  const reader = response.body.getReader();
  opened(reader);
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ARCHIVE_BYTES)
      return refuse("That package is too large to download.");
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** A parsed URL, or nothing. Kept separate from the allowlist so a bad scheme
 *  and a bad host get different sentences. */
function parseUrl(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

/** The hostname is compared after parsing, so `github.com.evil.example` and a
 *  userinfo prefix both fail. */
function isCatalogueHost(url: URL): boolean {
  return (
    url.protocol === "https:" && ALLOWED_HOSTS.has(url.hostname.toLowerCase())
  );
}

function redirectTarget(response: Response, current: URL): URL | undefined {
  const location = response.headers.get("location");
  if (location === null) return undefined;
  try {
    const next = new URL(location, current);
    return isCatalogueHost(next) ? next : undefined;
  } catch {
    return undefined;
  }
}

function refuse(message: string): DownloadResult {
  return { ok: false, message };
}
