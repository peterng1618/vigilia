// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { QrCode } from "./qr-symbol.js";

const URL = `http://192.168.1.42:5227/?session=${"a".repeat(43)}`;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  root?.unmount();
  root = undefined;
  host?.remove();
  host = undefined;
});

/** The element the symbol is drawn into. `createRoot` rather than
 *  `@testing-library/react`, which this workspace does not depend on. */
function mount(text: string): HTMLDivElement {
  const mounted = document.createElement("div");
  host = mounted;
  document.body.append(mounted);
  const created = createRoot(mounted);
  root = created;
  act(() => created.render(<QrCode text={text} />));
  return mounted;
}

it("draws the ink on the paper, whatever palette the shell is in", () => {
  const container = mount(URL);
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();

  const background = svg?.querySelector("rect");
  expect(background?.getAttribute("fill")).toBe("#ffffff");

  const module = svg?.querySelectorAll("path")[0];
  expect(module?.getAttribute("fill")).toBe("#101418");
  // A token here would invert under a dark shell palette and stop scanning.
  expect(module?.getAttribute("fill")).not.toContain("var(--vigilia");
});

it("names the URL it carries, so the code is not only a picture", () => {
  const container = mount(URL);
  expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
    `QR code: ${URL}`,
  );
});
