import { STARTER_TEMPLATE } from "./new-fabric-theme.js";
import {
  createThemeLibraryClient,
  type ThemeLibraryClient,
  type ThemeLibraryEntry,
} from "./theme-library-client.js";
import { uiCopy } from "./ui-copy.js";

/** What the author picked, and which kind of thing it is. A template and a
 *  saved theme are opened by different routes — one is built here, the other
 *  fetched over the library API — so the choice has to carry which it was. */
export type ThemeLibraryChoice =
  | { readonly kind: "template"; readonly id: string }
  | { readonly kind: "theme"; readonly id: string };

/** The dialog's return value for an answer. Every other close — Cancel, Escape,
 *  a host closing it — is a dismissal, which is what an empty return value
 *  already means. */
const OPEN = "open";

/**
 * What the author is asked before a theme is removed.
 *
 * Longer than the button, and read before it, so it can say the two things that
 * make the act safe to offer: **which theme**, and **that the recycle bin is
 * where it goes**. A confirmation that only says "Delete?" is a confirmation of
 * the button, not of the act.
 */
const DELETE_LEAD = "Move this theme to the recycle bin?";

/** The control's own word. Beside the dialog rather than in `ui-copy.ts`,
 *  because the copy table's owner is another surface's concern and this string
 *  exists only beside the button it names. */
const DELETE_LABEL = "Delete";

/** The client a removal goes through, or undefined when there is none — in
 *  which case the chooser offers no deletion rather than failing when the
 *  author presses a button it drew. */
function remover(
  client: ThemeLibraryClient | undefined,
): ((id: string) => Promise<void>) | undefined {
  if (client?.remove !== undefined) {
    return (id: string) => client.remove?.(id) ?? Promise.resolve();
  }
  // The chooser is opened by the editor, which serves from the same host as
  // the library, so its own client is the right one when none was handed in.
  const own = createThemeLibraryClient();
  return own.remove === undefined ? undefined : own.remove.bind(own);
}

/**
 * A `<dialog>` that answers with one of two answers and dismisses to neither.
 * Not named `confirm`: that is `window.confirm` in every editor scope, and
 * shadowing it here would be a trap for the next reader of this file.
 */
function ask(
  lead: string,
  confirmLabel: string,
  cancelLabel: string,
  answer: string,
  confirmAttribute: string,
): Promise<boolean> {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", lead);

  const text = document.createElement("p");
  text.className = "vigilia-dialog-lead";
  text.textContent = lead;

  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";
  const yes = document.createElement("button");
  yes.type = "button";
  yes.textContent = confirmLabel;
  yes.setAttribute(confirmAttribute, "");
  const no = document.createElement("button");
  no.type = "button";
  no.textContent = cancelLabel;
  no.setAttribute("data-vigilia-library-cancel", "");
  actions.append(no, yes);
  dialog.append(text, actions);

  return new Promise((resolve) => {
    let done = false;
    const settle = (): void => {
      if (done) return;
      done = true;
      const accepted = dialog.returnValue === answer;
      dialog.remove();
      resolve(accepted);
    };
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close?.();
        settle();
      }
    });
    dialog.addEventListener("close", () => settle());
    yes.addEventListener("click", () => {
      dialog.close?.(answer);
      settle();
    });
    no.addEventListener("click", () => {
      dialog.close?.("cancel");
      settle();
    });
    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
}

/**
 * Asks which theme to open: the product's templates, or the author's own.
 *
 * The two are listed separately because they are different in kind, and the
 * difference is the whole point of making the starter a template rather than
 * what `New` means. A template is something the product offers; a saved theme
 * is something the author made and can delete. Flattened into one list, the
 * starter would read as the author's own work — which is the claim the product
 * is withdrawing.
 *
 * A `<dialog>` for the same reason as the other two editor prompts, and a
 * native labelled `<select>` inside it, so the whole surface is reachable and
 * dismissible by keyboard without a bespoke key handler.
 */
