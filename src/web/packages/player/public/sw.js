/**
 * The player's service worker — the shell offline, never a reading.
 *
 * Served at the host's root, so its scope is `/` with no
 * `Service-Worker-Allowed` header (docs/decisions/0071). The host refuses an
 * unpaired reader everything else, which is why this path is on the
 * bundle-asset allowlist: the browser fetches this file itself and cannot
 * carry the session.
 *
 * **`/api/**` is never cached.** The theme document, its packaged assets and
 * the sample stream are the live data the host owns, and an offline display
 * showing yesterday's numbers as though they were live is the fabrication this
 * project forbids. Offline, the shell draws and the player's own load-failure
 * page says the theme could not be loaded — which is what it says, and it is
 * true.
 *
 * Plain JavaScript on purpose: Vite copies `public/` verbatim, so this file is
 * the one the browser is given rather than a build of it.
 */

const SHELL_CACHE = "vigilia-shell-v1";
/** Stable names, so they can be precached without a build-time list. The
 *  content-hashed bundle assets are cached as they are fetched instead. */
const SHELL_FILES = ["/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("vigilia-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      // A display that is already open is controlled from here, which is what
      // makes the *next* navigation the one that fills the cache.
      .then(() => self.clients.claim()),
  );
});

/** Best effort: a cache that refused an entry must not fail the request. */
async function remember(cacheKey, response) {
  try {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(cacheKey, response);
  } catch {
    /* Not cacheable; the display still got its answer. */
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // **The network answers first, always.** The host marks the document
    // `no-store` because entry HTML must not retain references to an old
    // build, and a cache-first navigation would keep a display on a shell the
    // host has already replaced. The cache is the offline fallback and
    // nothing else.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) void remember(request, response.clone());
          return response;
        })
        .catch(async () => {
          // The display URL carries its theme and its session, so the cached
          // document is under a different query than the one being asked for.
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached ?? Response.error();
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) void remember(request, response.clone());
            return response;
          }),
      ),
    );
  }
});
