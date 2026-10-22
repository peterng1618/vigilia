import { describe, expect, it, vi } from "vitest";
import {
  clearCredential,
  listCredentials,
  saveCredential,
  verifyCredential,
} from "./credentials-client.js";

const row = {
  id: "demo",
  label: "Demo source",
  set: false,
  hint: "",
  verify: false,
};

describe("the credentials client", () => {
  it("reads the host's rows", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([row]), { status: 200 }));

    expect(await listCredentials({ fetch: fetcher })).toEqual([row]);
    expect(fetcher).toHaveBeenCalledWith("/api/credentials");
  });

  it("answers no rows when the host keeps no credential store", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("", { status: 503 }));

    expect(await listCredentials({ fetch: fetcher })).toEqual([]);
  });

  it("saves through the credential's own route", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    expect(
      await saveCredential("demo", "sk-live-9f2c", { fetch: fetcher }),
    ).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith("/api/credentials/demo", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "sk-live-9f2c" }),
    });
  });

  it("carries the host's own refusal sentence", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("Only bearer credentials are supported (R10).", {
        status: 400,
      }),
    );

    expect(
      await saveCredential("session", "cookie", { fetch: fetcher }),
    ).toEqual({
      ok: false,
      message: "Only bearer credentials are supported (R10).",
    });
  });

  it("turns a network throw into a refusal", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("host is unreachable"));

    expect(await clearCredential("demo", { fetch: fetcher })).toEqual({
      ok: false,
      message: "host is unreachable",
    });
  });

  it("clears through DELETE", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    expect(await clearCredential("demo", { fetch: fetcher })).toEqual({
      ok: true,
    });
    expect(fetcher).toHaveBeenCalledWith("/api/credentials/demo", {
      method: "DELETE",
    });
  });

  it("verifies through POST and reports a rejected key", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ ok: false, message: "The host answered 403." }),
          { status: 200 },
        ),
      );

    expect(await verifyCredential("demo", { fetch: fetcher })).toEqual({
      ok: false,
      message: "The host answered 403.",
    });
    expect(fetcher).toHaveBeenCalledWith("/api/credentials/demo/verify", {
      method: "POST",
    });
  });
});
