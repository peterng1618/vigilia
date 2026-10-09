// @vitest-environment jsdom

/**
 * The Tokens pane's paint list.
 *
 * **The figure and the delete come from one walk.** A token reported unused by
 * this list is unused in the sense the reassignment-on-delete acts on, because
 * both read `paletteTokenUsage`'s record — this file asserts the pane states
 * what it is given rather than deriving a second answer.
 *
 * **The picker's host is identity, and that is a measured defect.** The
 * imperative panel rebuilt its field set on every commit, which destroyed the
 * colour picker's trigger, and the open popover then measured a detached node —
 * one click on the saturation square threw the picker to (0, 6). The React form
 * of the rule is the key on the field set: a colour change re-renders in place,
 * a paint-kind switch remounts. Both directions are asserted, because only one
 * of them was the defect.
 *
 * `Harness` is the session's half of that contract: a commit comes back as a new
 * palette prop, exactly as `editor-session`'s `render()` hands one back.
 */
import type { FabricPalette } from "@vigilia/renderer-core";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { uiCopy } from "../../ui-copy.js";
import { PaintList, type PaintListProps } from "./paint-list.js";

// Base UI's popups need three browser APIs jsdom has none of — the same three
// `control.dom.test.tsx` supplies, for the same reason.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

// jsdom ships no `CSS` at all, and the colour guard asks the platform by name
// (`CSS.supports("color", …)`) because the browser is the authority on what it
// can paint. This shim answers for the values these cases use, so the refusal
// path is exercised rather than skipped.
(globalThis as { CSS?: unknown }).CSS = {
  supports: (_property: string, value: string): boolean =>
    /^(#[0-9a-f]{3,8}|rgb|hsl|transparent|white|black)/i.test(value),
};

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeAll(() => {
  const matches = Element.prototype.matches;
  Element.prototype.matches = Object.assign(function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ":modal" || selector === ":popover-open") return false;
    return matches.call(this, selector);
  }, matches);
});

let root: Root | undefined;

afterEach(async () => {
  if (root !== undefined) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

/** The list over a palette it owns, so a commit comes back the way the session
 *  hands one back rather than leaving the component on stale props. */
function Harness(props: {
  readonly initial: FabricPalette;
  readonly usage: PaintListProps["usage"];
  readonly onDelete: PaintListProps["onDelete"];
  readonly change: (palette: FabricPalette) => void;
}): React.JSX.Element {
  const [palette, setPalette] = useState(props.initial);
  return (
    <PaintList
      palette={palette}
      usage={props.usage}
      onDelete={props.onDelete}
      onChange={(next) => {
        props.change(next);
        setPalette(next);
      }}
    />
  );
}

async function mount(
  initial: FabricPalette,
  options: {
    readonly usage?: PaintListProps["usage"];
    readonly onDelete?: PaintListProps["onDelete"];
  } = {},
): Promise<{
  readonly host: HTMLElement;
  readonly change: ReturnType<typeof vi.fn>;
}> {
  if (root !== undefined) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  const host = document.createElement("div");
  document.body.append(host);
  const change = vi.fn();
  const mounted = createRoot(host);
  root = mounted;
  await act(async () => {
    mounted.render(
      <Harness
        initial={initial}
        usage={options.usage}
        onDelete={options.onDelete}
        change={change}
      />,
    );
  });
  return { host, change };
}

/** React and floating-ui schedule outside `act`, so a popup is flushed with
 *  macrotasks rather than one. */
async function flush(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function click(target: Element, detail = 0): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail }),
    );
  });
}

/** Base UI commits a list item only when the press that precedes the click
 *  started on it, so the press is part of the interaction. */
async function pointerDown(target: Element): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "mouse",
        button: 0,
      }),
    );
  });
}

/** A real edit, as React sees one: the value goes through the prototype's
 *  setter because React replaces `value` on the node with a tracker that
 *  records every assignment, and `input` is the native event for a text field. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    // Focused first: `blur()` on an element that never held focus is a no-op
    // and fires no event, so the commit below would never arrive.
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input) as HTMLInputElement,
      "value",
    )?.set;
    if (setter === undefined) input.value = value;
    else setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.blur();
  });
}

/** Types into the field a hook names and commits it, the way an author does. */
async function commitField(control: string, value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(control);
  if (input === null) throw new Error(`no field matches ${control}`);
  await type(input, value);
}

/** Picks the option whose value is `id` — the id the control commits, never the
 *  label it prints, because the labels are the document's own token names. */
