// @vitest-environment jsdom
import { IText, Rect } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createStylePanel } from "./style.js";

const globals = {
  palette: {
    ink: { name: "Ink", value: { kind: "solid", color: "#e8ecf3" } },
  },
  typePresets: {
    body: { name: "Body", value: { family: "Inter", size: 16, weight: "600" } },
  },
} as never;

function setup(active: unknown) {
  const host = document.createElement("div");
  let current = globals;
  const panel = createStylePanel(host, {
    editor: {
      canvas: {
        getActiveObject: () => active,
        requestRenderAll: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      },
      historyManager: { saveState: vi.fn() },
      errorManager: { warn: vi.fn(), error: vi.fn() },
    } as never,
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

describe("the style tab", () => {
  it("shows a selection's resolved paint and type", () => {
    const text = new IText("Hi", { left: 0, top: 0 });
    text.set({
      vigiliaPaint: { fill: "palette.ink" },
      vigiliaText: {
        runs: [{ kind: "literal", text: "Hi", typePreset: "typePresets.body" }],
      },
    });
    const { host } = setup(text);

    // What the author picked, and what it actually means.
    const lines = [...host.querySelectorAll("[data-vigilia-resolution]")].map(
      (line) => line.textContent,
    );
    expect(lines.join("\n")).toContain("palette.ink");
    expect(lines.join("\n")).toContain("#e8ecf3");
    expect(lines.join("\n")).toContain("Inter");
  });

  it("lists the document's globals when nothing is selected", () => {
    const { host } = setup(undefined);

    const text = host.textContent ?? "";
    expect(text).toContain("Ink");
    expect(text).toContain("Body");
  });

  it("shows globals that changed after the panel mounted", () => {
    const { host, panel, setGlobals } = setup(undefined);

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

  it("stops listing globals once something is selected", () => {
    const rect = new Rect({ left: 0, top: 0, width: 10, height: 10 });
    const { host } = setup(rect);

    expect(host.querySelector("[data-vigilia-globals]")).toBeNull();
  });
});
