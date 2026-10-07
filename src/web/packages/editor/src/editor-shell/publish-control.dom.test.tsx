// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { PublishControl } from "./publish-control.js";

const token = "t".repeat(43);

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

afterEach(() => {
  vi.unstubAllGlobals();
  if (root !== undefined) act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
});

/** The control as the header mounts it. `createRoot` rather than
 *  `@testing-library/react`, which this workspace does not depend on. */
async function mount(): Promise<HTMLDivElement> {
  const mounted = document.createElement("div");
  host = mounted;
  document.body.append(mounted);
  const created = createRoot(mounted);
  root = created;
  await act(async () => created.render(<PublishControl />));
  return mounted;
}

/** The same control mounted afresh, which is what a reloaded editor does. The
 *  surface reads the host once when it appears, so a *new* answer is read by a
 *  *new* control — `rerender` of the same tree would re-run no effect. */
async function remount(): Promise<HTMLDivElement> {
  if (root !== undefined) await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  return mount();
}

it("renders nothing when this host is not on the LAN", async () => {
  hostAnswers({ lan: false, address: null, port: null, sessions: [] });
  const container = await mount();

  await vi.waitFor(() => expect(container.firstChild).toBeNull());
});

it("shows the address the host named, with a code for it", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  const container = await mount();

  await vi.waitFor(() =>
    expect(container.textContent).toContain("http://192.168.1.42:5227"),
  );
  expect(
    container.querySelector("[data-vigilia-qr]")?.getAttribute("aria-label"),
  ).toBe(`QR code: http://192.168.1.42:5227/?session=${token}`);
  expect(container.textContent).toContain(uiCopy.publish.warning);
});

it("takes the address apart again when the host answers with a new one", async () => {
  hostAnswers({ lan: true, address: "192.168.1.42", port: 5227, sessions: [] });
  const first = await mount();
  await vi.waitFor(() =>
    expect(first.textContent).toContain("http://192.168.1.42:5227"),
  );

  hostAnswers({ lan: true, address: "192.168.1.99", port: 5227, sessions: [] });
  const second = await remount();

  await vi.waitFor(() =>
    expect(second.textContent).toContain("http://192.168.1.99:5227"),
  );
  expect(second.textContent).not.toContain("http://192.168.1.42:5227");
});
