// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { ViewportManager } from "../viewport-manager/index.js";
import { ZoomReadout } from "./zoom-readout.js";

it("shows the zoom as a percentage and resets to fit", async () => {
  const zoomToFit = vi.fn();
  const listeners = new Set<() => void>();
  let zoom = 0.5;
  // A stub with every ViewportManager member and no `as never`: the cast would
  // erase a missing `onChange`, which is exactly the defect to catch.
  const viewport = {
    zoom: () => zoom,
    zoomToPoint: vi.fn(),
    zoomBy: vi.fn(),
    zoomToFit,
    zoomToSelection: vi.fn(),
    reset: vi.fn(),
    panBy: vi.fn(),
    resize: vi.fn(),
    onChange: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: vi.fn(),
  } satisfies ViewportManager;

  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<ZoomReadout viewport={viewport} />));
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("50%");

  // The readout must track the camera, not just render its first value.
  await act(async () => {
    zoom = 2;
    for (const listener of listeners) listener();
  });
  expect(host.querySelector("[data-vigilia-zoom]")?.textContent).toBe("200%");

  // Base UI portals the popup to `body`, so the item is not under `host`;
  // `keepMounted` keeps it in the document while the menu is closed.
  await act(async () =>
    document
      .querySelector<HTMLButtonElement>('[aria-label="Zoom to fit"]')
      ?.click(),
  );
  expect(zoomToFit).toHaveBeenCalled();
});
