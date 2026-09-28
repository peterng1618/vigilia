// @vitest-environment jsdom
import { Canvas } from "fabric/es";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { createErrorManager } from "../error-manager/index.js";
import { DiagnosticMessage } from "./diagnostic-message.js";

function mount(canvas: Canvas): {
  readonly host: HTMLElement;
  rerender(next: Canvas): Promise<void>;
  unmount(): Promise<void>;
} {
  const host = document.createElement("div");
  const root = createRoot(host);
  return {
    host,
    async rerender(next) {
      await act(async () => root.render(<DiagnosticMessage canvas={next} />));
    },
    async unmount() {
      await act(async () => root.unmount());
    },
  };
}

function liveRegion(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>('[role="status"]');
}

it("reports a refused edit in the status line, named and announced", async () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const view = mount(canvas);
  await view.rerender(canvas);
  const manager = createErrorManager(canvas);
  const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

  await act(async () => {
    manager.warn("controls", "That value cannot be applied to the selection.");
  });

  const region = liveRegion(view.host);
  // The author must be able to find it, not merely see a colour change.
  expect(region?.getAttribute("aria-label")).toBe("Editor message");
  // The severity word is in the text, not only the icon: the line is read after
  // the moment it was written, when the mark is no longer in anyone's eye.
  expect(region?.textContent).toBe(
    "Warning: That value cannot be applied to the selection.",
  );
  expect(region?.dataset["severity"]).toBe("warning");
  // The category is what tells two refusals apart when they read alike.
  expect(region?.dataset["category"]).toBe("controls");
  logged.mockRestore();
});

it("marks an error as one, and a newer diagnostic replaces an older one", async () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const view = mount(canvas);
  await view.rerender(canvas);
  const manager = createErrorManager(canvas);
  const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  const errored = vi.spyOn(console, "error").mockImplementation(() => {});

  await act(async () => {
    manager.warn("controls", "That value cannot be applied to the selection.");
  });
  await act(async () => {
    manager.error("clipboard", "Could not read the clipboard.");
  });

  const region = liveRegion(view.host);
  expect(region?.dataset["severity"]).toBe("error");
  expect(region?.dataset["category"]).toBe("clipboard");
  // The two severities must not read alike in the text either.
  expect(region?.textContent).toBe("Error: Could not read the clipboard.");
  // Two children would read as two messages; the surface carries one.
  expect(view.host.querySelectorAll('[role="status"]')).toHaveLength(1);
  warned.mockRestore();
  errored.mockRestore();
});

it("leaves the message up rather than taking it away", async () => {
  const canvas = new Canvas(document.createElement("canvas"));
  const view = mount(canvas);
  await view.rerender(canvas);
  const manager = createErrorManager(canvas);
  const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

  await act(async () => {
    manager.warn("controls", "That value cannot be applied to the selection.");
  });
  // Unrelated canvas traffic is what a status line sees all day; a refusal that
  // left on the next event would be the silence this surface exists to end.
  await act(async () => {
    canvas.fire("object:modified" as never);
  });

  expect(liveRegion(view.host)?.textContent).toBe(
    "Warning: That value cannot be applied to the selection.",
  );
  logged.mockRestore();
});

it("drops a message the next document cannot be held to, and stops listening", async () => {
  const first = new Canvas(document.createElement("canvas"));
  const view = mount(first);
  await view.rerender(first);
  const manager = createErrorManager(first);
  const logged = vi.spyOn(console, "warn").mockImplementation(() => {});

  await act(async () => {
    manager.warn("controls", "That value cannot be applied to the selection.");
  });
  const second = new Canvas(document.createElement("canvas"));
  await view.rerender(second);
  expect(liveRegion(view.host)?.textContent).toBe("");

  // The replaced document's canvas is torn down with it; a listener left on it
  // would push a message no author is looking at.
  await act(async () => {
    manager.warn("controls", "That value cannot be applied to the selection.");
  });
  expect(liveRegion(view.host)?.textContent).toBe("");

  await view.unmount();
  logged.mockRestore();
});
