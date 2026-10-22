import { env, SELF } from "cloudflare:test";
import type { TestHelpers } from "better-auth/plugins";
import { beforeAll, describe, expect, it } from "vitest";
import { createAuth } from "../src/auth";

const BASE = "https://store.test";
const LOOPBACK = encodeURIComponent("http://127.0.0.1:5173");

describe("auth", () => {
  beforeAll(async () => {
    // Twice, because the owner may re-run `/migrate` on an already migrated D1.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const migrated = await SELF.fetch(`${BASE}/migrate`, {
        method: "POST",
        headers: { "x-migrate-token": "test-migrate" },
      });
      expect(migrated.status).toBe(200);
    }
  });

  it("refuses a missing or forged bearer session", async () => {
    expect((await SELF.fetch(`${BASE}/api/me`)).status).toBe(401);
    expect(
      (
        await SELF.fetch(`${BASE}/api/me`, {
          headers: { authorization: "Bearer forged.token" },
        })
      ).status,
    ).toBe(401);
  });

  it("accepts a real test session", async () => {
    const auth = createAuth(env);
    const test = ((await auth.$context) as unknown as { test: TestHelpers })
      .test;
    const user = await test.saveUser(
      test.createUser({ email: "a@example.com" }),
    );
    const { headers, cookies } = await test.login({ userId: user.id });
    const answered = await SELF.fetch(`${BASE}/api/me`, { headers });
    expect(answered.status).toBe(200);
    const body = (await answered.json()) as Record<string, unknown>;
    expect(body).toEqual({ userId: user.id, email: "a@example.com" });
    expect(Object.keys(body)).toHaveLength(2);

    // The host sends the signed session token, not a cookie; the same token the
    // test helper signed must authenticate.
    const signed = cookies[0]?.value;
    expect(signed).toBeDefined();
    expect(
      (
        await SELF.fetch(`${BASE}/api/me`, {
          headers: { authorization: `Bearer ${signed}` },
        })
      ).status,
    ).toBe(200);
  });

  it("answers a missing or wrong migrate token with 404 and 403", async () => {
    expect(
      (await SELF.fetch(`${BASE}/migrate`, { method: "POST" })).status,
    ).toBe(404);
    expect(
      (
        await SELF.fetch(`${BASE}/migrate`, {
          method: "POST",
          headers: { "x-migrate-token": "wrong" },
        })
      ).status,
    ).toBe(403);
  });

  it("starts a social sign-in at the provider", async () => {
    const started = await SELF.fetch(
      `${BASE}/auth/start?provider=github&host=${LOOPBACK}&state=opaque`,
      { redirect: "manual" },
    );
    expect(started.status).toBe(302);
    const location = started.headers.get("location") ?? "";
    expect(
      location.startsWith("https://github.com/login/oauth/authorize"),
    ).toBe(true);
    expect(location).toContain("state=");
    expect(
      (
        await SELF.fetch(
          `${BASE}/auth/start?provider=gitlab&host=${LOOPBACK}&state=opaque`,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await SELF.fetch(
          `${BASE}/auth/start?provider=github&host=${encodeURIComponent("https://evil.example")}&state=opaque`,
        )
      ).status,
    ).toBe(400);
  });

  it("serves the return page only for a loopback host", async () => {
    expect(
      (
        await SELF.fetch(
          `${BASE}/auth/return?host=${encodeURIComponent("http://evil.example:80")}&state=a`,
        )
      ).status,
    ).toBe(400);
    const page = await SELF.fetch(
      `${BASE}/auth/return?host=${LOOPBACK}&state=a`,
    );
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    const html = await page.text();
    expect(html).toContain("/api/auth/one-time-token/generate");
  });
});
