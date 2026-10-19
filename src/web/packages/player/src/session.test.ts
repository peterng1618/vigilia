import { describe, expect, it, vi } from "vitest";
import { readStoredPairing, storePairing } from "./host-refind.js";
import { displaySession } from "./session.js";

/** The browser's own `Storage`, without a browser. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => void entries.delete(key),
    setItem: (key, value) => void entries.set(key, value),
  };
}

describe("display session token", () => {
  it("keeps the page it was built from, so a poll can read it", () => {
    // The follower builds its own poll out of the page a display is on — which
    // display it is and where its theme came from — and it is handed the token,
    // not the URL, so the URL has to ride along.
    const pageUrl =
      "http://127.0.0.1:5227/?display=left-screen&theme=studio&data=live";

    expect(displaySession(pageUrl, fetch).pageUrl).toBe(pageUrl);
  });

  it("carries no token for a loopback display", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("ok"));
    const session = displaySession("http://127.0.0.1:5227/", fetcher);

    expect(session.token).toBeUndefined();
    await session.fetch("/api/themes");
    expect(fetcher).toHaveBeenCalledWith("/api/themes", undefined);
    expect(
      session.streamUrl("/ws", new URLSearchParams({ keys: "cpu.load" })),
    ).toBe("/ws?keys=cpu.load");
  });

  it("sends the paired token as a header on fetches", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("ok"));
    const session = displaySession(
      "http://192.168.1.10:5227/?session=abc123",
      fetcher,
    );

    expect(session.token).toBe("abc123");
    await session.fetch("/api/themes", { method: "GET" });

    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(new Headers(init?.headers).get("x-vigilia-session")).toBe("abc123");
    expect(init?.method).toBe("GET");
  });

  it("appends the token to a stream URL, because EventSource cannot set headers", () => {
    const session = displaySession(
      "http://192.168.1.10:5227/?session=abc123",
      fetch,
    );

    const url = session.streamUrl(
      "/ws",
      new URLSearchParams({ keys: "cpu.load,ram.used" }),
    );

    expect(url).toContain("keys=cpu.load%2Cram.used");
    expect(url).toContain("session=abc123");
  });

  it("appends the token to URLs a header-less loader fetches", () => {
    const paired = displaySession(
      "http://192.168.1.10:5227/?session=abc123",
      fetch,
    );
    const loopback = displaySession("http://127.0.0.1:5227/", fetch);

    expect(paired.withToken("/api/themes/living-room/")).toBe(
      "/api/themes/living-room/?session=abc123",
    );
    expect(paired.withToken("/api/themes/x/assets/a.png?v=1")).toBe(
      "/api/themes/x/assets/a.png?v=1&session=abc123",
    );
    // An unpaired display's URLs stay exactly what they were.
    expect(loopback.withToken("/api/themes/living-room/")).toBe(
      "/api/themes/living-room/",
    );
  });
});

describe("what a load reads, and what it writes", () => {
  it("resolves the credential from the URL, and from storage when the URL carries none", () => {
    const storage = memoryStorage();
    const first = displaySession(
      "http://192.168.1.10:5227/?session=abc",
      fetch,
      storage,
    );

    expect(first.token).toBe("abc");

    // The record `rememberPairing` writes, and the only thing that makes the
    // second half of this case meaningful: the host's own redirect keeps the
    // query, but a URL that arrives without one is still this display.
    storePairing(storage, {
      hostId: "h1",
      hostName: "study-pc",
      port: 5227,
      token: "abc",
      lastAddress: "192.168.1.10",
    });

    const later = displaySession("http://192.168.1.10:5227/", fetch, storage);

    expect(later.token).toBe("abc");
  });

  it("writes no pairing of its own", () => {
    // The identity comes from `GET /api/host` and nowhere else: `pair.html`
    // navigates to `/?session=<token>` and nothing in the repo emits `host=`,
    // `name=` or `port=` (R72). A second writer here could only produce a record
    // with an empty `hostId` — which reads back as a valid pairing, matches no
    // probe, and would overwrite a good one on any load where `/api/host`
    // failed.
    const storage = memoryStorage();

    displaySession("http://192.168.1.10:5227/?session=abc", fetch, storage);

    expect(readStoredPairing(storage)).toBeUndefined();
  });

  it("lets a fresh pairing link replace a stored credential", () => {
    // Otherwise a display re-paired to a second host keeps the first one's
    // token, and answers a host that never issued it.
    const storage = memoryStorage();

    storePairing(storage, {
      hostId: "h1",
      hostName: "a",
      port: 5227,
      token: "first",
      lastAddress: "192.168.1.10",
    });

    const fresh = displaySession(
      "http://192.168.1.10:5227/?session=second",
      fetch,
      storage,
    );

    expect(fresh.token).toBe("second");
  });
});
