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

    panel.render({ width: 1280, height: 720, fitMode: "cover" });
    const select = panel.root.querySelector<HTMLSelectElement>(
      "[data-vigilia-artboard-fit-mode]",
    )!;
    expect(select.value).toBe("cover");

    const width = panel.root.querySelector<HTMLInputElement>(
      "[data-vigilia-artboard-width]",
    )!;
    width.value = "1000";
    width.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenCalledWith({
      width: 1000,
      height: 720,
      fitMode: "cover",
    });

    select.value = "contain";
    select.dispatchEvent(new Event("change"));
    expect(change).toHaveBeenLastCalledWith({
      width: 1000,
      height: 720,
      fitMode: "contain",
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
