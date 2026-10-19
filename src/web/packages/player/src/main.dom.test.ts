// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://192.168.1.10:5227/"}
// The re-find cases below need this LAN origin: `sweepAddresses("localhost")` is
// empty, so on the default jsdom origin the sweep is a no-op and both cases pass
// vacuously.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAIRING_STORAGE_KEY, readStoredPairing } from "./host-refind.js";

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

/**
 * The player's re-find, which is where the retry and the probe both live (R72).
 *
 * The follower reports every failed tick — a fact, not a policy — so four failed
 * ticks inside one cooldown must be one sweep rather than four, and a failed
 * sweep must be allowed another once the cooldown passes. Measured both ways:
 * with the cooldown removed this case sees 1265 requests (one sweep per tick,
 * plus the one the load started with), and with the retry removed it never sees
 * the second 253. Timers are faked because a cooldown of real seconds is a test
 * nobody would wait for.
 *
 * The credential case shares this harness, and has to live here rather than in
 * `host-refind.test.ts`: that file can only catch a mutation *inside* the
 * ladder, while the real risk is `main.ts` building its probe from
 * `session.fetch`/`withToken`, which the ladder's own tests never see (R63).
 *
 * It runs before the cases below because a jsdom file shares one window: a
 * display another case mounted is still holding real timers, and this case's
 * clock is what is under test.
 */
describe("the player's re-find", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    // The cases below drive `main.ts` through their own import, and a module
    // this case already evaluated would not run its start sequence again.
    vi.resetModules();
  });

  /** Microtasks only: the mount, the poll and the sweep are promises, and the
   *  fake clock is advanced explicitly where a timer is the point. */
  async function flush(): Promise<void> {
    for (let turn = 0; turn < 400; turn += 1) {
      await Promise.resolve();
    }
  }

  /** One request the player made, and the `init` it made it with: a credential
   *  rides in a header, so a case about the credential needs both halves. */
  interface Asked {
    readonly url: string;
    readonly init: RequestInit | undefined;
  }

  /** A request to another *address* on this /24, which is what the sweep is. The
   *  ladder's two known candidates are this page's own address and the host's
   *  name, so neither is counted, and one ladder run makes exactly 253 of these
   *  — the number `sweepAddresses` gives. The page is at a LAN address rather
   *  than a name because a name has no /24 to sweep, and the display this task
   *  is for is the one whose URL is one. */
  function isSweptAddress(url: string): boolean {
    const target = new URL(url, window.location.href);
    return (
      target.origin !== window.location.origin &&
      /^\d+\.\d+\.\d+\.\d+$/.test(target.hostname)
    );
  }

  /** Mounts a paired display whose host has moved: every poll fails, so every
   *  tick reports it and the ladder runs. */
  async function mountWithTheHostGone(): Promise<{ readonly asked: Asked[] }> {
    // The display this case mounts gets no frames: a minute of fake time is
    // ~1900 repaints at the chart loop's rate, and every one of them is work
    // this case is not about. `window`'s own pair, because the chart loop binds
    // those rather than the globals `vi.stubGlobal` replaces — and stubbing the
    // globals alone left the case at 17 s of a 20 s budget.
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
    vi.useFakeTimers();
    skeleton();
    history.replaceState(
      {},
      "",
      "/?theme=living-room&display=d1&theme-source=map&session=paired-token",
    );
    vi.stubGlobal("EventSource", SilentEventSource);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );

    const asked: Asked[] = [];

    Object.defineProperty(window, "fetch", {
      configurable: true,
      writable: true,
      value: vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        asked.push({ url, init });

        if (url === "/api/host") {
          return json({ id: "h1", name: "study-pc", port: 5227 });
        }
        // The host has moved: every poll fails, so every tick reports it.
        if (url.startsWith("/api/published")) {
          throw new Error("down");
        }
        if (url.endsWith("/document")) return json(mountedEnvelope());
        if (url === "/api/themes") return json({ themes: [] });
        // Any swept address: a host that is not this display's.
        return json({});
      }),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await import("./main.js");
    await flush();

    return { asked };
  }

  /** One failed tick, and the microtasks its report sets off: the sweep is 253
   *  promises deep, so the clock cannot be advanced in one block without
   *  starving it — and a sweep still in flight is a sweep the next tick is
   *  meant to leave alone. */
  async function failedTick(): Promise<void> {
    await vi.advanceTimersByTimeAsync(2_000);
    await flush();
  }

  it("sweeps once per cooldown, not once per failed tick", async () => {
    const { asked } = await mountWithTheHostGone();
    const swept = (): number =>
      asked.filter(({ url }) => isSweptAddress(url)).length;

    expect(swept()).toBe(253);

    // Four failed ticks inside the cooldown are one sweep, not four.
    for (let tick = 0; tick < 4; tick += 1) {
      await failedTick();
    }

    expect(swept()).toBe(253);

    // Past the cooldown a failed tick is allowed another, which is the retry a
    // latch in the follower could never give this display. One advance, because
    // no sweep is in flight here: every tick in the window is blocked by the
    // cooldown until the first one that is not, and that one sweeps.
    await vi.advanceTimersByTimeAsync(62_000);
    await flush();

    expect(swept()).toBe(506);
  });

  it("sends no credential to a swept address", async () => {
    const { asked } = await mountWithTheHostGone();

    // The sweep has to have happened, or the case below is vacuous. It has by
    // the time the mount returns: the follower polls once on start, that tick
    // fails, and `onUnreachable` runs the ladder.
    const swept = asked.filter(({ url }) => isSweptAddress(url));

    expect(swept.length).toBeGreaterThan(0);

    // `/api/host` is unauthenticated and CORS `*`, so the probe needs no
    // credential — and a probe built from `session.fetch`/`withToken` would
    // offer this display's token to every address that answers, which is the
    // opposite of what the stored `hostId` is for (R63).
    const offenders = swept
      .filter(
        ({ url, init }) =>
          url.includes("session") ||
          new Headers(init?.headers).has("x-vigilia-session"),
      )
      .map(({ url }) => url);

    expect(offenders).toEqual([]);
  });
});

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

