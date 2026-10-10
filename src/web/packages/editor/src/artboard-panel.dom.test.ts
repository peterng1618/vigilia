// @vitest-environment jsdom
/**
 * The artboard panel's own contract: what each edit commits, what it refuses,
 * and what the document survives.
 *
 * The panel renders plan 1's control set now, so every drive here is the one an
 * author makes — a field is typed into and blurred, a select is opened and an
 * option chosen — and every read is by a `data-vigilia-*` hook rather than by a
 * native element that no longer exists. The enumeration of what the panel shows
 * lives in `panes/document/artboard-fields.dom.test.tsx`, which is the list this
 * rebuild was measured against.
 */
import {
  instantIn,
  MAX_ARTBOARD_DIMENSION,
  parseInstant,
  validateFabricThemeEnvelope,
} from "@vigilia/renderer-core";
import type { SceneBox } from "@vigilia/scene-fabric";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type ArtboardPanel, createArtboardPanel } from "./artboard-panel.js";
import { createBlankFabricTheme } from "./new-fabric-theme.js";
import { parseThemePackage, serializeThemePackage } from "./persist.js";

// Base UI's popups need three browser APIs jsdom has none of, the same three
// the Tokens pane's own dom tests supply.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as never;
Element.prototype.getAnimations ??= (): never[] => [];
window.PointerEvent ??= MouseEvent as never;

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

/** The platform's own spelling of a date's month and weekday, at UTC — the
    convention `names.ts` formats at, derived here without importing it, so a
    broken name function cannot make both sides of an assertion wrong together. */
