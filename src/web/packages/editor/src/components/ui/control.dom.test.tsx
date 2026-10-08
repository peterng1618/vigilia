// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { ControlIconButton } from "./control-icon-button.js";
import { ControlNumber } from "./control-number.js";
import { ControlSegmented } from "./control-segmented.js";
import { ControlSelect } from "./control-select.js";
import { ControlSlider } from "./control-slider.js";
import { ControlSwatch } from "./control-swatch.js";
import { ControlText } from "./control-text.js";
import { ControlToggle } from "./control-toggle.js";
import { InspectorSection } from "./inspector-section.js";

/**
 * The shared rules of the one control set — the two that are defects rather
 * than style (a control with no programmatic name, a refusal that omits the
 * row), plus the editing and recovery contract bible §5 makes normative.
 *
 * The styles are not asserted here: jsdom resolves no custom properties, so a
 * computed-style assertion would pass whatever the cascade does. The rendered
 * treatment, the hit areas and the six-palette focus contrast belong to the
 * browser fixture, not to this file.
 */

// Base UI's popups need three browser APIs jsdom has none of — the same three
// `palette-menu.dom.test.tsx` supplies, for the same reason: floating-ui
// observes its anchor, the popup waits for its own open transition, and it asks
// the selector engine for `:modal`/`:popover-open`, which jsdom parses slowly
// enough (about 0.5s a call) to dominate the file. The fourth is the switch's:
// it re-dispatches a click through a `PointerEvent` to carry modifier state,
// and jsdom has never had one.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

// React only flushes work scheduled inside `act` when it has been told it is in
// a test; without this, `act` warns and the update lands after the assertion.
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
let host: HTMLDivElement | undefined;

/** Mounts into a fresh host, replacing whatever the previous call mounted, so
 *  one case can render a refused control and then its working counterpart. */
async function mount(element: React.ReactNode): Promise<void> {
  if (root !== undefined) await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  host = document.createElement("div");
  document.body.append(host);
  const mounted = createRoot(host);
  root = mounted;
  await act(async () => {
    mounted.render(element);
  });
}

afterEach(async () => {
  if (root !== undefined) await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  host = undefined;
  vi.restoreAllMocks();
});

/** React and floating-ui schedule outside `act`, so the popup is flushed with
 *  macrotasks rather than one. */
async function flush(): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * The control a label names, resolved the way an assistive technology resolves
 * it: `<label for>` → id, then `aria-label`, then `aria-labelledby`. The id
 * branch is the one the association depends on, so removing the pairing makes
 * this throw rather than fall through to something that merely looks labelled.
 */
function labelled(name: string): HTMLElement {
  for (const label of document.querySelectorAll("label")) {
    if (label.textContent?.trim() !== name) continue;
    const target =
      label.htmlFor === "" ? null : document.getElementById(label.htmlFor);
    if (target !== null) return target;
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[aria-label]",
  )) {
    if (element.getAttribute("aria-label") === name) return element;
  }
  for (const element of document.querySelectorAll<HTMLElement>(
    "[aria-labelledby]",
  )) {
    const ids = (element.getAttribute("aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean);
    const text = ids
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
    if (text === name) return element;
  }
  throw new Error(`no control is labelled "${name}"`);
}

/** The description a control points at, as an assistive technology reads it. */
function description(control: HTMLElement): string {
  const ids = (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean);
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
}

/** A real edit, as React sees one. The value is set through the prototype's
 *  setter rather than the element's: React replaces `value` on the node itself
 *  with a tracker that records every assignment, so `node.value = x` would
 *  update the tracker and the change would be suppressed. `onChange` for a text
 *  input is the native `input` event; the dispatch is inside `act` because a
 *  continuous event's update is scheduled rather than flushed at dispatch. */
async function type(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input) as HTMLInputElement,
      "value",
    )?.set;
    if (setter === undefined) input.value = value;
    else setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function press(
  target: Element,
  key: string,
  init: KeyboardEventInit = {},
): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

