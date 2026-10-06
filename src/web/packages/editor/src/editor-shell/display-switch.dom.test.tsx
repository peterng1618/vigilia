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

function setup(display: DisplayLensId | undefined = "19.5:9") {
  const showDisplay = vi.fn();
  const zoomToSelection = vi.fn();
  const reset = vi.fn();
  const listeners = new Set<() => void>();
  let zoom = 0.5;
  // The camera's own fit predicate, held separately from the lens because it is:
  // `reset` clears the lens and leaves the camera at 1:1, which is a camera
  // state no display describes.
  let isFitted = false;
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
    isFitted: () => isFitted,
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
    setFitted(value: boolean): Promise<void> {
      return act(async () => {
        isFitted = value;
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
  const { host, render, setZoom, setDisplay } = setup("19.5:9");
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

  for (const label of ["Fit", "19.5:9", "9:19.5", "16:9"]) {
    expect(
      document.querySelector(`[aria-label="${label}"]`),
      `${label} is offered`,
    ).not.toBeNull();
  }

  await choose("9:19.5");
  // The id, not a boolean: an id the camera cannot resolve is a display that
  // silently did nothing, and `showDisplay` throws on an unknown one.
  expect(showDisplay).toHaveBeenCalledWith("9:19.5");

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
  const { render, setDisplay, setFitted } = setup("16:9");
  await render();

  const checked = (label: string): boolean =>
    document
      .querySelector(`[aria-label="${label}"]`)
      ?.getAttribute("aria-checked") === "true";

  expect(checked("16:9"), "the chosen display is marked").toBe(true);
  expect(checked("Fit"), "and the others are not").toBe(false);

  await setDisplay(undefined);
  await setFitted(true);
  expect(checked("Fit"), "Fit is marked when the camera is fitted").toBe(true);
  expect(checked("16:9")).toBe(false);
});

/** The Fit tick is a claim about the camera, so it has to survive a camera
 *  that is not fitted. `reset` is the writer that breaks the link: 100 %
 *  clears the lens and parks the camera at 1:1, and reading the lens alone
 *  reports that as Fit — the control asserting a framing that is not there.
 *
 *  Keyed on the tick rather than on `display()` for the same reason the
 *  display's own tick is: a sentinel the camera owns can only ever report what
 *  the camera last set, not where the camera is. */
it("ticks nothing when the camera is neither a display nor a fit", async () => {
  const { render, setDisplay, setFitted } = setup();
  await render();

  const checked = (label: string): boolean =>
    document
      .querySelector(`[aria-label="${label}"]`)
      ?.getAttribute("aria-checked") === "true";

  // 100 %: no display, and not fitted either.
  await setDisplay(undefined);
  await setFitted(false);
  expect(checked("Fit"), "100 % is not Fit").toBe(false);
  for (const label of ["19.5:9", "9:19.5", "16:9"]) {
    expect(checked(label), `${label} is not it either`).toBe(false);
  }

  // And the reverse: Fit chosen, then zoomed away from.
  await setFitted(true);
  expect(checked("Fit"), "a fitted camera ticks Fit").toBe(true);
  await setFitted(false);
  expect(checked("Fit"), "and a camera zoomed off the fit does not").toBe(false);

  // A display still ticks under a lens even once the camera has moved within
  // it: the window is still the window, which is the fact this menu holds.
  await setDisplay("9:19.5");
  expect(checked("9:19.5")).toBe(true);
});

/** The gutter the label offset is measured against. Base UI unmounts an
 *  unchecked indicator unless `keepMounted` is set, so without it the
 *  indicator exists on exactly one item and every other label sits a gutter
 *  to the left. Asserted on the DOM here because jsdom has no layout; the
 *  measured pixel offset is in `tests/e2e/editor-display.spec.ts`. */
it("gives every item its tick slot, ticked or not, so the labels cannot shift", async () => {
  const { render, setDisplay } = setup("16:9");
  await render();

  const tickCount = (label: string): number =>
    document
      .querySelector(`[aria-label="${label}"]`)
      ?.querySelectorAll(".editor-shell-menu-tick").length ?? 0;

  expect(tickCount("16:9"), "the ticked item").toBe(1);
  expect(tickCount("Fit"), "an unticked one has the slot too").toBe(1);
  expect(tickCount("19.5:9")).toBe(1);

  // The slot survives the tick moving, which is the whole claim.
  await setDisplay(undefined);
  expect(tickCount("Fit")).toBe(1);
  expect(tickCount("16:9")).toBe(1);
});