function spelledAt(parts: NonNullable<ReturnType<typeof parseInstant>>) {
  const at = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return (locale: string, options: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(at);
}

let panel: ArtboardPanel | undefined;

afterEach(async () => {
  if (panel !== undefined) await act(async () => panel?.destroy());
  panel = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

interface Mounted {
  readonly host: HTMLElement;
  readonly change: ReturnType<typeof vi.fn>;
  readonly metadataChange: ReturnType<typeof vi.fn>;
}

async function mount(
  globals?: Parameters<typeof createArtboardPanel>[1],
  options: Parameters<typeof createArtboardPanel>[3] = {},
): Promise<Mounted> {
  if (panel !== undefined) await act(async () => panel?.destroy());
  panel = undefined;
  document.body.replaceChildren();
  const metadataChange = vi.fn();
  const change = vi.fn();
  await act(async () => {
    panel = createArtboardPanel(document.body, globals, change, {
      onMetadataChange: metadataChange,
      ...options,
    });
  });
  return { host: document.body, change, metadataChange };
}

/** One draw, which is what the session's `render` is. */
async function draw(
  artboard: Parameters<ArtboardPanel["render"]>[0],
  metadata?: Parameters<ArtboardPanel["render"]>[1],
): Promise<void> {
  if (panel === undefined) throw new Error("no panel mounted");
  await act(async () => panel?.render(artboard, metadata));
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

/** Typing, as React sees it: the value goes through the prototype's setter
 *  because React replaces `value` on the node with a tracker that records every
 *  assignment, and `input` is the native event for a text field. Focused first,
 *  because `blur()` on an element that never held focus is a no-op and fires no
 *  event, so the commit `type` goes on to make would never arrive.
 *
 *  This stops at the draft, which is the state a case about an interrupted edit
 *  needs: nothing has been committed yet. */
async function draft(control: Element, value: string): Promise<void> {
  await act(async () => {
    (control as HTMLElement).focus();
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(control) as HTMLInputElement,
      "value",
    )?.set;
    if (setter === undefined) (control as HTMLInputElement).value = value;
    else setter.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** A real edit, committed: the blur is the commit, which is `ControlText`/
 *  `ControlNumber`'s rule. */
async function type(control: Element, value: string): Promise<void> {
  await draft(control, value);
  await act(async () => {
    (control as HTMLElement).blur();
  });
}

async function commitField(control: string, value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>(control);
  if (input === null) throw new Error(`no field matches ${control}`);
  await type(input, value);
}

/** A select's options, opened; Base UI renders none until it is open. */
async function openControl(control: string): Promise<readonly Element[]> {
  const trigger = document.querySelector<HTMLElement>(control);
  if (trigger === null) throw new Error(`no control matches ${control}`);
  await click(trigger);
  await flush();
  return Array.from(document.querySelectorAll('[role="option"]'));
}

/** Picks the option whose value is `id` — the id the control commits, never the
 *  label it prints, because several of those labels are document data. */
async function chooseIn(control: string, id: string): Promise<void> {
  const options = await openControl(control);
  const option = options.find(
    (candidate) => candidate.getAttribute("data-vigilia-option") === id,
  );
  if (option === undefined) throw new Error(`no option ${id} in ${control}`);
  await pointerDown(option);
  await click(option, 1);
  await flush();
}

/** What a control prints for what is chosen: the id it committed, read off the
 *  element that carries both the words and the value. */
function choiceOf(control: string): string {
  return (
    document
      .querySelector(`${control} [data-vigilia-value]`)
      ?.getAttribute("data-vigilia-value") ?? ""
  );
}

function field<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (found === null) throw new Error(`no element matches ${selector}`);
  return found;
}

/** A canvas that records its subscriptions: `fire` is the scene saying it moved,
 *  and `count` is what a `destroy()` case reads to see the handler really left.
 *  The panel's own contract has two sides — it subscribes, and it lets go. */
function canvasStub(): {
  readonly events: {
    readonly on: (event: string, handler: () => void) => void;
    readonly off: (event: string, handler: () => void) => void;
  };
  readonly fire: (event: string) => void;
  readonly count: (event: string) => number;
} {
  const listeners = new Map<string, Set<() => void>>();
  return {
    events: {
      on: (event, handler) => {
        const forEvent = listeners.get(event) ?? new Set<() => void>();
        forEvent.add(handler);
        listeners.set(event, forEvent);
      },
      off: (event, handler) => {
        listeners.get(event)?.delete(handler);
      },
    },
    fire: (event) => {
      for (const handler of listeners.get(event) ?? []) handler();
    },
    count: (event) => listeners.get(event)?.size ?? 0,
  };
}

describe("artboard panel", () => {
  it("shows and returns valid artboard properties", async () => {
    const { change } = await mount();
    await draw({ width: 1280, height: 720 });

    await commitField("[data-vigilia-artboard-width]", "1000");

    expect(change).toHaveBeenCalledWith({
      width: 1000,
      height: 720,
    });
  });

  it("carries the document's content fit through an edit rather than resetting it", async () => {
    // The panel does not own this value, so it must not decide it: a size
    // change that rewrote it to contain would silently uncrop a cover theme
    // whose author set the value by hand.
    const { change } = await mount();
    await draw({ width: 1280, height: 720, contentFit: "cover" });

    await commitField("[data-vigilia-artboard-width]", "1000");

    expect(change).toHaveBeenLastCalledWith({
      width: 1000,
      height: 720,
      contentFit: "cover",
    });
  });

  it("refuses a dimension the document cannot hold, and says why", async () => {
    // Was a refusal restoring 1280, then a clamp onto the bound of 1. The
    // control set's rule is the third answer and the one §5 states: a value the
    // owner rejects is refused with its reason, never coerced into a number
    // nobody typed — so a width of 0 commits nothing and the box says so.
    const { change } = await mount();
    await draw({ width: 1280, height: 720 });
    const width = field<HTMLInputElement>("[data-vigilia-artboard-width]");

    await commitField("[data-vigilia-artboard-width]", "0");
    expect(change).not.toHaveBeenCalled();
    expect(width.getAttribute("aria-invalid")).toBe("true");

    await commitField("[data-vigilia-artboard-width]", "");
    expect(change).not.toHaveBeenCalled();

    await commitField("[data-vigilia-artboard-width]", "not a number");
    expect(change).not.toHaveBeenCalled();

    // A fraction, which is the one refusal the pane's own guard cannot report:
    // `isDimension` would drop the value and say nothing, so the field has to be
    // the one that says why. Without `integer` on the halves the box accepts
    // 1.5, clears its draft and commits a size this document does not hold.
    await commitField("[data-vigilia-artboard-width]", "1.5");
    expect(change).not.toHaveBeenCalled();
    expect(width.getAttribute("aria-invalid")).toBe("true");
    expect(field(`#${width.id}-invalid`).textContent).toContain("whole number");

    await commitField(
      "[data-vigilia-artboard-width]",
      String(MAX_ARTBOARD_DIMENSION + 1),
    );
    expect(change).not.toHaveBeenCalled();

    // And a size the document can hold still goes through, so the refusals
    // above are not a field that stopped committing anything.
    await commitField("[data-vigilia-artboard-width]", "1600");
    expect(change).toHaveBeenLastCalledWith({ width: 1600, height: 720 });
  });

  it("selects persisted palette tokens for artboard paint", async () => {
    const { change } = await mount({
      palette: {
        background: { name: "Background", value: "#101216" },
        bars: { name: "Bars", value: "#000000" },
      },
    });
    await draw({
      width: 1280,
      height: 720,
      background: { ref: "palette.background" },
      barColor: { ref: "palette.bars" },
    });

    expect(choiceOf("[data-vigilia-artboard-background]")).toBe(
      "palette.background",
    );
    expect(choiceOf("[data-vigilia-artboard-bar-color]")).toBe("palette.bars");

    await chooseIn("[data-vigilia-artboard-background]", "palette.bars");
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ background: { ref: "palette.bars" } }),
    );
  });

  it("keeps an uneditable literal bar colour when another artboard field changes", async () => {
    const { change } = await mount({
      palette: { background: { name: "Background", value: "#101216" } },
    });
    await draw({
      width: 1280,
      height: 720,
      background: { ref: "palette.background" },
      barColor: { value: "#e20074" },
    });

    await commitField("[data-vigilia-artboard-width]", "1000");

    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 1000,
        barColor: { value: "#e20074" },
      }),
    );
  });

  it("emits declared background media and theme metadata", async () => {
    const { change, metadataChange } = await mount(undefined, {
      assets: [{ id: "clip", kind: "video", path: "assets/clip.mp4" }],
    });
    await draw({ width: 1280, height: 720 }, { name: "Before" });

    await commitField("[data-vigilia-theme-name]", "Living Room");
    expect(metadataChange).toHaveBeenLastCalledWith({
      name: "Living Room",
      themeLanguage: "en",
    });

    await chooseIn("[data-vigilia-background-asset]", "clip");
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({
        backgroundMedia: { assetId: "clip", fit: "cover" },
      }),
    );
  });

  it("preserves the displayed release version during metadata edits", async () => {
    const { metadataChange } = await mount();
    await draw(
      { width: 1280, height: 720 },
      { name: "Before", version: "1.2.3" },
    );

    await commitField("[data-vigilia-theme-name]", "After");

    expect(metadataChange).toHaveBeenLastCalledWith({
      name: "After",
      version: "1.2.3",
      themeLanguage: "en",
    });
    const version = field<HTMLOutputElement>("[data-vigilia-theme-version]");
    expect(version.tagName).toBe("OUTPUT");
    expect(version.textContent).toBe("1.2.3");
  });

  it("writes the chosen language into the theme's metadata", async () => {
    const { metadataChange } = await mount();
    await draw(
      { width: 1280, height: 720 },
      { name: "Before", themeLanguage: "en" },
    );

    expect(choiceOf("[data-vigilia-theme-language]")).toBe("en");

    // The list must actually offer it: `chooseIn` finds an option by the id it
    // commits, so a missing Welsh option throws rather than passing vacuously.
    await chooseIn("[data-vigilia-theme-language]", "vi");

    expect(metadataChange).toHaveBeenLastCalledWith({
      name: "Before",
      themeLanguage: "vi",
    });

    // The spec's "resolved names shown live": the author sees the words the
    // language actually spells, not only its English label. Read after the
    // choice, because the sample follows the control rather than the render.
    const sample =
      field<HTMLOutputElement>("[data-vigilia-theme-language-sample]")
        .textContent ?? "";
    const spell = spelledAt(parseInstant(instantIn(Date.now()))!);
    expect(sample).toContain(spell("vi", { month: "long" }));
    expect(sample).toContain(spell("vi", { weekday: "long" }));
    expect(sample).not.toContain(spell("en", { month: "long" }));
  });

  it("gives the description a multi-line field, so its prose can be read", async () => {
    await mount();
    // The starter's own sentence, at its real length. A single-line input in a
    // 161px box shows the first twenty characters of it and nothing else.
    const description =
      "The reference composition: a clock, two usage cards, two memory rings, a performance chart and stacked storage and network panels.";
    await draw({ width: 1672, height: 941 }, { name: "Before", description });

    const fieldElement = field<HTMLTextAreaElement>(
      "[data-vigilia-theme-description]",
    );
    expect(fieldElement.tagName).toBe("TEXTAREA");
    expect(fieldElement.value).toBe(description);
    // The whole sentence on screen at once, rather than a box an author has to
    // scroll sideways through to read the end of.
    expect(fieldElement.rows).toBeGreaterThan(1);
    // F1.19's work: the visible label is still the name a screen reader reads.
    const label = document.querySelector<HTMLLabelElement>(
      `label[for="${fieldElement.id}"]`,
    );
    expect(label?.textContent).toBe("Description");
  });

  it("offers the media's fit and no fit control of its own", async () => {
    await mount();
    await draw({ width: 1280, height: 720, contentFit: "cover" });

    // The artboard's own fit is the *content's*, it is always contain, and an
    // author cannot set it. Beside "Media fit" it was labelled "Preview fit",
    // so one panel offered two controls choosing between the same two words for
    // two different subjects — read as "how my picture looks in the preview",
    // which it never was.
    expect(
      document.querySelector("[data-vigilia-artboard-fit-mode]"),
    ).toBeNull();

    const options = await openControl("[data-vigilia-background-media-fit]");
    expect(options.map((option) => option.textContent)).toEqual([
      "Cover",
      "Contain",
    ]);
  });

  it("says on screen that the date is a sample of the chosen language", async () => {
    await mount();
    await draw(
      { width: 1280, height: 720 },
      { name: "Before", themeLanguage: "vi" },
    );

    // It has said so to a screen reader since ad45667 gave it an aria-label,
    // which is the whole of the problem: the panel printed "September Tuesday"
    // on a line of its own and told a sighted author nothing. A label the
    // author can see is what the F1.19 pairing already made the name.
    const sample = field<HTMLOutputElement>(
      "[data-vigilia-theme-language-sample]",
    );
    const label = document.querySelector<HTMLLabelElement>(
      `label[for="${sample.id}"]`,
    );
    expect(label?.textContent).toBe("Sample");
    // The sample keeps the status-region name a screen reader announces, which
    // is longer than the column a visible label has to fit in.
    expect(sample.getAttribute("aria-label")).toBe(
      "Sample in the chosen language",
    );
    expect(sample.id).not.toBe("");
  });

  it("keeps a declared language that is outside the list", async () => {
    await mount();
    await draw(
      { width: 1280, height: 720 },
      { name: "Hand-edited", themeLanguage: "cy" },
    );

    // Welsh is not one of the fifteen, but a document declaring it must not be
    // silently rewritten to English by the panel that displays it.
    expect(choiceOf("[data-vigilia-theme-language]")).toBe("cy");
  });
});

