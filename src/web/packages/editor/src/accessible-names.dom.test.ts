// @vitest-environment jsdom
import { Canvas, Rect, Textbox } from "fabric/es";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArtboardPanel } from "./artboard-panel.js";
import { createPalettePanel } from "./palette-manager/panel.js";
import { createSelectionInspector } from "./selection-inspector/index.js";
import { createTypePresetPanel } from "./type-preset-manager/panel.js";

/**
 * Every control these panels render has a name a screen reader reads.
 *
 * The panels are audited together because the defect was in all of them and a
 * test per panel would let the next unnamed control in be a new finding rather
 * than a red test. The names themselves are checked by name in the panels' own
 * tests; what is checked here is the invariant, so a new field added without
 * one fails here.
 *
 * The audit grew from three panels to four when vg-103's fix reached the chart
 * settings section and the very next control written beside it — the vertical
 * text alignment select — shipped with no `id` at all. vg-103's own test walked
 * one section's controls, so the shape of the fix was "a section", and a
 * control written tomorrow in a different section was nobody's red test.
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

  it("names each control by a label that holds nothing else", () => {
    // The one rule that separates a label which is *legitimately* unassociated
    // from one that is associated by containment and should not be. A label
    // with no `for` names the first labelable element inside it, and it is
    // named by its own text content — so a second element left inside it joins
    // the control's accessible name, whether or not that element is labelable.
    //
    // Measured on the live run editor: the Format field was announced as
    // "Format 04:38 Tokens: YYYY YY · MMMM MMM MM M · dddd ddd · DD D · HH H
    // hh h · mm ss · A a. Words in [square brackets]." — a live clock and a
    // whole vocabulary, read as the field's name, changing every minute. The
    // preview is a `<span>` and the vocabulary a `<p>`, neither of them
    // labelable, so counting labelable descendants would have passed it.
    //
    // So this is not "every label needs an `htmlFor`". A `<legend>`, a group
    // heading and a label wrapping exactly one control are all fine — and a
    // control's own children do not count, because the platform reads a
    // `<select>`'s options as its value rather than as the label's words.
    const { root } = mountPanels();
    const crowded = Array.from(root.querySelectorAll("label"))
      .filter((label) => label.htmlFor === "")
      .filter((label) => {
        const children = [...label.children];
        return (
          children.length > 1 ||
          (children[0] !== undefined && !children[0].matches(LABELABLE))
        );
      })
      .map((label) => identity(label));
    expect(crowded).toEqual([]);
  });

  it("leaves no two controls sharing one id", () => {
    // The run editor renders the same fields once per run, so a positional id
    // would collide and the second control's label would name the first.
    const { root } = mountPanels();
    const seen = new Map<string, number>();
    for (const element of root.querySelectorAll<HTMLElement>("[id]")) {
      seen.set(element.id, (seen.get(element.id) ?? 0) + 1);
    }
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("gives every form control an id, so no field here is reachable only by position", () => {
    // Form controls, not buttons: a button is named by its own text and is
    // found by role and name, while a field is the thing a `<label for>` and an
    // `aria-labelledby` have to point at. vg-103 fixed one section and the
    // vertical text alignment select written beside it a moment later still
    // shipped with none, because the test walked the section rather than the
    // editor.
    const { root } = mountPanels();
    const anonymous = Array.from(
      root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea",
      ),
    )
      .filter((control) => control.id === "")
      .map(identity);
    expect(anonymous).toEqual([]);
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

/** The panels mounted at once, each in a state that shows every field it can
    render: a gradient with stops, a font picker, a delete control, and a text
    object with a run bound to a clock — the inspector's richest selection, and
    the one that reaches the format and zone fields nothing else does. */
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
    { name: "Living Room", version: "1.2.3", themeLanguage: "en" },
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

  mountSelectionInspector(root);

  return { root };
}

/**
 * The selection inspector, on a text object whose one run reads a clock, and on
 * a shape.
 *
 * A shape and a text object render disjoint field sets — panel material and a
 * corner radius against runs, layout and bindings — so the audit needs both.
 * One canvas and one inspector each, rather than two renders of one: `render()`
 * clears the panel it rebuilds, and two inspectors on one canvas would both
 * follow the selection to whichever object was made active last.
 */
function mountSelectionInspector(root: HTMLElement): void {
  const text = new Textbox("", { id: "clock-label" });
  text.set("vigiliaText", {
    align: "centre",
    verticalAlign: "middle",
    box: { width: 140, height: 27 },
    runs: [{ kind: "value", bindingId: "clock-time" }],
  });
  const shape = new Rect({ left: 0, top: 0, width: 40, height: 20 });
  shape.set("vigiliaGlass", { blurRadius: 16 });

  for (const selection of [text, shape]) {
    const canvas = new Canvas(document.createElement("canvas"));
    canvas.add(selection);
    canvas.setActiveObject(selection);
    const editor = {
      canvas,
      historyManager: { saveState: vi.fn() },
      errorManager: { warn: vi.fn(), error: vi.fn() },
      cropManager: { active: false, target: undefined },
    };
    const globals = {
      palette: {
        ink: { name: "Ink", value: { kind: "solid", color: "#ffffff" } },
      },
      typePresets: {
        body: { name: "Body", value: { family: "Inter", size: 16 } },
      },
    };

    const host = document.createElement("div");
    root.append(host);
    createSelectionInspector(host, {
      editor: editor as never,
      globals: globals as never,
      nodeBindings: () => [
        { id: "clock-time", semanticKey: "date.today" },
      ],
      refreshGlass: vi.fn(),
    });
  }
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
