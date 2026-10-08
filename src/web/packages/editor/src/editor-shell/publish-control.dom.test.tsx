// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { PublishControl } from "./publish-control.js";
import type { EditorActionFacade } from "./session-facade.js";
import { HostingStore } from "./shell-layout.js";

const token = "t".repeat(43);

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

/** The host's two answers: where it is, and a display credential when the LAN
 *  is on. Which path is asked decides which body comes back. */
function hostAnswers(hosting: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).startsWith("/api/hosting")
        ? new Response(JSON.stringify(hosting), { status: 200 })
        : new Response(
            JSON.stringify({
              session: { token, expiresAt: "2026-10-08T00:00:00.000Z" },
            }),
            { status: 201 },
          ),
    ),
  );
}

let root: Root | undefined;
let host: HTMLDivElement | undefined;

/** Base UI portals the popover to `body`, outside the mount point, and keeps it
 *  mounted while closed — so this is what removes the surface a test just read. */
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
  return mounted;
}

/** The same control mounted afresh, which is what a reloaded editor does. The
 *  surface reads the host once when it is built, so a *new* answer is read by a
 *  *new* store behind a *new* control. */
async function remount(): Promise<HTMLDivElement> {
  teardown();
  return mount();
}

/** The popover's own text. It is portalled to `body`, so the mount point's own
 *  `textContent` holds none of it. */
function popupText(): string {
  return (
    document.querySelector(".editor-shell-publish-popup")?.textContent ?? ""
  );
}

/** Whether the popover is showing. `keepMounted` leaves it in the DOM while it
 *  is shut, so the class alone is not the answer — `data-open` is. */
function popupOpen(): boolean {
  return (
    document.querySelector(".editor-shell-publish-popup[data-open]") !== null
  );
}

it("closes the pairing surface behind one control rather than repeating it in the bar", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  const container = await mount();
  await vi.waitFor(() =>
    expect(container.querySelector("button")).not.toBeNull(),
  );
  const trigger = container.querySelector("button");
  await vi.waitFor(() =>
    expect(trigger?.getAttribute("aria-pressed")).toBe("true"),
  );

  // The bar is the control and nothing else: no code, no code symbol sat beside
  // it, and nothing open. The whole surface is behind the press.
  expect(container.querySelector("code")).toBeNull();
  expect(container.querySelector("[data-vigilia-qr]")).toBeNull();
  expect(trigger?.textContent).toBe(uiCopy.publish.stop);
  expect(popupOpen()).toBe(false);

  // And the press opens it, address and expiry together on one surface.
  await act(async () => trigger?.click());
  await vi.waitFor(() => expect(popupOpen()).toBe(true));
  expect(popupText()).toContain("http://192.168.1.42:5227");
  expect(popupText()).toContain(
    uiCopy.publish.expires("2026-10-08T00:00:00.000Z"),
  );
});

it("offers to serve the LAN, and says what that costs before it does", async () => {
  hostAnswers({ lan: false, address: null, port: null, sessions: [] });
  const container = await mount();

  await vi.waitFor(() =>
    expect(popupText()).toContain(uiCopy.publish.warning),
  );

  const button = container.querySelector("button");
  expect(button?.textContent).toBe(uiCopy.publish.start);
  expect(button?.getAttribute("aria-pressed")).toBe("false");

  // The button *offers* to publish, which says nothing about what that costs.
  // Without this the warning is on the surface for a sighted reader only. The
  // attribute is asserted before it is used as a selector, so dropping it fails
  // here rather than as `'' is not a valid selector` from the query below. The
  // popover is kept mounted so the element the button is described by exists
  // before the choice is made.
  const describedBy = button?.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
    uiCopy.publish.warning,
  );
});

it("shows the host's own reason when it refuses the interface", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/hosting")
        return new Response("", { status: 404 });
      if (init?.method === "PUT") {
        return new Response("Port 5227 is not free on 0.0.0.0: EADDRINUSE", {
          status: 409,
        });
      }
      return new Response(
        JSON.stringify({ lan: false, address: null, port: null, sessions: [] }),
      );
    }),
  );

  const container = await mount();
  await vi.waitFor(() =>
    expect(popupText()).toContain(uiCopy.publish.warning),
  );

  // `act` because the click starts a state update; without it React has not
  // re-rendered by the time the assertion runs.
  await act(async () => container.querySelector("button")?.click());

  await vi.waitFor(() => expect(popupText()).toContain("EADDRINUSE"));
});

it("shows the host's refusal when the move it accepted did not happen", async () => {
  // A PUT answers 200 with the state the host had *before* it moved — it has
  // to, because it cannot rebind while that answer is still on its socket
  // (vg-173). So a refusal arrives on the read that follows, in the host's own
  // words, and the button ends up showing them rather than the state it asked
  // for.
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) !== "/api/hosting") {
        return new Response("", { status: 404 });
      }

      if (init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            lan: false,
            address: null,
            port: null,
            refusal: null,
            sessions: [],
          }),
        );
      }

      reads += 1;
      return new Response(
        JSON.stringify({
          lan: false,
          address: null,
          port: null,
          refusal:
            reads === 1 ? null : "Port 5227 is not free on 0.0.0.0: EADDRINUSE",
          sessions: [],
        }),
      );
    }),
  );

  const container = await mount();
  await vi.waitFor(() =>
    expect(popupText()).toContain(uiCopy.publish.warning),
  );

  const button = container.querySelector("button");
  await act(async () => button?.click());

  await vi.waitFor(() => expect(popupText()).toContain("EADDRINUSE"));
  // The state it asked for never arrived, so the control still offers to start.
  expect(button?.textContent).toBe(uiCopy.publish.start);
  expect(button?.getAttribute("aria-pressed")).toBe("false");
});

it("shows the address the host named, with a code for it", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  await mount();

  await vi.waitFor(() =>
    expect(popupText()).toContain("http://192.168.1.42:5227"),
  );
  expect(
    document
      .querySelector("[data-vigilia-qr]")
      ?.getAttribute("aria-label"),
  ).toBe(`QR code: http://192.168.1.42:5227/?session=${token}`);
  expect(popupText()).toContain(uiCopy.publish.warning);
});

it("takes the address apart again when the host answers with a new one", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  await mount();
  await vi.waitFor(() =>
    expect(popupText()).toContain("http://192.168.1.42:5227"),
  );

  hostAnswers({ lan: true, address: "192.168.1.99", port: 5227, sessions: [] });
  await remount();

  await vi.waitFor(() =>
    expect(popupText()).toContain("http://192.168.1.99:5227"),
  );
  expect(popupText()).not.toContain("http://192.168.1.42:5227");
});

it("names the document a display is showing, because a live overlay is invisible", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  await mount(sessionShowing({ id: "living-room", name: "Living room" }));

  await vi.waitFor(() =>
    expect(popupText()).toContain(uiCopy.publish.live("Living room")),
  );
});

it("says what is left to do for a theme the library does not hold", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  await mount(sessionShowing(undefined));

  // Publishing carries the document's assets from its own folder, so a theme
  // that was never saved has nothing to publish — and the surface says so
  // rather than offering a display a theme with holes in it.
  await vi.waitFor(() =>
    expect(popupText()).toContain(uiCopy.publish.unsaved),
  );
});
