// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createTypePresetPanel } from "./panel.js";
import { fontTrio } from "../font-catalog.js";

describe("type preset panel", () => {
  it("edits a global type token", () => {
    const onChange = vi.fn();
    const panel = createTypePresetPanel(document.body, onChange);
    panel.render({
      body: { name: "Body", value: { family: "Inter", size: 16 } },
    });
    const size = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-type-size]",
    )!;
    size.value = "18";
    size.dispatchEvent(new Event("change"));
    expect(onChange).toHaveBeenLastCalledWith({
      body: { name: "Body", value: { family: "Inter", size: 18 } },
    });
  });

  it("preserves packaged face metadata when editing size", () => {
    const onChange = vi.fn();
    const panel = createTypePresetPanel(document.body, onChange);
    panel.render({
      body: {
        name: "Body",
        value: {
          family: "Inter",
          size: 16,
          weight: 600,
          letterSpacing: 0.2,
          lineHeight: 1.4,
          face: { assetId: "inter-600" },
          trioRole: "body",
        },
      },
    });

    const size = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-type-size]",
    )!;
    size.value = "18";
    size.dispatchEvent(new Event("change"));

    expect(onChange).toHaveBeenLastCalledWith({
      body: {
        name: "Body",
        value: {
          family: "Inter",
          size: 18,
          weight: 600,
          letterSpacing: 0.2,
          lineHeight: 1.4,
          face: { assetId: "inter-600" },
          trioRole: "body",
        },
      },
    });
  });

  it("emits numeric letter spacing", () => {
    const onChange = vi.fn();
    const panel = createTypePresetPanel(document.body, onChange);
    panel.render({
      body: { name: "Body", value: { family: "Inter", size: 16 } },
    });

    const letterSpacing = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-type-letter-spacing]",
    )!;
    letterSpacing.value = "0.25";
    letterSpacing.dispatchEvent(new Event("change"));

    expect(onChange).toHaveBeenLastCalledWith({
      body: {
        name: "Body",
        value: { family: "Inter", size: 16, letterSpacing: 0.25 },
      },
    });
  });

  it("requires a replacement before deleting a type token", () => {
    const remove = vi.fn();
    const panel = createTypePresetPanel(document.body, vi.fn(), remove);
    panel.render({
      body: { name: "Body", value: { family: "Inter", size: 16 } },
      caption: { name: "Caption", value: { family: "Inter", size: 12 } },
    });
    const preset = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-type-preset]",
    )!;
    preset.value = "body";
    preset.dispatchEvent(new Event("change"));

    const replacement = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-type-replacement]",
    )!;
    replacement.value = "caption";
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-type-delete]")!
      .click();

    expect(remove).toHaveBeenCalledWith("body", "caption");
  });

  it("offers a shared curated face picker for the selected preset", async () => {
    const applyFace = vi.fn(async () => {});
    const panel = createTypePresetPanel(document.body, vi.fn(), undefined, {
      applyFace,
      applyTrio: vi.fn(async () => {}),
      preview: vi.fn(async () => {}),
    });
    panel.render({
      body: {
        name: "Body",
        value: { family: "Inter", size: 16, trioRole: "body" },
      },
    });

    const face = document.querySelector<HTMLSelectElement>(
      "[data-vigilia-font-face]",
    )!;
    face.value = fontTrio("minimal")!.faces[0]!.id;
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-font-apply]")!
      .click();
    await Promise.resolve();

    expect(applyFace).toHaveBeenCalledWith(
      "body",
      fontTrio("minimal")!.faces[0],
    );
  });
});
