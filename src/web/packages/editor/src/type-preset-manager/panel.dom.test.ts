// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fontTrio } from "../font-catalog.js";
import { createTypePresetPanel } from "./panel.js";

// The panel appends to the host it is given, and several of these tests read
// through `document` rather than through the panel's own root, so one test's
// markup would otherwise be the next test's first match.
afterEach(() => document.body.replaceChildren());

describe("type preset panel", () => {
  it("puts every field's label in the shell's own label column", () => {
    // With a delete action and a second preset, so the reassign row — one of
    // the nine — is on screen rather than absent.
    const panel = createTypePresetPanel(document.body, vi.fn(), vi.fn(), {
      preview: vi.fn(async () => {}),
      applyFace: vi.fn(async () => {}),
      applyTrio: vi.fn(async () => {}),
    });
    panel.render({
      body: { name: "Body", value: { family: "Inter", size: 16 } },
      caption: { name: "Caption", value: { family: "Inter", size: 12 } },
    });

    // The defect this replaces: each control was wrapped in a `<label>`, so
    // the shell's `label { display: block }` rule printed "Name" and then the
    // box it names on the same line, pressed against it. Every other panel
    // lays the pair out as a `.vigilia-field` grid row with a 72px label
    // column; a wrapped label can never take a column, because a grid item
    // that wraps its own control is one box, not two.
    const fields = [
      "type-name",
      "type-family",
      "type-size",
      "type-weight",
      "type-line-height",
      "type-letter-spacing",
      "font-face",
      "font-trio",
      "type-replacement",
    ];
    for (const key of fields) {
      const control = panel.root.querySelector<HTMLElement>(
        `[data-vigilia-${key}]`,
      )!;
      const row = control.closest(".vigilia-field");
      if (row === null) throw new Error(`${key} has no field row`);
      // The label is a sibling, not an ancestor: that is what puts it in the
      // column beside the control rather than above it.
      const label = row.querySelector<HTMLLabelElement>(":scope > label");
      if (label === null) throw new Error(`${key} has no own label`);
      expect(label.htmlFor, key).toBe(control.id);
      expect(label.textContent, key).not.toBe("");
      // And the control is the row's own second child, so nothing sits between
      // the label and the input it names.
      expect([...row.children].indexOf(control), key).toBe(1);
    }
  });

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
