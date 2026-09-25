// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkedPair } from "./linked-pair.js";
import { numberField } from "./number-field.js";

afterEach(() => {
  document.body.replaceChildren();
});

describe("number field", () => {
  it("rejects an out-of-range number instead of coercing it to zero", () => {
    const onCommit = vi.fn();
    const field = numberField({
      label: "Width",
      value: 100,
      min: 1,
      max: 4096,
      data: "vigiliaArtboardWidth",
      onCommit,
    });
    document.body.append(field.row);
    const input = field.row.querySelector("input")!;

    input.value = "abc";
    input.dispatchEvent(new Event("change"));
    expect(onCommit).not.toHaveBeenCalled();
    expect(field.row.querySelector("[role=alert]")).not.toBeNull();
    // The field shows the last value it accepted, not the rejected text. This
    // is not cosmetic: `artboard-panel.dom.test.ts:44-52` already requires it,
    // and that test has to keep passing once the panel's own `render(current)`
    // rollback disappears with this refactor.
    expect(input.value).toBe("100");

    // The assertion above is only meaningful if a valid edit does commit —
    // otherwise "no handler ran" and "invalid input was refused" look
    // identical.
    input.value = "200";
    input.dispatchEvent(new Event("change"));
    expect(onCommit).toHaveBeenCalledWith(200);
    expect(field.row.querySelector("[role=alert]")).toBeNull();

    // Out of range is refused the same way as unparseable, not clamped.
    input.value = "99999";
    input.dispatchEvent(new Event("change"));
    expect(onCommit).toHaveBeenCalledTimes(1);

    // A rejected edit must not become the new "last valid": the field still
    // shows 200, so a second rejection restores 200 rather than the 99999 it
    // refused.
    expect(input.value).toBe("200");

    // `setValue` is the only other writer of the input, and it is what the
    // panel's `render()` calls; it must not fire `onCommit`, or a re-render
    // would look like an edit and dirty the document on every refresh.
    field.setValue(320);
    expect(input.value).toBe("320");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("rejects a zero dimension the way the artboard rule does", () => {
    const onCommit = vi.fn();
    const field = numberField({
      label: "Width",
      value: 1280,
      min: 1,
      max: 16384,
      data: "vigiliaArtboardWidth",
      onCommit,
    });
    document.body.append(field.row);
    const input = field.row.querySelector("input")!;

    input.value = "0";
    input.dispatchEvent(new Event("change"));

    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe("1280");
    expect(field.row.querySelector("[role=alert]")).not.toBeNull();
  });

  it("carries the dataset key the panel selectors read", () => {
    const field = numberField({
      label: "Width",
      value: 1,
      data: "vigiliaArtboardWidth",
      onCommit: vi.fn(),
    });

    expect(field.input.getAttribute("data-vigilia-artboard-width")).toBe("");
  });
});

describe("linked pair", () => {
  it("emits a commit carrying both values for a linked pair", () => {
    const onCommit = vi.fn();
    const pair = linkedPair({
      rowLabel: "Size",
      first: { label: "W", value: 100, data: "vigiliaArtboardWidth" },
      second: { label: "H", value: 200, data: "vigiliaArtboardHeight" },
      min: 1,
      max: 4096,
      onCommit,
    });
    document.body.append(pair.row);

    pair.first.value = "10";
    pair.first.dispatchEvent(new Event("change"));
    // The pair commits both current values, so the untouched field still reads
    // 200.
    expect(onCommit).toHaveBeenLastCalledWith(10, 200);
    pair.second.value = "20";
    pair.second.dispatchEvent(new Event("change"));
    expect(onCommit).toHaveBeenLastCalledWith(10, 20);
  });

  it("restores only the rejected field and leaves its sibling alone", () => {
    const onCommit = vi.fn();
    const pair = linkedPair({
      rowLabel: "Size",
      first: { label: "W", value: 100, data: "vigiliaArtboardWidth" },
      second: { label: "H", value: 200, data: "vigiliaArtboardHeight" },
      min: 1,
      max: 4096,
      onCommit,
    });
    document.body.append(pair.row);

    pair.first.value = "10";
    pair.first.dispatchEvent(new Event("change"));
    pair.second.value = "0";
    pair.second.dispatchEvent(new Event("change"));

    expect(onCommit).toHaveBeenLastCalledWith(10, 200);
    expect(pair.first.value).toBe("10");
    expect(pair.second.value).toBe("200");

    // `setValues` is the panel's repaint writer and must not look like an edit
    // — `setGlobals` calls it on every palette refresh.
    pair.setValues(640, 480);
    expect(pair.first.value).toBe("640");
    expect(pair.second.value).toBe("480");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
