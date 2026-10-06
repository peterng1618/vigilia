// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkedPair } from "./linked-pair.js";
import { numberField } from "./number-field.js";
import { propertySection } from "./property-section.js";

afterEach(() => {
  document.body.replaceChildren();
});

/** A bounded field, the shape both the sides field and the blur field take. */
function bounded(over: (input: HTMLInputElement) => void) {
  const onCommit = vi.fn();
  const onReject = vi.fn();
  const field = numberField({
    label: "Sides",
    value: 6,
    min: 3,
    max: 32,
    data: "vigiliaSides",
    onReject,
    onCommit,
  });
  document.body.append(field.row);
  const input =
    field.row.querySelector<HTMLInputElement>("input[type=number]")!;
  over(input);
  return { field, input, onCommit, onReject };
}

const rangeOf = (row: HTMLElement) =>
  row.querySelector<HTMLInputElement>("input[type=range]");

const type = (input: HTMLInputElement, value: string): void => {
  input.value = value;
  input.dispatchEvent(new Event("change"));
};

describe("number field", () => {
  it("lands a value past the maximum on the bound", () => {
    const { input, onCommit, onReject } = bounded((input) =>
      type(input, "99999"),
    );

    // The clamp teaches the ceiling: the field now reads 48 where a revert
    // would read the old value and teach nothing.
    expect(onCommit).toHaveBeenCalledWith(32);
    expect(input.value).toBe("32");
    // Clamping is not a rejection. `onReject` is how glass.ts raises a toast
    // and how the inspector warns; firing it here would report a failure for an
    // edit that was applied.
    expect(onReject).not.toHaveBeenCalled();
  });

  it("lands a value under the minimum on the bound", () => {
    const { input, onCommit } = bounded((input) => type(input, "0"));

    expect(onCommit).toHaveBeenCalledWith(3);
    expect(input.value).toBe("3");
  });

  it("refuses an empty value rather than reading it as zero", () => {
    const { input, onCommit, onReject } = bounded((input) => type(input, ""));

    // `Number("")` is 0, so this must not become a clamp to the minimum: an
    // emptied box is a different mistake from a value that is too small.
    expect(onCommit).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("6");
  });

  it("refuses a non-integer rather than rounding it", () => {
    const { input, onCommit, onReject } = bounded((input) =>
      type(input, "6.5"),
    );

    expect(onCommit).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("6");
    // Refusing rather than clamping is the other half: a step of 1 says this
    // field has no 6.5, and a bound does not make one.
    expect(input.step).toBe("1");
  });

  it("commits a value inside the bound untouched", () => {
    const { input, onCommit, onReject } = bounded((input) => type(input, "12"));

    expect(onCommit).toHaveBeenCalledWith(12);
    expect(input.value).toBe("12");
    expect(onReject).not.toHaveBeenCalled();
  });

  it("states the bound in the field's own row", () => {
    const field = numberField({
      label: "Sides",
      value: 6,
      min: 3,
      max: 32,
      data: "vigiliaSides",
      onCommit: vi.fn(),
    });
    document.body.append(field.row);

    // Readable before the bound is tripped, which is the whole point: the
    // author finds the ceiling by looking, not by failing.
    expect(field.row.querySelector(".vigilia-field-bound")?.textContent).toBe(
      "3–32",
    );
  });

  it("says nothing about a bound the field does not have", () => {
    const field = numberField({
      label: "X",
      value: 10,
      min: 1,
      data: "vigiliaGeometry",
      onCommit: vi.fn(),
    });
    document.body.append(field.row);

    // A half-stated range would be a lie in the same way a slider on a free
    // field is: it would promise a maximum the field has no opinion about.
    expect(field.row.querySelector(".vigilia-field-bound")).toBeNull();
    expect(rangeOf(field.row)).toBeNull();
  });

  it("offers a slider on a bounded field and keeps the box the precise one", () => {
    const { field, input, onCommit } = bounded(() => undefined);
    const range = rangeOf(field.row);

    expect(range).not.toBeNull();
    // Two controls for one value, not two sources of truth: the box still
    // accepts a typed value, and it still clamps.
    expect(range?.min).toBe("3");
    expect(range?.max).toBe("32");
    type(input, "60");
    expect(onCommit).toHaveBeenLastCalledWith(32);
    // The slider followed the box rather than holding a stale thumb.
    expect(range?.value).toBe("32");
  });

  it("names the slider by the label the box already has", () => {
    const { field } = bounded(() => undefined);
    const range = rangeOf(field.row);
    const label = field.row.querySelector<HTMLLabelElement>("label")!;

    // A second string naming the same control is a second vocabulary, and it
    // is the one thing that drifts.
    expect(range?.getAttribute("aria-labelledby")).toBe(label.id);
    expect(label.textContent).toBe("Sides");
  });

  it("commits a whole drag as one edit", () => {
    const { field, onCommit, input } = bounded(() => undefined);
    const range = rangeOf(field.row)!;

    // A drag fires `input` per pixel and `change` once, on release.
    range.value = "10";
    range.dispatchEvent(new Event("input"));
    range.value = "20";
    range.dispatchEvent(new Event("input"));
    expect(onCommit).not.toHaveBeenCalled();

    range.dispatchEvent(new Event("change"));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(20);
    // One value, one display: the box is not left showing the pre-drag number.
    expect(input.value).toBe("20");
  });

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

    type(input, "abc");
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
    type(input, "200");
    expect(onCommit).toHaveBeenCalledWith(200);
    expect(field.row.querySelector("[role=alert]")).toBeNull();

    // A refused edit must not become the new "last valid": the field still
    // shows 200, so a second refusal restores 200 rather than what it refused.
    type(input, "1.5");
    expect(input.value).toBe("200");

    // `setValue` is the only other writer of the input, and it is what the
    // panel's `render()` calls; it must not fire `onCommit`, or a re-render
    // would look like an edit and dirty the document on every refresh.
    field.setValue(320);
    expect(input.value).toBe("320");
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("refuses through the field an edit the model itself rejected", () => {
    // `glass.ts` calls this when `writeTreatment` returns false: the field
    // accepted the value, so the field is the only thing that can roll it back.
    const onCommit = vi.fn();
    const field = numberField({
      label: "Glass blur",
      value: 12,
      min: 0,
      max: 48,
      data: "vigiliaGlassBlur",
      onCommit,
    });
    document.body.append(field.row);
    const input = field.row.querySelector("input")!;

    type(input, "60");
    expect(onCommit).toHaveBeenCalledWith(48);
    field.refuse(12);

    expect(input.value).toBe("12");
    expect(rangeOf(field.row)?.value).toBe("12");
    // The model's refusal is a different failure from the field's, and it says
    // so through the same line rather than a second kind of feedback.
    expect(field.row.querySelector("[role=alert]")?.textContent).toBe(
      "That value cannot be applied. Enter a number in range.",
    );
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
  it("commits each half to its own handler, never the sibling's", () => {
    const first = vi.fn();
    const second = vi.fn();
    const pair = linkedPair({
      rowLabel: "Size",
      first: { label: "W", value: 100, data: "vigiliaArtboardWidth" },
      second: { label: "H", value: 200, data: "vigiliaArtboardHeight" },
      min: 1,
      max: 4096,
      onCommitFirst: first,
      onCommitSecond: second,
    });
    document.body.append(pair.row);

    type(pair.first, "10");
    expect(first).toHaveBeenLastCalledWith(10);
    // The sibling is not the editor of this edit, so it hears nothing.
    expect(second).not.toHaveBeenCalled();

    type(pair.second, "20");
    expect(second).toHaveBeenLastCalledWith(20);
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("restores only the rejected field and leaves its sibling alone", () => {
    const first = vi.fn();
    const second = vi.fn();
    const pair = linkedPair({
      rowLabel: "Size",
      first: { label: "W", value: 100, data: "vigiliaArtboardWidth" },
      second: { label: "H", value: 200, data: "vigiliaArtboardHeight" },
      min: 1,
      max: 4096,
      onCommitFirst: first,
      onCommitSecond: second,
    });
    document.body.append(pair.row);

    type(pair.first, "10");
    type(pair.second, "abc");

    expect(first).toHaveBeenLastCalledWith(10);
    expect(second).not.toHaveBeenCalled();
    expect(pair.first.value).toBe("10");
    expect(pair.second.value).toBe("200");

    // `setValues` is the panel's repaint writer and must not look like an edit
    // — `setGlobals` calls it on every palette refresh.
    pair.setValues(640, 480);
    expect(pair.first.value).toBe("640");
    expect(pair.second.value).toBe("480");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("keeps two fields and one alert host on the one line they share", () => {
    const pair = linkedPair({
      rowLabel: "Size",
      first: { label: "W", value: 100, data: "vigiliaArtboardWidth" },
      second: { label: "H", value: 200, data: "vigiliaArtboardHeight" },
      min: 1,
      max: 4096,
      onCommitFirst: vi.fn(),
      onCommitSecond: vi.fn(),
    });
    document.body.append(pair.row);

    // A slider per half would put two controls on a 280px flex line that
    // already carries a label and two boxes, so the pair asks for none.
    expect(rangeOf(pair.row)).toBeNull();
    expect(pair.row.querySelectorAll("input[type=number]")).toHaveLength(2);

    // Both halves refuse into the one host, so the row never grows a second
    // line of feedback the panel has no room for.
    type(pair.first, "abc");
    type(pair.second, "abc");
    const alerts = pair.row.querySelectorAll("[role=alert]");
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) expect(alert.parentElement).toBe(pair.row);
  });
});

/** A field stand-in: the section only carries the elements it is given, so the
    test needs something addressable inside the body, not a real control. */
function line(text: string): HTMLElement {
  const element = document.createElement("p");
  element.textContent = text;
  return element;
}

/** The section's parts, found the way a spec finds them: by the hook and by
    the element the platform provides, never by a private class. */
function parts(section: ReturnType<typeof propertySection>) {
  const details = section.root.querySelector("details");
  const summary = section.root.querySelector("summary");
  return {
    details,
    summary,
    body: section.root.querySelector(".vigilia-section-body"),
  };
}

describe("property section", () => {
  it("keeps the title and the count in a closed summary and reveals the body when opened", () => {
    const section = propertySection({
      id: "paint",
      title: "Paint",
      body: [line("Opacity")],
      defaultOpen: false,
    });
    document.body.append(section.root);
    const { details, summary, body } = parts(section);

    expect(
      section.root.querySelector('[data-vigilia-section="paint"]'),
    ).not.toBeNull();
    expect(details?.open).toBe(false);
    // Collapsed is not hidden: the count is in the summary, so a closed section
    // still says how much it holds, and the title is there to name it. The count
    // is the body's own length — there is no other number it could be.
    expect(summary?.textContent).toContain("Paint");
    expect(
      section.root.querySelector(".vigilia-section-count")?.textContent,
    ).toBe("1");
    // Closed, the body is still in the DOM — a section that unmounted it would
    // drop every field the next re-render replaced instead of updating.
    expect(body?.textContent).toBe("Opacity");

    section.open();
    expect(details?.open).toBe(true);
    expect(body?.textContent).toBe("Opacity");
  });

  it("keeps the title and the count as separate text, neither replacing the other", () => {
    const section = propertySection({
      id: "position",
      title: "Position",
      body: [line("X")],
      defaultOpen: false,
    });
    document.body.append(section.root);
    const { summary } = parts(section);

    // The summary is named by its own content, so the name is title + count.
    // Naming it by the title span alone (an `aria-labelledby`, now removed)
    // would announce "Position" and drop the count from the name — the reviewer
    // reasoned this from the mechanism; jsdom computes no accessible name, so it
    // is not measured here.
    expect(summary?.hasAttribute("aria-labelledby")).toBe(false);
    const title = summary?.querySelector(".vigilia-section-title");
    const count = summary?.querySelector(".vigilia-section-count");
    expect(title?.textContent).toBe("Position");
    expect(count?.textContent).toBe("1");
    // Two nodes and a separator, not one fused string: "Position1" would read
    // as a single word.
    expect(summary?.textContent).toBe("Position 1");
  });

  it("focuses the summary the platform makes tabbable and toggles it on click", () => {
    const section = propertySection({
      id: "content",
      title: "Content",
      body: [line("Title")],
      defaultOpen: false,
    });
    document.body.append(section.root);
    const { details, summary } = parts(section);

    summary?.focus();
    // Reachable by keyboard: the summary is the platform's own focus target,
    // not a div the panel had to make tabbable.
    expect(document.activeElement).toBe(summary);

    // This is a focus-and-click test, not a keyboard-activation one: jsdom runs
    // no keyboard activation for any element — a browser toggles `<details>`
    // through the click it synthesizes for Enter on a focused summary — so the
    // activation is driven directly rather than through a keydown jsdom ignores.
    summary?.click();
    expect(details?.open).toBe(true);
    summary?.click();
    expect(details?.open).toBe(false);
  });

  it("replaces the body and leaves the open state untouched", () => {
    const open = propertySection({
      id: "layer",
      title: "Layer",
      body: [line("Opacity")],
      defaultOpen: true,
    });
    const closed = propertySection({
      id: "spends",
      title: "Spends",
      body: [line("Preview")],
      defaultOpen: false,
    });
    document.body.append(open.root, closed.root);

    open.setBody([line("Scale"), line("Rotation")]);
    closed.setBody([line("Live")]);

    // A re-render must not collapse the section the author just opened, nor
    // open one the author left closed.
    expect(open.isOpen()).toBe(true);
    expect(closed.isOpen()).toBe(false);
    const body = open.root.querySelector(".vigilia-section-body");
    expect(body?.children).toHaveLength(2);
    expect(body?.textContent).toBe("ScaleRotation");
    // The replaced field is gone rather than appended beside the old one.
    expect(body?.textContent).not.toContain("Opacity");
  });

  it("renders nothing at all for a section with no body", () => {
    const section = propertySection({
      id: "layer",
      title: "Layer",
      body: [],
      defaultOpen: true,
    });
    document.body.append(section.root);

    // Not a header with a count of zero: with nothing to hold there is nothing
    // to disclose, so there is no disclosure.
    expect(section.root.querySelector("details")).toBeNull();
    expect(section.root.textContent).toBe("");
  });

  it("follows a shrinking body with its count", () => {
    const section = propertySection({
      id: "paint",
      title: "Paint",
      body: [line("Fill"), line("Stroke"), line("Opacity")],
      defaultOpen: true,
    });
    document.body.append(section.root);

    expect(
      section.root.querySelector(".vigilia-section-count")?.textContent,
    ).toBe("3");
    section.setBody([line("Fill"), line("Stroke")]);

    // A header that still says three over a body holding two is the same lie as
    // a count of zero on fields: the count describes the body it is attached to.
    expect(parts(section).body?.children).toHaveLength(2);
    expect(
      section.root.querySelector(".vigilia-section-count")?.textContent,
    ).toBe("2");
    expect(parts(section).summary?.textContent).toBe("Paint 2");
    expect(section.isOpen()).toBe(true);
  });

  it("empties with its body and builds again when the body comes back", () => {
    const section = propertySection({
      id: "layer",
      title: "Layer",
      body: [line("Opacity")],
      defaultOpen: false,
    });
    document.body.append(section.root);
    section.open();
    expect(section.isOpen()).toBe(true);

    section.setBody([]);

    // An emptied body is an empty section: the header goes with it rather than
    // standing over nothing.
    expect(section.root.querySelector("details")).toBeNull();
    expect(section.root.textContent).toBe("");

    section.setBody([line("Scale"), line("Rotation")]);

    // A section that disappeared has no open state to preserve, so the rebuilt
    // one is `defaultOpen` again — and its count follows the new body, not the
    // one it was constructed with.
    expect(parts(section).details).not.toBeNull();
    expect(section.isOpen()).toBe(false);
    expect(parts(section).body?.children).toHaveLength(2);
    expect(
      section.root.querySelector(".vigilia-section-count")?.textContent,
    ).toBe("2");
  });
});
