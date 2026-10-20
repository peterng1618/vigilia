/**
 * The package picker's half, which is `theme-import.ts`'s and not
 * `editor-main.ts`'s: importing writes to the library, where opening a
 * document would need the whole editor shell mounted (R129).
 *
 * The host reads the package and decides the id, so the cases below are about
 * what the browser *sends* and what it makes of the answer — the bytes leave
 * unread, and the host's own words are what the author is told.
 */
import { describe, expect, it } from "vitest";
import { importThemePackage } from "./theme-import.js";

/** What the host answered, as the client sees it. Built by hand rather than
 *  from a `Response`, so the assertions are about the mapping and not about
 *  what the platform's fetch happens to expose. */
function answering(answer: {
  readonly status: number;
  readonly id?: string;
  readonly text?: string;
  readonly json?: unknown;
}) {
  const calls: { readonly url: string; readonly init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      text: async () => answer.text ?? "",
      json: async () =>
        answer.json ?? (answer.id === undefined ? {} : { id: answer.id }),
    };
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x01]);

describe("importThemePackage", () => {
  it("posts the package's bytes to the host and answers the id it landed under", async () => {
    const { calls, fetcher } = answering({ status: 200, id: "living-room" });

    const result = await importThemePackage(BYTES, { fetch: fetcher });

    expect(result).toEqual({ ok: true, id: "living-room" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/themes/import");
    expect(calls[0]?.init.method).toBe("POST");
    // The bytes themselves, unread: the reader is the host's, and a client
    // that parsed a package here would be a second place that decided its id.
    expect([...(calls[0]?.init.body as Uint8Array)]).toEqual([...BYTES]);
  });

  it("sends the bytes it was given even when they are not a package", async () => {
    const { calls, fetcher } = answering({
      status: 400,
      text: "That file is not a readable theme package.",
    });
    const garbage = new Uint8Array([1, 2, 3]);

    const result = await importThemePackage(garbage, { fetch: fetcher });

    // The host's own reason, carried out rather than replaced — and the refusal
    // is the host's to make, so the bytes still went.
    expect(result).toEqual({
      ok: false,
      message: "That file is not a readable theme package.",
    });
    expect([...(calls[0]?.init.body as Uint8Array)]).toEqual([1, 2, 3]);
  });

  it("posts to the host the client was given", async () => {
    const { calls, fetcher } = answering({ status: 200, id: "family-room" });

    await importThemePackage(BYTES, {
      baseUrl: "https://pc.test:8443",
      fetch: fetcher,
    });

    expect(calls[0]?.url).toBe("https://pc.test:8443/api/themes/import");
  });

  it("reports a refusal with no words of its own as the status", async () => {
    const { fetcher } = answering({ status: 500 });

    const result = await importThemePackage(BYTES, { fetch: fetcher });

    expect(result).toEqual({
      ok: false,
      message: "The host refused the import (500).",
    });
  });

  it("refuses an answer that names no id rather than inventing one", async () => {
    const { fetcher } = answering({ status: 200, json: {} });

    const result = await importThemePackage(BYTES, { fetch: fetcher });

    expect(result).toEqual({
      ok: false,
      message: "The host did not say where the theme landed.",
    });
  });

  it("reports a host that could not be reached", async () => {
    const fetcher = (async () => {
      throw new Error("Failed to fetch");
    }) as unknown as typeof fetch;

    const result = await importThemePackage(BYTES, { fetch: fetcher });

    expect(result).toEqual({ ok: false, message: "Failed to fetch" });
  });
});
