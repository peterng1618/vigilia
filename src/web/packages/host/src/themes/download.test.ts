import { MAX_ARCHIVE_BYTES } from "@vigilia/theme-package";
import { describe, expect, it } from "vitest";
import { DEFAULT_TIMEOUT_MS, downloadPackage } from "./download.js";

/** A release asset on an allowed host, and the hop GitHub actually answers. */
const ASSET =
  "https://github.com/peterng1618/vigilia-store/releases/download/v1/aurora.zip";
const ASSET_HOST = "https://release-assets.githubusercontent.com/aurora.zip";

type Handler = (
  url: string,
  init?: RequestInit,
) => Response | Promise<Response>;

/**
 * A `typeof fetch` over a handler that records every URL it was asked for. The
 * record is how a test proves a refused redirect was never followed, rather
 * than merely that the answer was a refusal.
 */
function injectedFetch(handler: Handler): {
  readonly fetch: typeof fetch;
  readonly seen: string[];
} {
  const seen: string[] = [];
  const fetcher: typeof globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    seen.push(url);
    return await handler(url, init);
  };
  return { fetch: fetcher, seen };
}

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** A body that never ends, so only the caller's timeout can settle it. */
function stalledBody(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytesOf("partial"));
    },
  });
}

/**
 * A body of exactly `total` bytes, one chunk per pull. `cancelled` is set when
 * the downloader stops reading, which is what proves the cap is enforced on the
 * stream rather than after the whole body has been buffered.
 */
function countedBody(total: number): {
  readonly body: ReadableStream<Uint8Array>;
  readonly cancelled: () => boolean;
} {
  const chunk = new Uint8Array(1024 * 1024);
  let sent = 0;
  let stopped = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const size = Math.min(chunk.byteLength, total - sent);
      controller.enqueue(chunk.subarray(0, size));
      sent += size;
    },
    cancel() {
      stopped = true;
    },
  });
  return { body, cancelled: () => stopped };
}

describe("downloadPackage", () => {
  it("refuses a URL that is not https", async () => {
    const { fetch, seen } = injectedFetch(() => new Response("no"));

    const result = await downloadPackage(
      "http://github.com/peterng1618/vigilia-store/aurora.zip",
      { fetch },
    );

    expect(result).toEqual({
      ok: false,
      stage: "address",
      message: expect.stringContaining("https"),
    });
    // A refused scheme is refused before the request, not after it.
    expect(seen).toEqual([]);
  });

  it("refuses a host the catalogue cannot produce", async () => {
    const { fetch, seen } = injectedFetch(() => new Response("no"));

    const result = await downloadPackage("https://example.com/x.zip", {
      fetch,
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/catalogue/i);
    expect(seen).toEqual([]);
  });

  it("refuses a redirect off an allowed host", async () => {
    const { fetch, seen } = injectedFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://example.com/x.zip" },
        }),
    );

    const result = await downloadPackage(ASSET, { fetch });

    expect(result.ok).toBe(false);
    // The off-list host is never asked for the bytes, which is the whole point
    // of holding the redirect rather than letting `follow` take it.
    expect(seen).toEqual([ASSET]);
  });

  it("follows a redirect between allowed hosts", async () => {
    const { fetch, seen } = injectedFetch((url) =>
      url === ASSET
        ? new Response(null, {
            status: 302,
            headers: { location: ASSET_HOST },
          })
        : new Response("package"),
    );

    const result = await downloadPackage(ASSET, { fetch });

    expect(result).toEqual({ ok: true, bytes: bytesOf("package") });
    expect(seen).toEqual([ASSET, ASSET_HOST]);
  });

  it("refuses a second redirect, even between allowed hosts", async () => {
    const { fetch, seen } = injectedFetch(
      () =>
        new Response(null, {
          status: 302,
          headers: { location: ASSET_HOST },
        }),
    );

    const result = await downloadPackage(ASSET, { fetch });

    expect(result.ok).toBe(false);
    expect(seen).toEqual([ASSET, ASSET_HOST]);
  });

  it("refuses a body larger than the reader accepts, from its Content-Length", async () => {
    // A body that can never be read: if the declared size is not checked
    // first, the read stalls until the timeout and the message is the wrong
    // one, rather than this test hanging.
    const { fetch } = injectedFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull: () => new Promise(() => undefined),
          }),
          { headers: { "content-length": String(MAX_ARCHIVE_BYTES + 1) } },
        ),
    );

    const result = await downloadPackage(ASSET, { fetch, timeoutMs: 50 });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/large/i);
  });

  it("cancels the body it refuses on its Content-Length", async () => {
    // The refusal happens before a reader exists, so nothing else releases the
    // connection: without an explicit cancel the origin keeps sending.
    let cancelled = false;
    const { fetch } = injectedFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            pull: () => new Promise(() => undefined),
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "content-length": String(MAX_ARCHIVE_BYTES + 1) } },
        ),
    );

    const result = await downloadPackage(ASSET, { fetch, timeoutMs: 50 });

    expect(result.ok).toBe(false);
    expect(cancelled).toBe(true);
  });

  it("refuses a body larger than the reader accepts, and stops reading it", async () => {
    // Twice the cap, so the stream is still open when the refusal lands: a
    // stream that had already ended would make `cancel` a no-op and prove
    // nothing about stopping early.
    const counted = countedBody(MAX_ARCHIVE_BYTES * 2);
    const { fetch } = injectedFetch(() => new Response(counted.body));

    const result = await downloadPackage(ASSET, { fetch });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/large/i);
    // Cancelling mid-stream is the difference between a cap and a complaint
    // after the whole body has already been held in memory.
    expect(counted.cancelled()).toBe(true);
  });

  it("allows two minutes for a legitimate package on a slow line", () => {
    // A 25 MiB item on a 3 Mbps line takes about 67 s, so a 60 s default
    // refuses a download that is still arriving. Pinned as a literal, because
    // a shorter default is otherwise only visible by waiting for it.
    expect(DEFAULT_TIMEOUT_MS).toBe(120_000);
  });

  it("refuses a body that stops arriving", async () => {
    const { fetch } = injectedFetch(() => new Response(stalledBody()));

    // A guard of its own, so an implementation that ignores `timeoutMs` fails
    // this test rather than hanging it until the runner's budget expires.
    const result = await Promise.race([
      downloadPackage(ASSET, { fetch, timeoutMs: 25 }),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("downloadPackage never timed out")),
          2000,
        ),
      ),
    ]);

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/time|finish/i);
  });

  it("refuses a response that is not a package", async () => {
    const { fetch } = injectedFetch(
      () => new Response("not found", { status: 404 }),
    );

    const result = await downloadPackage(ASSET, { fetch });

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toMatch(/404/);
  });

  it("answers the bytes for a good response", async () => {
    const body = "the package bytes";
    const { fetch } = injectedFetch(() => new Response(body));

    const result = await downloadPackage(ASSET, { fetch });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.bytes : new Uint8Array()).toEqual(bytesOf(body));
  });
});
