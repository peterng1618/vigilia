import { describe, expect, it, vi } from "vitest";
import { readStoredPairing } from "./host-refind.js";
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

describe("what a load remembers", () => {
  it("stores the credential it was handed and stops reading it from the URL", () => {
    const storage = memoryStorage();
    displaySession("http://192.168.1.10:5227/?session=abc", fetch, storage);

    expect(readStoredPairing(storage)?.token).toBe("abc");

    // A later load with no query resolves the session from storage. This is the
    // half that makes storing it worth anything: the host's own redirect keeps
    // the query, but a URL that arrives without one is still this display.
    const later = displaySession("http://192.168.1.10:5227/", fetch, storage);

    expect(later.token).toBe("abc");
  });

  it("keeps the host identity beside the credential", () => {
    const storage = memoryStorage();

    displaySession(
      "http://192.168.1.10:5227/?session=abc&host=h1&name=study-pc&port=5227",
      fetch,
      storage,
    );

    expect(readStoredPairing(storage)).toEqual({
      hostId: "h1",
      hostName: "study-pc",
      port: 5227,
      token: "abc",
      lastAddress: "192.168.1.10",
    });
  });

  it("lets a fresh pairing link replace a stored one", () => {
    // Otherwise a display re-paired to a second host keeps the first one's
    // token, and answers a host that never issued it.
    const storage = memoryStorage();

    displaySession(
      "http://192.168.1.10:5227/?session=first&host=h1&name=a&port=5227",
      fetch,
      storage,
    );
    displaySession(
      "http://192.168.1.10:5227/?session=second&host=h2&name=b&port=5227",
      fetch,
      storage,
    );

    expect(readStoredPairing(storage)?.token).toBe("second");
    expect(readStoredPairing(storage)?.hostId).toBe("h2");
  });

  it("keeps the identity a load already stored, and moves its address", () => {
    // The host's own redirect preserves the query, so a re-served page carries
    // its token and no identity parameters. The address is the one thing that
    // has to move with the load, because that is what the ladder tries first.
    const storage = memoryStorage();

    displaySession(
      "http://192.168.1.10:5227/?session=abc&host=h1&name=study-pc&port=5227",
      fetch,
      storage,
    );
    displaySession("http://192.168.1.44:5227/?session=abc", fetch, storage);

    expect(readStoredPairing(storage)).toEqual({
      hostId: "h1",
      hostName: "study-pc",
      port: 5227,
      token: "abc",
      lastAddress: "192.168.1.44",
    });
  });
});
