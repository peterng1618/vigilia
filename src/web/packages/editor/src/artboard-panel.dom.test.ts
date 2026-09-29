// @vitest-environment jsdom
import { instantIn, parseInstant } from "@vigilia/renderer-core";
import { describe, expect, it, vi } from "vitest";
import { createArtboardPanel } from "./artboard-panel.js";

/** The platform's own spelling of a date's month and weekday, at UTC — the
    convention `names.ts` formats at, derived here without importing it, so a
    broken name function cannot make both sides of an assertion wrong together. */
function spelledAt(parts: NonNullable<ReturnType<typeof parseInstant>>) {
  const at = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (locale: string, options: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(at);
}

describe("artboard panel", () => {
  it("shows and returns valid artboard properties", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, change);

    panel.render({ width: 1280, height: 720 });

    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;
    width.value = "1000";
    width.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenCalledWith({
      width: 1000,
      height: 720,
    });
  });

  it("carries the document's content fit through an edit rather than resetting it", () => {
    // The panel does not own this value, so it must not decide it: a size
    // change that rewrote it to contain would silently uncrop a cover theme
    // whose author set the value by hand.
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, change);
    panel.render({ width: 1280, height: 720, contentFit: "cover" });

    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;
    width.value = "1000";
    width.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith({
      width: 1000,
      height: 720,
      contentFit: "cover",
    });
  });

  it("refuses an invalid dimension and restores the last valid value", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, change);
    panel.render({ width: 1280, height: 720 });
    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;

    width.value = "0";
    width.dispatchEvent(new Event("change"));

    expect(change).not.toHaveBeenCalled();
    expect(width.value).toBe("1280");
  });

  it("selects persisted palette tokens for artboard paint", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(
      document.body,
      {
        palette: {
          background: { name: "Background", value: "#101216" },
          bars: { name: "Bars", value: "#000000" },
        },
      },
      change,
    );
    panel.render({
      width: 1280,
      height: 720,
      background: { ref: "palette.background" },
      barColor: { ref: "palette.bars" },
    });

    const background = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-artboard-background]",
    )!;
    const bars = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-artboard-bar-color]",
    )!;
    expect(background.value).toBe("palette.background");
    expect(bars.value).toBe("palette.bars");

    background.value = "palette.bars";
    background.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ background: { ref: "palette.bars" } }),
    );
  });

  it("keeps an uneditable literal bar colour when another artboard field changes", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(
      document.body,
      {
        palette: { background: { name: "Background", value: "#101216" } },
      },
      change,
    );
    panel.render({
      width: 1280,
      height: 720,
      background: { ref: "palette.background" },
      barColor: { value: "#e20074" },
    });

    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;
    width.value = "1000";
    width.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 1000,
        barColor: { value: "#e20074" },
      }),
    );
  });

  it("emits declared background media and theme metadata", () => {
    const artboardChange = vi.fn();
    const metadataChange = vi.fn();
    const panel = createArtboardPanel(
      document.body,
      undefined,
      artboardChange,
      {
        assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
        onMetadataChange: metadataChange,
      },
    );
    panel.render({ width: 1280, height: 720 }, { name: "Before" });

    const name = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-theme-name]",
    )!;
    name.value = "Living Room";
    name.dispatchEvent(new Event("change"));
    expect(metadataChange).toHaveBeenLastCalledWith({
      name: "Living Room",
      locale: "en",
    });

    const source = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-background-asset]",
    )!;
    source.value = "clip";
    source.dispatchEvent(new Event("change"));
    expect(artboardChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        backgroundMedia: { assetId: "clip", fit: "cover" },
      }),
    );
  });

  it("preserves the displayed release version during metadata edits", () => {
    const metadataChange = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, vi.fn(), {
      onMetadataChange: metadataChange,
    });
    panel.render(
      { width: 1280, height: 720 },
      { name: "Before", version: "1.2.3" },
    );

    const name = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-theme-name]",
    )!;
    const version = panel.root.querySelector<HTMLOutputElement>(
      "[data-vigilia-theme-version]",
    )!;
    name.value = "After";
    name.dispatchEvent(new Event("change"));

    expect(metadataChange).toHaveBeenLastCalledWith({
      name: "After",
      version: "1.2.3",
      locale: "en",
    });
    expect(version.tagName).toBe("OUTPUT");
    expect(version.value).toBe("1.2.3");
  });

  it("writes the chosen language into the theme's metadata", () => {
    const metadataChange = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, vi.fn(), {
      onMetadataChange: metadataChange,
    });
    panel.render(
      { width: 1280, height: 720 },
      { name: "Before", locale: "en" },
    );

    const language = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-theme-language]",
    )!;
    expect(language.value).toBe("en");

    const vietnamese = Array.from(language.options).find(
      (option) => option.value === "vi",
    );
    // The list must actually offer it; a `select.value = "vi"` with no matching
    // option silently reads back as "" and the test would pass vacuously.
    expect(vietnamese).toBeDefined();
    language.value = "vi";
    language.dispatchEvent(new Event("change"));

    expect(metadataChange).toHaveBeenLastCalledWith({
      name: "Before",
      locale: "vi",
    });

    // The spec's "resolved names shown live": the author sees the words the
    // language actually spells, not only its English label.
    const sample = panel.root.querySelector<HTMLOutputElement>(
      "[data-vigilia-theme-language-sample]",
    )!.textContent!;
    const spell = spelledAt(parseInstant(instantIn(Date.now()))!);
    expect(sample).toContain(spell("vi", { month: "long" }));
    expect(sample).toContain(spell("vi", { weekday: "long" }));
    expect(sample).not.toContain(spell("en", { month: "long" }));
  });

  it("gives the description a multi-line field, so its prose can be read", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    // The starter's own sentence, at its real length. A single-line input in a
    // 161px box shows the first twenty characters of it and nothing else.
    const description =
      "The reference composition: a clock, two usage cards, two memory rings, a performance chart and stacked storage and network panels.";
    panel.render({ width: 1672, height: 941 }, { name: "Before", description });

    const field = panel.root.querySelector<HTMLTextAreaElement>(
      "[data-vigilia-theme-description]",
    )!;
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.value).toBe(description);
    // The whole sentence on screen at once, rather than a box an author has to
    // scroll sideways through to read the end of.
    expect(field.rows).toBeGreaterThan(1);
    expect(field.style.gridColumn).toBe("1 / -1");
    // F1.19's work: the visible label is still the name a screen reader reads.
    const label = panel.root.querySelector<HTMLLabelElement>(
      `label[for="${field.id}"]`,
    );
    expect(label?.textContent).toBe("Description");
  });

  it("offers the media's fit and no fit control of its own", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render({ width: 1280, height: 720, contentFit: "cover" });

    // The artboard's own fit is the *content's*, it is always contain, and an
    // author cannot set it. Beside "Media fit" it was labelled "Preview fit",
    // so one panel offered two controls choosing between the same two words for
    // two different subjects — read as "how my picture looks in the preview",
    // which it never was.
    expect(
      panel.root.querySelector("[data-vigilia-artboard-fit-mode]"),
    ).toBeNull();
    const mediaFit = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-background-media-fit]",
    )!;
    expect(
      Array.from(mediaFit.options, (option) => option.textContent),
    ).toEqual(["Cover", "Contain"]);
  });

  it("says on screen that the date is a sample of the chosen language", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render(
      { width: 1280, height: 720 },
      { name: "Before", locale: "vi" },
    );

    // It has said so to a screen reader since ad45667 gave it an aria-label,
    // which is the whole of the problem: the panel printed "September Tuesday"
    // on a line of its own and told a sighted author nothing. A label the
    // author can see is what the F1.19 pairing already made the name.
    const sample = panel.root.querySelector<HTMLOutputElement>(
      "[data-vigilia-theme-language-sample]",
    )!;
    const label = panel.root.querySelector<HTMLLabelElement>(
      `label[for="${sample.id}"]`,
    );
    expect(label?.textContent).toBe("Sample");
    // The sample keeps the status-region name a screen reader announces, which
    // is longer than the column a visible label has to fit in.
    expect(sample.getAttribute("aria-label")).toBe(
      "Sample in the chosen language",
    );
    expect(sample.id).not.toBe("");
  });

  it("keeps a declared language that is outside the list", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render(
      { width: 1280, height: 720 },
      { name: "Hand-edited", locale: "cy" },
    );

    const language = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-theme-language]",
    )!;

    // Welsh is not one of the fifteen, but a document declaring it must not be
    // silently rewritten to English by the panel that displays it.
    expect(language.value).toBe("cy");
  });
});

