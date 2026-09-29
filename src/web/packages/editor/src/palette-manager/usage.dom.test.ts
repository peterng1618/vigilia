// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPalettePanel } from "./panel.js";

/**
 * What a token is linked to, in the panel.
 *
 * The count and the delete guard have to come from one walk: a panel saying
 * "3 uses" while the delete decides from a different traversal is how a token
 * is removed from under a live object. `usage` is injected rather than
 * recomputed here, so this file asserts the panel reports what it is given and
 * names the objects — the traversal itself is proven in scene-fabric.
 */
describe("palette token usage", () => {
  const palette = {
    accent: {
      name: "Accent",
      value: { kind: "solid" as const, color: "#00b8d9" },
    },
    unused: {
      name: "Unused",
      value: { kind: "solid" as const, color: "#334455" },
    },
  };

  afterEach(() => document.body.replaceChildren());

  const usage = (): Readonly<Record<string, readonly { name: string }[]>> => ({
    accent: [{ name: "Card title" }, { name: "Header" }, { name: "RAM gauge" }],
    unused: [],
  });

  const render = (): HTMLElement => {
    const panel = createPalettePanel(document.body, vi.fn(), undefined, {
      usage,
    });
    panel.render(palette);
    return document.body;
  };

  const count = (id: string): string => {
    const option = document.querySelector<HTMLOptionElement>(
      `[data-vigilia-palette-token] option[value="${id}"]`,
    )!;
    return option.textContent ?? "";
  };

  it("names how many objects a token is linked to, per token", () => {
    render();

    expect(count("accent")).toContain("3");
    expect(count("unused")).toContain("0");
  });

  it("still shows the token's own name beside the count", () => {
    render();

    expect(count("accent")).toContain("Accent");
  });

  it("names the objects a token is used by", () => {
    render();

    const listed = document.querySelector("[data-vigilia-palette-users]")!;
    expect(listed.textContent).toContain("Card title");
    expect(listed.textContent).toContain("Header");
    expect(listed.textContent).toContain("RAM gauge");
  });

  it("says so plainly when nothing uses the token, so dead tokens show", () => {
    const panel = createPalettePanel(document.body, vi.fn(), undefined, {
      usage,
    });
    panel.render(palette);
    const token = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-token]",
    )!;
    token.value = "unused";
    token.dispatchEvent(new Event("change"));

    // The count is on the option, so a dead token is visible without selecting
    // it; the list is the confirmation.
    expect(count("unused")).toContain("0");
    expect(
      document.querySelector("[data-vigilia-palette-users]")!.textContent,
    ).not.toContain("Card title");
  });

  it("omits the count entirely when the panel is given no scene to read", () => {
    // Without a usage source the panel has no scene. Printing 0 there would be
    // fabricating a measurement — the same rule as a gap in telemetry (§97).
    const panel = createPalettePanel(document.body, vi.fn());
    panel.render(palette);

    const option = document.querySelector<HTMLOptionElement>(
      `[data-vigilia-palette-token] option[value="accent"]`,
    )!;
    expect(option.textContent).toBe("Accent");
    expect(document.querySelector("[data-vigilia-palette-users]")).toBeNull();
  });
});
