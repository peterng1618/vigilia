// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { themeList } from "../public/theme-list.js";

/** The chooser at `/` and the settings page both list saved themes, so the row
 * is drawn once here. A chooser that drew its own would be the second copy of
 * the thumbnail, the hatched stand-in and the duplicated-name disambiguation. */

const THEMES = [
  { id: "living-room", name: "Living Room" },
  { id: "studio", name: "Studio" },
];

/** Every row is choosable, so the tests pass a handler they never call. */
const onChoose = (): void => undefined;

function mount(frag: DocumentFragment): HTMLElement {
  const host = document.createElement("div");
  host.append(frag);
  document.body.replaceChildren(host);
  return host;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("a saved theme as one row", () => {
  it("asks for each theme's picture", () => {
    const host = mount(themeList(THEMES, { onChoose }));
    const shots = [
      ...host.querySelectorAll<HTMLImageElement>("img.theme-shot"),
    ];

    expect(shots.map((shot) => shot.getAttribute("src"))).toEqual([
      "/api/themes/living-room/thumbnail",
      "/api/themes/studio/thumbnail",
    ]);
    // The name beside it is the theme's; the picture adds nothing for a reader.
    expect(shots.every((shot) => shot.alt === "")).toBe(true);
  });

  it("falls back to a hatched stand-in when a theme has no picture", () => {
    const host = mount(themeList(THEMES, { onChoose }));
    const shot = host.querySelector("img.theme-shot");
    shot?.dispatchEvent(new Event("error"));

    // A theme saved before pictures existed has none, which is not a broken
    // one: the element is swapped for one of the same size, because a failed
    // `<img>` keeps drawing the browser's own glyph over the space.
    expect(host.querySelectorAll("img.theme-shot")).toHaveLength(1);
    expect(host.querySelector("[data-placeholder]")).not.toBeNull();
  });

  it("tells two themes that share a name apart by their id", () => {
    const host = mount(
      themeList(
        [
          { id: "studio", name: "Studio" },
          { id: "studio-annexe", name: "Studio" },
        ],
        { onChoose },
      ),
    );
    const names = [...host.querySelectorAll(".theme-text")].map(
      (text) => text.textContent,
    );

    expect(names).toEqual(["Studio (studio)", "Studio (studio-annexe)"]);
  });

  it("states the chosen theme in words, not by a border alone", () => {
    const host = mount(themeList(THEMES, { active: "studio", onChoose }));
    const rows = [...host.querySelectorAll("button[data-theme]")];

    expect(rows.map((row) => row.getAttribute("aria-pressed"))).toEqual([
      "false",
      "true",
    ]);
    expect(rows[1]?.querySelector(".current")?.textContent).toBe("Showing");
  });

  it("names each row only once, so a screen reader reads a theme once", () => {
    const host = mount(themeList(THEMES, { onChoose }));
    const labels = [...host.querySelectorAll("button[data-theme]")].map(
      (row) => row.textContent,
    );

    expect(labels).toEqual(["Living Room", "Studio"]);
  });

  /** Changing a saved theme was impossible: the row chose which theme the
   * displays show, and nothing anywhere else opened one for editing. A save
   * was a place a theme could be put and never read back from. */
  describe("editing a theme, beside the control that displays it", () => {
    it("offers an edit link carrying that theme's id", () => {
      const host = mount(themeList(THEMES, { onChoose }));
      const edits = [
        ...host.querySelectorAll<HTMLAnchorElement>(".theme-edit"),
      ];

      expect(edits.map((edit) => edit.getAttribute("href"))).toEqual([
        "/editor/?theme=living-room",
        "/editor/?theme=studio",
      ]);
    });

    it("names the theme each link edits, because the word alone does not", () => {
      const host = mount(themeList(THEMES, { onChoose }));
      const names = [...host.querySelectorAll(".theme-edit")].map((edit) =>
        edit.getAttribute("aria-label"),
      );

      // Read in a list of links, six identical "Edit"s name nothing; the
      // visible "Edit" stays inside the name so the two agree.
      expect(names).toEqual([
        "Edit Living Room in the editor",
        "Edit Studio in the editor",
      ]);
      expect(
        [...host.querySelectorAll(".theme-edit")].every((edit) =>
          (edit.getAttribute("aria-label") ?? "").startsWith(
            edit.textContent ?? "",
          ),
        ),
      ).toBe(true);
    });

    it("keeps the edit link outside the button, so it is a link and not a label", () => {
      const host = mount(themeList(THEMES, { onChoose }));
      const row = host.querySelector("[data-theme='living-room']");

      // A link nested in a button cannot be focused or followed on its own:
      // the pointer goes to the button, and the keyboard has one stop that
      // chooses the theme rather than editing it.
      expect(row?.closest(".theme-edit")).toBeNull();
      expect(
        host.querySelector(".theme-row [data-theme] + .theme-edit"),
      ).not.toBeNull();
    });

    it("leaves the consumer's choice working, beside the new link", () => {
      const chosen = vi.fn();
      const host = mount(themeList(THEMES, { onChoose: chosen }));
      host
        .querySelector<HTMLButtonElement>("[data-theme='studio']")
        ?.dispatchEvent(new Event("click"));

      expect(chosen).toHaveBeenCalledWith("studio");
    });
  });
});

const TEMPLATES = [
  { id: "vigilia-starter-template", name: "Starter — System dashboard" },
];

/** A template is not a stored theme, so it is offered beside the stored ones
 *  and never inside the count of what this PC has saved. */
describe("a template the product ships, beside the saved themes", () => {
  const withTemplate = (): HTMLElement =>
    mount(themeList(THEMES, { onChoose, templates: TEMPLATES }));

  it("lists the template, and says which kind of row it is", () => {
    const host = withTemplate();
    const groups = [...host.querySelectorAll(".theme-group-label")].map(
      (label) => label.textContent,
    );

    expect(groups).toEqual(["Templates", "Your themes"]);
    // Two kinds of thing in one list, so the row says which it is rather than
    // letting a template read as a theme the author saved.
    expect(host.querySelector("[data-template]")?.textContent).toContain(
      "Starter — System dashboard",
    );
  });

  it("takes the consumer to the editor, because that is where a template lives", () => {
    const row = withTemplate().querySelector("[data-template]");

    // A template is not stored, so it cannot be chosen as the active theme;
    // the only honest action is to open it. An anchor is focusable and follows
    // the link, so the row needs no key handler of its own.
    expect(row?.tagName).toBe("A");
    expect(row?.getAttribute("href")).toBe("/editor/");
    // A screen reader reads the link's purpose from its name, not from where
    // the pointer is, so the row has to say where it goes.
    expect(row?.textContent).toContain("Opens in the editor");
  });

  it("asks for no picture, because a template has none to serve", () => {
    const host = withTemplate();

    // A thumbnail route is keyed by theme id and a template is not stored, so
    // asking for one is a 404 — a console error on a clean page load, which is
    // the failure a favicon link exists to remove. The reserved space is drawn
    // directly instead.
    expect(host.querySelectorAll("img")).toHaveLength(THEMES.length);
    expect(
      host.querySelector("[data-template] [data-placeholder]"),
    ).not.toBeNull();
  });

  it("draws exactly as it did before, when the product ships no template", () => {
    const host = mount(themeList(THEMES, { onChoose }));

    expect(host.querySelector(".theme-group-label")).toBeNull();
    expect(host.querySelector("[data-template]")).toBeNull();
  });
});
