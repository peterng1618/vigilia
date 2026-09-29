// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
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
});
