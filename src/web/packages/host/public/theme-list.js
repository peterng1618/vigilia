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
 * Dependency-free source, like the pages that load it: the host serves these
 * files itself, so they must not need a build step or a network fetch.
 */

/**
 * @param {readonly {readonly id: string, readonly name?: string, readonly author?: string}[]} themes
 * @param {{readonly active?: string | null, readonly onChoose: (id: string) => void}} options
 * @returns {DocumentFragment}
 */
export function themeList(themes, { active = null, onChoose }) {
  const fragment = document.createDocumentFragment();

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
      const placeholder = document.createElement("div");
      placeholder.className = "theme-shot";
      placeholder.dataset.placeholder = "";
      shot.replaceWith(placeholder);
    });
    row.append(shot);

    const text = document.createElement("span");
    text.className = "theme-text";
    const named = theme.name ?? theme.id;
    // Two themes can share a display name; the id tells them apart.
    const shared =
      themes.filter((other) => (other.name ?? other.id) === named).length > 1;
    text.append(shared ? `${named} (${theme.id})` : named);
    if (theme.author !== undefined) {
      const by = document.createElement("span");
      by.className = "by";
      by.textContent = theme.author;
      text.append(by);
    }
    row.append(text);

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