async function click(target: Element, detail = 0): Promise<void> {
  await act(async () => {
    target.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, detail }),
    );
  });
}

/** A mouse press. Base UI's list items commit a click only when the press that
 *  precedes it started on the item, so the press is part of the interaction and
 *  not decoration. */
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

async function unblur(target: HTMLElement): Promise<void> {
  await act(async () => {
    target.blur();
  });
}

const SHOWS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "cpu.load", name: "CPU load" },
  { id: "mem.used", name: "Memory used" },
];
const ALIGN: readonly {
  readonly id: "left" | "center";
  readonly name: string;
}[] = [
  { id: "left", name: "Left" },
  { id: "center", name: "Center" },
];
const PAINTS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "ink", name: "Ink" },
  { id: "paper", name: "Paper" },
];

it("gives every control a programmatic name and an id", async () => {
  await mount(
    <>
      <ControlText label="Title" value="CPU" onCommit={() => {}} />
      <ControlNumber label="Width" value={299} onCommit={() => {}} />
      <ControlSelect
        label="Shows"
        value="cpu.load"
        options={SHOWS}
        onChange={() => {}}
      />
      <ControlSwatch
        label="Fill"
        value="ink"
        options={PAINTS}
        swatch={<span data-swatch="" />}
        onChange={() => {}}
      />
      <ControlToggle label="Glass" checked={false} onChange={() => {}} />
      <ControlSegmented
        label="Align"
        value="left"
        options={ALIGN}
        onChange={() => {}}
      />
      <ControlSlider
        label="Opacity"
        value={50}
        min={0}
        max={100}
        onCommit={() => {}}
      />
      <ControlIconButton label="Delete layer" onClick={() => {}}>
        <span />
      </ControlIconButton>
    </>,
  );

  for (const name of [
    "Title",
    "Width",
    "Shows",
    "Fill",
    "Glass",
    "Align",
    "Opacity",
    "Delete layer",
  ]) {
    expect(labelled(name).id, `${name} has no id to be named by`).not.toBe("");
  }
  expect(labelled("Title").tagName).toBe("INPUT");
  expect(labelled("Shows").tagName).toBe("BUTTON");
  expect(labelled("Glass").tagName).toBe("BUTTON");
  expect(labelled("Delete layer").tagName).toBe("BUTTON");
  expect(labelled("Opacity").tagName).toBe("INPUT");
});

it("gives two instances of one field distinct ids", async () => {
  await mount(
    <>
      <ControlText label="Title" value="a" onCommit={() => {}} />
      <ControlText label="Subtitle" value="b" onCommit={() => {}} />
    </>,
  );

  expect(labelled("Title").id).not.toBe(labelled("Subtitle").id);
});

it("renders a refused control rather than omitting it", async () => {
  await mount(
    <ControlToggle
      label="Glass"
      checked={false}
      onChange={() => {}}
      refused="not offered for a group"
    />,
  );

  expect(document.body.textContent).toContain("not offered for a group");
  const control = labelled("Glass");
  expect(control).toBeTruthy();
  expect(control.getAttribute("aria-disabled")).toBe("true");
  expect(control.hasAttribute("disabled")).toBe(false);
});

it("connects a refusal to its control and to the focus target", async () => {
  await mount(
    <ControlNumber
      label="Blur"
      value={2}
      min={0}
      max={10}
      refused="not offered for a group"
      onCommit={() => {}}
    />,
  );

  const control = labelled("Blur");
  expect(control.getAttribute("aria-disabled")).toBe("true");
  expect(control.hasAttribute("disabled")).toBe(false);
  expect(description(control)).toContain("not offered for a group");
});

