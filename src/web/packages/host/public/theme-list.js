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
 * @param {readonly {readonly id: string, readonly name?: string, readonly author?: string}[]} themes
 * @param {{readonly active?: string | null, readonly onChoose: (id: string) => void, readonly templates?: readonly {readonly id: string, readonly name: string}[]}} options
 * @returns {DocumentFragment}
 */
export function themeList(themes, { active = null, onChoose, templates = [] }) {
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
    fragment.append(row);
  }

  return fragment;
}
