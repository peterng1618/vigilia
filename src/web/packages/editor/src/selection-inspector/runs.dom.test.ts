// @vitest-environment jsdom
import type { Binding, TextRun } from "@vigilia/renderer-core";
import { formatInstant, instantIn } from "@vigilia/renderer-core";
import { VIGILIA_TEXT_PROPERTY } from "@vigilia/scene-fabric";
import { Canvas, Textbox } from "fabric/es";
import { describe, expect, it, vi } from "vitest";
import { createRunEditor } from "./runs.js";

/**
 * A text object's runs, plus the binding store a run's reading lives in: the
 * envelope owns that, so the test stands in for the session.
 */
function harness(runs: readonly TextRun[], locale?: string) {
  const canvas = new Canvas(document.createElement("canvas"));
  const object = new Textbox("", { id: "clock-label" });
  object.set(VIGILIA_TEXT_PROPERTY, { runs });
  canvas.add(object);

  let bindings: readonly Binding[] = [];
  const host = document.createElement("div");
  const render = (): void => {
    host.replaceChildren();
    host.append(
      createRunEditor(
        {
          canvas,
          historyManager: { saveState: vi.fn() },
        } as never,
        undefined,
        object as never,
        render,
        {
          bindings: () => bindings,
          setBindings: (next) => {
            bindings = next;
          },
        },
        locale,
      ).root,
    );
  };
  render();

  const pick = <T extends HTMLElement>(selector: string): T =>
    host.querySelector<T>(selector)!;

  return {
    object,
    host,
    pick,
    render,
    runs: (): readonly TextRun[] =>
      (object.get(VIGILIA_TEXT_PROPERTY) as { runs: readonly TextRun[] }).runs,
    stored: (): readonly Binding[] => bindings,
    dispose: () => canvas.dispose(),
  };
}

const literalClock: readonly TextRun[] = [
  {
    kind: "literal",
    text: "07:24",
    typePreset: "typePresets.70-300",
    style: { color: { ref: "palette.text" } },
  },
];

/** Choosing from a select fires `change`; nothing else does. */
function choose(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change"));
}

