// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

/**
 * `vg-190`: a rejection arriving after the scene mounted calls
 * `showLoadFailure`, which replaces the whole document and discards a display
 * that was already drawn. Ruled 2026-10-14: the replacement is intended — a
 * display that says it is broken beats one showing stale art — so what this
 * case pins is the behaviour, not a fix to it.
 *
 * The row stayed open on its own measurement debt: of the three calls
 * `startHostedTheme` makes after `mountFabricScene`, which can actually reject
 * was unmeasured. Read, they are:
 *
 * - `loadFontAssets` cannot. `font-assets.ts` routes every failure — no
 *   `FontFace` API, missing bytes, missing metadata, a face that will not load —
 *   to `options.onError(...)` and carries on, which is what `reportFontError`'s
 *   own comment says is deliberate.
 * - `refresh` cannot. It is `(): void` and synchronous, so it holds no promise
 *   to reject.
 * - `reviveThemeEnvelope` can, and it is the only one.
 *   `assertFabricThemeEnvelopeCompatible` runs before the first `await` inside
 *   it, so a theme pinned to another Fabric runtime throws inside an `async`
 *   function — a rejected promise, which the `catch` around the display's whole
 *   lifetime turns into `showLoadFailure`.
 *
 * This case drives that path through the real `main.ts`, which has no other
 * test. The refusal is `assertFabricThemeEnvelopeCompatible`'s own: the
 * envelope is served, validated and accepted, and only the mounted scene's
 * revival refuses it. Stubbing `reviveThemeEnvelope` to reject would prove a
 * `catch` is wired and nothing about which call can fail.
 */

const THEME_ID = "late-rejection";

/** The document `index.html` ships, in its own order: the top band, the artboard
 *  host, then the bottom band. All three, so "the body was replaced" is a claim
 *  about the shipped document rather than about the elements built here. */
function skeleton(): HTMLElement {
  document.body.replaceChildren();
  const top = document.createElement("div");
  top.id = "vigilia-chrome-top";
  top.dataset["vigiliaChrome"] = "top";
  const host = document.createElement("div");
  host.id = "artboard";
  Object.defineProperty(host, "clientWidth", { value: 412 });
  Object.defineProperty(host, "clientHeight", { value: 839 });
  const bottom = document.createElement("div");
  bottom.id = "vigilia-chrome-bottom";
  bottom.dataset["vigiliaChrome"] = "bottom";
  document.body.append(top, host, bottom);
  return host;
}

/**
 * Valid to `validateFabricThemeEnvelope` — which pins only the shape of
 * `fabricVersion`, never the runtime — so the host serves it and the player
 * accepts it. Only the mount's own compatibility check refuses it.
 */
function servedEnvelope(): unknown {
  return {
    schemaVersion: 2,
    fabricVersion: "0.0.1",
    id: "living-room",
    artboard: { width: 1920, height: 1080 },
    metadata: { themeLanguage: "en" },
    scene: { version: "0.0.1", objects: [] },
  };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** The readings stream. A stub transport, so no socket is opened; the path
 *  under test is the document load, not the live source. */
class SilentEventSource {
  addEventListener(): void {}
  close(): void {}
}

describe("a rejection that arrives after the scene mounted", () => {
  it("replaces the display that was already drawn", async () => {
    const host = skeleton();
    history.replaceState({}, "", `/?theme=${THEME_ID}`);
    vi.stubGlobal("EventSource", SilentEventSource);
    Object.defineProperty(window, "fetch", {
      configurable: true,
      writable: true,
      value: vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/document") ? json(servedEnvelope()) : json({}),
      ),
    });
    const warned = vi.spyOn(console, "warn").mockImplementation(() => {});

    // `main.ts` runs on import, so the DOM above has to exist first.
    await import("./main.js");
    await vi.waitFor(
      () => {
        expect(
          document.querySelector("[data-vigilia-load-failure]"),
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );

    // The refusal is the real one. Nothing here mocks `reviveThemeEnvelope` or
    // anything else `@vigilia/scene-fabric` exports; the only stubs are the
    // network (`fetch`, `EventSource`).
    expect(
      warned.mock.calls.find(
        ([, error]) =>
          error instanceof Error &&
          /incompatible with this runtime/.test(error.message),
      ),
      "the rejection must be the compatibility check's own, not a stubbed one",
    ).toBeDefined();

    // The display was mounted and had its canvas before that rejection landed —
    // without this the case would be an early failure wearing a late one's name.
    // The assertion establishes that the canvas *existed*, not that it existed
    // before the refusal; the discrimination between an early and a late refusal
    // comes from the deliberate break (hoisting the check above the mount), not
    // from this assertion.
    expect(
      host.querySelector('canvas[data-vigilia="artboard"]'),
      "the scene never mounted, so this is not the post-mount path",
    ).not.toBeNull();

    // And the failure document is what the page shows instead: the artboard,
    // its chrome and the mounted scene are all gone.
    expect(host.isConnected).toBe(false);
    expect(document.getElementById("vigilia-chrome-top")).toBeNull();
    expect(document.getElementById("vigilia-chrome-bottom")).toBeNull();
    expect(
      document.querySelector("[data-vigilia-load-failure]")?.parentElement,
    ).toBe(document.body);
  });
});
