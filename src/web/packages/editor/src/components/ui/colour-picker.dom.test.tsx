// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeAll, expect, it, vi } from "vitest";
import { ColourPicker } from "./colour-picker.js";

// jsdom's selector engine cannot answer `:modal`/`:popover-open`, and floating-ui
// asks for both on every position. Each unanswerable call costs ~0.5s of selector
// parsing, which turns one popover open into ~35s. Real browsers answer both.
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

/** The picker with its popover open, and the tracks it rendered. */
async function openPicker(value: string): Promise<{
  readonly onChange: ReturnType<typeof vi.fn>;
  readonly track: (testId: string) => HTMLElement;
  readonly read: (testId: string) => {
    now: number;
    min: number;
    max: number;
  };
  readonly close: () => Promise<void>;
}> {
  const host = document.createElement("div");
  document.body.append(host);
  const onChange = vi.fn();
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <ColourPicker value={value} onChange={onChange} label="Pick a colour" />,
    );
  });

  const trigger = host.querySelector<HTMLButtonElement>(
    '[data-testid="picker-trigger"]',
  );
  if (trigger === null) throw new Error("The picker rendered no trigger.");
  await act(async () => {
    trigger.click();
  });

  const track = (testId: string): HTMLElement => {
    const found = document.body.querySelector<HTMLElement>(
      `[data-testid="${testId}"]`,
    );
    if (found === null) throw new Error(`No ${testId} track.`);
    return found;
  };
  const read = (testId: string) => {
    const element = track(testId);
    return {
      now: Number(element.getAttribute("aria-valuenow")),
      min: Number(element.getAttribute("aria-valuemin")),
      max: Number(element.getAttribute("aria-valuemax")),
    };
  };

  return {
    onChange,
    track,
    read,
    close: async () => {
      root.unmount();
      host.remove();
      await act(async () => {});
    },
  };
}

/** One key on one track, in the phase a browser would deliver it. */
async function press(track: HTMLElement, key: string): Promise<void> {
  track.focus();
  await act(async () => {
    track.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });
}

it("moves a track's value from the keyboard, which vg-194 recorded as missing", async () => {
  // `#808080` is a grey: zero saturation, so the saturation track starts at the
  // bottom of its range and an arrow has somewhere to go.
  const picker = await openPicker("#808080");

  // The role is a promise about a range, so the range has to be declared. A
  // keyboard path over `role="slider"` with no `aria-valuemin`/`aria-valuemax`
  // announces an undefined range, which is the second half of the same defect.
  expect(picker.read("picker-saturation")).toEqual({ now: 0, min: 0, max: 100 });

  await press(picker.track("picker-saturation"), "ArrowRight");

  expect(
    picker.read("picker-saturation").now,
    "an arrow key on a focused track moves it",
  ).toBe(1);
  expect(picker.onChange).toHaveBeenCalledOnce();

  await picker.close();
});

it("steps downward, and clamps at both ends rather than wrapping", async () => {
  const picker = await openPicker("#ff0000");
  const hue = picker.track("picker-hue");
  // Pure red is hue 0, so this track also starts at the bottom.
  expect(picker.read("picker-hue").now).toBe(0);

  await press(hue, "ArrowLeft");
  expect(picker.read("picker-hue").now, "the low end clamps").toBe(0);

  await press(hue, "End");
  expect(picker.read("picker-hue").now, "End is the top of the range").toBe(100);
  await press(hue, "ArrowRight");
  expect(picker.read("picker-hue").now, "the high end clamps").toBe(100);

  await press(hue, "Home");
  expect(picker.read("picker-hue").now, "Home is the bottom").toBe(0);

  await picker.close();
});

it("leaves a key it does not own to the panel behind it", async () => {
  const picker = await openPicker("#808080");
  const track = picker.track("picker-saturation");

  // `preventDefault` on every key would swallow the panel's own handling of a
  // key that is none of the slider's business. Read on `document`, **after**
  // React's own root listener has run — a listener on the track itself would
  // read the flag before the handler it is asking about.
  let defaultPrevented = false;
  const observer = (event: KeyboardEvent): void => {
    defaultPrevented = event.defaultPrevented;
  };
  document.addEventListener("keydown", observer, { once: true });
  await press(track, "a");
  document.removeEventListener("keydown", observer);

  expect(defaultPrevented, "an unowned key is not swallowed").toBe(false);
  expect(picker.read("picker-saturation").now).toBe(0);
  expect(picker.onChange).not.toHaveBeenCalled();

  await picker.close();
});