it("a refused toggle cannot be turned by pointer, Space or Enter", async () => {
  const refused = vi.fn();
  await mount(
    <ControlToggle
      label="Glass"
      checked={false}
      onChange={refused}
      refused="not offered for a group"
    />,
  );
  const refuser = labelled("Glass");
  await click(refuser);
  await press(refuser, " ");
  await press(refuser, "Enter");
  expect(refused).not.toHaveBeenCalled();

  // The positive control: the same interaction on the same control, only
  // without the refusal, does change it — so the assertion above is about the
  // refusal rather than about a handler that never fires at all.
  const applied = vi.fn();
  await mount(
    <ControlToggle label="Glass" checked={false} onChange={applied} />,
  );
  await click(labelled("Glass"));
  expect(applied).toHaveBeenCalledWith(true);
});

it("a refused select cannot be changed by pointer or keyboard", async () => {
  const refused = vi.fn();
  await mount(
    <ControlSelect
      label="Shows"
      value="cpu.load"
      options={SHOWS}
      onChange={refused}
      refused="not offered for a group"
    />,
  );
  const trigger = labelled("Shows");
  await click(trigger);
  await flush();
  const refusedOption = document.querySelector<HTMLElement>('[role="option"]');
  if (refusedOption !== null) await click(refusedOption);
  await press(trigger, "ArrowDown");
  await press(trigger, "Enter");
  await flush();
  expect(refused).not.toHaveBeenCalled();

  const applied = vi.fn();
  await mount(
    <ControlSelect
      label="Shows"
      value="cpu.load"
      options={SHOWS}
      onChange={applied}
    />,
  );
  await click(labelled("Shows"));
  await flush();
  const options = Array.from(
    document.querySelectorAll<HTMLElement>('[role="option"]'),
  );
  expect(
    options.length,
    "the popup did not open, so the refusal above proves nothing",
  ).toBeGreaterThan(1);
  const second = options.find((option) =>
    (option.textContent ?? "").includes("Memory used"),
  );
  expect(second).toBeTruthy();
  if (second !== undefined) {
    await pointerDown(second);
    await click(second, 1);
  }
  await flush();
  expect(applied).toHaveBeenCalledWith("mem.used");
});

it("a refused segmented choice cannot be changed by pointer or arrow keys", async () => {
  const refused = vi.fn();
  await mount(
    <ControlSegmented
      label="Align"
      value="left"
      options={ALIGN}
      onChange={refused}
      refused="not offered for a group"
    />,
  );
  const group = labelled("Align");
  await press(group, "ArrowRight");
  for (const option of document.querySelectorAll<HTMLElement>(
    "[role='group'] button",
  )) {
    await click(option);
  }
  expect(refused).not.toHaveBeenCalled();

  const applied = vi.fn();
  await mount(
    <ControlSegmented
      label="Align"
      value="left"
      options={ALIGN}
      onChange={applied}
    />,
  );
  const buttons = document.querySelectorAll<HTMLElement>(
    "[role='group'] button",
  );
  expect(buttons).toHaveLength(2);
  if (buttons[1] !== undefined) await click(buttons[1]);
  expect(applied).toHaveBeenCalledWith("center");
});

it("a refused slider cannot be moved by arrow keys or by pointer", async () => {
  const refused = vi.fn();
  await mount(
    <ControlSlider
      label="Opacity"
      value={5}
      min={0}
      max={10}
      onCommit={refused}
      refused="not offered for a group"
    />,
  );
  const refuser = document.querySelector<HTMLInputElement>(
    'input[type="range"]',
  );
  expect(refuser, "the slider renders no focus target").toBeTruthy();
  if (refuser !== null) {
    refuser.focus();
    await press(refuser, "ArrowRight");
    await click(refuser);
  }
  expect(refused).not.toHaveBeenCalled();

  const applied = vi.fn();
  await mount(
    <ControlSlider
      label="Opacity"
      value={5}
      min={0}
      max={10}
      onCommit={applied}
    />,
  );
  const thumb = document.querySelector<HTMLInputElement>('input[type="range"]');
  if (thumb !== null) {
    thumb.focus();
    await press(thumb, "ArrowRight");
  }
  expect(applied).toHaveBeenCalledWith(6);
});

