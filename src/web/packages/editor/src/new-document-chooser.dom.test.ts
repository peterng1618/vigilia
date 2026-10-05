// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  chooseArtboardSize,
  newDocumentChooser,
} from "./new-document-chooser.js";

/** The one thing a real browser gives the chooser that jsdom has not. */
function showModal(): void {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: {
    open: boolean;
    setAttribute(name: string, value: string): void;
  }) {
    this.open = true;
    this.setAttribute("open", "");
  };
}

describe("the new-document chooser", () => {
  beforeEach(() => {
    showModal();
    document.body.replaceChildren();
  });

  it("names itself, and every control it holds is labelled", () => {
    const dialog = newDocumentChooser();

    // A dialog with no accessible name is announced as "dialog" and nothing
    // else, which is the one thing an author pressing New needs to hear.
    expect(
      dialog.getAttribute("aria-label") ??
        dialog.getAttribute("aria-labelledby"),
    ).toBeTruthy();
    for (const control of dialog.querySelectorAll("select, button, input")) {
      const labelled =
        control.getAttribute("aria-label") !== null ||
        (control.id !== "" &&
          dialog.querySelector(`label[for="${control.id}"]`) !== null) ||
        (control.textContent ?? "").trim() !== "";
      expect(labelled, control.outerHTML).toBe(true);
    }
  });

  it("asks what the theme is for first, and offers Custom beside it", () => {
    // The finding the redesign exists for: three "Custom"s as the starting
    // state asks an author to know a ratio before knowing what the thing is
    // for. The first control is the question, and every display is on it.
    const dialog = newDocumentChooser();

    const values = display(dialog);
    expect(values).toEqual([
      "phone-landscape",
      "phone-portrait",
      "wall-panel",
      "",
    ]);
    // And Custom is not a corner: it is the last option of the same control,
    // one click from the three.
    expect(
      dialog.querySelector(
        `[data-vigilia-new-document-display] option[value=""]`,
      )?.textContent,
    ).toBe("Custom size");
  });

  it("opens on the display the document it would replace is at", async () => {
    // 19.5:9 portrait is a phone hung upright, so it is offered back rather
    // than reset — the same finding as before, asked as the right question.
    const pending = chooseArtboardSize({ width: 1080, height: 2340 });
    const dialog = opened();

    expect(read(dialog, "display")).toBe("phone-portrait");
    // And the size it would actually produce, so the carry-over is visible
    // rather than something the author has to infer from a dropdown.
    expect(dialog.textContent).toContain("1080 × 2340");
    expect(dialog.textContent).not.toContain("1920 × 1080");

    create(dialog);
    await expect(pending).resolves.toEqual({ width: 1080, height: 2340 });
  });

  it.each([
    ["phone-landscape", { width: 2340, height: 1080 }],
    ["phone-portrait", { width: 1080, height: 2340 }],
    ["wall-panel", { width: 1920, height: 1080 }],
  ] as const)(
    "a new theme from %s arrives at those dimensions",
    async (lens, size) => {
      const pending = chooseArtboardSize();
      const dialog = opened();

      set(dialog, "display", lens);
      create(dialog);

      await expect(pending).resolves.toEqual(size);
    },
  );

  it("keeps the technical question behind Custom, one click away", () => {
    const dialog = newDocumentChooser();

    // A display answers what the theme is *for*; the ratio, orientation and
    // resolution answer how it is measured. A document chosen by display does
    // not need the second question asked of it.
    expect(customQuestion(dialog).hidden).toBe(true);

    set(dialog, "display", "");
    expect(customQuestion(dialog).hidden).toBe(false);
    // One click, not a second dialog and not a menu elsewhere.
    expect(display(dialog)).toContain("");
  });

  it("offers every size the dropdowns could express before", async () => {
    const pending = chooseArtboardSize();
    const dialog = opened();
    set(dialog, "display", "");

    const values = (marker: string): string[] =>
      [
        ...dialog.querySelectorAll<HTMLOptionElement>(
          `[data-vigilia-new-document-${marker}] option`,
        ),
      ].map((option) => option.value);

    expect(values("ratio")).toEqual(["16:9", "19.5:9", "4:3"]);
    expect(values("orientation")).toEqual(["landscape", "portrait"]);
    expect(values("resolution")).toEqual(["1080p", "2k", "4k"]);

    // The three still combine into a size on screen, so no preset became a
    // guess an author has to commit to before seeing the number.
    set(dialog, "ratio", "19.5:9");
    expect(dialog.textContent).toContain("2340 × 1080");
    set(dialog, "orientation", "portrait");
    expect(dialog.textContent).toContain("1080 × 2340");
    set(dialog, "resolution", "4k");
    expect(dialog.textContent).toContain("2160 × 4680");

    create(dialog);
    await expect(pending).resolves.toEqual({
      width: 2160,
      height: 4680,
    });
  });

  it("has Custom accept a size no preset names", async () => {
    // The chooser has never been able to do this — the three dropdowns only
    // name presets. Review Focus 6 is the other half: a 4000 × 4000 theme has
    // to be authorable from the question, not only from the panel afterwards.
    const pending = chooseArtboardSize();
    const dialog = opened();
    set(dialog, "display", "");

    type(dialog, "width", "4000");
    type(dialog, "height", "4000");

    create(dialog);
    await expect(pending).resolves.toEqual({ width: 4000, height: 4000 });
  });

  it("refuses a size that is not a dimension, rather than creating one", async () => {
    const pending = chooseArtboardSize();
    const dialog = opened();
    set(dialog, "display", "");
    type(dialog, "height", "2000");

    // `Number("")` is 0 and `Number("1600.5")` is 1600.5: a field that
    // coerced either would open a document nobody sized. The bound owns that
    // refusal — `linkedPair` is the panel's own — so what this asserts is that
    // the chooser confirms the width the field kept, not the one typed, and
    // keeps the height the author did accept.
    type(dialog, "width", "");
    type(dialog, "width", "1600.5");
    expect(read(dialog, "width")).toBe("1920");

    create(dialog);
    await expect(pending).resolves.toEqual({ width: 1920, height: 2000 });
  });

  it("cancels to no choice and closes, so a New pressed by accident changes nothing", async () => {
    const pending = chooseArtboardSize();
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-new-document-cancel]")
      ?.click();

    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("dismisses on Escape, which a dialog gives for free", async () => {
    const pending = chooseArtboardSize();
    const dialog = opened();
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelector("dialog")).toBeNull();
  });
});