describe("artboard presets in the panel", () => {
  it("shows the preset the document's size came from", async () => {
    await mount();
    await draw({ width: 1080, height: 2340, contentFit: "cover" });

    expect({
      ratio: choiceOf("[data-vigilia-artboard-ratio]"),
      orientation: choiceOf("[data-vigilia-artboard-orientation]"),
      resolution: choiceOf("[data-vigilia-artboard-resolution]"),
    }).toEqual({
      ratio: "19.5:9",
      orientation: "portrait",
      resolution: "1080p",
    });
  });

  it("derives the artboard size from a change to any of the three", async () => {
    const { change } = await mount();
    await draw({ width: 1920, height: 1080, contentFit: "cover" });

    await chooseIn("[data-vigilia-artboard-resolution]", "4k");
    expect(change).toHaveBeenLastCalledWith({
      width: 3840,
      height: 2160,
      contentFit: "cover",
    });

    await chooseIn("[data-vigilia-artboard-orientation]", "portrait");
    expect(change).toHaveBeenLastCalledWith({
      width: 2160,
      height: 3840,
      contentFit: "cover",
    });

    await chooseIn("[data-vigilia-artboard-ratio]", "4:3");
    // Still portrait from the step above, so the ratio's long edge is now the
    // short one: the three controls are read together, not one at a time.
    expect(change).toHaveBeenLastCalledWith({
      width: 2160,
      height: 2880,
      contentFit: "cover",
    });
  });

  it("names a custom reading rather than a preset the document is not at", async () => {
    await mount();
    await draw({ width: 1000, height: 700 });

    for (const hook of [
      "artboard-ratio",
      "artboard-orientation",
      "artboard-resolution",
    ])
      expect(choiceOf(`[data-vigilia-${hook}]`), hook).toBe("");
  });

  it("keeps the free size fields for a size no preset names", async () => {
    const { change } = await mount();
    await draw({ width: 1000, height: 700 });

    await commitField("[data-vigilia-artboard-width]", "1600");

    expect(change).toHaveBeenLastCalledWith({
      width: 1600,
      height: 700,
    });
  });

  it("derives a whole preset from a custom size without leaving a control unset", async () => {
    const { change } = await mount();
    await draw({ width: 1000, height: 700, contentFit: "cover" });

    // Choosing one of the three means choosing all three — the other two were
    // Custom, and leaving them so would show a size the controls deny.
    await chooseIn("[data-vigilia-artboard-ratio]", "4:3");

    expect(change).toHaveBeenLastCalledWith({
      width: 1440,
      height: 1080,
      contentFit: "cover",
    });
    expect({
      ratio: choiceOf("[data-vigilia-artboard-ratio]"),
      orientation: choiceOf("[data-vigilia-artboard-orientation]"),
      resolution: choiceOf("[data-vigilia-artboard-resolution]"),
    }).toEqual({
      ratio: "4:3",
      orientation: "landscape",
      resolution: "1080p",
    });
  });

  it("leaves the custom reading unselectable", async () => {
    const { change } = await mount();
    await draw({ width: 1000, height: 700 });

    // A reading, not a choice: an author cannot ask for a size that is not a
    // preset, and cannot get stuck on one they chose by accident.
    for (const hook of [
      "artboard-ratio",
      "artboard-orientation",
      "artboard-resolution",
    ]) {
      const options = await openControl(`[data-vigilia-${hook}]`);
      const custom = options.find(
        (option) => option.getAttribute("data-vigilia-option") === "",
      );
      expect(custom?.hasAttribute("data-disabled"), hook).toBe(true);
      if (custom === undefined) continue;
      await pointerDown(custom);
      await click(custom, 1);
      await flush();
    }

    // The refusal is real, not a decoration: pressing the reading commits
    // nothing and leaves the controls on the document's own size.
    expect(change).not.toHaveBeenCalled();
    for (const hook of [
      "artboard-ratio",
      "artboard-orientation",
      "artboard-resolution",
    ])
      expect(choiceOf(`[data-vigilia-${hook}]`), hook).toBe("");
  });

  it("states that a size change does not move content, beside the controls that change it", async () => {
    await mount();
    await draw({ width: 1672, height: 941 });

    // The one-click ratio change is the whole of F1.33: the author picks a
    // ratio and content silently falls outside the new frame. The panel owns
    // what a size means, so it says so where the control is — before the click,
    // not after. With no scene given it states the rule and never a number it
    // has not measured.
    const note = field("[data-vigilia-artboard-note]");
    expect(note.textContent).toBe(
      "Objects are not moved or resized. Anything outside the artboard is not shown on a display.",
    );
    expect(note.getAttribute("role")).toBe("note");
  });

  it("counts the scene it is given, and leaves a marked object out of it", async () => {
    // The panel's half of the defect. It reads `sceneBoxesOf`'s output, so the
    // mark has to arrive on the box rather than being re-derived here — a second
    // reader of the property would be a second chance for the editor's figure
    // and the player's notice to disagree about the same theme.
    const boxes: SceneBox[] = [
      {
        visible: true,
        bleeds: false,
        left: 950,
        top: 100,
        width: 100,
        height: 100,
        depth: 0,
      },
    ];
    await mount(undefined, { sceneBoxes: () => boxes });
    const note = (): string =>
      document.querySelector("[data-vigilia-artboard-note]")?.textContent ?? "";

    await draw({ width: 1000, height: 1000 });
    expect(note()).toContain("1 of 1 objects are now outside");

    boxes[0] = { ...boxes[0]!, bleeds: true };
    await draw({ width: 1000, height: 1000 });

    expect(note()).not.toContain("are now outside");
  });

  it("keeps a half-typed draft when the canvas redraws the pane", async () => {
    // The old pane recomputed the note **alone** on `object:modified` so a full
    // render could not rebuild the size and ratio inputs out from under an
    // author typing in one of them. This pane redraws the whole tree instead,
    // and what makes that safe is the field holding its draft in its own state.
    // A canvas event during a half-typed edit is the one path where the
    // difference would be felt, and nothing else asserts it.
    const canvas = canvasStub();
    // Counted, not just read: one reading per draw is what says the event
    // reached the panel at all. A dead subscription leaves this where it was,
    // and the two assertions below would still pass — a draft survives a redraw
    // that never happened, which is the failure this case exists to catch.
    const boxes = vi.fn((): readonly SceneBox[] => []);
    const { change } = await mount(undefined, {
      canvasEvents: canvas.events,
      sceneBoxes: boxes,
    });
    await draw({ width: 1280, height: 720 });

    const width = field<HTMLInputElement>("[data-vigilia-artboard-width]");
    // Typed, not committed: the blur that commits has not happened yet.
    await draft(width, "1000");
    const drawn = boxes.mock.calls.length;
    expect(drawn, "the pane read the scene when it first drew").toBeGreaterThan(
      0,
    );
    await act(async () => canvas.fire("object:modified"));

    expect(
      boxes.mock.calls.length,
      "the canvas event reached the panel and redrew it",
    ).toBe(drawn + 1);
    expect(width.value, "the draft the author is still typing").toBe("1000");
    expect(
      change,
      "and the redraw committed nothing behind them",
    ).not.toHaveBeenCalled();
  });

  it("releases the canvas subscription and the tree when it is destroyed", async () => {
    // The one line of lifecycle this panel's own contract promises. `destroy()`
    // releases a subscription on a canvas that outlives the panel — the session
    // replaces the panel on every document — so a panel that only forgot the
    // handler would go on recomputing a figure for a document it no longer
    // describes.
    const canvas = canvasStub();
    const boxes: SceneBox[] = [
      {
        visible: true,
        bleeds: false,
        left: 950,
        top: 100,
        width: 100,
        height: 100,
        depth: 0,
      },
    ];
    await mount(undefined, {
      canvasEvents: canvas.events,
      sceneBoxes: () => boxes,
    });
    const note = (): string =>
      document.querySelector("[data-vigilia-artboard-note]")?.textContent ?? "";

    await draw({ width: 1000, height: 1000 });
    const outside = note();
    expect(outside, "the figure is on screen to begin with").toContain(
      "are now outside",
    );

    // The scene moves and the canvas says so — the subscription is live. Two
    // different moves, one before and one after `destroy()`, because firing the
    // same scene twice changes nothing and would make the second half of this
    // test pass for the wrong reason.
    boxes[0] = { ...boxes[0]!, bleeds: true };
    canvas.fire("object:modified");
    expect(note(), "a live panel follows the scene").not.toBe(outside);

    await act(async () => panel?.destroy());
    const released = document.querySelector("[data-vigilia-artboard-note]");
    expect(
      released,
      "the tree is released with the subscription, not left behind",
    ).toBeNull();
    // The handler really left the canvas's set, so nothing masked a second
    // listener still holding the pane's `draw`.
    expect(canvas.count("object:modified")).toBe(0);
  });
});

