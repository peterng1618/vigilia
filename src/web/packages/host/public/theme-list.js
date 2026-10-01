/**
 * A saved theme as one row in a list.
 *
 * The owner of that row. Two pages list themes — the chooser the host serves
 * at `/` and the settings page — so the picture, the hatched stand-in for a
 * theme saved before pictures existed, and the id that tells two same-named
 * themes apart are drawn once here. A chooser with its own rows would be the
 * second copy of all three, and the copy that arrives second is the one
 * without the picture.
 *
 * A template is the same row with a different truth behind it: the product
 * offers it, the PC has not saved it, and it cannot be chosen as what the
 * displays show. It is listed beside the saved themes and says so, because a
 * flattened list would read the starter as the author's own work — the claim
 * F0.3 withdrew — and a row that only says "Opens in the editor" says where a
 * template actually is.
 *
 * Dependency-free source, like the pages that load it: the host serves these
 * files itself, so they must not need a build step or a network fetch.
 */

/** Reserved space with nothing in it, for a row with no picture to draw. */
function placeholder() {
  const box = document.createElement("div");
  box.className = "theme-shot";
  box.dataset.placeholder = "";
  return box;
}

/** The name beside the picture, and anything said under it. */
function rowText(name, sub) {
  const text = document.createElement("span");
  text.className = "theme-text";
  text.append(name);
  if (sub !== undefined) {
    const by = document.createElement("span");
    by.className = "by";
    by.textContent = sub;
    text.append(by);
  }
  return text;
}

function groupLabel(label) {
  const heading = document.createElement("p");
  heading.className = "theme-group-label";
  heading.textContent = label;
  return heading;
}

/**
 * Moves a theme to the recycle bin through the host's own route
 * (`DELETE /api/themes/:id`, loopback only).
 *
 * The host moves the folder through the operating system's trash rather than
 * unlinking it, and it sends the platform's own reason when that refuses — a
 * PC with no `gio` and no `trash-put` is the case this exists for, and the
 * author can only learn it from here. So the reason is thrown as it arrives
 * rather than replaced by one of ours.
 */
