// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { createShellLayout } from "./shell-layout.js";

/**
 * The rail is single-panel, so opening Assets really does take the layer list
 * down and build it again. The selection, the inspector's geometry and the
 * canvas handles all survive that swap; only the scroll did not, and with the
 * Starter's 52 rows — more in a theme an author has built — finding your place
 * again is the whole cost of glancing at the assets.
 */
describe("the rail keeps each pane where you left it", () => {
  it("returns the layer list to the offset it was scrolled to", async () => {
    const root = document.createElement("div");
    document.body.append(root);
    const layout = createShellLayout(root);
    const rail = (name: string): HTMLButtonElement =>
      root.querySelector<HTMLButtonElement>(
        `nav[aria-label="Editor areas"] button[title="${name}"], nav[aria-label="Editor areas"] button:nth-child(${name === "Layers" ? 1 : 3})`,
      )!;
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

    rail("Assets").click();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(panel().scrollTop).toBe(0);

    rail("Layers").click();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    expect(panel().scrollTop).toBe(499);

    layout.destroy();
    root.remove();
  });
});
