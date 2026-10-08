// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { PublishControl } from "./publish-control.js";
import type { EditorActionFacade } from "./session-facade.js";
import { HostingStore } from "./shell-layout.js";

const token = "t".repeat(43);
const EXPIRES = "2026-10-08T00:00:00.000Z";
const ADDRESS = "192.168.1.42";
const PORT = 5227;

// Base UI's popover needs two browser APIs jsdom has none of: floating-ui
// observes its anchor, and the popup waits for its own open transition before
// reporting itself open. Without them the press below never settles.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];

// jsdom's selector engine cannot answer `:modal`/`:popover-open`, and
// floating-ui asks for both on every position. Each unanswerable call costs
// ~0.5s of selector parsing, which turns one open into tens of seconds. Real
// browsers answer both.
beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

/** A session that answers only what the surface asks it. The two methods are
 *  the whole of this control's conversation with the document; the other
 *  twenty are the shell's and are not reachable from here. */
function sessionShowing(
  document: { readonly id: string; readonly name: string } | undefined,
): EditorActionFacade {
  return {
    publishableDocument: () =>
      document === undefined
        ? undefined
        : {
            id: document.id,
            envelope: {
              id: document.id,
              artboard: { width: 1920, height: 1080 },
              metadata: { name: document.name },
            },
          },
    subscribeDocumentChange: () => () => undefined,
  } as unknown as EditorActionFacade;
}

/**
 * A host whose state actually **moves**.
 *
 * The stub this replaced answered every `/api/hosting` request — the PUT
 * included — with the same body, so the host never changed and no test could
 * tell "opened the surface" from "moved the host". That is exactly the
 * difference the trigger is not allowed to blur, so the PUT here rebinds and
 * every read after it reports where the host landed.
 */
function hostServing(options: {
  readonly lan: boolean;
  readonly address?: string;
  readonly port?: number;
  /** Refuse the PUT itself, in the host's own words. */
  readonly refuse?: string;
  /** Accept the PUT and move nothing, leaving the refusal to arrive on the read
   *  that follows — the shape `vg-173` gives a host that cannot rebind while
   *  its answer is still on the socket. */
  readonly refusalAfterPut?: string;
}): { readonly putCalls: () => number } {
  const where = options.address ?? ADDRESS;
  const at = options.port ?? PORT;
  let lan = options.lan;
  let refusal: string | null = null;
  let puts = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/pairing/sessions")) {
        return new Response(
          JSON.stringify({ session: { token, expiresAt: EXPIRES } }),
          { status: 201 },
        );
      }

      if (init?.method === "PUT") {
        puts += 1;
        if (options.refuse !== undefined) {
          return new Response(options.refuse, { status: 409 });
        }
        if (options.refusalAfterPut === undefined) {
          lan = (JSON.parse(String(init.body)) as { lan: boolean }).lan;
        } else {
          refusal = options.refusalAfterPut;
        }
      }

      return new Response(
        JSON.stringify({
          lan,
          address: lan ? where : null,
          port: lan ? at : null,
          refusal,
          sessions: [],
        }),
        { status: 200 },
      );
    }),
  );

  return { putCalls: () => puts };
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

/** Base UI portals the popover to `body`, outside the mount point, so this is
 *  what removes the surface a test just read. */
function teardown(): void {
  if (root !== undefined) act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  for (const stray of document.querySelectorAll(".editor-shell-positioner")) {
    stray.remove();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  teardown();
});

/** The control as the header mounts it. `createRoot` rather than
 *  `@testing-library/react`, which this workspace does not depend on. The store
 *  asks the host on construction, so the fetch stub is already in place. */
async function mount(session?: EditorActionFacade): Promise<HTMLDivElement> {
  const mounted = document.createElement("div");
  host = mounted;
  document.body.append(mounted);
  const created = createRoot(mounted);
  root = created;
  const hosting = new HostingStore();
  await act(async () =>
    created.render(<PublishControl session={session} hosting={hosting} />),
  );
  await vi.waitFor(() =>
    expect(mounted.querySelector("[data-vigilia-publish]")).not.toBeNull(),
  );
  return mounted;
}

