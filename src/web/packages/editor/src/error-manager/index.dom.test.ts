// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createErrorManager, type EditorDiagnostic } from "./index.js";

describe("ErrorManager", () => {
  it("emits a structured editor:error event and logs it", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const seen: EditorDiagnostic[] = [];
    canvas.on(
      "editor:error" as never,
      ((diagnostic: EditorDiagnostic) => {
        seen.push(diagnostic);
      }) as never,
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const manager = createErrorManager(canvas);

    const cause = new Error("no permission");
    manager.error("clipboard", "Could not read the clipboard.", cause);

    expect(seen).toEqual([
      {
        category: "clipboard",
        message: "Could not read the clipboard.",
        cause,
      },
    ]);
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });

  it("emits editor:warning without a cause and omits the key entirely", () => {
    const canvas = new Canvas(document.createElement("canvas"));
    const seen: EditorDiagnostic[] = [];
    canvas.on(
      "editor:warning" as never,
      ((diagnostic: EditorDiagnostic) => {
        seen.push(diagnostic);
      }) as never,
    );
    const logged = vi.spyOn(console, "warn").mockImplementation(() => {});
    const manager = createErrorManager(canvas);

    manager.warn("snapping", "Ignored a non-finite anchor.");

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual({
      category: "snapping",
      message: "Ignored a non-finite anchor.",
    });
    expect("cause" in seen[0]!).toBe(false);
    expect(logged).toHaveBeenCalledOnce();
    logged.mockRestore();
  });
});