it("refuses a non-numeric entry instead of coercing it to zero", async () => {
  const onCommit = vi.fn();
  await mount(
    <ControlNumber
      label="Width"
      value={299}
      min={0}
      max={1000}
      onCommit={onCommit}
    />,
  );

  const field = labelled("Width") as HTMLInputElement;
  await type(field, "abc");
  expect(onCommit).not.toHaveBeenCalledWith(0);
  expect(onCommit).not.toHaveBeenCalled();

  await press(field, "Enter");
  expect(onCommit).not.toHaveBeenCalled();
  expect(description(field), "the reason is not shown to the field").toContain(
    "not a number",
  );
  expect(field.getAttribute("aria-invalid")).toBe("true");
  // The rejected draft survives until it is corrected or cancelled.
  expect(field.value).toBe("abc");
});

it("does not commit an empty numeric draft, and never writes zero for it", async () => {
  const onCommit = vi.fn();
  await mount(<ControlNumber label="Width" value={299} onCommit={onCommit} />);
  const field = labelled("Width") as HTMLInputElement;
  await type(field, "");
  await press(field, "Enter");
  expect(onCommit).not.toHaveBeenCalled();
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(description(field)).not.toBe("");

  // An optional field clears its authored key instead, and writes nothing.
  const cleared = vi.fn();
  await mount(
    <ControlNumber
      label="Width"
      value={299}
      onCommit={onCommit}
      onClear={cleared}
    />,
  );
  const optional = labelled("Width") as HTMLInputElement;
  await type(optional, "");
  await press(optional, "Enter");
  expect(cleared).toHaveBeenCalledTimes(1);
  expect(onCommit).not.toHaveBeenCalled();
});

it("does not commit a number outside the field owner's bounds", async () => {
  const onCommit = vi.fn();
  await mount(
    <ControlNumber
      label="Width"
      value={299}
      min={0}
      max={1000}
      onCommit={onCommit}
    />,
  );
  const field = labelled("Width") as HTMLInputElement;
  await type(field, "4000");
  await press(field, "Enter");
  expect(onCommit).not.toHaveBeenCalled();
  expect(field.value).toBe("4000");
  expect(description(field)).toContain("1000");
});

it("commits once on Enter, and not again on the blur that follows", async () => {
  const onCommit = vi.fn();
  await mount(<ControlNumber label="Width" value={299} onCommit={onCommit} />);
  const field = labelled("Width") as HTMLInputElement;
  field.focus();
  await type(field, "320");
  await press(field, "Enter");
  expect(onCommit).toHaveBeenCalledTimes(1);
  await unblur(field);
  expect(onCommit).toHaveBeenCalledTimes(1);
  expect(onCommit).toHaveBeenCalledWith(320);
});

it("restores the authored value on Escape without committing", async () => {
  const onCommit = vi.fn();
  await mount(<ControlNumber label="Width" value={299} onCommit={onCommit} />);
  const field = labelled("Width") as HTMLInputElement;
  field.focus();
  await type(field, "320");
  expect(field.value).toBe("320");
  await press(field, "Escape");
  expect(field.value).toBe("299");
  await unblur(field);
  expect(onCommit).not.toHaveBeenCalled();
});

it("does not commit on the Enter of a composition", async () => {
  const onCommit = vi.fn();
  await mount(<ControlText label="Title" value="CPU" onCommit={onCommit} />);
  const field = labelled("Title") as HTMLInputElement;
  field.focus();
  await type(field, "CPU load");
  await act(async () => {
    field.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true }),
    );
  });
  await press(field, "Enter");
  expect(onCommit).not.toHaveBeenCalled();

  await act(async () => {
    field.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true }),
    );
  });
  await press(field, "Enter", { isComposing: true });
  expect(onCommit).not.toHaveBeenCalled();

  await press(field, "Enter");
  expect(onCommit).toHaveBeenCalledWith("CPU load");
});

