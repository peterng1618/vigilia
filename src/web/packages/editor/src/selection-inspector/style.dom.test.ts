// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createDocumentReferencesPanel } from "./style.js";

const globals = {
  palette: {
    ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
  },
  typePresets: {
    body: { name: "Body", value: { family: "Inter", size: 16, weight: "600" } },
  },
} as never;

function setup() {
  const host = document.createElement("div");
  let current = globals;
  const panel = createDocumentReferencesPanel(host, {
    globals: () => current,
  });
  return {
    panel,
    host,
    setGlobals: (next: unknown): void => {
      current = next as never;
    },
  };
}

describe("the document's references", () => {
  it("lists the document's tokens and presets by name, and resolves them", () => {
    const { host } = setup();

    // The authored name, then what it resolves to: the panel answers "what can
    // this document reference, and what does each one mean".
    const ink = host.querySelector('[data-vigilia-resolution="Ink"]');
    expect(ink?.textContent).toContain("Ink");
    expect(ink?.textContent).toContain("#e8ecf3");
    const body = host.querySelector('[data-vigilia-resolution="Body"]');
    expect(body?.textContent).toContain("Body");
    expect(body?.textContent).toContain("Inter");
  });

  it("skips the absence of a token", () => {
    const { host, panel, setGlobals } = setup();
    setGlobals({
      palette: {
        none: { name: "None", value: { kind: "solid", color: "#00000000" } },
        ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
      },
      typePresets: {},
    });
    panel.render();

    // `none` is the absence of a token, not one of them: listing it would offer
    // the author a reference that means "no reference".
    expect(host.textContent).toContain("Ink");
    expect(host.textContent).not.toContain("None");
  });

  it("shows globals that changed after the panel mounted", () => {
    const { host, panel, setGlobals } = setup();

    setGlobals({
      palette: {
        ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
        accent: { name: "Accent", value: { kind: "solid", color: "#ff8800" } },
      },
      typePresets: {},
    });
    panel.render();

    // Read on demand, so a theme edit cannot leave a stale resolution behind.
    expect(host.textContent).toContain("Accent");
  });
});
