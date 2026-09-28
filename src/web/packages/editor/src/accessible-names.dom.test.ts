// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createArtboardPanel } from "./artboard-panel.js";
import { createPalettePanel } from "./palette-manager/panel.js";
import { createTypePresetPanel } from "./type-preset-manager/panel.js";

/**
 * Every control these three panels render has a name a screen reader reads.
 *
 * The three panels are audited together because the defect was in all three and
 * a test per panel would let the fourth unnamed control in be a new finding
 * rather than a red test. The names themselves are checked by name in the
 * panels' own tests; what is checked here is the invariant, so a new field
 * added without one fails here.
 */

/** The elements a person can focus, so the audit is over what they can reach. */
const FOCUSABLE = "a[href],button,input,select,textarea,[tabindex]";

/** The elements a `<label for>` may name. `output` is one of them. */
const LABELABLE = "button,input,meter,output,progress,select,textarea";

afterEach(() => document.body.replaceChildren());

describe("editor panels", () => {
  it("gives every control an accessible name", () => {
    const { root } = mountPanels();
    const unnamed = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => accessibleName(element) === "")
      .map(identity);
    expect(unnamed).toEqual([]);
  });

  it("leaves no label naming nothing", () => {
    const { root } = mountPanels();
    const dangling = Array.from(root.querySelectorAll("label"))
      .filter((label) => {
        if (label.htmlFor !== "") return label.htmlFor === "";
        return label.querySelector(LABELABLE) === null;
      })
      .map((label) => label.textContent ?? "");
    expect(dangling).toEqual([]);
  });

  it("names the release version, which no form control owns", () => {
    const { root } = mountPanels();
    const version = root.querySelector("[data-vigilia-theme-version]")!;
    expect(accessibleName(version)).toBe("Release version");
  });

  it("names every output, because an output announces itself", () => {
    // `output` is a live region: it speaks without being focused, so an
    // unnamed one is a status line with no subject.
    const { root } = mountPanels();
    const unnamed = Array.from(root.querySelectorAll("output"))
      .filter((element) => accessibleName(element) === "")
      .map((element) => element.outerHTML.slice(0, 60));
    expect(unnamed).toEqual([]);
  });
});

/** The three panels mounted at once, each in a state that shows every field it
    can render: a gradient with stops, a font picker and a delete control. */
function mountPanels(): { root: HTMLElement } {
  const root = document.createElement("div");
  document.body.append(root);

  createArtboardPanel(
    root,
    {
      palette: {
        background: { name: "Background", value: "#101216" },
        bars: { name: "Bars", value: "#000000" },
      },
    },
    () => undefined,
    {
      assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
      onMetadataChange: () => undefined,
    },
  ).render(
    { width: 1280, height: 720 },
    { name: "Living Room", version: "1.2.3", locale: "en" },
  );

  createPalettePanel(
    root,
    () => undefined,
    () => undefined,
  ).render({
    none: { name: "None", value: { kind: "solid", color: "transparent" } },
    accent: { name: "Accent", value: { kind: "solid", color: "#00b8d9" } },
    glow: {
      name: "Glow",
      value: {
        kind: "gradient",
        angle: 45,
        stops: [
          { offset: 0, color: "#ffffff" },
          { offset: 1, color: "#000000" },
        ],
      },
    },
  });
  // The reserved token renders one field; every other renders the whole set,
  // including reassign and delete, so the audit has to look at both.
  selectPaletteToken(root, "glow");

  createTypePresetPanel(
    root,
    () => undefined,
    () => undefined,
    {
      applyFace: async () => undefined,
      applyTrio: async () => undefined,
      preview: async () => undefined,
    },
  ).render({
    body: { name: "Body", value: { family: "Inter", size: 16 } },
    caption: { name: "Caption", value: { family: "Inter", size: 12 } },
  });

  return { root };
}

/**
 * The name a control is announced under, as far as jsdom can be asked: the same
 * four mechanisms the platform uses, in the platform's own order of precedence.
 * A browser measures the real thing — this is the regression net under it.
 */
function accessibleName(element: Element): string {
  const labelled = element.getAttribute("aria-label")?.trim();
  if (labelled !== undefined && labelled !== "") return labelled;
  const referenced = element.getAttribute("aria-labelledby");
  if (referenced !== null && referenced !== "") {
    const text = referenced
      .split(/\s+/)
      .map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text !== "") return text;
  }
  if (element.id !== "") {
    const labels =
      element.ownerDocument.querySelectorAll<HTMLLabelElement>("label[for]");
    for (const label of labels) {
      if (label.htmlFor === element.id) return label.textContent?.trim() ?? "";
    }
  }
  const wrapping = element.closest("label")?.textContent?.trim() ?? "";
  if (wrapping !== "") return wrapping;
  // Name from content, which is how a button is named and how a select's option
  // text is emphatically not: the option list is the control's value.
  return element.tagName === "BUTTON"
    ? (element.textContent?.trim() ?? "")
    : "";
}

/** A stable handle for the failure message: the attribute the panel is found by. */
function identity(element: HTMLElement): string {
  const data = Object.entries(element.dataset).find(
    ([, value]) => value === "",
  );
  return data === undefined
    ? element.outerHTML.slice(0, 60)
    : `[data-${data[0]}]`;
}

function selectPaletteToken(root: HTMLElement, id: string): void {
  const token = root.querySelector<HTMLSelectElement>(
    "[data-vigilia-palette-token]",
  )!;
  token.value = id;
  token.dispatchEvent(new Event("change"));
}