/** The same control mounted afresh, which is what a reloaded editor does. The
 *  surface reads the host once when it is built, so a *new* answer is read by a
 *  *new* store behind a *new* control. */
async function remount(): Promise<HTMLDivElement> {
  teardown();
  return mount();
}

/** The bar's own control. Everything else on this surface is behind it. */
function headerControl(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-vigilia-publish]");
}

/** The host switch, which is the popover's and never the bar's. */
function hostSwitch(): HTMLElement | null {
  return document.querySelector("[data-vigilia-host-switch]");
}

/** The press that opens the surface. */
async function openSurface(container: HTMLElement): Promise<void> {
  await act(async () => headerControl(container)?.click());
  await vi.waitFor(() => expect(popupOpen()).toBe(true));
}

/** The popover's own text. It is portalled to `body`, so the mount point's own
 *  `textContent` holds none of it. */
function popupText(): string {
  return (
    document.querySelector(".editor-shell-publish-popup")?.textContent ?? ""
  );
}

/** Whether the popover is showing. The popup is not in the DOM at all until it
 *  is asked for, so its presence and its `data-open` are the same answer. */
function popupOpen(): boolean {
  return (
    document.querySelector(".editor-shell-publish-popup[data-open]") !== null
  );
}

it("opens the surface without moving the host, and keeps every fact behind the press", async () => {
  const fake = hostServing({ lan: true });
  const container = await mount();

  // The bar is the control and nothing else: no code, no code symbol sat beside
  // it, and nothing open. The whole surface is behind the press.
  expect(popupOpen()).toBe(false);
  expect(container.querySelector("code")).toBeNull();
  expect(container.querySelector("[data-vigilia-qr]")).toBeNull();
  expect(headerControl(container)?.textContent).toBe(uiCopy.publish.start);
  expect(hostSwitch()).toBeNull();

  // **The press is free of side effects.** This is the whole of F1: an author
  // presenting a theme presses to read the phone address, and a control that
  // stopped the session to show it would have lost the fact it was asked for.
  await openSurface(container);
  expect(fake.putCalls()).toBe(0);

  expect(hostSwitch()?.getAttribute("aria-pressed")).toBe("true");
  expect(popupText()).toContain(`http://${ADDRESS}:${PORT}`);
  expect(popupText()).toContain(uiCopy.publish.expires(EXPIRES));
});

it("turns the host on from inside the surface, and shows what it is serving", async () => {
  const fake = hostServing({ lan: false });
  const container = await mount();
  await openSurface(container);

  // A loopback host has nothing to pair with, so the switch is the only thing
  // offered and the facts are absent rather than empty.
  expect(hostSwitch()?.textContent).toBe(uiCopy.publish.start);
  expect(hostSwitch()?.getAttribute("aria-pressed")).toBe("false");
  expect(popupText()).not.toContain("http://");

  await act(async () => hostSwitch()?.click());

  await vi.waitFor(() =>
    expect(hostSwitch()?.getAttribute("aria-pressed")).toBe("true"),
  );
  expect(fake.putCalls()).toBe(1);
  // The move does not shut the surface: the facts appear where the choice was
  // made, rather than behind a second press.
  expect(popupOpen()).toBe(true);
  expect(popupText()).toContain(`http://${ADDRESS}:${PORT}`);
  expect(
    document.querySelector("[data-vigilia-qr]")?.getAttribute("aria-label"),
  ).toBe(`QR code: http://${ADDRESS}:${PORT}/?session=${token}`);
});

