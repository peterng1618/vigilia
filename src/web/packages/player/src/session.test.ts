import { describe, expect, it, vi } from "vitest";
import { displaySession } from "./session.js";

describe("display session token", () => {
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
});
