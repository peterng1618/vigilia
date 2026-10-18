import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./service-worker.js";

/** `navigator` is stubbed rather than injected: the module reads the browser's
 *  own container, and a parameter that only a test ever passes is a seam the
 *  production code does not need. */

describe("the display's service worker registration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing where the browser has no service worker at all", () => {
    vi.stubGlobal("navigator", {});

    expect(() => registerServiceWorker()).not.toThrow();
  });

  it("registers the host's root script, which is what gives it the player's scope", () => {
    const register = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { serviceWorker: { register } });

    registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("leaves the display running when the browser refuses the registration", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("navigator", {
      serviceWorker: {
        register: vi.fn(async () => {
          throw new Error("SecurityError: refused");
        }),
      },
    });

    registerServiceWorker();
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });
});