/**
 * Review Focus 6: a theme of any shape still authors.
 *
 * The chooser can reach these two sizes and the panel can display them, but
 * neither fact is this claim. What is missing is the whole cycle — create,
 * load, edit, save — for a size no preset names, because each of those is a
 * place that could quietly round a 3:1 back to 16:9. The controls reading
 * Custom is the panel's existing behaviour for a typed size, pinned here
 * because it is what makes the edit step below meaningful rather than a guess.
 */
describe.each([
  ["a 3:1 board", { width: 3000, height: 1000 }],
  ["a 4000 × 4000 theme", { width: 4000, height: 4000 }],
])("%s", (_label, size) => {
  it("creates, loads, edits and saves without leaving its shape", async () => {
    const created = createBlankFabricTheme(size);
    expect(validateFabricThemeEnvelope(created)).toEqual({
      ok: true,
      envelope: created,
    });

    // Load: the panel reads a size no preset names as Custom on all three,
    // rather than claiming a preset the document is not at.
    const { change } = await mount();
    await draw(created.artboard);
    for (const hook of [
      "artboard-ratio",
      "artboard-orientation",
      "artboard-resolution",
    ])
      expect(choiceOf(`[data-vigilia-${hook}]`), hook).toBe("");

    // Edit: the free fields carry the shape, so a change keeps the other edge.
    await commitField(
      "[data-vigilia-artboard-width]",
      String(size.width + 100),
    );
    const edited = change.mock.lastCall?.[0] as typeof created.artboard;
    expect(edited).toMatchObject({
      width: size.width + 100,
      height: size.height,
    });

    // Save: the edited document is a valid one, and it comes back out of a
    // package at the size it was saved at — no step between may round it back
    // to a preset.
    const saved = { ...created, artboard: edited };
    expect(validateFabricThemeEnvelope(saved)).toEqual({
      ok: true,
      envelope: saved,
    });
    const pkg = serializeThemePackage(saved);
    expect(pkg.ok).toBe(true);
    if (!pkg.ok) return;
    const parsed = parseThemePackage(pkg.bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.envelope.artboard).toMatchObject({
      width: size.width + 100,
      height: size.height,
    });

    // And the reopened document still reads as Custom, so the cycle ends where
    // it started rather than stranding the author on a size the three controls
    // deny.
    await mount();
    await draw(parsed.envelope.artboard);
    for (const hook of [
      "artboard-ratio",
      "artboard-orientation",
      "artboard-resolution",
    ])
      expect(choiceOf(`[data-vigilia-${hook}]`), hook).toBe("");
  });
});
