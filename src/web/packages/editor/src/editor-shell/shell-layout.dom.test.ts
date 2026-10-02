// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { uiCopy } from "../ui-copy.js";
import { createShellLayout } from "./shell-layout.js";

/**
 * The pane bar is single-panel, so opening Assets really does take the layer
 * list down and build it again. The selection, the inspector's geometry and
 * the canvas handles all survive that swap; only the scroll did not, and with
 * the Starter's 52 rows — more in a theme an author has built — finding your
 * place again is the whole cost of glancing at the assets.
 */
describe("the pane bar keeps each pane where you left it", () => {
  it("returns the layer list to the offset it was scrolled to", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const layout = createShellLayout(root);
    // The bar's segments, by the label they show rather than by the icon they
    // used to draw: the rail's entries were named by `title`, and a labelled
    // segment has no tooltip to address.
    const segment = (label: string): HTMLButtonElement =>
      Array.from(
        root.querySelectorAll<HTMLButtonElement>(
          ".editor-shell-pane-bar button",
        ),
      ).find((button) => button.textContent?.trim() === label)!;
    const panel = (): HTMLElement =>
      root.querySelector<HTMLElement>("aside.editor-shell-panel")!;

    // jsdom does not lay out, so the scrollable height is stated rather than
    // measured — what is under test is the offset surviving the swap.
    const scrollable = Object.defineProperty(panel(), "scrollHeight", {
      value: 5000,
      configurable: true,
    });
    void scrollable;
    panel().scrollTop = 499;

    segment(uiCopy.rail.assets).click();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(panel().scrollTop).toBe(0);

    segment(uiCopy.rail.layers).click();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(panel().scrollTop).toBe(499);

    layout.destroy();
    root.remove();
  });
});