/** The chooser dialog, or a failure saying it did not open. */
function opened(): HTMLDialogElement {
  const dialog = document.querySelector<HTMLDialogElement>("dialog");
  if (dialog === null) throw new Error("the chooser did not open");
  return dialog;
}

function read(dialog: HTMLElement, marker: string): string {
  const control = dialog.querySelector<HTMLSelectElement | HTMLInputElement>(
    `[data-vigilia-new-document-${marker}]`,
  );
  if (control === null) throw new Error(`no ${marker} control`);
  return control.value;
}

function set(dialog: HTMLElement, marker: string, value: string): void {
  const select = dialog.querySelector<HTMLSelectElement>(
    `[data-vigilia-new-document-${marker}]`,
  );
  if (select === null) throw new Error(`no ${marker} control`);
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

function type(dialog: HTMLElement, marker: string, value: string): void {
  const input = dialog.querySelector<HTMLInputElement>(
    `[data-vigilia-new-document-${marker}]`,
  );
  if (input === null) throw new Error(`no ${marker} field`);
  input.value = value;
  input.dispatchEvent(new Event("change"));
}

function create(dialog: HTMLElement): void {
  dialog
    .querySelector<HTMLButtonElement>("[data-vigilia-new-document-create]")
    ?.click();
}

/** The option values the display question offers, in order. */
function display(dialog: HTMLElement): string[] {
  return [
    ...dialog.querySelectorAll<HTMLOptionElement>(
      "[data-vigilia-new-document-display] option",
    ),
  ].map((option) => option.value);
}

/** The controls behind Custom, as one thing to show and hide. */
function customQuestion(dialog: HTMLElement): HTMLElement {
  const custom = dialog.querySelector<HTMLElement>(
    "[data-vigilia-new-document-custom]",
  );
  if (custom === null) throw new Error("the chooser has no Custom question");
  return custom;
}
