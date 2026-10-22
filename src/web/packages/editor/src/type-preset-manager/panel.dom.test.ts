// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTypePreset } from "../selection-inspector/appearance.js";
import { uiCopy } from "../ui-copy.js";
import { createTypePresetPanel } from "./panel.js";

// The panel appends to the host it is given, and one case reads through
// `document` rather than through the panel's own root, so one test's markup
// would otherwise be the next test's first match.
afterEach(() => document.body.replaceChildren());

const presets = {
  body: { name: "Body", value: { family: "Inter", size: 16 } },
  caption: { name: "Caption", value: { family: "Inter", size: 12 } },
};

describe("type preset panel", () => {
  it("builds its own section, whose heading names the panel", () => {
    const panel = createTypePresetPanel(document.body, vi.fn());
    panel.render(presets);

    // `panel-labels.spec.ts` reads every `section h2` and matches the panel's
    // name against its text, so the heading is a plain `<h2>` carrying exactly
    // the table's word and no disclosure chrome beside it.
    expect(panel.root.tagName).toBe("SECTION");
    expect(panel.root.querySelector("h2")?.textContent).toBe(
      uiCopy.panels.typePresets,
    );
  });

  it("renders the chooser and a resolution line for each preset", () => {
    const panel = createTypePresetPanel(document.body, vi.fn());
    panel.render(presets);

    expect(
      panel.root.querySelector("[data-yunari-type-preset]"),
    ).not.toBeNull();
    // The value is `resolveTypePreset`'s own answer, read from the same record
    // the panel is given — never a copy of the "family weight sizepx" rule.
    expect(
      panel.root.querySelector('[data-yunari-type-preset-row="body"]')
        ?.textContent,
    ).toContain(
      resolveTypePreset({ typePresets: presets }, "typePresets.body"),
    );
    expect(
      panel.root.querySelector('[data-yunari-type-preset-row="caption"]'),
    ).not.toBeNull();
  });

  it("renders the chosen preset's own fields", () => {
    // A delete port, so the reassignment row — one of the fields — is on
    // screen rather than absent.
    const panel = createTypePresetPanel(document.body, vi.fn(), vi.fn());
    panel.render(presets);

    // The factory's draw is synchronous (`flushSync`), so the fields exist the
    // moment `render` returns — the contract the imperative panel had, and what
    // `editor-session` reads straight after a refresh.
    for (const hook of [
      "type-name",
      "type-family",
      "type-size",
      "type-weight",
      "type-line-height",
      "type-letter-spacing",
      "type-replacement",
      "type-delete",
    ]) {
      expect(
        panel.root.querySelector(`[data-yunari-${hook}]`),
        hook,
      ).not.toBeNull();
    }
  });

  it("unmounts its React tree and removes the section on disposal", () => {
    const panel = createTypePresetPanel(document.body, vi.fn());
    panel.render(presets);

    panel.destroy();

    expect(panel.root.isConnected).toBe(false);
    // The tree really went with it: a container that React still owned would
    // hand back the markup it rendered.
    expect(panel.root.querySelector("[data-yunari-type-preset]")).toBeNull();
  });
});
