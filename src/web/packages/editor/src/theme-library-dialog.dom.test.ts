// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { STARTER_TEMPLATE } from "./new-fabric-theme.js";
import {
  promptThemeConflict,
  promptThemeSelection,
} from "./theme-library-dialog.js";

/** jsdom has no `<dialog>`, so this stands in for the two methods the code
    calls. `close` is guarded so a real browser's close, which fires the event
    the code also listens for, cannot re-enter. */
function showModal(): void {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: {
    open: boolean;
    setAttribute(name: string, value: string): void;
  }) {
    this.open = true;
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(
    this: { returnValue: string; dispatchEvent(event: Event): boolean },
    returnValue = "",
  ) {
    if (this.returnValue === returnValue) return;
    this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}

const options = (): string[] =>
  [...document.querySelectorAll("dialog option")].map(
    (option) => option.getAttribute("value") ?? "",
  );

const choose = async (value: string): Promise<unknown> => {
  const pending = promptThemeSelection([
    { id: "mine", name: "My theme", updatedAt: "" },
  ]);
  const select = document.querySelector<HTMLSelectElement>("dialog select");
  if (select === null) throw new Error("the library dialog did not open");
  select.value = value;
  document
    .querySelector<HTMLButtonElement>("[data-vigilia-library-open]")
    ?.click();
  return pending;
};

describe("the library chooser", () => {
  beforeEach(() => {
    showModal();
    document.body.replaceChildren();
  });

  it("lists the starter as a template and the author's themes as theirs", async () => {
    const pending = promptThemeSelection([
      { id: "mine", name: "My theme", updatedAt: "" },
    ]);
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the library dialog did not open");

    // A template is something the product offers; a saved theme is something the
    // author made. One undifferentiated list says neither, and the author cannot
    // tell a starter apart from their own work.
    const groups = [...dialog.querySelectorAll("optgroup")].map(
      (group) => group.label,
    );
    expect(groups).toContain("Templates");
    expect(groups).toContain("Your themes");

    const inGroup = (label: string): string[] =>
      [
        ...dialog.querySelectorAll<HTMLOptionElement>(
          `optgroup[label="${label}"] option`,
        ),
      ].map((option) => option.value);
    expect(inGroup("Templates")).toEqual([STARTER_TEMPLATE.id]);
    expect(inGroup("Your themes")).toEqual(["mine"]);

    document
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("says which kind of thing was chosen, so the caller can tell them apart", async () => {
    await expect(choose(STARTER_TEMPLATE.id)).resolves.toEqual({
      kind: "template",
      id: STARTER_TEMPLATE.id,
    });
    await expect(choose("mine")).resolves.toEqual({
      kind: "theme",
      id: "mine",
    });
  });

  it("offers the template even when the author has saved nothing", async () => {
    const pending = promptThemeSelection([]);
    expect(options()).toEqual([STARTER_TEMPLATE.id]);
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("offers no control that removes anything, because it removes nothing", async () => {
    const pending = promptThemeSelection([
      { id: "mine", name: "My theme", updatedAt: "" },
    ]);
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the library dialog did not open");

    // A delete control next to a template would be a lie about what the product
    // can do: a template is not a stored theme, so there is nothing on the host
    // to remove. There is no theme deletion anywhere, and this keeps it that
    // way rather than adding one and then hiding it.
    for (const button of dialog.querySelectorAll("button")) {
      expect(
        /delete|remove|trash/i.test(button.textContent ?? ""),
        button.textContent ?? "",
      ).toBe(false);
    }

    document
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("names itself, and names its control", async () => {
    const pending = promptThemeSelection([]);
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the library dialog did not open");

    expect(
      dialog.getAttribute("aria-label") ??
        dialog.getAttribute("aria-labelledby"),
    ).toBeTruthy();
    const select = dialog.querySelector("select");
    if (select === null) throw new Error("no select");
    expect(
      select.getAttribute("aria-label") !== null ||
        dialog.querySelector(`label[for="${select.id}"]`) !== null,
    ).toBe(true);

    document
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });
});

/**
 * A refused save has to be answered, not merely announced. The three ways out
 * matter separately: the two that act and the one that does not, because the
 * last is what keeps the author's document theirs while they decide.
 */
describe("promptThemeConflict", () => {
  it.each(["reload", "overwrite"] as const)(
    "answers %s when the author picks it",
    async (choice) => {
      const pending = promptThemeConflict();
      const button = document.querySelector<HTMLButtonElement>(
        `[data-vigilia-library-${choice}]`,
      );
      if (button === null) throw new Error(`no ${choice} button`);
      expect(button.textContent).toBeTruthy();

      button.click();
      await expect(pending).resolves.toBe(choice);
    },
  );

  it("keeps both versions when the author says neither", async () => {
    const pending = promptThemeConflict();
    document
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("says the work is still there, and can be reached by keyboard", async () => {
    const pending = promptThemeConflict();
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the conflict dialog did not open");

    // The refusal has to name what happened and what the author still holds —
    // a message that only says "conflict" is the silent refusal.
    expect(dialog.textContent).toContain("still here");
    expect(
      dialog.getAttribute("aria-label") ??
        dialog.getAttribute("aria-labelledby"),
    ).toBeTruthy();
    for (const button of dialog.querySelectorAll("button")) {
      expect(button.type).toBe("button");
      expect(button.textContent).toBeTruthy();
    }

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await expect(pending).resolves.toBeUndefined();
  });
});
