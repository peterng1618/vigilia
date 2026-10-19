import { describe, expect, it, vi } from "vitest";
import { followPublished, reResolveUrl } from "./publish-follower.js";

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

/** The page a host-served display is on, which is what the follower polls from:
 *  the host resolved this theme itself. */
const MAP_PAGE =
  "http://127.0.0.1:5227/?display=left-screen&theme=studio&data=live&theme-source=map";

const settle = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe("followPublished", () => {
  it("does not reload while the revision sits still", async () => {
    const reload = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: answer({ id: "living-room", revision: 4 }),
      },
      reload,
      { intervalMs: 5 },
    );

    await settle(40);
    stop();
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once the revision moves", async () => {
    let revision = 4;
    const reload = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: vi.fn(
          async () =>
            new Response(JSON.stringify({ id: "living-room", revision })),
        ),
      },
      reload,
      { intervalMs: 5 },
    );

    await settle(20);
    revision = 5;
    await settle(40);
    stop();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("stops, and says so, when the host refuses the session", async () => {
    const reload = vi.fn();
    const refused = vi.fn();
    const stop = followPublished(
      { pageUrl: MAP_PAGE, fetch: answer({ error: "not paired" }, 403) },
      reload,
      { intervalMs: 5, onRefused: refused },
    );

    await settle(40);
    const calls = refused.mock.calls.length;
    await settle(40);
    stop();

    expect(calls).toBeGreaterThan(0);
    // Stopped: a refusal is reported once, not polled forever.
    expect(refused.mock.calls.length).toBe(calls);
    expect(reload).not.toHaveBeenCalled();
  });

  it("calls onThemeChange when the host's answer moves", async () => {
    let theme = "studio";
    const reload = vi.fn();
    const onThemeChange = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                id: null,
                revision: 0,
                display: { id: "left-screen", theme },
              }),
            ),
        ),
      },
      reload,
      { intervalMs: 5, onThemeChange },
    );

    await settle(20);
    // The first answer is the baseline: a page that has just loaded is already
    // showing what the host resolved for it.
    expect(onThemeChange).not.toHaveBeenCalled();

    theme = "living-room";
    await settle(40);
    stop();

    expect(onThemeChange).toHaveBeenCalledTimes(1);
    expect(onThemeChange).toHaveBeenCalledWith("living-room");
    // The callback *is* the reload: a caller that answered it has already
    // navigated, and reloading the URL that navigation just left would undo it.
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads itself when the caller has no theme callback", async () => {
    let theme = "studio";
    const reload = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                id: null,
                revision: 0,
                display: { id: "left-screen", theme },
              }),
            ),
        ),
      },
      reload,
      { intervalMs: 5 },
    );

    await settle(20);
    theme = "living-room";
    await settle(40);
    stop();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not call onThemeChange when the answer is unchanged", async () => {
    const reload = vi.fn();
    const onThemeChange = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: answer({
          id: null,
          revision: 0,
          display: { id: "left-screen", theme: "studio" },
        }),
      },
      reload,
      { intervalMs: 5, onThemeChange },
    );

    await settle(40);
    stop();

    expect(onThemeChange).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("follows the map only for a page the host resolved itself", async () => {
    /** One follower, against a host whose answer moves, answering what it did
     *  and the poll it asked with. */
    async function follow(pageUrl: string): Promise<{
      readonly themes: readonly (string | null)[];
      readonly reloads: number;
      readonly asked: string | undefined;
    }> {
      let theme = "studio";
      const reload = vi.fn();
      const onThemeChange = vi.fn();
      const fetch = vi.fn(
        async (_input: RequestInfo | URL) =>
          new Response(
            JSON.stringify({
              id: null,
              revision: 0,
              display: { id: "left-screen", theme },
            }),
          ),
      );
      const stop = followPublished({ pageUrl, fetch }, reload, {
        intervalMs: 5,
        onThemeChange,
      });

      await settle(20);
      theme = "living-room";
      await settle(40);
      stop();

      const asked = fetch.mock.calls[0]?.[0];

      return {
        themes: onThemeChange.mock.calls.map((call) => call[0]),
        reloads: reload.mock.calls.length,
        asked: typeof asked === "string" ? asked : asked?.toString(),
      };
    }

    const map = await follow(MAP_PAGE);
    expect(map.themes).toEqual(["living-room"]);
    expect(map.reloads).toBe(0);
    // The display names itself — that is the sighting its window makes — and
    // names no theme: a theme the host resolved itself is answered by the map,
    // and a page that echoed its own back would be answered `null` for ever.
    expect(map.asked).toBe(
      "/api/published?display=left-screen&theme-source=map",
    );

    const link = await follow(
      "http://127.0.0.1:5227/?theme=studio&data=live&theme-source=link",
    );
    expect(link.themes).toEqual([]);
    expect(link.reloads).toBe(0);
    // A link is the person's own instruction for that page, so it says so.
    expect(link.asked).toBe("/api/published?theme-source=link&theme=studio");

    const published = await follow(
      "http://127.0.0.1:5227/?theme=studio&data=live&theme-source=published",
    );
    expect(published.themes).toEqual([]);
    expect(published.reloads).toBe(0);
    expect(published.asked).toBe("/api/published?theme-source=published");
  });
});