it("binds the §145 warning to the control that makes the choice", async () => {
  hostServing({ lan: false });
  const container = await mount();
  await openSurface(container);

  // The switch offers to publish, which says nothing about what that costs.
  // Without this the warning is on the surface for a sighted reader only. The
  // attribute is asserted before it is used as a selector, so dropping it fails
  // here rather than as `'' is not a valid selector` from the query below.
  const describedBy = hostSwitch()?.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
    uiCopy.publish.warning,
  );
  // And the opener is not the control it describes: opening costs nothing, so
  // it carries no warning.
  expect(headerControl(container)?.getAttribute("aria-describedby")).toBeNull();
});

it("shows the host's own reason when it refuses the interface", async () => {
  hostServing({
    lan: false,
    refuse: "Port 5227 is not free on 0.0.0.0: EADDRINUSE",
  });
  const container = await mount();
  await openSurface(container);

  // `act` because the click starts a state update; without it React has not
  // re-rendered by the time the assertion runs.
  await act(async () => hostSwitch()?.click());

  await vi.waitFor(() => expect(popupText()).toContain("EADDRINUSE"));
  // The state it asked for never arrived, so the switch still offers to start.
  expect(hostSwitch()?.textContent).toBe(uiCopy.publish.start);
  expect(hostSwitch()?.getAttribute("aria-pressed")).toBe("false");
});

it("shows the host's refusal when the move it accepted did not happen", async () => {
  // A PUT answers 200 with the state the host had *before* it moved — it has
  // to, because it cannot rebind while that answer is still on its socket
  // (vg-173). So a refusal arrives on the read that follows, in the host's own
  // words, and the switch ends up showing them rather than the state it asked
  // for.
  hostServing({
    lan: false,
    refusalAfterPut: "Port 5227 is not free on 0.0.0.0: EADDRINUSE",
  });
  const container = await mount();
  await openSurface(container);

  await act(async () => hostSwitch()?.click());

  await vi.waitFor(() => expect(popupText()).toContain("EADDRINUSE"));
  // The refusal is shown inside the surface that is already open, so nothing
  // has to be pressed again to read it.
  expect(popupOpen()).toBe(true);
  expect(hostSwitch()?.textContent).toBe(uiCopy.publish.start);
});

it("shows the address the host named, with a code for it", async () => {
  hostServing({ lan: true });
  const container = await mount();
  await openSurface(container);

  await vi.waitFor(() =>
    expect(popupText()).toContain(`http://${ADDRESS}:${PORT}`),
  );
  expect(
    document.querySelector("[data-vigilia-qr]")?.getAttribute("aria-label"),
  ).toBe(`QR code: http://${ADDRESS}:${PORT}/?session=${token}`);
  expect(popupText()).toContain(uiCopy.publish.warning);
});

it("takes the address apart again when the host answers with a new one", async () => {
  hostServing({ lan: true });
  const container = await mount();
  await openSurface(container);
  await vi.waitFor(() =>
    expect(popupText()).toContain(`http://${ADDRESS}:${PORT}`),
  );

  hostServing({ lan: true, address: "192.168.1.99" });
  const reloaded = await remount();
  await openSurface(reloaded);

  await vi.waitFor(() =>
    expect(popupText()).toContain("http://192.168.1.99:5227"),
  );
  expect(popupText()).not.toContain(`http://${ADDRESS}:${PORT}`);
});

it("names the document a display is showing, because a live overlay is invisible", async () => {
  hostServing({ lan: true });
  const container = await mount(
    sessionShowing({ id: "living-room", name: "Living room" }),
  );
  await openSurface(container);

  await vi.waitFor(() =>
    expect(popupText()).toContain(uiCopy.publish.live("Living room")),
  );
});

it("says what is left to do for a theme the library does not hold", async () => {
  hostServing({ lan: true });
  const container = await mount(sessionShowing(undefined));
  await openSurface(container);

  // Publishing carries the document's assets from its own folder, so a theme
  // that was never saved has nothing to publish — and the surface says so
  // rather than offering a display a theme with holes in it.
  await vi.waitFor(() => expect(popupText()).toContain(uiCopy.publish.unsaved));
});