export function promptThemeSelection(
  themes: readonly ThemeLibraryEntry[],
  templates: readonly ThemeLibraryEntry[] = [STARTER_TEMPLATE],
  options?: { readonly client?: ThemeLibraryClient },
): Promise<ThemeLibraryChoice | undefined> {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", uiCopy.library.choose);

  const lead = document.createElement("p");
  lead.className = "vigilia-dialog-lead";
  lead.textContent = uiCopy.library.choose;

  const select = document.createElement("select");
  select.id = "vigilia-library-theme";
  // Its own words, not the dialog's: the lead line already says "Open a
  // theme", and a label repeating it printed twice over the control it names.
  const label = document.createElement("label");
  label.textContent = uiCopy.library.themeField;
  label.htmlFor = select.id;
  const field = document.createElement("div");
  field.className = "vigilia-field";
  field.append(label, select);
  select.append(group(uiCopy.library.templates, templates, "template"));
  select.append(group(uiCopy.library.yourThemes, themes, "theme"));

  const open = document.createElement("button");
  open.type = "button";
  open.textContent = uiCopy.library.open;
  open.setAttribute("data-vigilia-library-open", "");
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = uiCopy.library.cancel;
  cancel.setAttribute("data-vigilia-library-cancel", "");

  /**
   * Removal is offered beside opening, on the same row of choices, because a
   * theme the author cannot get rid of is an experiment they can never clear
   * away — and the library listing offers nothing else that does it.
   *
   * It moves the theme's folder to the operating system's trash, so it is
   * recoverable; the confirmation says so, which is what makes offering a
   * destructive control here honest rather than alarming.
   */
  const canRemove = remover(options?.client);
  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";
  if (canRemove !== undefined) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = DELETE_LABEL;
    remove.setAttribute("data-vigilia-library-delete", "");
    // Disabled rather than absent for a template: the control is one that exists
    // and says what it would do, instead of appearing and vanishing as the
    // selection moves.
    remove.disabled = true;
    actions.append(remove);
  }
  actions.append(cancel, open);

  /** Why the last removal did not happen, read by the author, not swallowed. */
  const status = document.createElement("p");
  status.className = "vigilia-dialog-lead";
  status.setAttribute("role", "status");
  status.hidden = true;

  const form = document.createElement("div");
  form.className = "vigilia-dialog-form";
  form.append(lead, field, actions, status);
  dialog.append(form);

  return new Promise((resolve) => {
    let done = false;
    /** The kind of the selected option, read off the option itself rather than
        rebuilt from its value: the ids are the host's, and an id carrying a
        quote would need escaping a lookup-by-value does not have. */
    const kindOf = (): string | undefined =>
      [...select.querySelectorAll<HTMLOptionElement>("option")].find(
        (option) => option.value === select.value,
      )?.dataset["kind"];

    const removeControl = dialog.querySelector<HTMLButtonElement>(
      "[data-vigilia-library-delete]",
    );
    const syncRemove = (): void => {
      if (removeControl !== null) {
        removeControl.disabled = kindOf() !== "theme";
      }
    };
    select.addEventListener("change", syncRemove);
    select.addEventListener("input", syncRemove);
    syncRemove();

    /** The value the dialog was closed *with*, which is the only thing that
        distinguishes an answer from a dismissal. Read at the `close` event
        rather than passed in, because `dialog.close("open")` fires `close`
        before the click handler resumes — a close listener that assumed every
        `close` was a dismissal would resolve every Open as a cancel. */
    const settle = (): void => {
      if (done) return;
      done = true;
      const raw = select.value;
      const kind = kindOf();
      dialog.remove();
      resolve(
        dialog.returnValue !== OPEN || kind === undefined
          ? undefined
          : ({ kind, id: raw } as ThemeLibraryChoice),
      );
    };

    removeControl?.addEventListener("click", async () => {
      const id = select.value;
      if (canRemove === undefined || kindOf() !== "theme") {
        return;
      }
      const entry = themes.find((theme) => theme.id === id);
      const accepted = await ask(
        `${DELETE_LEAD}\n\n${entry?.name ?? id} (${id}) will be moved to the recycle bin, where you can get it back.`,
        DELETE_LABEL,
        uiCopy.library.cancel,
        "remove",
        "data-vigilia-library-delete-confirm",
      );
      if (!accepted) {
        return;
      }
      try {
        await canRemove(id);
        // The option goes rather than the dialog closing, so the author can
        // carry on with the themes that are still theirs. Matched by iteration
        // rather than a selector, because the id is the host's and would have
        // to be escaped for an attribute selector.
        for (const option of select.querySelectorAll<HTMLOptionElement>(
          "option",
        )) {
          if (option.value === id) {
            option.remove();
          }
        }
        status.hidden = true;
        syncRemove();
      } catch (error: unknown) {
        // Nothing was lost, so the row stays and the reason is on screen: a
        // silent failure here is indistinguishable from a successful delete.
        status.textContent =
          error instanceof Error ? error.message : String(error);
        status.hidden = false;
      }
    });

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close?.();
        settle();
      }
    });
    dialog.addEventListener("close", () => settle());
    open.addEventListener("click", () => {
      dialog.close?.(OPEN);
      settle();
    });
    cancel.addEventListener("click", () => {
      dialog.close?.("cancel");
      settle();
    });

    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
}

