// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  chooseArtboardPreset,
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
    for (const control of dialog.querySelectorAll("select, button")) {
      const labelled =
        control.getAttribute("aria-label") !== null ||
        (control.id !== "" &&
          dialog.querySelector(`label[for="${control.id}"]`) !== null) ||
        (control.textContent ?? "").trim() !== "";
      expect(labelled, control.outerHTML).toBe(true);
    }
  });

  it("opens on 16:9 landscape at 1080p, and derives that size", async () => {
    const pending = chooseArtboardPreset();
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the chooser did not open");

    const read = (marker: string): string => {
      const select = dialog.querySelector<HTMLSelectElement>(
        `[data-vigilia-new-document-${marker}]`,
      );
      if (select === null) throw new Error(`no ${marker} control`);
      return select.value;
    };
    expect(read("ratio")).toBe("16:9");
    expect(read("orientation")).toBe("landscape");
    expect(read("resolution")).toBe("1080p");

    // The size the author is about to get, stated in the dialog rather than
    // left to be discovered by looking at the canvas afterwards.
    expect(dialog.textContent).toContain("1920 × 1080");

    dialog
      .querySelector<HTMLButtonElement>("[data-vigilia-new-document-create]")
      ?.click();
    await expect(pending).resolves.toEqual({
      ratio: "16:9",
      resolution: "1080p",
      orientation: "landscape",
    });
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("follows the three controls together, swapping the edges for portrait", async () => {
    const pending = chooseArtboardPreset();
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the chooser did not open");
    const set = (marker: string, value: string): void => {
      const select = dialog.querySelector<HTMLSelectElement>(
        `[data-vigilia-new-document-${marker}]`,
      );
      if (select === null) throw new Error(`no ${marker} control`);
      select.value = value;
      select.dispatchEvent(new Event("change"));
    };

    set("ratio", "19.5:9");
    expect(dialog.textContent).toContain("2340 × 1080");

    set("orientation", "portrait");
    expect(dialog.textContent).toContain("1080 × 2340");

    set("resolution", "4k");
    expect(dialog.textContent).toContain("2160 × 4680");

    dialog
      .querySelector<HTMLButtonElement>("[data-vigilia-new-document-create]")
      ?.click();
    await expect(pending).resolves.toEqual({
      ratio: "19.5:9",
      resolution: "4k",
      orientation: "portrait",
    });
  });

  it("offers every preset, and nothing else", async () => {
    const pending = chooseArtboardPreset();
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the chooser did not open");
    const values = (marker: string): string[] =>
      [
        ...dialog.querySelectorAll<HTMLOptionElement>(
          `[data-vigilia-new-document-${marker}] option`,
        ),
      ].map((option) => option.value);

    expect(values("ratio")).toEqual(["16:9", "19.5:9", "4:3"]);
    expect(values("orientation")).toEqual(["landscape", "portrait"]);
    expect(values("resolution")).toEqual(["1080p", "2k", "4k"]);
    // Dismissed rather than left open, so this dialog cannot outlive the test
    // and be the one the next assertion finds.
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-new-document-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("cancels to no choice and closes, so a New pressed by accident changes nothing", async () => {
    const pending = chooseArtboardPreset();
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-new-document-cancel]")
      ?.click();

    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("dismisses on Escape, which a dialog gives for free", async () => {
    const pending = chooseArtboardPreset();
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the chooser did not open");
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    await expect(pending).resolves.toBeUndefined();
    expect(document.querySelector("dialog")).toBeNull();
  });
});
