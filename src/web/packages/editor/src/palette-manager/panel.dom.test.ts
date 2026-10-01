// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPalettePanel } from "./panel.js";

describe("palette panel", () => {
  const palette = {
    none: {
      name: "None",
      value: { kind: "solid" as const, color: "transparent" },
    },
    background: {
      name: "Background",
      value: { kind: "solid" as const, color: "#102030" },
    },
  };

  afterEach(() => document.body.replaceChildren());

  it("edits a Fabric-compatible solid colour without changing its stable id", () => {
    const change = vi.fn();
    const panel = createPalettePanel(document.body, change);
    panel.render(palette);
    const token = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-token]",
    )!;
    token.value = "background";
    token.dispatchEvent(new Event("change"));
    const color = document.querySelector<HTMLInputElement>(
      "[data-vigilia-palette-color]",
    )!;
    color.value = "rgb(16 32 48)";
    color.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith({
      ...palette,
      background: {
        name: "Background",
        value: { kind: "solid", color: "rgb(16 32 48)" },
      },
    });
  });

  it("creates gradients with editable validated stops", () => {
    const change = vi.fn();
    const panel = createPalettePanel(document.body, change);
    panel.render(palette);
    const token = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-token]",
    )!;
    token.value = "background";
    token.dispatchEvent(new Event("change"));
    const kind = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-kind]",
    )!;
    kind.value = "gradient";
    kind.dispatchEvent(new Event("change"));
    const angle = document.querySelector<HTMLInputElement>(
      "[data-vigilia-palette-angle]",
    )!;
    angle.value = "45";
    angle.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        background: {
          name: "Background",
          value: {
            kind: "gradient",
            angle: 45,
            stops: [
              { offset: 0, color: "#ffffff" },
              { offset: 1, color: "#000000" },
            ],
          },
        },
      }),
    );

    document
      .querySelector<HTMLButtonElement>("[data-vigilia-palette-add-stop]")!
      .click();
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        background: expect.objectContaining({
          value: expect.objectContaining({
            stops: expect.arrayContaining([{ offset: 1, color: "#000000" }]),
          }),
        }),
      }),
    );
  });

  it("keeps the reserved transparent token immutable", () => {
    const change = vi.fn();
    const panel = createPalettePanel(document.body, change);
    panel.render(palette);

    expect(
      document.querySelector<HTMLInputElement>("[data-vigilia-palette-name]")!
        .disabled,
    ).toBe(true);
    expect(document.querySelector("[data-vigilia-palette-kind]")).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });

  it("leaves the picker's own trigger standing through a colour commit", () => {
    // The picker is a popover anchored to its trigger, and the trigger lives in
    // the field set. When a commit rebuilt that set the anchor was detached and
    // the open popover measured a zero rect — one click on the saturation
    // square threw it to the top-left corner of the window, 1300px from the
    // control that owns it.
    const change = vi.fn();
    const panel = createPalettePanel(document.body, change);
    const token = (): HTMLSelectElement =>
      document.querySelector<HTMLSelectElement>(
        "[data-vigilia-palette-token]",
      )!;
    // The picker is a React root of its own, so the fields only exist once
    // React has flushed — without this the assertion below reads nothing.
    act(() => panel.render(palette));
    act(() => {
      token().value = "background";
      token().dispatchEvent(new Event("change"));
    });

    const trigger = document.querySelector(
      "[data-vigilia-palette-picker] button",
    );
    expect(trigger).not.toBeNull();

    const color = document.querySelector<HTMLInputElement>(
      "[data-vigilia-palette-color]",
    )!;
    act(() => {
      color.value = "rgb(1 2 3)";
      color.dispatchEvent(new Event("change"));
    });

    // The same node, still in the document — not an equal one that replaced it.
    expect(document.querySelector("[data-vigilia-palette-picker] button")).toBe(
      trigger,
    );
    expect(trigger?.isConnected).toBe(true);
    expect(change).toHaveBeenCalledOnce();
  });

  it("keeps the second gradient edit from reverting the first", () => {
    // Both edits come from fields built once, so a listener closing over the
    // entry it was built with would write the second stop list over the first.
    const change = vi.fn();
    const panel = createPalettePanel(document.body, change);
    panel.render(palette);
    const token = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-token]",
    )!;
    token.value = "background";
    token.dispatchEvent(new Event("change"));
    const kind = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-kind]",
    )!;
    kind.value = "gradient";
    kind.dispatchEvent(new Event("change"));

    const angle = document.querySelector<HTMLInputElement>(
      "[data-vigilia-palette-angle]",
    )!;
    angle.value = "45";
    angle.dispatchEvent(new Event("change"));

    const firstColour = document.querySelectorAll<HTMLInputElement>(
      "[data-vigilia-palette-stop-color]",
    )[0];
    expect(firstColour).toBeDefined();
    firstColour!.value = "#ff0000";
    firstColour!.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        background: expect.objectContaining({
          value: expect.objectContaining({
            angle: 45,
            stops: [
              { offset: 0, color: "#ff0000" },
              { offset: 1, color: "#000000" },
            ],
          }),
        }),
      }),
    );
  });

  it("requires a replacement before deleting a token", () => {
    const remove = vi.fn();
    const panel = createPalettePanel(document.body, vi.fn(), remove);
    panel.render({
      ...palette,
      accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
    });
    const token = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-token]",
    )!;
    token.value = "background";
    token.dispatchEvent(new Event("change"));

    const replacement = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-palette-replacement]",
    )!;
    replacement.value = "accent";
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-palette-delete]")!
      .click();

    expect(remove).toHaveBeenCalledWith("background", "accent");
  });
});
