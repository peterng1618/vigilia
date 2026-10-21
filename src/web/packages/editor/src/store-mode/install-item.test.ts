import { expect, it } from "vitest";
import { installItem } from "./install-item.js";
import { fixtureItem } from "./item-fixture.js";
import type { CatalogueFacts } from "./local-source.js";

/** One online item: catalogue facts are what make it installable. */
const ITEM = fixtureItem(
  { id: "office-wall", name: "Office wall", version: "1.3.0" },
  {
    id: "office-wall",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
    downloads: 42,
    favorites: 7,
    packageUrl: "https://store.test/office-wall.zip",
    installedVersion: undefined,
  } satisfies CatalogueFacts,
);

/**
 * **The browser posts the four facts and reads no bytes** (`docs/decisions/0089`):
 * the host owns the download, so the request carries only what names the item —
 * the package address, the catalogue's id, the version and the kind.
 */
it("posts the item to the host's install route", async () => {
  const calls: {
    readonly url: string;
    readonly init: RequestInit | undefined;
  }[] = [];
  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true, id: "office-wall" }), {
      status: 200,
    });
  }) as unknown as typeof fetch;

  const outcome = await installItem(ITEM, { fetch: fetchStub });

  expect(outcome).toEqual({ ok: true });
  expect(calls).toHaveLength(1);
  expect(
    calls[0]?.url,
    "the install reaches a route the host does not serve",
  ).toBe("/api/themes/install");
  expect(calls[0]?.init?.method).toBe("POST");
  expect(
    calls[0]?.init?.headers,
    "the host cannot read a body that is not declared as JSON",
  ).toEqual({ "content-type": "application/json" });
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
    packageUrl: "https://store.test/office-wall.zip",
    catalogueId: "office-wall",
    version: "1.3.0",
    kind: "dashboard-theme",
  });
});

/**
 * **A refusal is the host's own sentence, unchanged** — the same rule
 * `theme-import.ts` follows. The host is the owner that downloaded and read the
 * package, so its words name which part failed; a sentence composed here would
 * hide that. The status is not carried, because nothing in the UI acts on it.
 */
it("carries the host's refusal out unchanged", async () => {
  const outcome = await installItem(ITEM, {
    fetch: (async () =>
      new Response("That package is not a theme.", {
        status: 400,
      })) as unknown as typeof fetch,
  });

  expect(outcome).toEqual({
    ok: false,
    message: "That package is not a theme.",
  });
});

/** A refusal with no body still says the host refused, rather than answering an
 *  empty string the surface would draw as a blank line. */
it("states the refusal when the host sends no sentence", async () => {
  const outcome = await installItem(ITEM, {
    fetch: (async () =>
      new Response("", { status: 502 })) as unknown as typeof fetch,
  });

  expect(outcome).toEqual({
    ok: false,
    message: "The host refused the install (502).",
  });
});
