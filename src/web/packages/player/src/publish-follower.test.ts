import { describe, expect, it, vi } from "vitest";
import { followPublished } from "./publish-follower.js";

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
    expect(map.reloads).toBe(1);
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
