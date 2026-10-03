// @vitest-environment jsdom
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PaletteMenu } from "./palette-menu.js";
import {
  readShellPalette,
  type ShellPalette,
  shellPalettes,
} from "./palette.js";

// Base UI's popup needs two browser APIs jsdom has none of: floating-ui observes
// its anchor, and the popup waits for its own open transition before reporting
// itself open.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];

// jsdom's selector engine cannot answer `:modal`/`:popover-open`, and
// floating-ui asks for both on every position. Each unanswerable call costs
// ~0.5s of selector parsing, which turns one menu open into ~35s. Real
// browsers answer both.
beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(
    function (this: Element, selector: string): boolean {
      if (selector === ":modal" || selector === ":popover-open") return false;
      return matches.call(this, selector);
    },
    matches,
  );
});

let root: Root | undefined;
let host: HTMLDivElement | undefined;

/** Base UI portals the popup to `body`, so it is read from the document and
 *  not from the mount host. */
function options(): readonly HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
  );
}

/** React schedules outside `act`, and floating-ui's measurement never settles
 *  inside one, so the popup is flushed with macrotasks instead. */
async function flush(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** The control in a shell root, with the popup open. */
async function mount(
  palette: ShellPalette,
  onChange = vi.fn(),
): Promise<HTMLElement> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <PaletteMenu
      storage={localStorage}
      palette={palette}
      onChange={onChange}
    />,
  );
  await flush();
  host.querySelector<HTMLButtonElement>("[data-vigilia-palette]")?.click();
  await flush();
  return host;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-shell-palette");
});

/** Base UI unmounts the popup on the next frame, so one test's open menu is
 *  still in the document for the next one. Escape is the gesture that closes
 *  it. */
afterEach(async () => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  await flush();
  root?.unmount();
  root = undefined;
  host?.remove();
  host = undefined;
  document.documentElement.removeAttribute("data-shell-palette");
});

it("offers every palette the list owns, and marks the one in force", async () => {
  await mount("graphite");

  // Read from `shellPalettes` rather than restated: `palette.ts` is the owner,
  // and a list typed here is a second one that can fall behind it.
  expect(options().map((item) => item.textContent?.trim())).toEqual([
    ...shellPalettes,
  ]);
  // And the checked half, which no sighted reader needs and every screen
  // reader does: without it six identical words are six identical choices.
  expect(options().map((item) => item.getAttribute("aria-checked"))).toEqual([
    "false",
    "true",
    "false",
    "false",
    "false",
    "false",
  ]);
});

it("shows a swatch of the current palette beside its name", async () => {
  await mount("graphite");

  const trigger = host?.querySelector("[data-vigilia-palette]");

  // The chip paints from the palette's own `--shell-*` tokens through
  // `data-shell-palette`, so it cannot read once at mount and go stale.
  expect(trigger?.querySelector("[data-shell-palette='graphite']")).not.toBeNull();
  expect(trigger?.textContent?.trim()).toBe("graphite");
  // And the trigger names itself. The value beside the chip is a state, not a
  // label: left to its own content the button announces "graphite, button",
  // which says what the shell currently is and nothing about what choosing it
  // does.
  expect(trigger?.getAttribute("aria-label")).toBe("Shell palette: graphite");
});

it("writes the choice through both owners", async () => {
  const onChange = vi.fn();
  await mount("editorial", onChange);

  options()
    .find((item) => item.textContent?.trim() === "ember")
    ?.click();
  await flush();

  // The two owners are unchanged from the select this replaces: the browser's
  // own store for the next session, and the document element's attribute for
  // the repaint that follows it.
  expect(readShellPalette(localStorage)).toBe("ember");
  expect(document.documentElement.dataset["shellPalette"]).toBe("ember");
  expect(onChange).toHaveBeenCalledWith("ember");
});