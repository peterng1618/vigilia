// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { DisplayLensId } from "../display-lens.js";
import type { ViewportManager } from "../viewport-manager/index.js";
import { DisplaySwitch } from "./display-switch.js";

/**
 * Every root this file renders, unmounted after each test.
 *
 * Base UI portals the popup to `document.body` and `keepMounted` keeps it
 * there, so a root left mounted leaves its menu in the document and the next
 * test's `querySelector` finds *that* one first — which reads as a control
 * ignoring the choice it was given.
 */
const mounted: Root[] = [];
afterEach(async () => {
  while (mounted.length > 0) {
    const root = mounted.pop();
    if (root !== undefined) await act(async () => root.unmount());
  }
});

function setup(display: DisplayLensId | undefined = "phone-landscape") {
  const showDisplay = vi.fn();
  const zoomToSelection = vi.fn();
  const reset = vi.fn();
  const listeners = new Set<() => void>();
  let zoom = 0.5;
  // A stub with every ViewportManager member and no `as never`: the cast would
  // erase a missing member, which is exactly the defect to catch.
  const viewport = {
    zoom: () => zoom,
    zoomToPoint: vi.fn(),
    zoomBy: vi.fn(),
    zoomToFit: vi.fn(),
    zoomToSelection,
    reset,
    panBy: vi.fn(),
    artboardScreenRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    display: () => display,
    showDisplay,
    displayScreenRect: () => undefined,
    resize: vi.fn(),
    onChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: vi.fn(),
  } satisfies ViewportManager;

  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  mounted.push(root);
  return {
    host,
    viewport,
    showDisplay,
    zoomToSelection,
    reset,
    render: () =>
      act(async () => root.render(<DisplaySwitch viewport={viewport} />)),
    setZoom(value: number): Promise<void> {
      return act(async () => {
        zoom = value;
        for (const listener of listeners) listener();
      });
    },
    setDisplay(value: DisplayLensId | undefined): Promise<void> {
      return act(async () => {
        display = value;
        for (const listener of listeners) listener();
      });
    },
  };
}

/** Base UI portals the popup to `body`, so the item is not under `host`;
 *  `keepMounted` keeps it in the document while the menu is closed. */
async function choose(label: string): Promise<void> {
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
      ?.click(),
  );
}

it("keeps reading the camera's zoom, because that readout is not this task's to remove", async () => {
  const { host, render, setZoom, setDisplay } = setup("phone-landscape");
  await render();
  // Not the display's name, under any choice: two browser tests pin this
  // control as the place the author reads the camera's scale, and a display is
  // chosen by default — so a name here would remove that capability on open.
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("50%");

  await setZoom(2);
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("200%");

  // A display is the lens, not the zoom: choosing one re-frames the camera
  // (measured in the viewport's own tests and in the browser), which is the
  // camera's business and not this label's.
  await setDisplay(undefined);
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("200%");
});

it("offers every display and Fit, and each is one click away", async () => {
  const { render, showDisplay, zoomToSelection, reset } = setup();
  await render();

  for (const label of [
    "Fit",
    "Phone landscape",
    "Phone portrait",
    "Wall panel",
  ]) {
    expect(
      document.querySelector(`[aria-label="${label}"]`),
      `${label} is offered`,
    ).not.toBeNull();
  }

  await choose("Phone portrait");
  // The id, not a boolean: an id the camera cannot resolve is a display that
  // silently did nothing, and `showDisplay` throws on an unknown one.
  expect(showDisplay).toHaveBeenCalledWith("phone-portrait");

  await choose("Fit");
  // `undefined` is Fit — no display at all, rather than a display with no
  // bounds, which is why this is not `showDisplay(null)`.
  expect(showDisplay).toHaveBeenLastCalledWith(undefined);

  // The previous behaviour is still reachable from the same control.
  await choose("Zoom to selection");
  expect(zoomToSelection).toHaveBeenCalled();
  await choose("100 %");
  expect(reset).toHaveBeenCalled();
});

it("marks the chosen display in the menu, so the trigger and the menu agree", async () => {
  const { render, setDisplay } = setup("wall-panel");
  await render();

  const checked = (label: string): boolean =>
    document
      .querySelector(`[aria-label="${label}"]`)
      ?.getAttribute("aria-checked") === "true";

  expect(checked("Wall panel"), "the chosen display is marked").toBe(true);
  expect(checked("Fit"), "and the others are not").toBe(false);

  await setDisplay(undefined);
  expect(checked("Fit"), "Fit is marked when no display is chosen").toBe(true);
  expect(checked("Wall panel")).toBe(false);
});