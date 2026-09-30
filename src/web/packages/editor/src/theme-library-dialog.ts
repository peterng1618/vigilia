import { STARTER_TEMPLATE } from "./new-fabric-theme.js";
import type { ThemeLibraryEntry } from "./theme-library-client.js";
import { uiCopy } from "./ui-copy.js";

/** What the author picked, and which kind of thing it is. A template and a
 *  saved theme are opened by different routes — one is built here, the other
 *  fetched over the library API — so the choice has to carry which it was. */
export type ThemeLibraryChoice =
  | { readonly kind: "template"; readonly id: string }
  | { readonly kind: "theme"; readonly id: string };

/** See `promptThemeConflict` for why these are not in `ui-copy.ts`. */
const CONFLICT_LEAD =
  "This theme was changed somewhere else since you opened it. Your work is still here.";
const CONFLICT_RELOAD = "Open the saved version";
const CONFLICT_OVERWRITE = "Replace it with mine";
const CONFLICT_CANCEL = "Keep editing";

/** The dialog's return value for an answer. Every other close — Cancel, Escape,
 *  a host closing it — is a dismissal, which is what an empty return value
 *  already means. */
const OPEN = "open";

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

  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";
  actions.append(cancel, open);

  const form = document.createElement("div");
  form.className = "vigilia-dialog-form";
  form.append(lead, field, actions);
  dialog.append(form);

  return new Promise((resolve) => {
    let done = false;
    /** The value the dialog was closed *with*, which is the only thing that
        distinguishes an answer from a dismissal. Read at the `close` event
        rather than passed in, because `dialog.close("open")` fires `close`
        before the click handler resumes — a close listener that assumed every
        `close` was a dismissal would resolve every Open as a cancel. */
    const settle = (): void => {
      if (done) return;
      done = true;
      const raw = select.value;
      // Read the kind off the option itself rather than rebuilding a selector
      // from its value: the ids are the host's, and an id carrying a quote would
      // need escaping this lookup does not.
      const kind = [
        ...select.querySelectorAll<HTMLOptionElement>("option"),
      ].find((option) => option.value === raw)?.dataset["kind"];
      dialog.remove();
      resolve(
        dialog.returnValue !== OPEN || kind === undefined
          ? undefined
          : ({ kind, id: raw } as ThemeLibraryChoice),
      );
    };

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
 * **ponytail:** these three strings are literals here rather than entries in
 * `ui-copy.ts`, which is the owner of visible editor copy and was not this
 * task's to edit. Fold them into `uiCopy.library` when that file is free; the
 * table is plain English today, so nothing is untranslated by leaving them
 * here.
 */
export function promptThemeConflict(): Promise<
  ThemeConflictChoice | undefined
> {
  const dialog = document.createElement("dialog");
  dialog.className = "vigilia-dialog";
  dialog.setAttribute("aria-label", CONFLICT_LEAD);

  const lead = document.createElement("p");
  lead.className = "vigilia-dialog-lead";
  lead.textContent = CONFLICT_LEAD;

  const actions = document.createElement("div");
  actions.className = "vigilia-dialog-actions";
  const buttons: ReadonlyArray<readonly [ThemeConflictChoice, string]> = [
    ["reload", CONFLICT_RELOAD],
    ["overwrite", CONFLICT_OVERWRITE],
  ];
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = CONFLICT_CANCEL;
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