async function chooseIn(control: string, id: string): Promise<void> {
  const trigger = document.querySelector<HTMLElement>(control);
  if (trigger === null) throw new Error(`no control matches ${control}`);
  await click(trigger);
  await flush();
  const option = document.querySelector<HTMLElement>(
    `[role="option"][data-vigilia-option="${id}"]`,
  );
  if (option === null) throw new Error(`no option ${id} in ${control}`);
  await pointerDown(option);
  await click(option, 1);
  await flush();
}

const palette = {
  none: {
    name: "None",
    value: { kind: "solid" as const, color: "transparent" },
  },
  background: {
    name: "Background",
    value: { kind: "solid" as const, color: "#102030" },
  },
  accent: {
    name: "Accent",
    value: { kind: "solid" as const, color: "#00b8d9" },
  },
};

const usageWith =
  (
    record: Readonly<
      Record<string, readonly { objectId: string; name: string }[]>
    >,
  ) =>
  (): Readonly<Record<string, readonly { objectId: string; name: string }[]>> =>
    record;

/** The token ids the list offers, in order — every token but the reserved one. */
function listedTokenIds(host: HTMLElement): string[] {
  return Array.from(
    host.querySelectorAll<HTMLElement>("[data-vigilia-palette-token-row]"),
    (row) => row.getAttribute("data-vigilia-palette-token-row") ?? "",
  );
}

/** The figure the list prints beside a token. */
function usageFigure(host: HTMLElement, id: string): string {
  return (
    host
      .querySelector(`[data-vigilia-palette-token-row="${id}"]`)
      ?.querySelector("[data-vigilia-palette-usage]")
      ?.textContent?.trim() ?? ""
  );
}

const pickerHost = (host: HTMLElement): Element | null =>
  host.querySelector("[data-vigilia-palette-picker]");
const fieldsHost = (host: HTMLElement): Element | null =>
  host.querySelector("[data-vigilia-palette-fields]");
const fieldError = (host: HTMLElement): Element | null =>
  host.querySelector("[data-vigilia-palette-error]");

it("lists every token with its name and its usage figure, and skips the none token", async () => {
  const { host } = await mount(palette, {
    usage: usageWith({
      none: [],
      background: [
        { objectId: "a", name: "Card title" },
        { objectId: "b", name: "Header" },
        { objectId: "c", name: "RAM gauge" },
      ],
      accent: [],
    }),
  });

  expect(listedTokenIds(host)).toEqual(["background", "accent"]);
  expect(listedTokenIds(host)).not.toContain("none");
  expect(usageFigure(host, "background")).toBe("3");
  // A token nothing uses reads as unused without being selected first.
  expect(usageFigure(host, "accent")).toBe("0");
  expect(host.textContent).toContain("Background");
});

it("states a missing reading rather than fabricating a zero when there is no scene", async () => {
  // §2.3 and the host's rule: a missing reading is stated, never defaulted.
  const { host } = await mount(palette, { usage: undefined });

  expect(usageFigure(host, "background")).toBe(uiCopy.panels.notSet);
  expect(usageFigure(host, "background")).not.toBe("0");
  // With no scene there is no list of users either: an empty one would read as
  // a measurement of zero rather than as an absent reading.
  expect(host.querySelector("[data-vigilia-palette-users]")).toBeNull();
});

it("keeps the picker's element standing while a value changes", async () => {
  const { host } = await mount(palette, { usage: undefined });
  const beforeHost = pickerHost(host);
  const beforeFields = fieldsHost(host);
  const beforeTrigger = host.querySelector(
    "[data-vigilia-palette-picker] button",
  );
  expect(beforeHost).not.toBeNull();

  await commitField("[data-vigilia-palette-color]", "#123456");

  expect(pickerHost(host), "a colour change re-renders in place").toBe(
    beforeHost,
  );
  expect(fieldsHost(host), "and the field set is the same one").toBe(
    beforeFields,
  );
  expect(
    host.querySelector("[data-vigilia-palette-picker] button"),
    "the trigger the popover is anchored to is still the same node",
  ).toBe(beforeTrigger);
});

it("remounts the field set when the paint kind changes", async () => {
  const { host } = await mount(palette, { usage: undefined });
  const before = fieldsHost(host);
  expect(before).not.toBeNull();

  await chooseIn("[data-vigilia-palette-kind]", "gradient");

  // The other direction of the rule above: a gradient is a different shape of
  // fields, so the set is rebuilt — which is what the imperative panel did and
  // what must not happen on a mere colour change.
  expect(fieldsHost(host), "a kind switch rebuilds the field set").not.toBe(
    before,
  );
});

it("refuses a colour the engine cannot paint, and says so beside the field", async () => {
  const { host, change } = await mount(palette, { usage: undefined });

  await commitField("[data-vigilia-palette-color]", "not-a-colour");

  expect(change).not.toHaveBeenCalled();
  expect(fieldError(host)?.textContent?.trim()).not.toBe("");
});