/** The preset controls, read the way the panel itself reads them. */
function presets(root: HTMLElement): {
  ratio: HTMLSelectElement;
  orientation: HTMLSelectElement;
  resolution: HTMLSelectElement;
} {
  return {
    ratio: root.querySelector<HTMLSelectElement>(
      "[data-vigilia-artboard-ratio]",
    )!,
    orientation: root.querySelector<HTMLSelectElement>(
      "[data-vigilia-artboard-orientation]",
    )!,
    resolution: root.querySelector<HTMLSelectElement>(
      "[data-vigilia-artboard-resolution]",
    )!,
  };
}

describe("artboard presets in the panel", () => {
  it("shows the preset the document's size came from", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render({ width: 1080, height: 2340, contentFit: "cover" });

    expect(presets(panel.root)).toMatchObject({
      ratio: expect.objectContaining({ value: "19.5:9" }),
      orientation: expect.objectContaining({ value: "portrait" }),
      resolution: expect.objectContaining({ value: "1080p" }),
    });
  });

  it("derives the artboard size from a change to any of the three", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, change);
    panel.render({ width: 1920, height: 1080, contentFit: "cover" });
    const { ratio, orientation, resolution } = presets(panel.root);

    resolution.value = "4k";
    resolution.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenLastCalledWith({
      width: 3840,
      height: 2160,
      contentFit: "cover",
    });

    orientation.value = "portrait";
    orientation.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenLastCalledWith({
      width: 2160,
      height: 3840,
      contentFit: "cover",
    });

    ratio.value = "4:3";
    ratio.dispatchEvent(new Event("change"));
    // Still portrait from the step above, so the ratio's long edge is now the
    // short one: the three controls are read together, not one at a time.
    expect(change).toHaveBeenLastCalledWith({
      width: 2160,
      height: 2880,
      contentFit: "cover",
    });
  });

  it("names a custom reading rather than a preset the document is not at", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render({ width: 1000, height: 700 });

    for (const select of Object.values(presets(panel.root)))
      expect(select.value).toBe("");
  });

  it("keeps the free size fields for a size no preset names", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, change);
    panel.render({ width: 1000, height: 700 });

    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;
    width.value = "1600";
    width.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith({
      width: 1600,
      height: 700,
    });
  });

  it("derives a whole preset from a custom size without leaving a control unset", () => {
    const change = vi.fn();
    const panel = createArtboardPanel(document.body, undefined, change);
    panel.render({ width: 1000, height: 700, contentFit: "cover" });
    const { ratio, orientation, resolution } = presets(panel.root);

    // Choosing one of the three means choosing all three — the other two were
    // Custom, and leaving them so would show a size the controls deny.
    ratio.value = "4:3";
    ratio.dispatchEvent(new Event("change"));

    expect(change).toHaveBeenLastCalledWith({
      width: 1440,
      height: 1080,
      contentFit: "cover",
    });
    expect({
      ratio: ratio.value,
      orientation: orientation.value,
      resolution: resolution.value,
    }).toEqual({
      ratio: "4:3",
      orientation: "landscape",
      resolution: "1080p",
    });
  });

  it("leaves the custom reading unselectable", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render({ width: 1000, height: 700 });

    // A reading, not a choice: an author cannot ask for a size that is not a
    // preset, and cannot get stuck on one they chose by accident.
    for (const select of Object.values(presets(panel.root))) {
      const custom = Array.from(select.options).find(
        (option) => option.value === "",
      )!;
      expect(custom.disabled).toBe(true);
    }
  });

  it("states that a size change does not move content, beside the controls that change it", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render({ width: 1672, height: 941 });

    // The one-click ratio change is the whole of F1.33: the author picks a
    // ratio and content silently falls outside the new frame. The panel owns
    // what a size means, so it says so where the control is — before the click,
    // not after. It cannot count what is outside, because the scene is not its
    // to read, so it states the rule and never a number it has not measured.
    const note = panel.root.querySelector("[data-vigilia-artboard-note]");
    expect(note?.textContent).toBe(
      "Objects are not moved or resized. Anything outside the artboard is not shown on a display.",
    );
    expect(note?.getAttribute("role")).toBe("note");
  });

  it("describes the width box with that note, so it reaches a screen reader too", () => {
    const panel = createArtboardPanel(document.body, undefined, vi.fn());
    panel.render({ width: 1672, height: 941 });

    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;
    const note = panel.root.querySelector("[data-vigilia-artboard-note]")!;
    expect(width.getAttribute("aria-describedby")).toBe(note.id);
  });
});