it("commits one slider step once, and previews it separately from history", async () => {
  const onPreview = vi.fn();
  const onCommit = vi.fn();
  await mount(
    <ControlSlider
      label="Opacity"
      value={5}
      min={0}
      max={10}
      onPreview={onPreview}
      onCommit={onCommit}
    />,
  );
  const thumb = document.querySelector<HTMLInputElement>('input[type="range"]');
  if (thumb !== null) {
    thumb.focus();
    await press(thumb, "ArrowRight");
  }
  expect(onPreview).toHaveBeenCalledWith(6);
  expect(onCommit).toHaveBeenCalledTimes(1);
  expect(onCommit).toHaveBeenCalledWith(6);
});

it("cancels a slider gesture with Escape and commits nothing for it", async () => {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  await mount(
    <ControlSlider
      label="Opacity"
      value={5}
      min={0}
      max={10}
      onCancel={onCancel}
      onCommit={onCommit}
      data={{ "data-testid": "opacity-slider" }}
    />,
  );
  const slider = document.querySelector<HTMLElement>(
    '[data-testid="opacity-slider"]',
  );
  expect(slider, "the data attributes did not reach the control").toBeTruthy();
  if (slider === null) return;

  // A press in flight is the only gesture jsdom can hold open: it has no
  // layout, so Base UI's pointer drag resolves to no value at all and its
  // release path cannot be reached here. What this asserts is the cancel
  // contract — Escape cancels once and the release that follows commits
  // nothing. The drag itself is the browser fixture's business.
  await act(async () => {
    slider.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
    );
  });
  await press(slider, "Escape");
  await act(async () => {
    slider.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
  });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onCommit).not.toHaveBeenCalled();
});

it("gives an icon button its name and its tooltip from one label", async () => {
  await mount(
    <ControlIconButton
      label="Delete layer"
      shortcut={{ printed: "Ctrl+Z", spoken: "Control Z" }}
      onClick={() => {}}
    >
      <span />
    </ControlIconButton>,
  );
  const button = labelled("Delete layer");
  expect(button.getAttribute("aria-label")).toBe("Delete layer");

  // Focus opens it without the hover delay, and the popup is the same one the
  // selection inspector shows — the control wires the one tooltip owner rather
  // than growing a React second.
  await act(async () => button.focus());
  const popup = document.querySelector(".editor-shell-tooltip");
  expect(popup, "focus did not open the tooltip").toBeTruthy();
  expect(popup?.textContent).toContain("Delete layer");
  expect(popup?.querySelector("kbd")?.textContent).toBe("Ctrl+Z");
  expect(popup?.querySelector("kbd")?.getAttribute("aria-label")).toBe(
    "Control Z",
  );
  expect(description(button)).toContain("Delete layer");

  await act(async () => button.blur());
  expect(document.querySelector(".editor-shell-tooltip")).toBeNull();

  // Teardown: unmounting the control takes the popup and its listeners with it.
  await act(async () => button.focus());
  await mount(<span>gone</span>);
  expect(document.querySelector(".editor-shell-tooltip")).toBeNull();
});

it("toggles an inspector section whose header says whether it is read-only", async () => {
  await mount(
    <InspectorSection id="content" title="Content">
      <span>Position</span>
    </InspectorSection>,
  );
  const header = document.querySelector<HTMLButtonElement>("#content-header");
  expect(header?.getAttribute("aria-expanded")).toBe("true");
  expect(header?.textContent).toContain("Content");
  expect(document.body.textContent).toContain("Position");

  if (header !== null) await click(header);
  expect(header?.getAttribute("aria-expanded")).toBe("false");
  expect(document.getElementById("content-panel")?.hasAttribute("hidden")).toBe(
    true,
  );

  await mount(
    <InspectorSection id="spends" title="Spends" readOnly>
      <span>3.2 GB</span>
    </InspectorSection>,
  );
  expect(document.querySelector("#spends-header")?.textContent).toContain(
    "Read-only",
  );
});