it("edits the token the author picks, and commits it under its own stable id", async () => {
  const { host, change } = await mount(palette, { usage: undefined });

  await click(host.querySelector('[data-vigilia-palette-token-row="accent"]')!);
  await commitField("[data-vigilia-palette-color]", "#abcdef");

  expect(change).toHaveBeenLastCalledWith({
    ...palette,
    accent: { name: "Accent", value: { kind: "solid", color: "#abcdef" } },
  });
});

it("carries the colour across a paint-kind switch in both directions", async () => {
  // The measured defect: choosing Linear gradient over a 30% alpha panel
  // replaced it, in one dropdown choice, with an opaque white-to-black sweep,
  // and undo was the way back.
  const { host, change } = await mount(
    {
      frost: {
        name: "Frosted panel",
        value: { kind: "solid", color: "#0815234d" },
      },
    },
    { usage: undefined },
  );

  await chooseIn("[data-vigilia-palette-kind]", "gradient");
  expect(change).toHaveBeenLastCalledWith({
    frost: {
      name: "Frosted panel",
      value: {
        kind: "gradient",
        angle: 0,
        stops: [
          { offset: 0, color: "#0815234d" },
          { offset: 1, color: "#0815234d" },
        ],
      },
    },
  });

  // Now the gradient's first stop has been moved, and going back to a solid
  // takes that rather than white.
  await type(
    document.querySelector<HTMLInputElement>(
      "[data-vigilia-palette-stop-color]",
    )!,
    "#0a16234d",
  );
  await chooseIn("[data-vigilia-palette-kind]", "solid");
  expect(change).toHaveBeenLastCalledWith({
    frost: {
      name: "Frosted panel",
      value: { kind: "solid", color: "#0a16234d" },
    },
  });
  void host;
});

it("edits a gradient's angle, its stops and an added stop", async () => {
  const { host, change } = await mount(
    {
      glow: {
        name: "Glow",
        value: {
          kind: "gradient" as const,
          angle: 0,
          stops: [
            { offset: 0, color: "#102030" },
            { offset: 1, color: "#102030" },
          ],
        },
      },
    },
    { usage: undefined },
  );

  await commitField("[data-vigilia-palette-angle]", "45");
  expect(change).toHaveBeenLastCalledWith({
    glow: {
      name: "Glow",
      value: {
        kind: "gradient",
        angle: 45,
        stops: [
          { offset: 0, color: "#102030" },
          { offset: 1, color: "#102030" },
        ],
      },
    },
  });

  // Both edits come from fields built once, so a handler closing over the entry
  // it was built with would write the second stop list over the first.
  await type(
    document.querySelector<HTMLInputElement>(
      "[data-vigilia-palette-stop-color]",
    )!,
    "#ff0000",
  );
  expect(change).toHaveBeenLastCalledWith({
    glow: {
      name: "Glow",
      value: {
        kind: "gradient",
        angle: 45,
        stops: [
          { offset: 0, color: "#ff0000" },
          { offset: 1, color: "#102030" },
        ],
      },
    },
  });

  await click(host.querySelector("[data-vigilia-palette-add-stop]")!);
  expect(change).toHaveBeenLastCalledWith({
    glow: {
      name: "Glow",
      value: {
        kind: "gradient",
        angle: 45,
        stops: [
          { offset: 0, color: "#ff0000" },
          { offset: 1, color: "#102030" },
          { offset: 1, color: "#102030" },
        ],
      },
    },
  });
});

it("carries a replacement into the delete, and deletes through the port", async () => {
  const remove = vi.fn();
  const { host } = await mount(palette, { usage: undefined, onDelete: remove });

  await chooseIn("[data-vigilia-palette-replacement]", "accent");
  await click(
    host.querySelector<HTMLButtonElement>("[data-vigilia-palette-delete]")!,
  );

  expect(remove).toHaveBeenCalledWith("background", "accent");
});

it("names the objects a token is used by, for the chosen token", async () => {
  const { host } = await mount(palette, {
    usage: usageWith({
      background: [{ objectId: "card", name: "Card title" }],
      accent: [{ objectId: "header", name: "Header" }],
    }),
  });

  expect(
    host.querySelector("[data-vigilia-palette-users]")?.textContent,
  ).toContain("Card title");

  await click(host.querySelector('[data-vigilia-palette-token-row="accent"]')!);
  const users = host.querySelector("[data-vigilia-palette-users]")?.textContent;
  expect(users).toContain("Header");
  expect(users).not.toContain("Card title");
});