describe("followPublished's unreachable report", () => {
  it("reports an unreachable host rather than swallowing it", async () => {
    // Today this error is discarded (`publish-follower.ts`'s `catch`), which is
    // why the ladder had no way to run at all.
    const onUnreachable = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: vi.fn(async () => Promise.reject(new Error("down"))),
      },
      vi.fn(),
      { intervalMs: 5, onUnreachable },
    );

    await settle(40);
    stop();

    expect(onUnreachable).toHaveBeenCalled();
  });

  it("reports one unreachable episode once, and a later one again", async () => {
    // The caller's answer to this is a sweep of 253 addresses, so a host that
    // is simply asleep must not put every display on the /24 on a cadence.
    let reachable = false;
    const onUnreachable = vi.fn();
    const stop = followPublished(
      {
        pageUrl: MAP_PAGE,
        fetch: vi.fn(async () =>
          reachable
            ? new Response(JSON.stringify({ revision: 1 }))
            : Promise.reject(new Error("down")),
        ),
      },
      vi.fn(),
      { intervalMs: 5, onUnreachable },
    );

    await settle(40);
    expect(onUnreachable).toHaveBeenCalledTimes(1); // not once per failed tick
    reachable = true;
    await settle(20);
    reachable = false;
    await settle(40);
    stop();

    expect(onUnreachable).toHaveBeenCalledTimes(2); // a new episode reports
  });
});

describe("reResolveUrl", () => {
  const page = "http://127.0.0.1:5227/";

  it("re-resolves on a map page and leaves a link page's id alone", () => {
    // `data` is what makes the host skip its resolution, so it always goes: a
    // reload that keeps it re-serves the theme id already in the URL, and a
    // reassignment changes exactly that id.
    expect(
      reResolveUrl(
        `${page}?display=left-screen&theme=studio&data=live&theme-source=map`,
      ),
    ).toBe(`${page}?display=left-screen&theme-source=map`);

    // The id a map page holds is the host's own answer, so it is the one that
    // has to go; a link page's id is the person's instruction and stays.
    expect(
      reResolveUrl(`${page}?theme=studio&data=live&theme-source=link`),
    ).toBe(`${page}?theme=studio&theme-source=link`);

    // A published page keeps its id, exactly as it behaves today.
    expect(
      reResolveUrl(`${page}?theme=studio&data=live&theme-source=published`),
    ).toBe(`${page}?theme=studio&theme-source=published`);
  });

  it("keeps the display the page names, so the sighting survives the reload", () => {
    expect(
      reResolveUrl(
        `${page}?display=left-screen&session=abc123&theme=studio&data=live&theme-source=map`,
      ),
    ).toBe(`${page}?display=left-screen&session=abc123&theme-source=map`);
  });
});
