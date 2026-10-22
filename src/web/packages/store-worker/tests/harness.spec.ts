import { env, SELF } from "cloudflare:test";
import { expect, it } from "vitest";

it("answers health and reaches the D1 binding", async () => {
  const response = await SELF.fetch("https://store.test/api/health");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM item").first();
  expect(row).toEqual({ n: 0 });
});