export async function deleteTheme(id) {
  const response = await fetch(
    `/api/themes/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if (response.ok) return;

  const body = await response.text().catch(() => "");
  // A refused removal is plain text; the 404 that answers a theme which is not
  // in the library is JSON, and its message is the one inside.
  let message;
  try {
    message = JSON.parse(body)?.error;
  } catch {
    // Not JSON: the text already is the host's reason.
  }
  throw new Error(
    message || body || `The host refused to remove it (${response.status}).`,
  );
}

/** What the author is asked before a theme leaves the library. Longer than the
 *  button and read before it, so it can say the two things that make the act
 *  safe to offer: which theme, and that the recycle bin is where it goes.
 *  Wording, control names and the `<dialog>` itself are the editor's, taken
 *  rather than reworded — one operation must not be described two ways. */
const DELETE_LEAD = "Move this theme to the recycle bin?";

/**
 * Asks before a removal, the way the editor's own dialog does: a `<dialog>`,
 * so it traps focus while it is open and gives it back to the Delete that
 * opened it when it closes, with no key handler of its own to maintain.
 */
function confirmRemoval(name, id) {
  const ask =
    `${DELETE_LEAD}\n\n${name} (${id}) will be moved to the recycle bin, ` +
    "where you can get it back.";
  const dialog = document.createElement("dialog");
  dialog.className = "theme-confirm";
  // A screen reader announces the dialog's name on opening, so it carries the
  // whole question rather than the lead line alone.
  dialog.setAttribute("aria-label", ask);

  const text = document.createElement("p");
  text.className = "theme-confirm-lead";
  text.textContent = ask;

  const actions = document.createElement("div");
  actions.className = "theme-confirm-actions";
  const yes = document.createElement("button");
  yes.type = "button";
  yes.textContent = "Delete";
  yes.setAttribute("data-theme-delete-yes", "");
  const no = document.createElement("button");
  no.type = "button";
  no.textContent = "Cancel";
  no.setAttribute("data-theme-delete-no", "");
  // Cancel first: it is the answer a dialog opened by mistake wants, and the
  // order it sits in is the order the keyboard reaches it.
  actions.append(no, yes);
  dialog.append(text, actions);

  return new Promise((resolve) => {
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      const accepted = dialog.returnValue === "remove";
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
      dialog.close?.("remove");
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
 * @param {readonly {readonly id: string, readonly name?: string, readonly author?: string}[]} themes
 * @param {{readonly active?: string | null, readonly onChoose: (id: string) => void, readonly onDelete?: (id: string) => Promise<void>, readonly templates?: readonly {readonly id: string, readonly name: string}[]}} options
 * @returns {DocumentFragment}
 */
export function themeList(
  themes,
  { active = null, onChoose, onDelete, templates = [] },
) {
  const fragment = document.createDocumentFragment();

  if (templates.length > 0) {
    fragment.append(groupLabel("Templates"));
  }

  for (const template of templates) {
    // A template has no stored package, so the thumbnail route cannot answer
    // for it and the reserved space is drawn directly — asking would be a 404,
    // and a 404 on a clean load is a console error.
    const row = document.createElement("a");
    row.className = "theme-option";
    row.dataset.template = template.id;
    row.href = "/editor/";
    row.append(placeholder(), rowText(template.name, "Opens in the editor"));
    fragment.append(row);
  }

  // With nothing saved, the empty group would be a heading over no rows.
  if (templates.length > 0 && themes.length > 0) {
    fragment.append(groupLabel("Your themes"));
  }

  for (const theme of themes) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "theme-option";
    row.dataset.theme = theme.id;
    row.setAttribute("aria-pressed", String(theme.id === active));

    const shot = document.createElement("img");
    shot.className = "theme-shot";
    // The row already names the theme, so the picture adds nothing to read.
    shot.alt = "";
    shot.src = `/api/themes/${encodeURIComponent(theme.id)}/thumbnail`;
    // No picture is a normal state, not a broken one: the element is swapped
    // for one of the same size, because an `<img>` whose source failed keeps
    // drawing the browser's own broken-image glyph over the space.
    shot.addEventListener("error", () => {
      shot.replaceWith(placeholder());
    });
    row.append(shot);

    const named = theme.name ?? theme.id;
    // Two themes can share a display name; the id tells them apart.
    const shared =
      themes.filter((other) => (other.name ?? other.id) === named).length > 1;
    row.append(
      rowText(
        shared ? `${named} (${theme.id})` : named,
        theme.author,
      ),
    );

    // The chosen theme is stated in words too, so the state does not rest on
    // a border weight alone.
    if (theme.id === active) {
      const current = document.createElement("span");
      current.className = "current";
      current.textContent = "Showing";
      row.append(current);
    }

    row.addEventListener("click", () => onChoose(theme.id));

    // Showing a theme and changing it are different acts, so they are different
    // controls: the button above is the consumer choosing, and this is the
    // author editing. A `<button>` cannot hold a link, so the row's two
    // controls are siblings inside one row.
    const edit = document.createElement("a");
    edit.className = "theme-edit";
    edit.href = `/editor/?theme=${encodeURIComponent(theme.id)}`;
    edit.textContent = "Edit";
    // A row's name is not the link's, so read alone in a list of links every
    // one of these would be "Edit". The theme's own name is what tells them
    // apart, and the visible "Edit" is kept inside it.
    edit.setAttribute("aria-label", `Edit ${named} in the editor`);

    const wrapper = document.createElement("div");
    wrapper.className = "theme-row";
    wrapper.append(row, edit);

    /**
     * Removal sits beside choosing and editing rather than replacing either: a
     * theme an author cannot get rid of is an experiment they can never clear
     * away, and on a host page the library listing is the only place they
     * look. Offered only where a removal exists to make — the same rule the
     * editor's chooser follows, for the same reason.
     */
    if (onDelete !== undefined) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "theme-delete";
      remove.textContent = "Delete";
      // Read in a list of controls, several identical "Delete"s name nothing;
      // the theme's own name is what tells them apart, and the visible word
      // stays inside the name so the two agree.
      remove.setAttribute(
        "aria-label",
        `Delete ${named} — moved to the recycle bin`,
      );

      // Said on the row rather than in a page-level status line: it belongs to
      // this theme, and a refusal leaves the row exactly where it was.
      const note = document.createElement("p");
      note.className = "theme-delete-note";
      note.setAttribute("role", "status");
      note.hidden = true;

      remove.addEventListener("click", async () => {
        const accepted = await confirmRemoval(named, theme.id);
        if (!accepted) return;
        remove.disabled = true;
        try {
          await onDelete(theme.id);
          // Gone from the listing, because the host has it no more and the row
          // would otherwise offer to choose what is not there.
          wrapper.remove();
        } catch (error) {
          // Nothing was lost, so the row stays and the host's own reason is on
          // screen: a silent failure here is indistinguishable from a delete
          // that worked, and on a PC with no trash command this text is the
          // only way the author learns why.
          note.textContent =
            error instanceof Error ? error.message : String(error);
          note.hidden = false;
          remove.disabled = false;
        }
      });

      wrapper.append(remove, note);
    }

    fragment.append(wrapper);
  }

  return fragment;
}