describe("binding a text run to a sensor", () => {
  it("turns a literal run into a reading, keeping how it looks", () => {
    const box = harness(literalClock);

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );

    const [binding] = box.stored();
    expect(binding?.semanticKey).toBe("time.now");
    expect(box.runs()[0]).toMatchObject({
      kind: "value",
      bindingId: binding?.id,
      typePreset: "typePresets.70-300",
      style: { color: { ref: "palette.text" } },
    });
    return box.dispose();
  });

  it("offers a format and a zone only for a key that is an instant", () => {
    const box = harness(literalClock);
    const source = box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]');

    choose(source, "cpu.load");
    box.render();
    expect(box.host.querySelector('[data-vigilia-run-format="0"]')).toBeNull();
    expect(box.host.querySelector('[data-vigilia-run-zone="0"]')).toBeNull();

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();
    expect(
      box.host.querySelector('[data-vigilia-run-format="0"]'),
    ).not.toBeNull();
    expect(
      box.host.querySelector('[data-vigilia-run-zone="0"]'),
    ).not.toBeNull();
    return box.dispose();
  });

  it("previews the tokens as they are typed, and stores what was typed", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    const input = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    input.value = "[It is ]dddd";
    input.dispatchEvent(new Event("input"));

    // The same instant the editor's own preview source reads, so the preview is
    // the reading the run will paint rather than an example of one.
    expect(box.pick('[data-vigilia-run-format-preview="0"]').textContent).toBe(
      formatInstant(instantIn(Date.now()), "[It is ]dddd"),
    );

    input.dispatchEvent(new Event("change"));
    expect(box.stored()[0]?.format).toBe("[It is ]dddd");
    return box.dispose();
  });

  it("falls back to the key's own default when the format is cleared", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    const placeholder = box.pick<HTMLInputElement>(
      '[data-vigilia-run-format="0"]',
    ).placeholder;
    expect(placeholder).toBe("HH:mm");

    const input = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    input.value = "dddd";
    input.dispatchEvent(new Event("change"));
    box.render();

    const cleared = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    cleared.value = "";
    cleared.dispatchEvent(new Event("input"));
    expect(box.pick('[data-vigilia-run-format-preview="0"]').textContent).toBe(
      formatInstant(instantIn(Date.now()), "HH:mm"),
    );

    cleared.dispatchEvent(new Event("change"));
    expect(box.stored()[0]?.format).toBeUndefined();
    return box.dispose();
  });

  it("drops what described the reading the run no longer reads", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();
    const input = box.pick<HTMLInputElement>('[data-vigilia-run-format="0"]');
    input.value = "dddd";
    input.dispatchEvent(new Event("change"));
    box.render();
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-zone="0"]'),
      "Asia/Tokyo",
    );

    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "cpu.load",
    );

    expect(box.stored()[0]?.semanticKey).toBe("cpu.load");
    expect(box.stored()[0]?.format).toBeUndefined();
    expect(box.stored()[0]?.timeZone).toBeUndefined();
    return box.dispose();
  });

  it("reads the clock in the zone the author pinned to it", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    // Unpinned is the default: the display reads wherever its consumer is.
    const zone = box.pick<HTMLSelectElement>('[data-vigilia-run-zone="0"]');
    expect(zone.value).toBe("");

    choose(zone, "Asia/Tokyo");
    box.render();
    expect(box.stored()[0]?.timeZone).toBe("Asia/Tokyo");

    // The preview is the reading the run will paint, so pinning a zone has to
    // change what it says rather than only what is stored.
    expect(box.pick('[data-vigilia-run-format-preview="0"]').textContent).toBe(
      formatInstant(instantIn(Date.now()), "HH:mm", "Asia/Tokyo"),
    );

    choose(box.pick<HTMLSelectElement>('[data-vigilia-run-zone="0"]'), "");
    expect(box.stored()[0]?.timeZone).toBeUndefined();
    return box.dispose();
  });

  it("previews a format in the document's own language", () => {
    const editor = harness([{ kind: "value", bindingId: "clock-date" }], "ja");
    choose(
      editor.pick<HTMLSelectElement>("[data-vigilia-run-source]"),
      "date.today",
    );

    const format = editor.pick<HTMLInputElement>("[data-vigilia-run-format]");
    format.value = "dddd";
    format.dispatchEvent(new Event("input"));

    const preview = editor.pick<HTMLElement>(
      "[data-vigilia-run-format-preview]",
    ).textContent;

    // The preview must read the language the paint will, or an author chooses a
    // format against words that never appear on the dashboard. The weekday varies
    // with the day the suite runs, so the week's shape is asserted rather than a
    // fixed string: `ja` and `en` for the same instant must differ, which a
    // preview ignoring the language cannot achieve. One instant, read once: a
    // midnight rollover between the assertions must not make them disagree.
    const instant = instantIn(Date.now());

    expect(preview).toBe(formatInstant(instant, "dddd", undefined, "ja"));
    expect(preview).not.toBe(formatInstant(instant, "dddd", undefined, "en"));

    return editor.dispose();
  });

  it("writes alignment, wrap and overflow into the object's authored text", () => {
    const box = harness(literalClock);
    const content = (): Record<string, unknown> =>
      box.object.get(VIGILIA_TEXT_PROPERTY) as Record<string, unknown>;

    choose(box.pick<HTMLSelectElement>("[data-vigilia-text-align]"), "center");
    choose(box.pick<HTMLSelectElement>("[data-vigilia-text-wrap]"), "nowrap");
    choose(
      box.pick<HTMLSelectElement>("[data-vigilia-text-overflow]"),
      "ellipsis",
    );

    // These are the object's layout, which the renderer already honours; they
    // persist in the same authored content the runs do.
    expect(content()["align"]).toBe("center");
    expect(content()["wrap"]).toBe(false);
    expect(content()["overflow"]).toBe("ellipsis");
    return box.dispose();
  });

  it("shows alignment, wrap and overflow again from what was stored", () => {
    const box = harness(literalClock);
    choose(box.pick<HTMLSelectElement>("[data-vigilia-text-align]"), "right");

    // Reopening rebuilds the control from the persisted content, so a re-read
    // must show the stored choice rather than a default.
    box.render();
    expect(box.pick<HTMLSelectElement>("[data-vigilia-text-align]").value).toBe(
      "right",
    );
    return box.dispose();
  });

  it("returns a run to prose, releasing the binding it named", () => {
    const box = harness(literalClock);
    choose(
      box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'),
      "time.now",
    );
    box.render();

    choose(box.pick<HTMLSelectElement>('[data-vigilia-run-source="0"]'), "");

    expect(box.stored()).toEqual([]);
    expect(box.runs()[0]).toMatchObject({
      kind: "literal",
      typePreset: "typePresets.70-300",
    });
    return box.dispose();
  });
});
