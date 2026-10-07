import { describe, expect, it, vi } from "vitest";
import { displayUrl, mintSession, readHosting } from "./hosting-client.js";

const answer = (
  url: string,
  body: unknown,
  init?: ResponseInit,
): typeof fetch =>
  vi.fn(
    async () => new Response(JSON.stringify(body), init),
  ) as unknown as typeof fetch;

describe("readHosting", () => {
  it("reads this machine's address and port", async () => {
    const read = await readHosting(
      answer("/api/hosting", {
        lan: true,
        address: "192.168.1.42",
        port: 5227,
        sessions: [],
      }),
    );
    expect(read).toEqual({ lan: true, address: "192.168.1.42", port: 5227 });
  });

  it("answers nothing when no host is behind the editor", async () => {
    const missing = vi.fn(
      async () => new Response("", { status: 404 }),
    ) as unknown as typeof fetch;
    expect(await readHosting(missing)).toBeUndefined();
  });

  it("answers nothing for a body it cannot read", async () => {
    expect(
      await readHosting(answer("/api/hosting", { lan: "yes" })),
    ).toBeUndefined();
  });
});

describe("mintSession", () => {
  it("mints from the host, which is the only thing that may", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            session: {
              token: "t".repeat(43),
              expiresAt: "2026-10-08T00:00:00.000Z",
            },
          }),
          { status: 201 },
        ),
    ) as unknown as typeof fetch;

    expect(await mintSession(fetcher)).toEqual({
      token: "t".repeat(43),
      expiresAt: "2026-10-08T00:00:00.000Z",
    });
    expect(
      String(
        (fetcher as unknown as { mock: { calls: string[][] } }).mock
          .calls[0]?.[0],
      ),
    ).toBe("/api/pairing/sessions?label=display");
  });
});

describe("displayUrl", () => {
  it("puts the session in the query, because a script cannot send a header", () => {
    expect(displayUrl({ address: "192.168.1.42", port: 5227 }, "abc/def")).toBe(
      "http://192.168.1.42:5227/?session=abc%2Fdef",
    );
  });
});
