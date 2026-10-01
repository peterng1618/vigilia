// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { STARTER_TEMPLATE } from "./new-fabric-theme.js";
import type { ThemeLibraryClient } from "./theme-library-client.js";
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

/** Pick an option the way a person does. Assigning `select.value` alone fires
 *  no event, so a control that answers to `change` would never hear it. */
const pick = (value: string): HTMLSelectElement => {
  const select = document.querySelector<HTMLSelectElement>("dialog select");
  if (select === null) throw new Error("the library dialog did not open");
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  return select;
};

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

  it("offers a delete only for a theme, and never for a template", async () => {
    const removed: string[] = [];
    const pending = promptThemeSelection(
      [{ id: "mine", name: "My theme", updatedAt: "" }],
      [STARTER_TEMPLATE],
      {
        client: {
          remove: async (id: string) => {
            removed.push(id);
          },
        } as unknown as ThemeLibraryClient,
      },
    );
    const dialog = document.querySelector("dialog");
    if (dialog === null) throw new Error("the library dialog did not open");
    const del = dialog.querySelector<HTMLButtonElement>(
      "[data-vigilia-library-delete]",
    );
    if (del === null) throw new Error("no delete control");

    // A template is not a stored theme: the host has no folder for it, so a
    // delete beside one would offer to remove something that was never there.
    pick(STARTER_TEMPLATE.id);
    expect(del.disabled).toBe(true);

    pick("mine");
    expect(del.disabled).toBe(false);
    del.click();

    document
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
    expect(removed).toEqual([]);
  });

  it("confirms by name before removing, and the row goes afterwards", async () => {
    const removed: string[] = [];
    const pending = promptThemeSelection(
      [{ id: "mine", name: "My theme", updatedAt: "" }],
      [STARTER_TEMPLATE],
      {
        client: {
          remove: async (id: string) => {
            removed.push(id);
          },
        } as unknown as ThemeLibraryClient,
      },
    );

    const chooser = document.querySelector("dialog");
    if (chooser === null) throw new Error("the library dialog did not open");
    pick("mine");
    chooser
      .querySelector<HTMLButtonElement>("[data-vigilia-library-delete]")
      ?.click();

    // The confirm names the theme, because a destructive act the author cannot
    // see the target of is the thing they have to be stopped from.
    const confirm = [...document.querySelectorAll("dialog")].at(-1);
    if (confirm === undefined) throw new Error("no confirmation appeared");
    expect(confirm.textContent).toContain("My theme");
    // And says where it goes, which is the whole reason this is allowed.
    expect(confirm.textContent).toMatch(/recycle bin|trash/i);

    confirm
      .querySelector<HTMLButtonElement>("[data-vigilia-library-delete-confirm]")
      ?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(removed).toEqual(["mine"]);
    // The row is gone, so the author cannot open what is no longer there.
    expect(options()).toEqual([STARTER_TEMPLATE.id]);

    // The chooser itself is still open: the author carries on with what is
    // theirs rather than being dropped out of the library.
    chooser
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("keeps the theme when the author backs out of the confirmation", async () => {
    const removed: string[] = [];
    const pending = promptThemeSelection(
      [{ id: "mine", name: "My theme", updatedAt: "" }],
      [STARTER_TEMPLATE],
      {
        client: {
          remove: async (id: string) => {
            removed.push(id);
          },
        } as unknown as ThemeLibraryClient,
      },
    );

    const chooser = document.querySelector("dialog");
    if (chooser === null) throw new Error("the library dialog did not open");
    pick("mine");
    chooser
      .querySelector<HTMLButtonElement>("[data-vigilia-library-delete]")
      ?.click();

    const confirm = [...document.querySelectorAll("dialog")].at(-1);
    if (confirm === undefined) throw new Error("no confirmation appeared");
    confirm
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();

    expect(removed).toEqual([]);
    expect(options()).toContain("mine");

    chooser
      .querySelector<HTMLButtonElement>("[data-vigilia-library-cancel]")
      ?.click();
    await expect(pending).resolves.toBeUndefined();
  });

  it("says why a removal failed, and keeps the theme listed", async () => {
    const pending = promptThemeSelection(
      [{ id: "mine", name: "My theme", updatedAt: "" }],
      [STARTER_TEMPLATE],
      {
        client: {
          remove: async () => {
            throw new Error("This PC has no trash command (gio, trash-put)");
          },
        } as unknown as ThemeLibraryClient,
      },
    );

    const chooser = document.querySelector("dialog");
    if (chooser === null) throw new Error("the library dialog did not open");
    pick("mine");
    chooser
      .querySelector<HTMLButtonElement>("[data-vigilia-library-delete]")
      ?.click();
    [...document.querySelectorAll("dialog")]
      .at(-1)
      ?.querySelector<HTMLButtonElement>(
        "[data-vigilia-library-delete-confirm]",
      )
      ?.click();
    for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();

    // Nothing was lost, so the row stays and the reason is on screen: a silent
    // failure here would look exactly like a successful delete.
    expect(options()).toContain("mine");
    expect(chooser.textContent).toContain("no trash command");

    chooser
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
