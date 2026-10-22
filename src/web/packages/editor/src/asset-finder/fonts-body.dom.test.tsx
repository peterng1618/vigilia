// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { catalogFaces, fontTrios } from "../font-catalog.js";
import {
  createSpecimenCache,
  type SpecimenCache,
} from "../font-specimen-cache.js";
import { FontsBody } from "./fonts-body.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** Faces that will never arrive: this case is about which data the picker was
 *  handed, not about the specimens' bytes. */
function missingCache(): SpecimenCache {
  return createSpecimenCache({
    fetch: vi.fn(async () => new Response(null, { status: 404 })),
    createFontFace: vi.fn(() => ({ load: vi.fn(async () => undefined) })),
    fonts: { add: vi.fn(), delete: vi.fn() },
  });
}

let host: HTMLDivElement | undefined;

afterEach(() => {
  host?.remove();
  host = undefined;
});

/**
 * The finder's Fonts body is the catalogue's picker, fed by whoever renders
 * it: the chooser opens on the catalogue's first trio and the rows are the
 * catalogue's own faces.
 */
it("renders the catalogue's picker with its trios and faces", async () => {
  host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(
      <FontsBody
        trios={fontTrios()}
        faces={catalogFaces()}
        favorites={[]}
        cache={missingCache()}
        onApplyFace={vi.fn()}
        onApplyTrio={vi.fn()}
        onToggleFavorite={vi.fn()}
      />,
    );
  });

  expect(host.querySelector("[data-yunari-font-picker]")).not.toBeNull();
  // The trio chooser prints the id it was given as the current value.
  const firstTrio = fontTrios()[0];
  expect(firstTrio).toBeDefined();
  expect(
    host.querySelector(`[data-yunari-value="${firstTrio?.id ?? ""}"]`),
  ).not.toBeNull();

  const rows = host.querySelectorAll<HTMLElement>(
    "[data-yunari-font-face-row]",
  );
  expect(rows.length).toBeGreaterThan(0);
  const known = new Set(catalogFaces().map((face) => face.family));
  for (const row of rows) {
    expect(known.has(row.getAttribute("data-yunari-font-family") ?? "")).toBe(
      true,
    );
  }

  root.unmount();
});
