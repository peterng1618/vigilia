import { describe, expect, it, vi } from "vitest";
import { KNOWN_CREDENTIALS } from "./credentials-registry.js";

const unsplash = KNOWN_CREDENTIALS.find((entry) => entry.id === "unsplash");

describe("KNOWN_CREDENTIALS", () => {
  it("lists Unsplash as a bearer credential with a check", () => {
    expect(unsplash).toMatchObject({
      id: "unsplash",
      label: "Unsplash",
      kind: "bearer",
    });
    expect(typeof unsplash?.verify).toBe("function");
  });

  it("names where a person creates the key", () => {
    expect(unsplash?.help?.url).toBe("https://unsplash.com/oauth/applications");
    expect(unsplash?.help?.text).not.toBe("");
  });

  it("checks the key against the search endpoint and says ok on 200", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    expect(await unsplash?.verify?.("key-1234", fetcher)).toEqual({ ok: true });

    expect(calls[0]?.url).toContain("api.unsplash.com/search/photos");
    expect(calls[0]?.init?.headers).toEqual({
      Authorization: "Client-ID key-1234",
    });
  });

  it("names the status when the key is rejected, without echoing it", async () => {
    const fetcher = vi.fn(
      async () => new Response("unauthorized", { status: 401 }),
    ) as unknown as typeof fetch;

    const result = await unsplash?.verify?.("key-1234", fetcher);

    expect(result?.ok).toBe(false);
    const message = result?.ok === false ? result.message : "";
    expect(message).toContain("401");
    expect(message).not.toContain("key-1234");
  });
});
