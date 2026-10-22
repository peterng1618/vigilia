// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { FontFaceField } from "./font-face-field.js";
import type { FontFaceEdits } from "./view.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const edits: FontFaceEdits = {
  applyFace: async () => undefined,
  applyTrio: async () => undefined,
  listFavorites: async () => [],
  saveFavorites: async () => [],
};

let host: HTMLDivElement | undefined;

afterEach(() => {
  host?.remove();
  host = undefined;
});

/**
 * The field's whole contract since the picker moved into the finder's Fonts
 * body: it is a button, it mounts no picker of its own, and pressing it asks
 * for the surface that now owns the catalogue.
 */
it("is a button that asks for the finder, not a mounted picker", async () => {
  const onOpenFontPicker = vi.fn();
  host = document.createElement("div");
  document.body.append(host);

  const root = createRoot(host);
  await act(async () => {
    root.render(
      <FontFaceField
        view={{ presetId: "body" }}
        edits={edits}
        onOpenFontPicker={onOpenFontPicker}
      />,
    );
  });

  expect(host.querySelector("[data-yunari-font-picker]")).toBeNull();

  const button = host.querySelector<HTMLButtonElement>(
    "[data-yunari-open-font-picker]",
  );
  expect(button?.textContent).toBe(uiCopy.assets.openFontPicker);
  await act(async () => button?.click());

  expect(onOpenFontPicker).toHaveBeenCalledTimes(1);
  root.unmount();
});