/** Valid to the compatibility check, so the display mounts whole and reaches
 *  the point where its chrome is built. */
function mountedEnvelope(): unknown {
  return {
    schemaVersion: 2,
    fabricVersion: "7.4.0",
    id: "living-room",
    artboard: { width: 1920, height: 1080 },
    metadata: { themeLanguage: "en" },
    scene: { version: "7.4.0", objects: [] },
  };
}

/**
 * The chooser's mount condition, driven through the real `main.ts`.
 *
 * A link page's id is the person's instruction, and `reResolveUrl` keeps it
 * (`publish-follower.ts:60-62` drops `theme` only for `map`), so a chooser
 * mounted there would write the map and then reload onto the link's theme —
 * the control appearing to do nothing. The hop from a chosen id to
 * `reResolveUrl` is not asserted here: jsdom does not navigate, `reResolveUrl`
 * is unit-tested in `publish-follower.test.ts`, and the hop itself is the
 * Phase 4 gate's browser run.
 */
describe("the theme chooser's mount condition", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Mounts the player at `search` and waits until its chrome has been built,
   *  which is the point the chooser's condition is decided at. */
  async function mountAt(search: string): Promise<void> {
    skeleton();
    history.replaceState({}, "", `/${search}`);
    vi.stubGlobal("EventSource", SilentEventSource);
    // jsdom has no `ResizeObserver`, and the scene's re-fit observer is created
    // after the chrome: without a stub the display fails to start and the
    // failure page replaces the document this test is about.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    Object.defineProperty(window, "fetch", {
      configurable: true,
      writable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/document")) return json(mountedEnvelope());
        if (url === "/api/themes") {
          return json({ themes: [{ id: "living-room", name: "Living Room" }] });
        }
        return json({});
      }),
    });

    await import("./main.js");
    // The display's own diagnostics are not this test's news; the failure page
    // replacing the document would be, and the wait below catches that.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await vi.waitFor(
      () => {
        expect(
          document.querySelector("[data-vigilia-load-failure]"),
        ).toBeNull();
        expect(
          document.querySelector("[data-vigilia-controls]"),
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );
  }

  it("offers the chooser on a page the host resolved", async () => {
    await mountAt(
      "?theme=living-room&display=d1&theme-source=map&session=paired-token",
    );

    await vi.waitFor(() =>
      expect(
        document.querySelector("[data-vigilia-theme-chooser]"),
      ).not.toBeNull(),
    );
  });

  it("offers nothing on a link page, whose theme id is the person's instruction", async () => {
    // The map case leaves `window.vigilia` set, and `vi.resetModules()` clears
    // modules, not the window: without this the check below would read the
    // previous run's signal and prove nothing.
    Reflect.deleteProperty(window, "vigilia");
    // Paired, so the absence is the mount condition and not the missing token.
    await mountAt("?theme=living-room&theme-source=link&session=paired-token");

    // `mountAt` waits on the controls (`main.ts:186`), which mount before the
    // chooser's condition is decided (`:204`). `window.vigilia` is set at the
    // end of that same start sequence (`:245`), after the decision, so awaiting
    // it is what makes the absence below a fact about the decision rather than
    // about a wait that stopped short of it.
    const diagnostics = window as unknown as { readonly vigilia?: unknown };
    await vi.waitFor(() => expect(diagnostics.vigilia).toBeDefined());

    expect(document.querySelector("[data-vigilia-theme-chooser]")).toBeNull();
  });
});

/**
 * The record a load writes, driven through the real `main.ts`.
 *
 * The load itself writes a token-bearing record from the URL, so the assertion
 * is the **identity** — the half only `GET /api/host` can supply — and the wait
 * is on that rather than on the record existing, which would pass before the
 * call was even made. `localStorage` outlives `vi.resetModules()`, which clears
 * modules and not the window, so it is cleared first.
 */
describe("the pairing a load remembers", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("records the host's identity beside this load's own address", async () => {
    skeleton();
    history.replaceState({}, "", "/?theme=living-room&session=paired-token");
    vi.stubGlobal("EventSource", SilentEventSource);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    Object.defineProperty(window, "fetch", {
      configurable: true,
      writable: true,
      value: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/document")) return json(mountedEnvelope());
        if (url === "/api/host") {
          return json({ id: "h1", name: "study-pc", port: 5227 });
        }
        return json({});
      }),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // **Whether a write happened is a question only the key can answer, and here
    // it has to be counted rather than read.** `rememberPairing` writes the good
    // record over whatever is there, so the value below is the same whether or
    // not `displaySession` wrote an empty one first — a second writer leaves a
    // second write and no other trace (R72, R76).
    const writes = vi.spyOn(Storage.prototype, "setItem");

    await import("./main.js");
    await vi.waitFor(() =>
      expect(readStoredPairing(window.localStorage)?.hostId).toBe("h1"),
    );

    expect(readStoredPairing(window.localStorage)).toEqual({
      hostId: "h1",
      hostName: "study-pc",
      port: 5227,
      token: "paired-token",
      lastAddress: window.location.hostname,
    });

    expect(writes.mock.calls.map(([key]) => key)).toEqual([
      PAIRING_STORAGE_KEY,
    ]);
  });
});