function group(
  label: string,
  entries: readonly ThemeLibraryEntry[],
  kind: "template" | "theme",
): HTMLOptGroupElement {
  const optgroup = document.createElement("optgroup");
  optgroup.label = label;
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.id;
    // A saved theme carries its id because two themes can share a display name;
    // a template has one, so the id is noise there.
    option.textContent =
      kind === "template" ? entry.name : `${entry.name} (${entry.id})`;
    option.dataset["kind"] = kind;
    optgroup.append(option);
  }
  return optgroup;
}

/** What an author can do about a save the host refused. */
export type ThemeConflictChoice = "reload" | "overwrite";

/**
 * Asks what to do about a save that was refused because the stored theme moved
 * on. Two answers and a way out, because a refusal must not cost the author
 * their document and must not be a dead end: reload discards their unsaved
 * edits in favour of the stored version, overwrite discards the stored version
 * in favour of their edits, and cancelling keeps both.
 *
 * A `<dialog>` like the other two editor prompts, so it is dismissible by
 * Escape and reachable by keyboard without a bespoke key handler.
 *
 */
/** Longer than the three answers, and read before them, so it stays beside the
 *  dialog rather than in the table with its siblings. */
const CONFLICT_LEAD_TEXT =
  "This theme was changed somewhere else since you opened it. Your work is still here.";

export function promptThemeConflict(): Promise<
  ThemeConflictChoice | undefined
> {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", CONFLICT_LEAD_TEXT);

  const lead = document.createElement("p");
  lead.className = "vigilia-dialog-lead";
  lead.textContent = CONFLICT_LEAD_TEXT;

  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";
  const buttons: ReadonlyArray<readonly [ThemeConflictChoice, string]> = [
    ["reload", uiCopy.library.conflict.reload],
    ["overwrite", uiCopy.library.conflict.overwrite],
  ];
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = uiCopy.library.conflict.cancel;
  cancel.setAttribute("data-vigilia-library-cancel", "");

  for (const [choice, label] of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute(`data-vigilia-library-${choice}`, "");
    actions.append(button);
  }
  actions.append(cancel);
  dialog.append(lead, actions);

  return new Promise((resolve) => {
    let done = false;
    /** Read at the `close` event, not passed in: `dialog.close(value)` fires
     *  `close` before the click handler resumes, so a listener that assumed
     *  every `close` was a dismissal would resolve every answer as a cancel. */
    const settle = (): void => {
      if (done) return;
      done = true;
      const value = dialog.returnValue;
      dialog.remove();
      resolve(value === "reload" || value === "overwrite" ? value : undefined);
    };

    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close?.();
        settle();
      }
    });
    dialog.addEventListener("close", () => settle());
    for (const [choice] of buttons) {
      dialog
        .querySelector(`[data-vigilia-library-${choice}]`)
        ?.addEventListener("click", () => {
          dialog.close?.(choice);
          settle();
        });
    }
    cancel.addEventListener("click", () => {
      dialog.close?.("cancel");
      settle();
    });

    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  });
}
