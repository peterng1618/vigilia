// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { GradientEditor } from "./gradient-editor.js";

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, the update lands after the assertion.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  if (root !== undefined) act(() => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
});

it("rings a stop with §4's `--edge` boundary token, not a raw colour", () => {
  const mounted = document.createElement("div");
  host = mounted;
  document.body.append(mounted);
  root = createRoot(mounted);
  act(() =>
    root?.render(
      <GradientEditor
        // `hsl()` rather than a hex, so this case is about the ring alone.
        stops={[
          { offset: 0, color: "hsl(0, 0%, 0%)" },
          { offset: 1, color: "hsl(0, 0%, 100%)" },
        ]}
        angle={90}
        onChange={vi.fn()}
        label="Palette gradient"
      />,
    ),
  );

  // §4 names `--edge`/`--edge-2` the boundary role, and the 1px ring separates
  // the dot from the track under it — separation, not altitude, so it is not an
  // `--elev-*` depth. The assertion reads the *rendered* dot's own style: a
  // token that does not resolve at the element is the failure a text-level check
  // cannot see, and this reads exactly what the browser would paint with.
  const dot = mounted.querySelector<HTMLElement>(
    '[data-testid="gradient-stop-0"]',
  );
  expect(dot?.style.boxShadow).toBe("0 0 0 1px var(--edge)");
  expect(dot?.style.boxShadow).not.toContain("#000");
});
